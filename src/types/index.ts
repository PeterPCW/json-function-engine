// Core types for json-function-engine

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  functionId: string;
  category?: string;
  severity: Severity;
  message: string;
  location: {
    file: string;
    line: number;
    column?: number;
  };
  code?: string;
  metadata?: Record<string, unknown>;
  recommendation?: {
    title: string;
    description: string;
    library?: string;
  };
}

export interface Location {
  file: string;
  line: number;
  column?: number;
}

export interface FunctionDefinition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  frameworks?: string[];

  // Optional metadata fields for tools like attune
  category?: string;
  recommendation?: {
    title: string;
    description: string;
    library?: string;
  };
  catches?: string[];
  fix?: string[];

  // Condition - support both single and multiple conditions
  condition?: Condition;
  conditions?: Condition[];

  action: Action;
}

export interface FunctionSet {
  version: string;
  functions: FunctionDefinition[];
}

// Strict condition types - only built-in types
export type ConditionType = 'regex' | 'comparison' | 'exists' | 'composite' | 'math' | 'array';
// Allow custom condition types as string literals (for extensibility)
export type CustomConditionType = string & { __brand?: 'customCondition' };

export type AnyConditionType = ConditionType | CustomConditionType;

// Strict action types - only built-in types
export type ActionType = 'flag' | 'block' | 'transform' | 'notify';
// Allow custom action types as string literals (for extensibility)
export type CustomActionType = string & { __brand?: 'customAction' };

export type AnyActionType = ActionType | CustomActionType;

export type Condition = ConditionConfig;
export type Action = ActionConfig;

export interface BaseConditionConfig {
  type: AnyConditionType;
  fileExtensions?: string[];
}

export interface RegexConditionConfig extends BaseConditionConfig {
  type: 'regex';
  pattern: string;
  matchAll?: boolean;
  // Exclude matches near certain patterns (e.g., exclude matches near comments or in test files)
  excludePatterns?: string[];
  excludeRadius?: number;
}

export interface ComparisonConditionConfig extends BaseConditionConfig {
  type: 'comparison';
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'startsWith' | 'endsWith';
  field: string;
  value: unknown;
}

export interface ExistsConditionConfig extends BaseConditionConfig {
  type: 'exists';
  field: string;
}

export type CompositeOperator = 'AND' | 'OR' | 'NOT';

export interface CompositeConditionConfig extends BaseConditionConfig {
  type: 'composite';
  operator: CompositeOperator;
  conditions: ConditionConfig[];
}

export type MathOperator = '+' | '-' | '*' | '/' | '%';

export interface MathConditionConfig extends BaseConditionConfig {
  type: 'math';
  operator: MathOperator;
  left: unknown;
  right: unknown;
}

export type ArrayOperator = 'map' | 'filter' | 'reduce' | 'all' | 'none' | 'some';

export interface ArrayConditionConfig extends BaseConditionConfig {
  type: 'array';
  operator: ArrayOperator;
  field: string;
  condition?: ConditionConfig;
  initialValue?: unknown;
}

export type ConditionConfig =
  | RegexConditionConfig
  | ComparisonConditionConfig
  | ExistsConditionConfig
  | CompositeConditionConfig
  | MathConditionConfig
  | ArrayConditionConfig;

export interface BaseActionConfig {
  type: AnyActionType;
}

export interface FlagActionConfig extends BaseActionConfig {
  type: 'flag';
  severity: Severity;
  message: string;
}

export interface BlockActionConfig extends BaseActionConfig {
  type: 'block';
  message: string;
  severity?: Severity;
}

export type TransformType = 'replace' | 'remove' | 'uppercase' | 'lowercase' | 'wrap' | 'trim';

export interface TransformActionConfig extends BaseActionConfig {
  type: 'transform';
  /** The field to transform (use 'content' for file content) */
  field: string;
  /** Type of transformation: replace, remove, uppercase, lowercase, wrap, trim */
  transformation: TransformType;
  /** Replacement text for 'replace' transformation (use $1, $2 for capture groups) */
  replacement?: string;
  /** Prefix/suffix for 'wrap' transformation */
  wrapWith?: { prefix: string; suffix: string };
}

export interface NotifyActionConfig extends BaseActionConfig {
  type: 'notify';
  /** Channel to notify: 'console', 'callback', or custom channel */
  channel: string;
  /** Template for notification message. Variables: {{functionId}}, {{message}}, {{file}}, {{line}}, {{severity}} */
  template?: string;
  /** Severity threshold for notification (only notify if severity >= threshold) */
  threshold?: Severity;
  /** Callback URL for 'webhook' channel (users should register custom handlers via Registry) */
  url?: string;
}

export type ActionConfig = 
  | FlagActionConfig 
  | BlockActionConfig 
  | TransformActionConfig 
  | NotifyActionConfig;

export interface FileInput {
  path: string;
  content: string;
}

// Registry interface for type reference (avoids circular deps)
export interface IRegistry {
  evaluateCondition(config: ConditionConfig, context: ExecutionContext, file: FileInput): Promise<ConditionResult>;
  executeAction(config: ActionConfig, context: ExecutionContext, conditionResult: ConditionResult, file: FileInput): Promise<ActionResult>;
}

export interface ExecutionContext {
  cwd: string;
  framework?: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Callback for evaluating nested conditions (used by composite conditions) */
  evaluateCondition?: (config: ConditionConfig, context: ExecutionContext, file: FileInput) => Promise<ConditionResult>;
  [key: string]: unknown;
}

export interface EngineOptions {
  include?: string[];
  exclude?: string[];
  timeout?: number;
  parallel?: boolean;
  /** Maximum file size in bytes. Files larger than this will be skipped. Default: 10MB */
  maxFileSize?: number;
  /** Maximum line length to process. Lines longer than this will be truncated. Default: 10000 */
  maxLineLength?: number;
}

export interface FormatOptions {
  pretty?: boolean;
  theme?: 'light' | 'dark';
  version?: string;
}

export type ReporterFormat = 'json' | 'text' | 'html' | 'sarif';

export interface ConditionResult {
  matched: boolean;
  matches?: Array<{
    line: number;
    column: number;
    text: string;
  }>;
}

export interface ActionResult {
  success: boolean;
  findings?: Finding[];
  blocked?: boolean;
  transformed?: unknown;
  notified?: boolean;
  error?: string;
}

// Registry types
export interface ConditionDefinition {
  name: string;
  evaluate: (
    config: ConditionConfig,
    context: ExecutionContext,
    file: FileInput,
    registry?: IRegistry
  ) => ConditionResult | Promise<ConditionResult>;
}

export interface ActionDefinition {
  name: string;
  execute: (
    config: ActionConfig,
    context: ExecutionContext,
    matches: ConditionResult,
    file: FileInput
  ) => ActionResult | Promise<ActionResult>;
}

export interface ReporterDefinition {
  name: string;
  format: (
    findings: Finding[],
    options?: FormatOptions
  ) => string | Promise<string>;
}

// Engine result types
export interface LoadResult {
  loaded: number;
  errors: Array<{ path: string; error: string }>;
}

// Dependency interfaces for DI
export interface FileSystem {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<{ isDirectory(): boolean }>;
}

export interface Logger {
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// Default implementations
export class NodeFileSystem implements FileSystem {
  private fs = require('fs/promises');

  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    return this.fs.readFile(path, encoding);
  }

  async readdir(path: string): Promise<string[]> {
    return this.fs.readdir(path);
  }

  async stat(path: string): Promise<{ isDirectory(): boolean }> {
    const stats = await this.fs.stat(path);
    return { isDirectory: () => stats.isDirectory() };
  }
}

export class ConsoleLogger implements Logger {
  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.info(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }
}
