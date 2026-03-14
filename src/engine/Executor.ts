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
      parallel: options.parallel ?? true
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
      // Pre-split lines for each file
      const filesWithLines = (pipelineData.files || files).map(f => ({
        ...f,
        lines: f.content.split('\n')
      }));

      // Process files (parallel or sequential)
      const fileResults = this.options.parallel
        ? await Promise.all(filesWithLines.map(f => this.processFile(f, enabledFunctions, context)))
        : await this.sequentialProcess(filesWithLines, enabledFunctions, context);

      for (const findings of fileResults) {
        allFindings.push(...findings);
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
    files: Array<FileInput & { lines: string[] }>,
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
    file: FileInput & { lines: string[] },
    fns: FunctionDefinition[],
    context: ExecutionContext
  ): Promise<Finding[]> {
    const findings: Finding[] = [];
    const fileContext = { ...context, file: file.path, lines: file.lines };

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
          // Classify and track the error
          this.errors.push(this.classifyError(error, fn.id, file.path));
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

    // Evaluate condition
    const conditionResult = await this.registry.evaluateCondition(
      fn.condition as ConditionConfig,
      contextWithCallback,
      file
    );

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
