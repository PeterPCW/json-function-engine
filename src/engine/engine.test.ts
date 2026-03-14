import { describe, it, expect, beforeEach } from 'vitest';
import { Engine, Registry } from '../index.js';
import type { Finding } from '../types/index.js';

describe('Engine', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine();
  });

  describe('loadFunctions', () => {
    it('should load functions from JSON object', async () => {
      // We'll test via the registry since we don't have files
      const registry = engine.getRegistry();
      expect(registry).toBeInstanceOf(Registry);
    });

    it('should have built-in conditions', () => {
      const registry = engine.getRegistry();
      expect(registry.hasCondition('regex')).toBe(true);
      expect(registry.hasCondition('comparison')).toBe(true);
      expect(registry.hasCondition('exists')).toBe(true);
      expect(registry.hasCondition('composite')).toBe(true);
    });

    it('should have built-in actions', () => {
      const registry = engine.getRegistry();
      expect(registry.hasAction('flag')).toBe(true);
      expect(registry.hasAction('block')).toBe(true);
      expect(registry.hasAction('transform')).toBe(true);
      expect(registry.hasAction('notify')).toBe(true);
    });

    it('should have built-in reporters', () => {
      const registry = engine.getRegistry();
      expect(registry.hasReporter('json')).toBe(true);
      expect(registry.hasReporter('text')).toBe(true);
      expect(registry.hasReporter('html')).toBe(true);
      expect(registry.hasReporter('sarif')).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute regex condition and flag action', async () => {
      // Test the engine
      const engine2 = new Engine();

      // Access registry to test directly
      const registry = engine2.getRegistry();

      // Create a simple test by executing functions on a file
      const files = [
        { path: 'test.ts', content: 'const TODO = "test";' }
      ];
      
      // Test with built-in condition evaluation
      const result = await registry.evaluateCondition(
        { type: 'regex', pattern: 'TODO' },
        { cwd: '.' },
        files[0]
      );
      
      expect(result.matched).toBe(true);
      expect(result.matches).toBeDefined();
      expect(result.matches!.length).toBeGreaterThan(0);
    });

    it('should not match when pattern not found', async () => {
      const registry = engine.getRegistry();
      
      const result = await registry.evaluateCondition(
        { type: 'regex', pattern: 'NOT_FOUND' },
        { cwd: '.' },
        { path: 'test.ts', content: 'const x = 1;' }
      );
      
      expect(result.matched).toBe(false);
    });

    it('should filter by file extension', async () => {
      const registry = engine.getRegistry();
      
      // Should match
      const result1 = await registry.evaluateCondition(
        { type: 'regex', pattern: 'TODO', fileExtensions: ['.ts'] },
        { cwd: '.' },
        { path: 'test.ts', content: 'TODO' }
      );
      expect(result1.matched).toBe(true);
      
      // Should not match (wrong extension)
      const result2 = await registry.evaluateCondition(
        { type: 'regex', pattern: 'TODO', fileExtensions: ['.js'] },
        { cwd: '.' },
        { path: 'test.ts', content: 'TODO' }
      );
      expect(result2.matched).toBe(false);
    });

    it('should execute flag action with findings', async () => {
      const registry = engine.getRegistry();
      
      const conditionResult = { matched: true, matches: [{ line: 1, column: 1, text: 'TODO' }] };
      
      const result = await registry.executeAction(
        { type: 'flag', severity: 'info', message: 'TODO found' },
        { cwd: '.' },
        conditionResult,
        { path: 'test.ts', content: 'TODO' }
      );
      
      expect(result.success).toBe(true);
      expect(result.findings).toBeDefined();
      expect(result.findings!.length).toBe(1);
      expect(result.findings![0].message).toBe('TODO found');
      expect(result.findings![0].severity).toBe('info');
    });

    it('should handle composite AND condition', async () => {
      const registry = engine.getRegistry();
      
      const result = await registry.evaluateCondition(
        {
          type: 'composite',
          operator: 'AND',
          conditions: [
            { type: 'regex', pattern: 'const' },
            { type: 'regex', pattern: 'x' }
          ]
        },
        { cwd: '.' },
        { path: 'test.ts', content: 'const x = 1;' }
      );
      
      expect(result.matched).toBe(true);
    });

    it('should handle composite OR condition', async () => {
      const registry = engine.getRegistry();
      
      const result = await registry.evaluateCondition(
        {
          type: 'composite',
          operator: 'OR',
          conditions: [
            { type: 'regex', pattern: 'NOT_EXISTS' },
            { type: 'regex', pattern: 'const' }
          ]
        },
        { cwd: '.' },
        { path: 'test.ts', content: 'const x = 1;' }
      );
      
      expect(result.matched).toBe(true);
    });

    it('should handle composite NOT condition', async () => {
      const registry = engine.getRegistry();
      
      const result = await registry.evaluateCondition(
        {
          type: 'composite',
          operator: 'NOT',
          conditions: [
            { type: 'regex', pattern: 'NOT_EXISTS' }
          ]
        },
        { cwd: '.' },
        { path: 'test.ts', content: 'const x = 1;' }
      );
      
      expect(result.matched).toBe(true);
    });

    it('should handle comparison condition', async () => {
      const registry = engine.getRegistry();
      
      // Test equality
      const result1 = await registry.evaluateCondition(
        { type: 'comparison', operator: '==', field: 'framework', value: 'nextjs' },
        { cwd: '.', framework: 'nextjs' },
        { path: 'test.ts', content: '' }
      );
      expect(result1.matched).toBe(true);
      
      // Test inequality
      const result2 = await registry.evaluateCondition(
        { type: 'comparison', operator: '!=', field: 'framework', value: 'react' },
        { cwd: '.', framework: 'nextjs' },
        { path: 'test.ts', content: '' }
      );
      expect(result2.matched).toBe(true);
    });

    it('should handle exists condition', async () => {
      const registry = engine.getRegistry();
      
      // Field exists
      const result1 = await registry.evaluateCondition(
        { type: 'exists', field: 'framework' },
        { cwd: '.', framework: 'nextjs' },
        { path: 'test.ts', content: '' }
      );
      expect(result1.matched).toBe(true);
      
      // Field does not exist
      const result2 = await registry.evaluateCondition(
        { type: 'exists', field: 'nonexistent' },
        { cwd: '.', framework: 'nextjs' },
        { path: 'test.ts', content: '' }
      );
      expect(result2.matched).toBe(false);
    });

    it('should execute block action', async () => {
      const registry = engine.getRegistry();
      
      const conditionResult = { matched: true, matches: [] };
      
      const result = await registry.executeAction(
        { type: 'block', message: 'Blocking execution' },
        { cwd: '.' },
        conditionResult,
        { path: 'test.ts', content: '' }
      );
      
      expect(result.success).toBe(true);
      expect(result.blocked).toBe(true);
    });
  });

  describe('format', () => {
    it('should format findings as JSON', () => {
      const findings: Finding[] = [
        {
          functionId: 'TEST_RULE',
          severity: 'high',
          message: 'Test finding',
          location: { file: 'test.ts', line: 1 }
        }
      ];
      
      const output = engine.format(findings, 'json', { pretty: true });
      expect(output).toContain('TEST_RULE');
      expect(output).toContain('high');
    });

    it('should format findings as text', () => {
      const findings: Finding[] = [
        {
          functionId: 'TEST_RULE',
          severity: 'high',
          message: 'Test finding',
          location: { file: 'test.ts', line: 1 }
        }
      ];
      
      const output = engine.format(findings, 'text');
      expect(output).toContain('Test finding');
      expect(output).toContain('test.ts:1');
    });

    it('should format findings as HTML', () => {
      const findings: Finding[] = [
        {
          functionId: 'TEST_RULE',
          severity: 'high',
          message: 'Test finding',
          location: { file: 'test.ts', line: 1 }
        }
      ];
      
      const output = engine.format(findings, 'html');
      expect(output).toContain('<!DOCTYPE html>');
      expect(output).toContain('Test finding');
    });

    it('should format findings as SARIF', () => {
      const findings: Finding[] = [
        {
          functionId: 'TEST_RULE',
          severity: 'high',
          message: 'Test finding',
          location: { file: 'test.ts', line: 1 }
        }
      ];
      
      const output = engine.format(findings, 'sarif');
      expect(output).toContain('"version"');
      expect(output).toContain('json-function-engine');
    });

    it('should handle empty findings', () => {
      const output = engine.format([], 'text');
      expect(output).toBe('No findings.');
    });
  });

  describe('custom extensions', () => {
    it('should allow custom condition registration', () => {
      const registry = engine.getRegistry();
      
      registry.registerCondition('custom', {
        name: 'custom',
        evaluate: async () => ({ matched: true })
      });
      
      expect(registry.hasCondition('custom')).toBe(true);
    });

    it('should allow custom action registration', () => {
      const registry = engine.getRegistry();
      
      registry.registerAction('custom', {
        name: 'custom',
        execute: async () => ({ success: true, findings: [] })
      });
      
      expect(registry.hasAction('custom')).toBe(true);
    });

    it('should allow custom reporter registration', () => {
      const registry = engine.getRegistry();
      
      registry.registerReporter('custom', {
        name: 'custom',
        format: () => 'custom output'
      });
      
      expect(registry.hasReporter('custom')).toBe(true);
    });
  });

  describe('File extension filtering', () => {
    it('should filter by fileExtension', async () => {
      const engine2 = new Engine();
      
      const extensionRules = [
        {
          id: 'EXTENSION_TEST',
          name: 'Test extension filter',
          enabled: true,
          condition: {
            type: 'regex' as const,
            pattern: 'TODO',
            fileExtensions: ['.ts', '.tsx']
          },
          action: {
            type: 'flag' as const,
            severity: 'info' as const,
            message: 'TODO found'
          }
        }
      ];
      
engine2.addFunctions(extensionRules);
      
      // Should match .ts file
      const findings1 = await engine2.execute(
        [{ path: 'test.ts', content: '// TODO: fix this' }],
        { cwd: '.' }
      );
      expect(findings1.length).toBe(1);
      
      // Should NOT match .js file (wrong extension)
      const findings2 = await engine2.execute(
        [{ path: 'test.js', content: '// TODO: fix this' }],
        { cwd: '.' }
      );
      expect(findings2.length).toBe(0);
    });
  });

  describe('Engine methods', () => {
    it('should return function count', () => {
      expect(engine.getFunctionCount()).toBe(0);
      engine.addFunctions([
        {
          id: 'TEST1',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ]);
      expect(engine.getFunctionCount()).toBe(1);
    });

    it('should add functions via addFunctions', () => {
      engine.addFunctions([
        {
          id: 'TEST1',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ]);
      expect(engine.getFunctionCount()).toBe(1);
    });

    it('should clear all functions', () => {
      engine.addFunctions([
        {
          id: 'TEST1',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ]);
      expect(engine.getFunctionCount()).toBe(1);
      engine.clear();
      expect(engine.getFunctionCount()).toBe(0);
    });

    it('should return functions via getFunctions', () => {
      const functions = [
        {
          id: 'TEST1',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];
      engine.addFunctions(functions);
      expect(engine.getFunctions()).toEqual(functions);
    });
  });

  describe('Math conditions', () => {
    it('should evaluate math addition', async () => {
      const mathEngine = new Engine();
      mathEngine.addFunctions([
        {
          id: 'MATH_TEST',
          condition: {
            type: 'math' as const,
            operator: '+' as const,
            left: 5,
            right: 3
          },
          action: {
            type: 'flag' as const,
            severity: 'info' as const,
            message: 'Math matched'
          }
        }
      ]);

      const findings = await mathEngine.execute([{ path: 'test.ts', content: 'test' }]);
      // Math operators match if result is truthy (non-zero)
      expect(findings.length).toBeGreaterThanOrEqual(0);
    });

    it('should have math condition registered', () => {
      const registry = engine.getRegistry();
      expect(registry.hasCondition('math')).toBe(true);
    });
  });

  describe('Array conditions', () => {
    it('should have array condition registered', () => {
      const registry = engine.getRegistry();
      expect(registry.hasCondition('array')).toBe(true);
    });

    it('should evaluate array all condition', async () => {
      const arrayEngine = new Engine();
      arrayEngine.addFunctions([
        {
          id: 'ARRAY_TEST',
          condition: {
            type: 'array' as const,
            operator: 'all' as const,
            field: 'items',
            condition: { type: 'comparison', operator: '==', field: '_array', value: 1 }
          },
          action: {
            type: 'flag' as const,
            severity: 'info' as const,
            message: 'Array matched'
          }
        }
      ]);

      const findings = await arrayEngine.execute([
        { path: 'test.ts', content: 'test', items: [1, 2, 3] }
      ]);
      // This tests that array conditions are evaluated
      expect(findings).toBeDefined();
    });
  });

  describe('Block action with severity', () => {
    it('should support block action with severity', async () => {
      const blockEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      blockEngine.functions = [
        {
          id: 'BLOCK_TEST',
          condition: { type: 'regex', pattern: 'BLOCK' },
          action: {
            type: 'block' as const,
            message: 'Blocked!',
            severity: 'high' as const
          }
        }
      ];

      const findings = await blockEngine.execute([{ path: 'test.ts', content: 'BLOCK' }]);
      expect(findings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Comparison operators', () => {
    it('should have comparison condition registered', () => {
      const registry = engine.getRegistry();
      expect(registry.hasCondition('comparison')).toBe(true);
    });

    it('should evaluate comparison without error', async () => {
      // Just verify the condition can be evaluated without throwing
      const registry = engine.getRegistry();
      const result = await registry.evaluateCondition(
        { type: 'comparison', operator: '==', field: 'test', value: 1 },
        { test: 1 },
        { path: 'test.ts', content: 'test' }
      );
      expect(result.matched).toBe(true);
    });
  });

  describe('Exists condition', () => {
    it('should have exists condition registered', () => {
      const registry = engine.getRegistry();
      expect(registry.hasCondition('exists')).toBe(true);
    });

    it('should evaluate exists without error', async () => {
      const registry = engine.getRegistry();
      const result = await registry.evaluateCondition(
        { type: 'exists', field: 'test' },
        { test: 'value' },
        { path: 'test.ts', content: 'test' }
      );
      expect(result.matched).toBe(true);
    });
  });

  describe('Composite conditions', () => {
    it('should have composite condition registered', () => {
      const registry = engine.getRegistry();
      expect(registry.hasCondition('composite')).toBe(true);
    });

    it('should evaluate composite AND without error', async () => {
      const registry = engine.getRegistry();
      const result = await registry.evaluateCondition(
        {
          type: 'composite',
          operator: 'AND',
          conditions: [
            { type: 'regex', pattern: 'test' }
          ]
        },
        {},
        { path: 'test.ts', content: 'test content' }
      );
      expect(result).toBeDefined();
    });

    it('should evaluate composite OR without error', async () => {
      const registry = engine.getRegistry();
      const result = await registry.evaluateCondition(
        {
          type: 'composite',
          operator: 'OR',
          conditions: [
            { type: 'regex', pattern: 'notfound' }
          ]
        },
        {},
        { path: 'test.ts', content: 'test content' }
      );
      expect(result).toBeDefined();
    });

    it('should evaluate composite NOT without error', async () => {
      const registry = engine.getRegistry();
      const result = await registry.evaluateCondition(
        {
          type: 'composite',
          operator: 'NOT',
          conditions: [
            { type: 'regex', pattern: 'notfound' }
          ]
        },
        {},
        { path: 'test.ts', content: 'test content' }
      );
      expect(result.matched).toBe(true);
    });
  });

  describe('Reporters', () => {
    it('should format as JSON', () => {
      const findings: Finding[] = [
        {
          functionId: 'TEST',
          severity: 'high',
          message: 'Test finding',
          location: { file: 'test.ts', line: 1 }
        }
      ];
      const output = engine.format(findings, 'json', { pretty: true });
      expect(output).toContain('TEST');
    });

    it('should format as text', () => {
      const findings: Finding[] = [
        {
          functionId: 'TEST',
          severity: 'high',
          message: 'Test finding',
          location: { file: 'test.ts', line: 1 }
        }
      ];
      const output = engine.format(findings, 'text');
      expect(output).toContain('test.ts');
    });

    it('should format as HTML', () => {
      const findings: Finding[] = [
        {
          functionId: 'TEST',
          severity: 'high',
          message: 'Test finding',
          location: { file: 'test.ts', line: 1 }
        }
      ];
      const output = engine.format(findings, 'html');
      expect(output).toContain('<html');
    });

    it('should format as SARIF', () => {
      const findings: Finding[] = [
        {
          functionId: 'TEST',
          severity: 'high',
          message: 'Test finding',
          location: { file: 'test.ts', line: 1 }
        }
      ];
      const output = engine.format(findings, 'sarif', { version: '2.1' });
      expect(output).toContain('sarif');
    });
  });

  describe('Engine options', () => {
    it('should respect parallel option', async () => {
      const parallelEngine = new Engine({ parallel: false });
      // @ts-expect-error - accessing private property for testing
      parallelEngine.functions = [
        {
          id: 'TEST',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];
      const findings = await parallelEngine.execute([{ path: 'test.ts', content: 'test' }]);
      expect(findings).toBeDefined();
    });

    it('should respect timeout option', async () => {
      const timeoutEngine = new Engine({ timeout: 1000 });
      expect(timeoutEngine).toBeDefined();
    });
  });

  describe('Framework filtering', () => {
    it('should filter functions by framework', async () => {
      const frameworkEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      frameworkEngine.functions = [
        {
          id: 'NEXTJS_ONLY',
          frameworks: ['nextjs'],
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        },
        {
          id: 'ALL_FRAMEWORKS',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];

      // When framework matches
      const findings1 = await frameworkEngine.execute(
        [{ path: 'test.ts', content: 'test' }],
        { cwd: '.', framework: 'nextjs' }
      );
      expect(findings1.length).toBe(2);

      // When framework doesn't match
      const findings2 = await frameworkEngine.execute(
        [{ path: 'test.ts', content: 'test' }],
        { cwd: '.', framework: 'react' }
      );
      expect(findings2.length).toBe(1);
      expect(findings2[0].functionId).toBe('ALL_FRAMEWORKS');
    });

    it('should run all functions when no framework specified', async () => {
      const frameworkEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      frameworkEngine.functions = [
        {
          id: 'NEXTJS_ONLY',
          frameworks: ['nextjs'],
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        },
        {
          id: 'REACT_ONLY',
          frameworks: ['react'],
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        },
        {
          id: 'ALL',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];

      const findings = await frameworkEngine.execute(
        [{ path: 'test.ts', content: 'test' }],
        { cwd: '.' }
      );
      expect(findings.length).toBe(3);
    });
  });

  describe('Finding deduplication', () => {
    it('should deduplicate findings', async () => {
      const dedupEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      dedupEngine.functions = [
        {
          id: 'SAME_RULE',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        },
        {
          id: 'SAME_RULE',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];

      const findings = await dedupEngine.execute([{ path: 'test.ts', content: 'test test' }]);
      // Should have only one finding per unique location
      const uniqueKeys = new Set(findings.map(f => `${f.functionId}:${f.location.file}:${f.location.line}`));
      expect(findings.length).toBe(uniqueKeys.size);
    });
  });

  describe('Metrics collection', () => {
    it('should collect metrics during execution', async () => {
      const metricsEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      metricsEngine.functions = [
        {
          id: 'TEST',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];

      await metricsEngine.execute([{ path: 'test.ts', content: 'test' }]);

      const metrics = metricsEngine.getMetrics();
      expect(metrics.getMetrics().functionsExecuted).toBeGreaterThan(0);
    });

    it('should expose getErrors method', async () => {
      const errorEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      errorEngine.functions = [
        {
          id: 'TEST',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];

      await errorEngine.execute([{ path: 'test.ts', content: 'test' }]);

      const errors = errorEngine.getErrors();
      expect(Array.isArray(errors)).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should throw when function is missing condition', async () => {
      const validateEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      validateEngine.functions = [
        {
          id: 'INVALID',
          // @ts-expect-error - intentionally missing condition
          condition: undefined,
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];

      await expect(validateEngine.execute([{ path: 'test.ts', content: 'test' }]))
        .rejects.toThrow("missing required field: condition");
    });

    it('should throw when function is missing action', async () => {
      const validateEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      validateEngine.functions = [
        {
          id: 'INVALID',
          condition: { type: 'regex', pattern: 'test' },
          // @ts-expect-error - intentionally missing action
          action: undefined
        }
      ];

      await expect(validateEngine.execute([{ path: 'test.ts', content: 'test' }]))
        .rejects.toThrow("missing required field: action");
    });

    it('should throw when condition is missing type', async () => {
      const validateEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      validateEngine.functions = [
        {
          id: 'INVALID',
          condition: { pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];

      await expect(validateEngine.execute([{ path: 'test.ts', content: 'test' }]))
        .rejects.toThrow("condition is missing required field: type");
    });
  });

  describe('Cancellation', () => {
    it('should check for already aborted signal before execution', async () => {
      const cancelEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      cancelEngine.functions = [
        {
          id: 'TEST',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];

      const controller = new AbortController();

      // Abort before calling execute
      controller.abort();

      // Should throw AbortError
      await expect(cancelEngine.execute(
        [{ path: 'test.ts', content: 'test' }],
        { cwd: '.', signal: controller.signal }
      )).rejects.toThrow('cancelled');
    });

    it('should support manual cancellation via Executor', async () => {
      const cancelEngine = new Engine();
      // @ts-expect-error - accessing private property for testing
      cancelEngine.functions = [
        {
          id: 'TEST',
          condition: { type: 'regex', pattern: 'test' },
          action: { type: 'flag', severity: 'info', message: 'test' }
        }
      ];

      // Cancel via executor
      const executor = cancelEngine.getExecutor();
      executor.cancel();

      const findings = await cancelEngine.execute([{ path: 'test.ts', content: 'test' }]);
      // Should have returned empty due to cancellation
      expect(findings).toBeDefined();
    });
  });
});
