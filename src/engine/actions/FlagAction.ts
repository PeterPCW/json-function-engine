import type { ActionDefinition, Finding } from '../../types/index.js';
import { assertFlagAction } from '../guards.js';

export const flagAction: ActionDefinition = {
  name: 'flag',
  execute: async (config, _context, matches, file) => {
    assertFlagAction(config);

    const { severity, message } = config;
    const findings: Finding[] = [];

    if (matches.matched && matches.matches) {
      for (const match of matches.matches) {
        findings.push({
          functionId: '',
          severity,
          message,
          location: {
            file: file.path,
            line: match.line,
            column: match.column
          },
          code: match.text
        });
      }
    }

    return {
      success: true,
      findings
    };
  }
};
