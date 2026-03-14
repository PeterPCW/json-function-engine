import type { FunctionDefinition, FileInput, ExecutionContext, Finding, Logger } from '../types/index.js';
import { createDefaultLogger } from '../utils/factories.js';

export type PipelineHookType = 'beforeLoad' | 'beforeExecute' | 'afterExecute' | 'onError';

export interface PipelineHook {
  type: PipelineHookType;
  name: string;
  handler: PipelineHandler;
}

export type PipelineHandler = (
  context: ExecutionContext,
  data: PipelineData
) => Promise<PipelineData> | PipelineData;

export interface PipelineData {
  files?: FileInput[];
  findings?: Finding[];
  functions?: FunctionDefinition[];
  error?: Error;
  result?: unknown;
}

export interface PipelineOptions {
  logger?: Logger;
  parallel?: boolean; // If true, execute hooks in parallel
}

export class Pipeline {
  private hooks: Map<PipelineHookType, PipelineHook[]> = new Map();
  private logger: Logger;
  private parallel: boolean;

  constructor(options: PipelineOptions = {}) {
    this.logger = options.logger ?? createDefaultLogger();
    this.parallel = options.parallel ?? false;
  }

  /**
   * Register a hook to the pipeline
   */
  register(hook: PipelineHook): void {
    const hooks = this.hooks.get(hook.type) || [];
    hooks.push(hook);
    this.hooks.set(hook.type, hooks);
  }

  /**
   * Unregister a hook from the pipeline
   */
  unregister(type: PipelineHookType, name: string): void {
    const hooks = this.hooks.get(type) || [];
    const filtered = hooks.filter(h => h.name !== name);
    this.hooks.set(type, filtered);
  }

  /**
   * Execute hooks of a specific type
   */
  async execute(type: PipelineHookType, context: ExecutionContext, data: PipelineData): Promise<PipelineData> {
    const hooks = this.hooks.get(type) || [];

    if (hooks.length === 0) {
      return data;
    }

    if (this.parallel) {
      // Parallel execution - run all hooks concurrently
      const results = await Promise.allSettled(
        hooks.map(hook => hook.handler(context, data))
      );

      // Get the last successful result, or original data
      let finalData = data;
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          finalData = result.value;
        } else if (result.status === 'rejected') {
          this.logger.error(`Pipeline hook failed:`, result.reason);
        }
      }
      return finalData;
    }

    // Sequential execution (default)
    let currentData = data;
    for (const hook of hooks) {
      try {
        currentData = await hook.handler(context, currentData);
      } catch (error) {
        // Log error but continue with other hooks
        this.logger.error(`Pipeline hook ${hook.name} failed:`, error);
      }
    }

    return currentData;
  }

  /**
   * Get all registered hooks
   */
  getHooks(type?: PipelineHookType): PipelineHook[] {
    if (type) {
      return this.hooks.get(type) || [];
    }
    return Array.from(this.hooks.values()).flat();
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
  }

  /**
   * Check if pipeline has hooks of a specific type
   */
  hasHooks(type: PipelineHookType): boolean {
    const hooks = this.hooks.get(type);
    return hooks ? hooks.length > 0 : false;
  }
}

/**
 * Create a pipeline hook helper
 */
export function createHook(
  type: PipelineHookType,
  name: string,
  handler: PipelineHandler
): PipelineHook {
  return { type, name, handler };
}
