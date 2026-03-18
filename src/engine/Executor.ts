import type { FunctionDefinition, FileInput, ExecutionContext, Finding, ConditionConfig, ActionConfig, Logger } from '../types/index.js';
import type { Registry } from './registry.js';
import { runWithTimeout } from '../utils/regex.js';
import { Pipeline, PipelineData } from './Pipeline.js';
import { DEFAULT_TIMEOUT_MS } from '../constants.js';
import { createDefaultLogger } from '../utils/factories.js';
import { DefaultMetricsCollector, type MetricsCollector } from '../utils/metrics.js';

export interface ExecutorDependencies {
  registry: Registry;
  logger?: Logger;
  metrics?: MetricsCollector;
}

export interface ExecutorOptions {
  timeout?: number;
  parallel?: boolean;
  /** Maximum file size in bytes. Files larger than this will be skipped. Default: 10MB */
  maxFileSize?: number;
  /** Maximum line length to process. Lines longer than this will be truncated. Default: 10000 */
  maxLineLength?: number;
  /** Enable streaming mode for large files. Processes line-by-line to reduce memory. Default: false */
  streaming?: boolean;
  /** File size threshold in bytes above which streaming processes line-by-line. Default: 1MB */
  streamingThreshold?: number;
  /** When true, streaming ignores excludePatterns. Default: false (excludePatterns takes precedence) */
  streamingIgnoreExclude?: boolean;
}

/**
 * Classified error information
 */
export interface ClassifiedError {
  functionId: string;
  file: string;
  error: string;
  phase: 'condition' | 'action';
  type: 'validation' | 'timeout' | 'runtime' | 'unknown';
  /** Optional stack trace for debugging */
  stack?: string;
}

export class Executor {
  private registry: Registry;
  private logger: Logger;
  private options: Required<ExecutorOptions>;
  private pipeline: Pipeline;
  private metrics: MetricsCollector;
  private errors: ClassifiedError[];
  private cancelled: boolean = false;

  constructor(dependencies: ExecutorDependencies, options: ExecutorOptions = {}) {
    if (!dependencies.registry) {
      throw new Error('Executor requires a Registry to be provided in dependencies');
    }
    this.registry = dependencies.registry;
    this.logger = dependencies.logger ?? createDefaultLogger();
    this.metrics = dependencies.metrics ?? new DefaultMetricsCollector();
    this.options = {
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      parallel: options.parallel ?? true,
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB default
      maxLineLength: options.maxLineLength ?? 10000,
      streaming: options.streaming ?? false,
      streamingThreshold: options.streamingThreshold ?? 1024 * 1024, // 1MB default
      streamingIgnoreExclude: options.streamingIgnoreExclude ?? false
    };
    this.pipeline = new Pipeline();
    this.errors = [];
  }

  /**
   * Cancel the current execution
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Check if execution was cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Reset cancelled state for next execution
   */
  private resetCancellation(): void {
    this.cancelled = false;
  }

  /**
   * Get the execution pipeline
   */
  getPipeline(): Pipeline {
    return this.pipeline;
  }

  /**
   * Preprocess files: check size limits and truncate long lines
   */
  private preprocessFiles(files: FileInput[]): FileInput[] {
    return files.map(file => {
      const content = file.content;

      // Check file size - use Buffer.byteLength for better performance than Blob
      const byteSize = Buffer.byteLength(content, 'utf-8');
      if (byteSize > this.options.maxFileSize) {
        this.logger.warn(`File ${file.path} exceeds max size (${byteSize} bytes), skipping`);
        this.metrics.increment('filesSkipped');
        return { ...file, content: '' };
      }

      // Truncate long lines
      const maxLineLength = this.options.maxLineLength;
      if (maxLineLength && maxLineLength > 0) {
        const lines = content.split('\n');
        const truncatedLines = lines.map(line => {
          if (line.length > maxLineLength) {
            return line.substring(0, maxLineLength) + '... [truncated]';
          }
          return line;
        });
        return { ...file, content: truncatedLines.join('\n') };
      }

      return file;
    });
  }

  /**
   * Execute functions against files
   */
  async execute(
    functions: FunctionDefinition[],
    files: FileInput[],
    context: ExecutionContext
  ): Promise<Finding[]> {
    this.resetCancellation(); // Reset cancelled state for new execution

    const endTimer = this.metrics.startTimer('execute');
    this.errors = []; // Reset errors for this execution
    this.metrics.increment('functionsEnabled', functions.length);
    this.metrics.increment('filesProcessed', files.length);

    const enabledFunctions = functions.filter(f => f.enabled !== false);

    // Run beforeExecute hooks
    let pipelineData: PipelineData = { files, functions: enabledFunctions };
    if (this.pipeline.hasHooks('beforeExecute')) {
      pipelineData = await this.pipeline.execute('beforeExecute', context, pipelineData);
    }

    const allFindings: Finding[] = [];

    try {
      // Pre-process files: check size and truncate long lines
      const processedFiles = this.preprocessFiles(pipelineData.files || files);

      // Process files - streaming mode processes files one at a time to reduce memory usage
      if (this.options.streaming) {
        // Check if any functions use excludePatterns (which requires full file context)
        const hasExcludePatterns = enabledFunctions.some(fn => {
          const condition = fn.condition;
          return condition && 'type' in condition &&
            condition.type === 'regex' &&
            'excludePatterns' in condition &&
            (condition as { excludePatterns?: string[] }).excludePatterns !== undefined;
        });

        // If excludePatterns is used and user hasn't opted to ignore it, disable streaming
        const useStreaming = !hasExcludePatterns || this.options.streamingIgnoreExclude;

        // Streaming mode: process files sequentially with line-by-line for large files
        for (const file of processedFiles) {
          if (this.cancelled) break;

          const fileSize = Buffer.byteLength(file.content, 'utf-8');

          // Use line-by-line streaming for files larger than threshold
          // (and only if excludePatterns doesn't prevent it)
          if (useStreaming && fileSize > this.options.streamingThreshold) {
            this.logger.info(`Streaming large file (${fileSize} bytes): ${file.path}`);
            const findings = await this.processFileStreaming(
              file.path,
              file.content,
              enabledFunctions,
              context
            );
            allFindings.push(...findings);
          } else {
            // Small file or excludePatterns requires full content - process normally
            const findings = await this.processFile(file as FileInput, enabledFunctions, context);
            allFindings.push(...findings);
          }
        }
      } else if (this.options.parallel) {
        // Standard parallel mode: process all files concurrently
        const fileResults = await Promise.all(
          processedFiles.map(f => this.processFile(f as FileInput, enabledFunctions, context))
        );
        for (const findings of fileResults) {
          allFindings.push(...findings);
        }
      } else {
        // Sequential mode: process files one at a time
        const fileResults = await this.sequentialProcess(processedFiles as FileInput[], enabledFunctions, context);
        for (const findings of fileResults) {
          allFindings.push(...findings);
        }
      }

      // Run afterExecute hooks
      if (this.pipeline.hasHooks('afterExecute')) {
        await this.pipeline.execute('afterExecute', context, { findings: allFindings });
      }

      // Track finding counts by severity
      for (const finding of allFindings) {
        this.metrics.increment('findings');
        this.metrics.increment(`findings.${finding.severity}`);
      }

      return allFindings;
    } catch (error) {
      // Run onError hooks
      if (this.pipeline.hasHooks('onError') && error instanceof Error) {
        await this.pipeline.execute('onError', context, { error, findings: allFindings });
      }
      throw error;
    } finally {
      endTimer();
    }
  }

  /**
   * Get execution errors with classification
   */
  getErrors(): ClassifiedError[] {
    return [...this.errors];
  }

  /**
   * Get the metrics collector
   */
  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  /**
   * Classify an error based on its characteristics
   */
  private classifyError(error: Error, functionId: string, file: string): ClassifiedError {
    const errorMessage = error.message.toLowerCase();

    // Check for timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return {
        functionId,
        file,
        error: error.message,
        phase: 'condition',
        type: 'timeout'
      };
    }

    // Check for validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('schema')) {
      return {
        functionId,
        file,
        error: error.message,
        phase: 'condition',
        type: 'validation'
      };
    }

    // Check for runtime errors
    if (errorMessage.includes('typeerror') || errorMessage.includes('referenceerror') || errorMessage.includes('syntaxerror')) {
      return {
        functionId,
        file,
        error: error.message,
        phase: 'action',
        type: 'runtime'
      };
    }

    // Default to unknown
    return {
      functionId,
      file,
      error: error.message,
      phase: 'action',
      type: 'unknown'
    };
  }

  /**
   * Process files sequentially
   */
  private async sequentialProcess(
    files: FileInput[],
    fns: FunctionDefinition[],
    context: ExecutionContext
  ): Promise<Finding[][]> {
    const results: Finding[][] = [];

    for (const file of files) {
      // Check for cancellation between files
      if (this.cancelled) {
        break;
      }
      const findings = await this.processFile(file, fns, context);
      results.push(findings);
    }

    return results;
  }

  /**
   * Process a single file through all enabled functions
   */
  async processFile(
    file: FileInput & { lines?: string[] },
    fns: FunctionDefinition[],
    context: ExecutionContext
  ): Promise<Finding[]> {
    const findings: Finding[] = [];
    // Note: lines in context was historically set but never consumed by conditions
    // Keeping the pattern for potential future use without the overhead of pre-splitting
    const fileContext = { ...context, file: file.path };

    for (const fn of fns) {
      // Check for cancellation between functions
      if (this.cancelled) {
        break;
      }

      this.metrics.increment('functionsExecuted');
      try {
        const result = await runWithTimeout(
          this.evaluateFunction(fn, file, fileContext),
          this.options.timeout,
          `Function ${fn.id} timed out`
        );

        if (result.findings) {
          for (const finding of result.findings) {
            finding.functionId = fn.id;
          }
          findings.push(...result.findings);
        }

        if (result.blocked) {
          this.logger.warn(`Execution blocked by function ${fn.id}: ${result.error}`);
          this.metrics.increment('blocked');
          break;
        }
      } catch (error) {
        if (error instanceof Error) {
          this.logger.warn(`Error executing function ${fn.id}:`, error);
          // Classify and track the error, including stack trace for debugging
          this.errors.push({
            ...this.classifyError(error, fn.id, file.path),
            stack: error.stack
          });
        } else {
          const errorMessage = String(error);
          this.logger.warn(`Error executing function ${fn.id}:`, error);
          this.errors.push({
            functionId: fn.id,
            file: file.path,
            error: errorMessage,
            phase: 'action',
            type: 'unknown' as const
          });
        }
        this.metrics.increment('errors');
      }
    }

    return findings;
  }

  /**
   * Process a file using streaming (line-by-line) for large files
   * This reduces memory usage by not loading entire file content into memory
   */
  async processFileStreaming(
    filePath: string,
    content: string,
    fns: FunctionDefinition[],
    context: ExecutionContext
  ): Promise<Finding[]> {
    const findings: Finding[] = [];
    const fileContext = { ...context, file: filePath };

    // Split content into lines - but only for this chunk if memory is a concern
    const lines = content.split('\n');

    // Process each line
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (this.cancelled) break;

      const line = lines[lineIdx];
      // Create a synthetic file input for just this line
      const lineFile: FileInput = {
        path: filePath,
        content: line
      };

      // Evaluate each function against this line
      for (const fn of fns) {
        if (this.cancelled) break;

        this.metrics.increment('functionsExecuted');
        try {
          const result = await runWithTimeout(
            this.evaluateFunction(fn, lineFile, fileContext),
            this.options.timeout,
            `Function ${fn.id} timed out`
          );

          if (result.findings) {
            for (const finding of result.findings) {
              finding.functionId = fn.id;
              // Adjust line number to be relative to original file
              finding.location.line = lineIdx + 1;
            }
            findings.push(...result.findings);
          }

          if (result.blocked) {
            this.logger.warn(`Execution blocked by function ${fn.id}: ${result.error}`);
            this.metrics.increment('blocked');
            break;
          }
        } catch (error) {
          if (error instanceof Error) {
            this.logger.warn(`Error executing function ${fn.id}:`, error);
            this.errors.push({
              ...this.classifyError(error, fn.id, filePath),
              stack: error.stack
            });
          } else {
            const errorMessage = String(error);
            this.logger.warn(`Error executing function ${fn.id}:`, error);
            this.errors.push({
              functionId: fn.id,
              file: filePath,
              error: errorMessage,
              phase: 'action',
              type: 'unknown' as const
            });
          }
          this.metrics.increment('errors');
        }
      }
    }

    return findings;
  }

  /**
   * Evaluate a function against a file
   */
  async evaluateFunction(
    fn: FunctionDefinition,
    file: FileInput,
    context: ExecutionContext
  ): Promise<{
    findings?: Finding[];
    blocked?: boolean;
    error?: string;
  }> {
    // Inject evaluateCondition callback into context for composite conditions
    const contextWithCallback: ExecutionContext = {
      ...context,
      evaluateCondition: (config, ctx, f) => this.registry.evaluateCondition(config, ctx, f)
    };

    // Evaluate condition(s) - support both single condition and array of conditions
    let conditionResult: import('../types/index.js').ConditionResult;

    if (fn.conditions && Array.isArray(fn.conditions)) {
      // Multiple conditions - OR them together (match if ANY matches)
      const results = await Promise.all(
        fn.conditions.map(c => this.registry.evaluateCondition(c, contextWithCallback, file))
      );

      // Combine matches from all conditions
      const matched = results.some(r => r.matched);
      const matches = results.flatMap(r => r.matches || []);

      conditionResult = { matched, matches };
    } else if (fn.condition) {
      // Single condition (backward compatible)
      conditionResult = await this.registry.evaluateCondition(
        fn.condition as ConditionConfig,
        contextWithCallback,
        file
      );
    } else {
      // No condition defined
      conditionResult = { matched: false };
    }

    // Execute action
    const actionResult = await this.registry.executeAction(
      fn.action as ActionConfig,
      contextWithCallback,
      conditionResult,
      file
    );

    // Assign function ID to findings
    if (actionResult.findings) {
      for (const finding of actionResult.findings) {
        finding.functionId = fn.id;
      }
    }

    return {
      findings: actionResult.findings,
      blocked: actionResult.blocked,
      error: actionResult.error
    };
  }

  /**
   * Set the logger (acceptable to change at runtime)
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Update options
   */
  setOptions(options: Partial<ExecutorOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
