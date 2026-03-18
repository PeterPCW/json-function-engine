/**
 * Example: How to register Attune helpers as custom actions in json-function-engine
 *
 * This shows the pattern for registering attune's helper functions as custom actions
 * so they can be used in function definitions.
 */

import type { ActionDefinition, ActionConfig, ExecutionContext, FileInput, ActionResult, Finding } from 'json-function-engine';
import type { AnalysisContext, Finding as AttuneFinding } from './src/types/index.js';

// Example helper from attune (simplified)
function findMissingHelper(
  context: { files: Array<{ path: string; content: string }> },
  params: { pattern: string; message: string }
): AttuneFinding[] {
  const findings: AttuneFinding[] = [];
  const regex = new RegExp(params.pattern);

  for (const file of context.files) {
    if (!regex.test(file.content)) {
      // Pattern NOT found - that's a finding
      findings.push({
        id: `missing-${file.path}`,
        ruleId: '',
        severity: 'medium',
        file: file.path,
        line: 1,
        message: params.message || 'Required pattern not found',
      });
    }
  }

  return findings;
}

// Example: Register a custom action in the engine
export function createHelperActions(): ActionDefinition[] {
  return [
    {
      name: 'findMissing',
      execute: async (
        config: ActionConfig,
        context: ExecutionContext,
        _conditionResult: any,
        file: FileInput
      ): Promise<ActionResult> => {
        // Extract params from config
        const params = (config as any).params || {};

        // Convert engine context to attune context
        const attuneContext = {
          files: [{ path: file.path, content: file.content }],
        };

        // Run the helper
        const findings = findMissingHelper(attuneContext, params);

        return {
          success: findings.length > 0,
          findings: findings.map(f => ({
            functionId: (config as any).type || 'findMissing',
            severity: f.severity,
            message: f.message,
            location: { file: f.file, line: f.line },
            code: f.code,
          })),
        };
      },
    },
    {
      name: 'findOnLines',
      execute: async (
        config: ActionConfig,
        context: ExecutionContext,
        _conditionResult: any,
        file: FileInput
      ): Promise<ActionResult> => {
        const params = (config as any).params || {};
        const pattern = params.pattern;
        const message = params.message || 'Pattern found';

        const regex = new RegExp(pattern, 'g');
        const matches = [];
        let match;

        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            matches.push({
              line: i + 1,
              column: 0,
              text: lines[i],
            });
          }
        }

        return {
          success: matches.length > 0,
          findings: matches.map(m => ({
            functionId: (config as any).type || 'findOnLines',
            severity: (params.severity as any) || 'medium',
            message: `${message} (${matches.length} occurrences)`,
            location: { file: file.path, line: m.line },
            code: m.text,
          })),
        };
      },
    },
  ];
}

/**
 * Example function definition that uses a helper action
 */
export const exampleWithHelper = {
  version: '1.0',
  functions: [
    {
      id: 'TS_MISSING_RETURN_TYPE',
      name: 'Exported function missing return type',
      description: 'Exported functions should have explicit return types.',
      enabled: true,
      priority: 1,
      frameworks: [],
      category: 'typescript',
      condition: {
        type: 'exists',
        field: 'content',
      },
      action: {
        // This references the registered custom action
        type: 'findMissing',
        severity: 'medium',
        message: 'Exported function should have explicit return type',
        params: {
          pattern: 'export\\s+function\\s+\\w+\\s*\\([^)]*\\)\\s*:\\s*\\w+',
          message: 'Exported function missing return type',
        },
      },
    },
  ],
};

/**
 * Example: All the fields that attune needs in the engine
 */
export const fullExample = {
  version: '1.0',
  functions: [
    {
      // Required fields
      id: 'RULE_ID',
      name: 'Rule Name',
      description: 'What this rule checks for',
      enabled: true,
      priority: 1,
      action: {
        type: 'flag',
        severity: 'medium',
        message: 'Finding message',
      },

      // Optional fields that attune uses
      frameworks: ['react', 'vue', 'nodejs'],  // Which frameworks this applies to
      category: 'security',                     // Category for grouping
      recommendation: {                         // Fix information
        title: 'How to fix',
        description: 'Detailed fix instructions',
        library: 'React',                      // Related library/framework
      },
      catches: [                                // What the rule detects (for --explain)
        'Issue 1',
        'Issue 2',
      ],
      fix: [                                   // How to fix (for --explain)
        'Step 1',
        'Step 2',
      ],

      // Condition - can be single or array
      condition: {
        type: 'regex',
        pattern: 'some.*pattern',
        fileExtensions: ['.ts', '.js'],
        excludePatterns: ['node_modules', 'dist'],
        excludeRadius: 50,
      },

      // OR multiple conditions (OR'd together)
      // conditions: [...],
    },
  ],
};
