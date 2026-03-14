// Default timeout for function execution in milliseconds
export const DEFAULT_TIMEOUT_MS = 5000;

// Regex cache limits
export const MAX_REGEX_CACHE_SIZE = 1000;

// Severity weights for sorting findings (higher = more severe)
export const SEVERITY_WEIGHTS = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1
} as const;

// Default parallel processing setting
export const DEFAULT_PARALLEL = true;

// File loading defaults
export const DEFAULT_INCLUDE_PATTERNS: string[] = [];
export const DEFAULT_EXCLUDE_PATTERNS: string[] = [];
