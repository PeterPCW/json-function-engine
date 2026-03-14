import type { ConditionDefinition } from '../../types/index.js';
import { assertExistsCondition } from '../guards.js';
import { getFieldValue } from './helpers.js';

export const existsCondition: ConditionDefinition = {
  name: 'exists',
  evaluate: (config, _context, _file) => {
    assertExistsCondition(config);

    const { field } = config;
    const value = getFieldValue(field, _context);

    return {
      matched: value !== undefined && value !== null
    };
  }
};
