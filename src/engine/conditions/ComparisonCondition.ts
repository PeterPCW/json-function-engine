import type { ConditionDefinition } from '../../types/index.js';
import { assertComparisonCondition } from '../guards.js';
import { getFieldValue } from './helpers.js';

export const comparisonCondition: ConditionDefinition = {
  name: 'comparison',
  evaluate: (config, _context, _file) => {
    assertComparisonCondition(config);

    const { operator, field, value } = config;
    const fieldValue = getFieldValue(field, _context);

    let matched = false;
    switch (operator) {
      case '==':
        matched = fieldValue === value;
        break;
      case '!=':
        matched = fieldValue !== value;
        break;
      case '>':
        matched = Number(fieldValue) > Number(value);
        break;
      case '<':
        matched = Number(fieldValue) < Number(value);
        break;
      case '>=':
        matched = Number(fieldValue) >= Number(value);
        break;
      case '<=':
        matched = Number(fieldValue) <= Number(value);
        break;
      case 'contains':
        matched = String(fieldValue).includes(String(value));
        break;
      case 'startsWith':
        matched = String(fieldValue).startsWith(String(value));
        break;
      case 'endsWith':
        matched = String(fieldValue).endsWith(String(value));
        break;
    }

    return { matched };
  }
};
