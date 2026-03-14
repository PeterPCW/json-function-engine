import type { ConditionDefinition } from '../../types/index.js';
import { assertMathCondition } from '../guards.js';

export const mathCondition: ConditionDefinition = {
  name: 'math',
  evaluate: (_config, _context, _file) => {
    assertMathCondition(_config);

    const { operator, left, right } = _config;
    const leftNum = Number(left);
    const rightNum = Number(right);

    let matched = false;
    switch (operator) {
      case '+':
        matched = leftNum + rightNum !== 0;
        break;
      case '-':
        matched = leftNum - rightNum !== 0;
        break;
      case '*':
        matched = leftNum * rightNum !== 0;
        break;
      case '/':
        matched = rightNum !== 0 && leftNum / rightNum !== 0;
        break;
      case '%':
        matched = rightNum !== 0 && leftNum % rightNum !== 0;
        break;
    }

    return { matched };
  }
};
