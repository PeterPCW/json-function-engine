/**
 * Custom error types for json-function-engine
 * Provides granular error handling for consumers
 */

// Base error class
export class EngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'EngineError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation errors
export class ValidationError extends EngineError {
  constructor(message: string, public readonly field?: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}

// Function loading errors
export class FunctionLoadError extends EngineError {
  constructor(
    message: string,
    public readonly path?: string,
    cause?: Error
  ) {
    super(message, 'FUNCTION_LOAD_ERROR', cause);
    this.name = 'FunctionLoadError';
  }
}

// Function execution errors
export class FunctionExecutionError extends EngineError {
  constructor(
    message: string,
    public readonly functionId?: string,
    public readonly file?: string,
    cause?: Error
  ) {
    super(message, 'FUNCTION_EXECUTION_ERROR', cause);
    this.name = 'FunctionExecutionError';
  }
}

// Timeout errors
export class TimeoutError extends EngineError {
  constructor(
    message: string,
    public readonly functionId?: string,
    public readonly timeoutMs?: number
  ) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

// File errors
export class FileError extends EngineError {
  constructor(
    message: string,
    public readonly path?: string,
    cause?: Error
  ) {
    super(message, 'FILE_ERROR', cause);
    this.name = 'FileError';
  }
}

// Configuration errors
export class ConfigurationError extends EngineError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIGURATION_ERROR', cause);
    this.name = 'ConfigurationError';
  }
}

// Registry errors (unknown condition/action types)
export class RegistryError extends EngineError {
  constructor(
    message: string,
    public readonly type?: string,
    public readonly availableTypes?: string[]
  ) {
    super(message, 'REGISTRY_ERROR');
    this.name = 'RegistryError';
  }
}

// Error with context for best-effort execution
export interface ErrorContext {
  functionId?: string;
  file?: string;
  phase?: 'load' | 'validate' | 'execute' | 'format';
}
