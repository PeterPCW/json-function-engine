import { join } from 'path';
import type { FunctionDefinition, FunctionSet, FileSystem, Logger, ConditionConfig, RegexConditionConfig } from '../types/index.js';
import { filterFunctionsByPattern, compileRegex } from '../utils/regex.js';
import { validateFunctionSet } from '../utils/schema.js';
import { createDefaultFileSystem, createDefaultLogger } from '../utils/factories.js';
import { FileError } from '../utils/errors.js';

export interface FileLoaderDependencies {
  fileSystem?: FileSystem;
  logger?: Logger;
}

export interface ExpandedResult {
  loaded: number;
  errors: Array<{ path: string; error: string }>;
  functions: FunctionDefinition[];
}

/**
 * Validate regex patterns in condition configurations
 */
function validateRegexPatterns(functions: FunctionDefinition[]): string[] {
  const errors: string[] = [];

  for (const fn of functions) {
    if (!fn.condition) continue;

    const conditionErrors = validateConditionPatterns(fn.id, fn.condition);
    errors.push(...conditionErrors);
  }

  return errors;
}

function validateConditionPatterns(functionId: string, config: ConditionConfig, path: string = ''): string[] {
  const errors: string[] = [];

  if (config.type === 'regex') {
    const regexConfig = config as RegexConditionConfig;
    if (regexConfig.pattern) {
      try {
        new RegExp(regexConfig.pattern);
      } catch (e) {
        errors.push(`Invalid regex pattern in function '${functionId}'${path}: ${regexConfig.pattern}`);
      }
    }
  }

  // Recursively validate composite conditions
  if (config.type === 'composite' && 'conditions' in config) {
    const compositeConfig = config as { conditions: ConditionConfig[] };
    for (let i = 0; i < compositeConfig.conditions.length; i++) {
      const childErrors = validateConditionPatterns(
        functionId,
        compositeConfig.conditions[i],
        `${path}/conditions[${i}]`
      );
      errors.push(...childErrors);
    }
  }

  return errors;
}

export class FileLoader {
  private fileSystem: FileSystem;
  private logger: Logger;

  constructor(dependencies: FileLoaderDependencies = {}) {
    this.fileSystem = dependencies.fileSystem ?? createDefaultFileSystem();
    this.logger = dependencies.logger ?? createDefaultLogger();
  }

  /**
   * Load functions from JSON files
   */
  async load(
    paths: string | string[],
    options: { include?: string[]; exclude?: string[]; skipValidation?: boolean } = {}
  ): Promise<ExpandedResult> {
    const filePaths = Array.isArray(paths) ? paths : [paths];
    const { skipValidation = false } = options;

    const loadedFunctions: FunctionDefinition[] = [];
    const errors: Array<{ path: string; error: string }> = [];

    // Use parallel loading
    const loadResults = await Promise.all(
      filePaths.map(async (filePath) => {
        const expandedPaths = await this.expandGlob(filePath);
        return Promise.all(
          expandedPaths.map(async (path) => {
            try {
              return await this.loadFile(path, { skipValidation });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              return { path, error: errorMessage, functions: [] };
            }
          })
        );
      })
    );

    // Flatten results
    for (const fileResults of loadResults) {
      for (const result of fileResults) {
        if (result.error) {
          errors.push({ path: result.path, error: result.error });
          this.logger.warn(`Failed to load functions from ${result.path}:`, result.error);
        } else {
          loadedFunctions.push(...result.functions);
        }
      }
    }

    // Filter by pattern
    const filteredFunctions = filterFunctionsByPattern(
      loadedFunctions,
      options.include || [],
      options.exclude || []
    );

    return { loaded: filteredFunctions.length, errors, functions: filteredFunctions };
  }

  /**
   * Load a single file and parse its functions
   */
  async loadFile(
    path: string,
    options: { skipValidation?: boolean } = {}
  ): Promise<{ path: string; error?: string; functions: FunctionDefinition[] }> {
    const { skipValidation = false } = options;

    let content: string;
    try {
      content = await this.fileSystem.readFile(path, 'utf-8' as BufferEncoding);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new FileError(`Failed to read file '${path}': ${error.message}`, path, error);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new FileError(`Failed to parse JSON in '${path}': ${error.message}`, path, error);
    }

    // Only accept "functions" key in JSON
    const functions = (parsed.functions || []) as FunctionDefinition[];
    const functionSet = { version: parsed.version, functions: functions } as FunctionSet;

    // Validate against schema (unless skipped)
    if (!skipValidation) {
      const validationErrors = validateFunctionSet(functionSet);
      if (validationErrors.length > 0) {
        const errorMessages = validationErrors.map(e => `${e.path}: ${e.message}`).join('; ');
        return { path, error: `Schema validation failed: ${errorMessages}`, functions: [] };
      }

      // Validate regex patterns
      const regexErrors = validateRegexPatterns(functions);
      if (regexErrors.length > 0) {
        return { path, error: `Invalid regex patterns: ${regexErrors.join('; ')}`, functions: [] };
      }
    }

    return { path, functions };
  }

  /**
   * Expand glob pattern to list of file paths
   */
  async expandGlob(pattern: string): Promise<string[]> {
    const parts = pattern.split('/');
    let currentDir = '.';

    // Find the directory part
    const globIndex = parts.findIndex(p => p.includes('*') || p.includes('?'));
    if (globIndex === -1) {
      // No glob, return as-is if file exists
      try {
        await this.fileSystem.stat(pattern);
        return [pattern];
      } catch {
        return [];
      }
    }

    // Join non-glob parts as directory
    if (globIndex > 0) {
      currentDir = join(...parts.slice(0, globIndex));
    }

    const globPart = parts[globIndex];
    const remainingParts = parts.slice(globIndex + 1);

    try {
      const entries = await this.fileSystem.readdir(currentDir);
      const matches = entries.filter(name => this.matchGlob(name, globPart));

      if (remainingParts.length > 0) {
        // Recurse into matched directories
        const result: string[] = [];
        for (const match of matches) {
          const subPath = join(currentDir, match);
          const stats = await this.fileSystem.stat(subPath);
          if (stats.isDirectory()) {
            const subResults = await this.expandGlob(join(subPath, ...remainingParts));
            result.push(...subResults);
          }
        }
        return result;
      }

      return matches.map(m => join(currentDir, m));
    } catch (error) {
      // Log warning for failed glob expansion
      this.logger.warn(`Failed to expand glob pattern '${pattern}':`, error);
      return [];
    }
  }

  /**
   * Match a name against a glob pattern
   */
  private matchGlob(name: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = this.getCompiledRegex(`^${regexPattern}$`);
    return regex.test(name);
  }

  /**
   * Get compiled regex from shared cache
   */
  private getCompiledRegex(pattern: string): RegExp {
    return compileRegex(pattern);
  }

  /**
   * Clear the regex cache (delegates to shared cache)
   * @deprecated Cache is now managed by the shared LRU cache in regex.ts
   */
  clearCache(): void {
    // No-op: cache is now managed by the shared LRU cache in regex.ts
    // This method is kept for API compatibility
  }
}
