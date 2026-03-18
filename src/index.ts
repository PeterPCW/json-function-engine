// Main exports for json-function-engine
export { Engine } from './engine/engine.js';
export type { EngineDependencies } from './engine/engine.js';
export { Registry } from './engine/registry.js';
export { FileLoader } from './engine/FileLoader.js';
export type { FileLoaderDependencies } from './engine/FileLoader.js';
export { FindingEnricher } from './engine/FindingEnricher.js';
export { Executor } from './engine/Executor.js';
export type { ExecutorDependencies, ExecutorOptions } from './engine/Executor.js';
export { Pipeline } from './engine/Pipeline.js';
export type { PipelineHook, PipelineHookType, PipelineData, PipelineOptions } from './engine/Pipeline.js';
export { createHook } from './engine/Pipeline.js';

// Export constants
export {
  DEFAULT_TIMEOUT_MS,
  MAX_REGEX_CACHE_SIZE,
  SEVERITY_WEIGHTS,
  DEFAULT_PARALLEL,
  DEFAULT_INCLUDE_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS
} from './constants.js';

// Export factory utilities
export { createDefaultFileSystem, createDefaultLogger, createStructuredLogger, createSilentLogger } from './utils/factories.js';
export type { StructuredLoggerOptions } from './utils/factories.js';

// Export metrics utilities
export { DefaultMetricsCollector, NoOpMetricsCollector } from './utils/metrics.js';
export type { EngineMetrics, MetricsCollector } from './utils/metrics.js';

// Export cache utilities
export { LRUCache } from './utils/cache.js';

// Export regex utilities
export { compileRegex, clearRegexCache, getRegexCacheSize, evaluateRegexCondition, matchFileExtension, runWithTimeout, getSeverityWeight, filterFunctionsByPattern } from './utils/regex.js';
export type { FunctionFilterOptions } from './utils/regex.js';

// Export error types
export {
  EngineError,
  ValidationError,
  FunctionLoadError,
  FunctionExecutionError,
  TimeoutError,
  FileError,
  ConfigurationError,
  RegistryError,
  type ErrorContext
} from './utils/errors.js';

// Re-export types
export type {
  Severity,
  Finding,
  Location,
  FunctionDefinition,
  FunctionSet,
  FileInput,
  ExecutionContext,
  EngineOptions,
  FormatOptions,
  ReporterFormat,
  ConditionConfig,
  ActionConfig,
  ConditionResult,
  ActionResult,
  ConditionDefinition,
  ActionDefinition,
  ReporterDefinition,
  // Type-safe condition/action types
  ConditionType,
  ActionType,
  AnyConditionType,
  AnyActionType,
  // Detailed types
  RegexConditionConfig,
  ComparisonConditionConfig,
  ExistsConditionConfig,
  CompositeConditionConfig,
  CompositeOperator,
  MathConditionConfig,
  MathOperator,
  ArrayConditionConfig,
  ArrayOperator,
  BaseConditionConfig,
  BaseActionConfig,
  FlagActionConfig,
  BlockActionConfig,
  TransformActionConfig,
  NotifyActionConfig,
  // Engine result types
  LoadResult,
  // DI types
  FileSystem,
  Logger,
  NodeFileSystem,
  ConsoleLogger,
  IRegistry
} from './types/index.js';
