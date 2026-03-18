import type {
  FunctionDefinition,
  FileInput,
  ExecutionContext,
  EngineOptions,
  Finding,
  LoadResult,
  FileSystem,
  Logger
} from '../types/index.js';
import { Registry } from './registry.js';
import { FileLoader } from './FileLoader.js';
import { Executor } from './Executor.js';
import { FindingEnricher } from './FindingEnricher.js';
import { getSeverityWeight } from '../utils/regex.js';
import { DEFAULT_TIMEOUT_MS } from '../constants.js';
import { createDefaultFileSystem, createDefaultLogger, createSilentLogger } from '../utils/factories.js';
import { type MetricsCollector } from '../utils/metrics.js';
import { ValidationError, ConfigurationError } from '../utils/errors.js';

/**
 * Error policy for execution behavior
 */
export type ErrorPolicy = 'best-effort' | 'fail-fast';

/**
 * Execution result with detailed error information
 */
export interface ExecutionResult {
  findings: Finding[];
  errors: Array<{
    functionId: string;
    file: string;
    error: string;
    phase: 'condition' | 'action';
  }>;
  success: boolean;
}

/**
 * Dependencies for Engine constructor (for dependency injection)
 */
export interface EngineDependencies {
  /** Custom registry instance */
  registry?: Registry;
  /** Custom file system implementation */
  fileSystem?: FileSystem;
  /** Custom logger implementation */
  logger?: Logger;
  /** Custom file loader implementation */
  fileLoader?: FileLoader;
  /** Custom executor implementation */
  executor?: Executor;
  /** Custom metrics collector implementation */
  metrics?: MetricsCollector;
  /** Error policy: 'best-effort' continues on errors, 'fail-fast' throws immediately */
  errorPolicy?: ErrorPolicy;
}

/**
 * Main entry point for the JSON Function Engine.
 *
 * @example
 * ```typescript
 * const engine = new Engine({ timeout: 5000, parallel: true });
 * await engine.loadFunctions('./functions.json');
 * const findings = await engine.execute(files, { cwd: '.' });
 * const output = engine.format(findings, 'json', { pretty: true });
 * ```
 */
export class Engine {
  private functions: FunctionDefinition[] = [];
  private registry: Registry;
  private fileSystem: FileSystem;
  private logger: Logger;
  private fileLoader: FileLoader;
  private executor: Executor;
  private findingEnricher: FindingEnricher;
  private options: Required<EngineOptions>;
  private errorPolicy: ErrorPolicy;

  constructor(options: EngineOptions = {}, dependencies: EngineDependencies = {}) {
    // Validate options
    if (options.timeout !== undefined && options.timeout <= 0) {
      throw new ConfigurationError('timeout must be a positive number');
    }
    if (options.parallel !== undefined && typeof options.parallel !== 'boolean') {
      throw new ConfigurationError('parallel must be a boolean');
    }
    if (options.include !== undefined && !Array.isArray(options.include)) {
      throw new ConfigurationError('include must be an array');
    }
    if (options.exclude !== undefined && !Array.isArray(options.exclude)) {
      throw new ConfigurationError('exclude must be an array');
    }

    this.registry = dependencies.registry ?? new Registry();
    this.fileSystem = dependencies.fileSystem ?? createDefaultFileSystem();
    // Use silent logger if silent option is set
    this.logger = dependencies.logger ?? (options.silent ? createSilentLogger() : createDefaultLogger());
    this.fileLoader = dependencies.fileLoader ?? new FileLoader({
      fileSystem: this.fileSystem,
      logger: this.logger
    });
    this.executor = dependencies.executor ?? new Executor(
      { registry: this.registry, logger: this.logger },
      {
        timeout: options.timeout,
        parallel: options.parallel,
        maxFileSize: options.maxFileSize,
        maxLineLength: options.maxLineLength,
        streaming: options.streaming,
        streamingThreshold: options.streamingThreshold,
        streamingIgnoreExclude: options.streamingIgnoreExclude,
        skipRegexValidation: options.skipRegexValidation
      }
    );
    this.options = {
      include: options.include || [],
      exclude: options.exclude || [],
      timeout: options.timeout || DEFAULT_TIMEOUT_MS,
      parallel: options.parallel ?? true,
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB default
      maxLineLength: options.maxLineLength ?? 10000,
      skipValidation: options.skipValidation ?? false,
      skipRegexValidation: options.skipRegexValidation ?? false,
      streaming: options.streaming ?? false,
      streamingThreshold: options.streamingThreshold ?? 1024 * 1024, // 1MB default
      streamingIgnoreExclude: options.streamingIgnoreExclude ?? false,
      silent: options.silent ?? false
    };
    this.errorPolicy = dependencies.errorPolicy ?? 'best-effort';
    this.findingEnricher = new FindingEnricher();
  }

  /**
   * Get the file loader instance for custom configuration
   * @returns FileLoader instance
   */
  getFileLoader(): FileLoader {
    return this.fileLoader;
  }

  /**
   * Get the executor instance for pipeline hooks and advanced control
   * @returns Executor instance
   */
  getExecutor(): Executor {
    return this.executor;
  }

  /**
   * Get execution metrics from the last run
   * @returns MetricsCollector with execution statistics
   */
  getMetrics(): MetricsCollector {
    return this.executor.getMetrics();
  }

  /**
   * Get execution errors from the last run
   * @returns Array of classified errors with functionId, file, error, phase, and type
   */
  getErrors(): Array<{ functionId: string; file: string; error: string; phase: 'condition' | 'action'; type: string }> {
    return this.executor.getErrors();
  }

  /**
   * Get the registry for registering custom conditions, actions, or reporters
   * @returns Registry instance
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get all loaded functions from the engine
   * @returns Array of FunctionDefinition objects
   */
  getFunctions(): FunctionDefinition[] {
    return this.functions;
  }

  /**
   * Get the count of loaded functions
   * @returns Number of functions currently loaded
   */
  getFunctionCount(): number {
    return this.functions.length;
  }

  /**
   * Add functions directly to the engine (useful for testing and programmatic use)
   * @param functions Array of function definitions to add
   */
  addFunctions(functions: FunctionDefinition[]): void {
    this.functions = [...this.functions, ...functions];
  }

  /**
   * Clear all functions from the engine
   */
  clear(): void {
    this.functions = [];
    this.fileLoader.clearCache();
  }

  /**
   * Set the error policy for execution
   * @param policy 'best-effort' continues on errors, 'fail-fast' throws immediately
   */
  setErrorPolicy(policy: ErrorPolicy): void {
    this.errorPolicy = policy;
  }

  /**
   * Get the current error policy
   */
  getErrorPolicy(): ErrorPolicy {
    return this.errorPolicy;
  }

  /**
   * Load functions from JSON files
   */
  async loadFunctions(paths: string | string[], options?: EngineOptions): Promise<LoadResult> {
    const mergedOptions = { ...this.options, ...options };

    // Use FileLoader to load and parse files
    const result = await this.fileLoader.load(paths, {
      include: mergedOptions.include,
      exclude: mergedOptions.exclude,
      skipValidation: mergedOptions.skipValidation
    });

    // Best-effort: collect errors but continue (strict mode removed)
    this.functions = result.functions;
    return { loaded: result.loaded, errors: result.errors };
  }

  async execute(
    files: FileInput[],
    context: ExecutionContext = { cwd: process.cwd() }
  ): Promise<Finding[]> {
    // Validate function definitions before execution
    this.validateFunctions();

    // Check for cancellation before starting
    if (context.signal?.aborted) {
      const error = new Error('The operation was cancelled');
      error.name = 'AbortError';
      throw error;
    }

    // Best-effort: continue on errors
    return this.executeBestEffort(files, context);
  }

  /**
   * Execute with best-effort policy - collects errors and continues
   */
  private async executeBestEffort(
    files: FileInput[],
    context: ExecutionContext
  ): Promise<Finding[]> {
    // Set up abort listener if signal provided
    let abortHandler: (() => void) | null = null;
    if (context.signal) {
      abortHandler = () => {
        this.executor.cancel();
      };
      context.signal.addEventListener('abort', abortHandler);
    }

    try {
      // Filter to enabled functions and apply framework filtering
      let enabledFunctions = this.functions.filter(f => f.enabled !== false);

      // Apply framework filtering if context has a framework specified
      if (context.framework) {
        enabledFunctions = enabledFunctions.filter(f => {
          if (f.frameworks && f.frameworks.length > 0) {
            return f.frameworks.includes(context.framework as string);
          }
          return true;
        });
      }

      // Sort by priority
      enabledFunctions = [...enabledFunctions].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

      // Use Executor to run the functions - best-effort is default in Executor
      const findings = await this.executor.execute(enabledFunctions, files, context);

      // Enrich findings with function metadata (category, recommendation, catches, fix)
      const enrichedFindings = this.findingEnricher.enrich(findings, enabledFunctions);

      // Deduplicate findings
      const uniqueFindings = this.deduplicateFindings(enrichedFindings);

      // Sort by severity
      return uniqueFindings.sort((a, b) =>
        getSeverityWeight(b.severity) - getSeverityWeight(a.severity)
      );
    } finally {
      // Clean up the listener after execution completes
      if (abortHandler && context.signal) {
        context.signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  /**
   * Validate all loaded function definitions
   * @throws ValidationError if any function definition is invalid
   */
  private validateFunctions(): void {
    for (const fn of this.functions) {
      if (!fn.id) {
        throw new ValidationError('Function definition is missing required field: id', 'id');
      }
      // Accept either condition OR conditions (not both)
      const hasCondition = fn.condition !== undefined;
      const hasConditions = fn.conditions !== undefined && fn.conditions.length > 0;

      if (!hasCondition && !hasConditions) {
        throw new ValidationError(
          `Function definition '${fn.id}' is missing required field: condition or conditions`,
          `functions.${fn.id}`
        );
      }
      if (hasCondition && hasConditions) {
        throw new ValidationError(
          `Function definition '${fn.id}' cannot use both condition and conditions`,
          `functions.${fn.id}`
        );
      }
      if (hasCondition && fn.condition && !fn.condition.type) {
        throw new ValidationError(
          `Function definition '${fn.id}' condition is missing required field: type`,
          `functions.${fn.id}.condition.type`
        );
      }
      if (hasConditions && fn.conditions) {
        for (let i = 0; i < fn.conditions.length; i++) {
          const cond = fn.conditions[i];
          if (!cond.type) {
            throw new ValidationError(
              `Function definition '${fn.id}' conditions[${i}] is missing required field: type`,
              `functions.${fn.id}.conditions[${i}].type`
            );
          }
        }
      }
      if (!fn.action) {
        throw new ValidationError(
          `Function definition '${fn.id}' is missing required field: action`,
          `functions.${fn.id}.action`
        );
      }
      if (fn.action && !fn.action.type) {
        throw new ValidationError(
          `Function definition '${fn.id}' action is missing required field: type`,
          `functions.${fn.id}.action.type`
        );
      }
    }
  }

  /**
   * Deduplicate findings based on functionId, file, line, and column
   */
  private deduplicateFindings(findings: Finding[]): Finding[] {
    // Use a Map for O(1) lookups with composite key
    // Key: functionId|file|line|column -> Finding
    // If duplicate found, keep the one with higher severity
    const seen = new Map<string, Finding>();
    const severityWeights = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      info: 1
    };

    for (const finding of findings) {
      const key = `${finding.functionId}|${finding.location.file}|${finding.location.line}|${finding.location.column ?? 0}`;

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, finding);
      } else {
        // Keep the finding with higher severity
        const existingWeight = severityWeights[existing.severity] ?? 0;
        const newWeight = severityWeights[finding.severity] ?? 0;
        if (newWeight > existingWeight) {
          seen.set(key, finding);
        }
      }
    }

    return Array.from(seen.values());
  }

  format(
    findings: Finding[],
    format: 'json' | 'text' | 'html' | 'sarif',
    options?: {
      pretty?: boolean;
      theme?: 'light' | 'dark';
      version?: string;
    }
  ): string | Promise<string> {
    return this.registry.format(findings, format, options);
  }

  async scan(
    files: FileInput[],
    format: 'json' | 'text' | 'html' | 'sarif' = 'json',
    context?: ExecutionContext,
    formatOptions?: {
      pretty?: boolean;
      theme?: 'light' | 'dark';
      version?: string;
    }
  ): Promise<string> {
    const findings = await this.execute(files, context);
    return this.format(findings, format, formatOptions);
  }
}
