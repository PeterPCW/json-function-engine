import { describe, it, expect } from 'vitest';
import { validateFunctionSet } from '../utils/schema.js';

describe('Schema Validation', () => {
  // Helper to create minimal valid function
  const fn = (overrides = {}) => ({
    id: 'TEST_FUNCTION',
    condition: { type: 'regex' as const, pattern: 'test' },
    action: { type: 'flag' as const, severity: 'info' as const, message: 'test' },
    name: 'Test',
    description: 'Test function',
    enabled: true,
    priority: 1,
    ...overrides
  });

  // Helper to validate and check for single error
  const validate = (data: { version: string; functions?: unknown[] }) => validateFunctionSet(data);

  it('should accept valid function set', () => {
    expect(validate({ version: '1.0', functions: [fn()] })).toHaveLength(0);
  });

  it('should reject missing version', () => {
    const result = validate({ functions: [] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/version' }));
  });

  it('should reject invalid version', () => {
    const result = validate({ version: '2.0', functions: [] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/version', message: expect.stringContaining('must be') }));
  });

  it('should reject missing functions', () => {
    const result = validate({ version: '1.0' });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions' }));
  });

  it('should reject non-array functions', () => {
    const result = validate({ version: '1.0', functions: 'not an array' });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions', message: expect.stringContaining('array') }));
  });

  it('should reject function without id', () => {
    const result = validate({ version: '1.0', functions: [fn({ id: undefined })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/id' }));
  });

  it('should reject invalid id format', () => {
    const result = validate({ version: '1.0', functions: [fn({ id: 'lowercase' })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/id', message: expect.stringContaining('uppercase') }));
  });

  it('should reject function without condition', () => {
    const result = validate({ version: '1.0', functions: [fn({ condition: undefined })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/condition' }));
  });

  it('should reject function without action', () => {
    const result = validate({ version: '1.0', functions: [fn({ action: undefined })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/action' }));
  });

  it('should reject invalid regex pattern', () => {
    const result = validate({ version: '1.0', functions: [fn({ condition: { type: 'regex', pattern: '[invalid(' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/condition/pattern' }));
  });

  it('should reject invalid condition type', () => {
    const result = validate({ version: '1.0', functions: [fn({ condition: { type: 'unknown' as any } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/condition/type' }));
  });

  it('should reject regex without pattern', () => {
    const result = validate({ version: '1.0', functions: [fn({ condition: { type: 'regex', pattern: undefined as any } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/condition/pattern' }));
  });

  it('should reject comparison without operator', () => {
    const result = validate({ version: '1.0', functions: [fn({ condition: { type: 'comparison', field: 'test' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/condition/operator' }));
  });

  it('should reject comparison without field', () => {
    const result = validate({ version: '1.0', functions: [fn({ condition: { type: 'comparison', operator: '==' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/condition/field' }));
  });

  it('should reject exists without field', () => {
    const result = validate({ version: '1.0', functions: [fn({ condition: { type: 'exists' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/condition/field' }));
  });

  it('should reject composite without operator', () => {
    const result = validate({ version: '1.0', functions: [fn({ condition: { type: 'composite', conditions: [] } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/condition/operator' }));
  });

  it('should reject composite without conditions', () => {
    const result = validate({ version: '1.0', functions: [fn({ condition: { type: 'composite', operator: 'AND' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/condition/conditions' }));
  });

  it('should reject flag without severity', () => {
    const result = validate({ version: '1.0', functions: [fn({ action: { type: 'flag', message: 'test' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/action/severity' }));
  });

  it('should reject flag with invalid severity', () => {
    const result = validate({ version: '1.0', functions: [fn({ action: { type: 'flag', severity: 'invalid' as any, message: 'test' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/action/severity' }));
  });

  it('should reject flag without message', () => {
    const result = validate({ version: '1.0', functions: [fn({ action: { type: 'flag', severity: 'info' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/action/message' }));
  });

  it('should reject block without message', () => {
    const result = validate({ version: '1.0', functions: [fn({ action: { type: 'block' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/action/message' }));
  });

  it('should reject transform without field', () => {
    const result = validate({ version: '1.0', functions: [fn({ action: { type: 'transform', transformation: 'uppercase' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/action/field' }));
  });

  it('should reject notify without channel', () => {
    const result = validate({ version: '1.0', functions: [fn({ action: { type: 'notify' } })] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/functions/0/action/channel' }));
  });

  it('should accept optional fields', () => {
    const result = validate({
      version: '1.0',
      metadata: { name: 'test', description: 'test', author: 'test' },
      functions: [fn({ name: 'Test', description: 'Test desc', enabled: false, priority: 5, frameworks: ['react', 'vue'] })]
    });
    expect(result).toHaveLength(0);
  });

  it('should reject invalid metadata', () => {
    const result = validate({ version: '1.0', metadata: 'not an object', functions: [fn()] });
    expect(result).toContainEqual(expect.objectContaining({ path: '/metadata' }));
  });
});
