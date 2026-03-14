import type { ExecutionContext } from '../../types/index.js';

export function getFieldValue(field: string, context: ExecutionContext): unknown {
  const parts = field.split('.');
  let value: unknown = context;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return value;
}
