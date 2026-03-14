import type { ConditionDefinition, ConditionConfig, ExecutionContext, FileInput, ConditionResult } from '../../types/index.js';
import { assertCompositeCondition } from '../guards.js';

export const compositeCondition: ConditionDefinition = {
  name: 'composite',
  // Store registry reference for fallback when context callback not provided
  evaluate: async (config, context, file, registry) => {
    assertCompositeCondition(config);

    const { operator, conditions } = config;

    // Use callback from context if provided, otherwise use registry directly
    let evaluateCondition: (config: ConditionConfig, ctx: ExecutionContext, f: FileInput) => Promise<ConditionResult>;

    if (context.evaluateCondition) {
      evaluateCondition = context.evaluateCondition;
    } else if (registry) {
      // Fallback for direct calls without context (e.g., in tests)
      evaluateCondition = (cond, ctx, f) => registry.evaluateCondition(cond, ctx, f);
    } else {
      throw new Error('Composite condition requires evaluateCondition in context or registry as fourth argument');
    }

    if (operator === 'NOT') {
      // For NOT, evaluate until we find one that matches (then NOT returns false)
      for (const condition of conditions) {
        const result = await evaluateCondition(condition, context, file);
        if (result.matched) {
          return { matched: false };
        }
      }
      return { matched: true };
    }

    if (operator === 'AND') {
      // Short-circuit: stop at first false
      for (const condition of conditions) {
        const result = await evaluateCondition(condition, context, file);
        if (!result.matched) {
          return { matched: false };
        }
      }
      return { matched: true };
    }

    // OR: short-circuit at first true
    for (const condition of conditions) {
      const result = await evaluateCondition(condition, context, file);
      if (result.matched) {
        return { matched: true };
      }
    }
    return { matched: false };
  }
};
