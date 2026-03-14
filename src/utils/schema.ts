// JSON Schema validator (draft-07 subset)
// Zero dependencies - custom implementation for validation

import { validateRegexPattern } from './regex.js';

interface SchemaError {
  path: string;
  message: string;
}

type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
interface JSONObject { [key: string]: JSONValue; }
type JSONArray = JSONValue[];

export function validateFunctionSet(data: unknown): SchemaError[] {
  const errors: SchemaError[] = [];

  if (!data || typeof data !== 'object') {
    errors.push({ path: '/', message: 'Function set must be an object' });
    return errors;
  }

  const obj = data as JSONObject;

  // Required: version
  if (!obj.version) {
    errors.push({ path: '/version', message: 'version is required' });
  } else if (obj.version !== '1.0') {
    errors.push({ path: '/version', message: 'version must be "1.0"' });
  }

  // Required: functions array
  if (!('functions' in obj)) {
    errors.push({ path: '/functions', message: 'functions array is required' });
  } else {
    const fns = obj.functions;
    if (!Array.isArray(fns)) {
      errors.push({ path: '/functions', message: 'functions must be an array' });
    } else {
      fns.forEach((fn, index) => {
        const fnErrors = validateFunction(fn, `/functions/${index}`);
        errors.push(...fnErrors);
      });
    }
  }

  // Optional: metadata
  if (obj.metadata !== undefined && (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata))) {
    errors.push({ path: '/metadata', message: 'metadata must be an object' });
  }

  return errors;
}

function validateFunction(fn: JSONValue, basePath: string): SchemaError[] {
  const errors: SchemaError[] = [];

  if (!fn || typeof fn !== 'object') {
    errors.push({ path: basePath, message: 'Function must be an object' });
    return errors;
  }

  const f = fn as JSONObject;

  // Required: id
  if (!f.id) {
    errors.push({ path: `${basePath}/id`, message: 'id is required' });
  } else if (typeof f.id !== 'string') {
    errors.push({ path: `${basePath}/id`, message: 'id must be a string' });
  } else if (!/^[A-Z0-9_]+$/.test(f.id)) {
    errors.push({ path: `${basePath}/id`, message: 'id must be uppercase letters, numbers, and underscores only' });
  }

  // Required: condition
  if (!f.condition) {
    errors.push({ path: `${basePath}/condition`, message: 'condition is required' });
  } else {
    const conditionErrors = validateCondition(f.condition, `${basePath}/condition`);
    errors.push(...conditionErrors);
  }

  // Required: action
  if (!f.action) {
    errors.push({ path: `${basePath}/action`, message: 'action is required' });
  } else {
    const actionErrors = validateAction(f.action, `${basePath}/action`);
    errors.push(...actionErrors);
  }

  // Optional fields validation
  if (f.enabled !== undefined && typeof f.enabled !== 'boolean') {
    errors.push({ path: `${basePath}/enabled`, message: 'enabled must be a boolean' });
  }

  if (f.priority !== undefined && typeof f.priority !== 'number') {
    errors.push({ path: `${basePath}/priority`, message: 'priority must be a number' });
  }

  if (f.frameworks !== undefined && (!Array.isArray(f.frameworks) || !f.frameworks.every(item => typeof item === 'string'))) {
    errors.push({ path: `${basePath}/frameworks`, message: 'frameworks must be an array of strings' });
  }

  return errors;
}

function validateCondition(condition: JSONValue, basePath: string): SchemaError[] {
  const errors: SchemaError[] = [];

  if (!condition || typeof condition !== 'object') {
    errors.push({ path: basePath, message: 'Condition must be an object' });
    return errors;
  }

  const c = condition as JSONObject;

  if (!c.type) {
    errors.push({ path: `${basePath}/type`, message: 'condition type is required' });
    return errors;
  }

  const validTypes = ['regex', 'comparison', 'exists', 'composite', 'math', 'array'];
  if (!validTypes.includes(c.type as string)) {
    errors.push({ path: `${basePath}/type`, message: `condition type must be one of: ${validTypes.join(', ')}` });
  }

  switch (c.type) {
    case 'regex':
      if (!c.pattern) {
        errors.push({ path: `${basePath}/pattern`, message: 'regex condition requires pattern' });
      } else if (typeof c.pattern !== 'string') {
        errors.push({ path: `${basePath}/pattern`, message: 'pattern must be a string' });
      }
      // Validate regex is valid and safe (ReDoS protection)
      if (c.pattern && typeof c.pattern === 'string') {
        try {
          // First check if it's a valid regex
          new RegExp(c.pattern);
          // Then validate for ReDoS patterns
          validateRegexPattern(c.pattern);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'invalid regex pattern';
          errors.push({ path: `${basePath}/pattern`, message });
        }
      }
      if (c.fileExtensions !== undefined && (!Array.isArray(c.fileExtensions) || !c.fileExtensions.every(f => typeof f === 'string'))) {
        errors.push({ path: `${basePath}/fileExtensions`, message: 'fileExtensions must be an array of strings' });
      }
      break;

    case 'comparison': {
      const validOperators = ['==', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'];
      if (!c.operator) {
        errors.push({ path: `${basePath}/operator`, message: 'comparison condition requires operator' });
      } else if (!validOperators.includes(c.operator as string)) {
        errors.push({ path: `${basePath}/operator`, message: `operator must be one of: ${validOperators.join(', ')}` });
      }
      if (!c.field) {
        errors.push({ path: `${basePath}/field`, message: 'comparison condition requires field' });
      }
      break;
    }

    case 'exists':
      if (!c.field) {
        errors.push({ path: `${basePath}/field`, message: 'exists condition requires field' });
      }
      break;

    case 'composite': {
      const validCompositeOps = ['AND', 'OR', 'NOT'];
      if (!c.operator) {
        errors.push({ path: `${basePath}/operator`, message: 'composite condition requires operator' });
      } else if (!validCompositeOps.includes(c.operator as string)) {
        errors.push({ path: `${basePath}/operator`, message: `operator must be one of: ${validCompositeOps.join(', ')}` });
      }
      if (!c.conditions || !Array.isArray(c.conditions)) {
        errors.push({ path: `${basePath}/conditions`, message: 'composite condition requires conditions array' });
      } else {
        c.conditions.forEach((cond, index) => {
          const condErrors = validateCondition(cond, `${basePath}/conditions/${index}`);
          errors.push(...condErrors);
        });
      }
      break;
    }

    case 'math':
    case 'array':
      // Will be validated when implemented
      break;
  }

  return errors;
}

function validateAction(action: JSONValue, basePath: string): SchemaError[] {
  const errors: SchemaError[] = [];

  if (!action || typeof action !== 'object') {
    errors.push({ path: basePath, message: 'Action must be an object' });
    return errors;
  }

  const a = action as JSONObject;

  if (!a.type) {
    errors.push({ path: `${basePath}/type`, message: 'action type is required' });
    return errors;
  }

  const validTypes = ['flag', 'block', 'transform', 'notify'];
  if (!validTypes.includes(a.type as string)) {
    errors.push({ path: `${basePath}/type`, message: `action type must be one of: ${validTypes.join(', ')}` });
  }

  switch (a.type) {
    case 'flag':
      if (!a.severity) {
        errors.push({ path: `${basePath}/severity`, message: 'flag action requires severity' });
      } else {
        const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
        if (!validSeverities.includes(a.severity as string)) {
          errors.push({ path: `${basePath}/severity`, message: `severity must be one of: ${validSeverities.join(', ')}` });
        }
      }
      if (!a.message) {
        errors.push({ path: `${basePath}/message`, message: 'flag action requires message' });
      }
      break;

    case 'block':
      if (!a.message) {
        errors.push({ path: `${basePath}/message`, message: 'block action requires message' });
      }
      if (a.severity !== undefined) {
        const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
        if (!validSeverities.includes(a.severity as string)) {
          errors.push({ path: `${basePath}/severity`, message: `severity must be one of: ${validSeverities.join(', ')}` });
        }
      }
      break;

    case 'transform':
      if (!a.field) {
        errors.push({ path: `${basePath}/field`, message: 'transform action requires field' });
      }
      if (!a.transformation) {
        errors.push({ path: `${basePath}/transformation`, message: 'transform action requires transformation' });
      }
      break;

    case 'notify':
      if (!a.channel) {
        errors.push({ path: `${basePath}/channel`, message: 'notify action requires channel' });
      }
      break;
  }

  return errors;
}
