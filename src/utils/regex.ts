import type { RegexConditionConfig, ConditionResult, FileInput, ExecutionContext } from '../types/index.js';
import { DEFAULT_TIMEOUT_MS, MAX_REGEX_CACHE_SIZE } from '../constants.js';
import { LRUCache } from './cache.js';

const regexCache = new LRUCache<string, RegExp>(MAX_REGEX_CACHE_SIZE);

// Regex complexity limits
const MAX_PATTERN_LENGTH = 500;
const MAX_PATTERN_GROUPS = 10;
const MAX_PATTERN_ALTERNATIONS = 10;

// Known ReDoS patterns - patterns that can cause catastrophic backtracking
const REDOS_PATTERNS = [
  { pattern: /\(\.\*\)\+/, message: 'Unbounded quantifier after group' },
  { pattern: /\(\.\+\)\+/, message: 'Unbounded quantifier after group' },
  { pattern: /\(\.\?\)\+/, message: 'Unbounded quantifier after group' },
  { pattern: /\(\.\*\)\*/, message: 'Nested quantifier' },
  { pattern: /\(\.\+\)\*/, message: 'Nested quantifier' },
  { pattern: /\(\.\?\)\*/, message: 'Nested quantifier' },
  { pattern: /\(\[^\]]+\]\+\)\+/, message: 'Character class with nested quantifier' },
  { pattern: /\(\.\{[^}]+\}\)\+/, message: 'Quantifier after group with quantifier' },
  { pattern: /\(\w\+\)\+/, message: 'Word character with nested quantifier' },
  { pattern: /\(\d\+\)\+/, message: 'Digit with nested quantifier' },
];

/**
 * Validate regex pattern for complexity and known ReDoS patterns
 * @throws Error if pattern is invalid or potentially dangerous
 */
export function validateRegexPattern(pattern: string): void {
  // Check length
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new Error(
      `Regex pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters. ` +
      `Pattern length: ${pattern.length}`
    );
  }

  // Check for known ReDoS patterns
  for (const { pattern: redosPattern, message } of REDOS_PATTERNS) {
    if (redosPattern.test(pattern)) {
      throw new Error(
        `Regex pattern contains potentially dangerous construct: ${message}. ` +
        'This pattern may cause catastrophic backtracking on certain inputs.'
      );
    }
  }

  // Count groups
  const groupMatches = pattern.match(/\((?!\?)/g);
  const groupCount = groupMatches ? groupMatches.length : 0;
  if (groupCount > MAX_PATTERN_GROUPS) {
    throw new Error(
      `Regex pattern has too many capturing groups (${groupCount}). ` +
      `Maximum allowed: ${MAX_PATTERN_GROUPS}`
    );
  }

  // Count alternations
  const alternationMatches = pattern.match(/\|/g);
  const alternationCount = alternationMatches ? alternationMatches.length : 0;
  if (alternationCount > MAX_PATTERN_ALTERNATIONS) {
    throw new Error(
      `Regex pattern has too many alternations (${alternationCount}). ` +
      `Maximum allowed: ${MAX_PATTERN_ALTERNATIONS}`
    );
  }

  // Check for nested quantifiers on same character
  const nestedQuantifierPattern = /[.+*][.+*]+/g;
  if (nestedQuantifierPattern.test(pattern)) {
    throw new Error(
      'Regex pattern contains nested quantifiers which may cause catastrophic backtracking.'
    );
  }
}

/**
 * Clear the regex cache
 */
export function clearRegexCache(): void {
  regexCache.clear();
}

/**
 * Get the number of cached regex patterns
 */
export function getRegexCacheSize(): number {
  return regexCache.size();
}

/**
 * Compile a regex pattern with validation
 * @throws Error if pattern is invalid or potentially dangerous
 */
export function compileRegex(pattern: string, _timeoutMs: number = DEFAULT_TIMEOUT_MS): RegExp {
  // Validate pattern first
  validateRegexPattern(pattern);

  const cached = regexCache.get(pattern);
  if (cached) {
    return cached;
  }

  try {
    const regex = new RegExp(pattern);
    regexCache.set(pattern, regex);
    return regex;
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Maximum time (ms) allowed for regex evaluation per line
 * Prevents ReDoS by limiting execution time
 */
const MAX_REGEX_TIME_PER_LINE_MS = 100;

/**
 * Evaluate a regex condition against a file with timeout protection
 * @throws Error if regex execution times out
 */
export function evaluateRegexCondition(
  config: RegexConditionConfig,
  _context: ExecutionContext,
  file: FileInput
): ConditionResult {
  const { pattern, matchAll = false } = config;

  // Validate and compile regex (includes ReDoS pattern validation)
  const regex = compileRegex(pattern);
  const lines = file.content.split('\n');
  const matches: Array<{ line: number; column: number; text: string }> = [];

  const startTime = performance.now();

  for (let i = 0; i < lines.length; i++) {
    // Check timeout every line
    const elapsed = performance.now() - startTime;
    const timePerLine = elapsed / (i + 1);
    const estimatedTotal = timePerLine * lines.length;

    // If we're exceeding per-line limit or estimated total exceeds limit, throw
    if (timePerLine > MAX_REGEX_TIME_PER_LINE_MS || estimatedTotal > MAX_REGEX_TIME_PER_LINE_MS * lines.length) {
      throw new Error(
        `Regex evaluation timed out: pattern '${pattern}' is taking too long. ` +
        `This may indicate a catastrophic backtracking issue. ` +
        `Processed ${i + 1} of ${lines.length} lines.`
      );
    }

    const line = lines[i];
    const match = line.match(regex);

    if (match) {
      if (matchAll) {
        let regexMatch: RegExpExecArray | null;
        let lineMatchCount = 0;
        const lineStartTime = performance.now();

        while ((regexMatch = regex.exec(line)) !== null) {
          // Check timeout every 100 matches per line
          lineMatchCount++;
          if (lineMatchCount % 100 === 0 && performance.now() - lineStartTime > MAX_REGEX_TIME_PER_LINE_MS) {
            throw new Error(
              `Regex evaluation timed out on line ${i + 1}: too many matches. ` +
              `This may indicate a catastrophic backtracking issue.`
            );
          }

          const matchIdx = regexMatch.index;
          matches.push({
            line: i + 1,
            column: matchIdx + 1,
            text: regexMatch[0]
          });
          if (regexMatch[0].length === 0) {
            // Prevent infinite loop on zero-length matches
            break;
          }
        }
      } else {
        const matchIdx = match.index ?? 0;
        matches.push({
          line: i + 1,
          column: matchIdx + 1,
          text: match[0]
        });
      }
    }
  }

  return {
    matched: matches.length > 0,
    matches
  };
}

export function matchFileExtension(
  filePath: string,
  extensions?: string[]
): boolean {
  if (!extensions || extensions.length === 0) {
    return true;
  }

  const path = filePath.toLowerCase();
  return extensions.some(ext => {
    const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return path.endsWith(normalizedExt);
  });
}

export async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function getSeverityWeight(severity: string): number {
  const weights: Record<string, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1
  };
  return weights[severity] ?? 0;
}

export interface FunctionFilterOptions {
  include?: string[];
  exclude?: string[];
}

export function filterFunctionsByPattern(
  functions: import('../types/index.js').FunctionDefinition[],
  include: string[] = [],
  exclude: string[] = []
): import('../types/index.js').FunctionDefinition[] {
  const result: import('../types/index.js').FunctionDefinition[] = [];

  for (const fn of functions) {
    const id = fn.id.toLowerCase();

    // Check exclude patterns first
    let excluded = false;
    for (const pattern of exclude) {
      const regex = compileRegex(pattern.toLowerCase());
      if (regex.test(id)) {
        excluded = true;
        break;
      }
    }
    if (excluded) {
      continue;
    }

    // If no include patterns, include all
    if (include.length === 0) {
      result.push(fn);
      continue;
    }

    // Check include patterns
    for (const pattern of include) {
      const regex = compileRegex(pattern.toLowerCase());
      if (regex.test(id)) {
        result.push(fn);
        break;
      }
    }
  }

  return result;
}
