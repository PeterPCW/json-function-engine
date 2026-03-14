import type { ActionDefinition } from '../../types/index.js';
import { assertTransformAction } from '../guards.js';

export const transformAction: ActionDefinition = {
  name: 'transform',
  execute: async (config, _context, _matches, _file) => {
    assertTransformAction(config);

    // Transform is a placeholder - actual transformation depends on context
    return {
      success: true,
      transformed: null
    };
  }
};
