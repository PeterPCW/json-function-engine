import { describe, it, expect } from 'vitest';
import { Engine } from './engine';

// Base function template
const baseFn = (id: string, pattern: string, severity = 'low', message = 'Found') => ({
  id,
  name: id,
  description: `Test ${id}`,
  enabled: true,
  priority: 1,
  condition: { type: 'regex' as const, pattern, fileExtensions: ['.ts', '.js', '.tsx', '.jsx'] },
  action: { type: 'flag' as const, severity: severity as any, message }
});

// Helper to create many functions
const createFunctions = (count: number, template: (i: number) => ReturnType<typeof baseFn>) =>
  Array.from({ length: count }, (_, i) => template(i));

// Helper to create test files
const createFiles = (count: number, content: string) =>
  Array.from({ length: count }, (_, i) => ({
    path: `src/file${i}.ts`,
    content: content + ` // line ${i}`
  }));

describe('Performance Benchmarks', () => {
  it('should scan 44 files with 448 functions in under 5 seconds', async () => {
    const engine = new Engine();
    const categories = ['security', 'best-practices', 'performance', 'accessibility', 'i18n', 'testing', 'typescript', 'react', 'nodejs', 'css'];

    const functions = createFunctions(448, (i) => {
      const cat = categories[i % categories.length];
      return baseFn(`${cat.toUpperCase()}_${Math.floor(i / 10)}_FN`, i % 2 === 0 ? 'function\\s+\\w+' : 'const\\s+\\w+\\s*=', i % 5 === 0 ? 'high' : i % 5 === 1 ? 'medium' : 'low', `Found ${cat} issue`);
    });

    engine.addFunctions(functions);

    const fileContents = [
      'function authenticate() { return true; }',
      'const config = { apiKey: "secret" };',
      'import { useState } from "react";',
      'export function processData(data) { return data; }',
      'const handler = () => { console.log("click"); };',
      'interface User { id: number; name: string; }',
      'type Result = Success | Failure;',
      'async function fetchData() { return await fetch("/api"); }',
      'class Service { private key: string; }',
      'const arr = [1, 2, 3].map(x => x * 2);',
    ];

    const files = createFiles(44, fileContents[0]);

    const startTime = performance.now();
    const findings = await engine.execute(files);
    const duration = performance.now() - startTime;

    console.log(`\n📊 Performance: ${files.length} files, ${functions.length} functions, ${duration.toFixed(2)}ms, ${findings.length} findings`);
    expect(duration).toBeLessThan(5000);
  });

  it('should cache compiled regex patterns', async () => {
    const engine = new Engine();
    const functions = createFunctions(100, () => baseFn('CACHED_FN', 'function\\s+\\w+'));
    engine.addFunctions(functions);

    const files = [{ path: 'src/test.ts', content: 'function test() {} function test2() {}' }];

    const firstRun = await (async () => {
      const start = performance.now();
      await engine.execute(files);
      return performance.now() - start;
    })();

    const secondRun = await (async () => {
      const start = performance.now();
      await engine.execute(files);
      return performance.now() - start;
    })();

    console.log(`\n📈 Regex caching: first=${firstRun.toFixed(2)}ms, second=${secondRun.toFixed(2)}ms`);
    expect(firstRun).toBeLessThan(100);
    expect(secondRun).toBeLessThan(100);
  });

  it('should handle large files without excessive delay', async () => {
    const engine = new Engine();
    const largeContent = '// TODO: Fix this\n'.repeat(10000);

    engine.addFunctions([baseFn('LARGE_FILE_FN', 'TODO')]);
    const files = [{ path: 'src/large.ts', content: largeContent }];

    const startTime = performance.now();
    const findings = await engine.execute(files);
    const duration = performance.now() - startTime;

    console.log(`\n📄 Large file: ~${(largeContent.length / 1024).toFixed(0)}KB, ${duration.toFixed(2)}ms, ${findings.length} findings`);
    expect(duration).toBeLessThan(2000);
  });

  it('should execute efficiently with multiple files', async () => {
    const engine = new Engine();
    const functions = createFunctions(50, (i) => baseFn(`PARALLEL_FN_${i}`, `pattern${i}`));
    engine.addFunctions(functions);

    const files = createFiles(20, (_, i) => `const value${i} = "pattern${i % 50}";`);

    const startTime = performance.now();
    const findings = await engine.execute(files);
    const duration = performance.now() - startTime;

    console.log(`\n⚡ Parallel: ${files.length} files, ${functions.length} functions, ${duration.toFixed(2)}ms, ${findings.length} findings`);
    expect(duration).toBeLessThan(3000);
  });
});
