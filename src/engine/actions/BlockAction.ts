import type { ActionDefinition } from '../../types/index.js';
import { assertBlockAction } from '../guards.js';

export const blockAction: ActionDefinition = {
  name: 'block',
  execute: async (config, _context, matches, _file) => {
    assertBlockAction(config);

    return {
      success: true,
      blocked: matches.matched,
      error: matches.matched ? config.message : undefined
    };
  }
};
