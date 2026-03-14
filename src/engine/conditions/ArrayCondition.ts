import type { ConditionDefinition, ExecutionContext, FileInput, ConditionResult, ConditionConfig as CC } from '../../types/index.js';
import { assertArrayCondition } from '../guards.js';
import { getFieldValue } from './helpers.js';

type ConditionEvaluator = (config: CC, context: ExecutionContext, file: FileInput) => Promise<ConditionResult>;

export const arrayCondition: ConditionDefinition = {
  name: 'array',
  evaluate: async (_config, context, _file) => {
    assertArrayCondition(_config);

    const { operator, field, condition } = _config;
    const fieldValue = getFieldValue(field, context);

    if (!Array.isArray(fieldValue)) {
      return { matched: false };
    }

    const evaluateCondition: ConditionEvaluator = async () => ({ matched: false });

    switch (operator) {
      case 'all': {
        if (!condition) return { matched: false };
        const results = await Promise.all(
          fieldValue.map((item, idx) =>
            evaluateCondition(
              condition,
              { ...context, [field]: item, _index: idx, _array: fieldValue },
              _file
            )
          )
        );
        return { matched: results.every(r => r.matched) };
      }
      case 'none': {
        if (!condition) return { matched: true };
        const results = await Promise.all(
          fieldValue.map((item, idx) =>
            evaluateCondition(
              condition,
              { ...context, [field]: item, _index: idx, _array: fieldValue },
              _file
            )
          )
        );
        return { matched: results.every(r => !r.matched) };
      }
      case 'some': {
        if (!condition) return { matched: fieldValue.length > 0 };
        const results = await Promise.all(
          fieldValue.map((item, idx) =>
            evaluateCondition(
              condition,
              { ...context, [field]: item, _index: idx, _array: fieldValue },
              _file
            )
          )
        );
        return { matched: results.some(r => r.matched) };
      }
      case 'filter': {
        if (!condition) return { matched: fieldValue.length > 0 };
        const results = await Promise.all(
          fieldValue.map((item, idx) =>
            evaluateCondition(
              condition,
              { ...context, [field]: item, _index: idx, _array: fieldValue },
              _file
            )
          )
        );
        const filtered = fieldValue.filter((_, idx) => results[idx].matched);
        return { matched: filtered.length > 0 };
      }
      case 'map':
      case 'reduce':
        return { matched: fieldValue.length > 0 };
      default:
        return { matched: false };
    }
  }
};
