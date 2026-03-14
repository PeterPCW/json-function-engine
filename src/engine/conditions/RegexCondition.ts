import type { ConditionDefinition } from '../../types/index.js';
import { evaluateRegexCondition } from '../../utils/regex.js';
import { assertRegexCondition } from '../guards.js';

export const regexCondition: ConditionDefinition = {
  name: 'regex',
  evaluate: (config, context, file) => {
    assertRegexCondition(config);
    return evaluateRegexCondition(config, context, file);
  }
};
