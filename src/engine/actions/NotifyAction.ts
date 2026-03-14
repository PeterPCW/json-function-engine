import type { ActionDefinition } from '../../types/index.js';
import { assertNotifyAction } from '../guards.js';

export const notifyAction: ActionDefinition = {
  name: 'notify',
  execute: async (config, _context, _matches, _file) => {
    assertNotifyAction(config);

    // Notify is a placeholder - actual notification depends on integration
    return {
      success: true,
      notified: true
    };
  }
};
