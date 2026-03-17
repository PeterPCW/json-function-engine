import type { ActionDefinition, NotifyActionConfig, ConditionResult, FileInput, ActionResult, Severity, ActionConfig } from '../../types/index.js';
import { assertNotifyAction } from '../guards.js';
import { SEVERITY_WEIGHTS } from '../../constants.js';

// Template variables for notification messages
interface TemplateContext {
  functionId?: string;
  message?: string;
  file?: string;
  line?: number;
  severity?: string;
  matchedText?: string;
}

/**
 * Apply template variables to a notification template
 */
function applyTemplate(template: string, context: TemplateContext): string {
  return template
    .replace(/\{\{functionId\}\}/g, context.functionId ?? '')
    .replace(/\{\{message\}\}/g, context.message ?? '')
    .replace(/\{\{file\}\}/g, context.file ?? '')
    .replace(/\{\{line\}\}/g, String(context.line ?? ''))
    .replace(/\{\{severity\}\}/g, context.severity ?? '')
    .replace(/\{\{matchedText\}\}/g, context.matchedText ?? '');
}

/**
 * Get severity weight for comparison
 */
function getSeverityWeight(severity: Severity | undefined): number {
  if (!severity) return 0;
  return SEVERITY_WEIGHTS[severity] ?? 0;
}

export const notifyAction: ActionDefinition = {
  name: 'notify',
  execute: async (
    config: ActionConfig,
    context: Record<string, unknown>,
    matches: ConditionResult,
    file: FileInput
  ): Promise<ActionResult> => {
    assertNotifyAction(config);
    const cfg = config as NotifyActionConfig;

    const { channel, template, threshold } = cfg;

    // Get severity from context (set by flag/block actions)
    const severity = context.severity as Severity | undefined;

    // Check threshold - only notify if severity meets threshold
    if (threshold && severity) {
      const thresholdWeight = SEVERITY_WEIGHTS[threshold] ?? 0;
      const severityWeight = getSeverityWeight(severity);
      if (severityWeight < thresholdWeight) {
        return { success: true, notified: false };
      }
    }

    // If no matches, nothing to notify about
    if (!matches.matched) {
      return { success: true, notified: false };
    }

    // Build template context
    const templateContext: TemplateContext = {
      functionId: context.functionId as string,
      message: context.message as string,
      file: file.path,
      line: matches.matches?.[0]?.line,
      severity: severity,
      matchedText: matches.matches?.[0]?.text
    };

    // Format the notification message
    const defaultTemplate = '[{{severity}}] {{functionId}} at {{file}}:{{line}}: {{message}}';
    const message = template
      ? applyTemplate(template, templateContext)
      : applyTemplate(defaultTemplate, templateContext);

    // Handle different channels
    switch (channel) {
      case 'console':
        // Log to console
        if (severity === 'critical' || severity === 'high') {
          console.error(message);
        } else if (severity === 'medium') {
          console.warn(message);
        } else {
          console.log(message);
        }
        break;

      case 'callback':
        // Call a callback function if provided in context
        const callback = context.notifyCallback as ((msg: string) => void) | undefined;
        if (callback && typeof callback === 'function') {
          callback(message);
        } else {
          // No callback configured, treat as warning
          console.warn(`Notify action: callback channel requested but no callback configured. Message: ${message}`);
        }
        break;

      case 'event':
        // Emit an event if EventEmitter is available in context
        const emitter = context.eventEmitter as {
          emit: (event: string, data: unknown) => boolean;
        } | undefined;
        if (emitter && typeof emitter.emit === 'function') {
          emitter.emit('finding', {
            message,
            functionId: templateContext.functionId,
            file: file.path,
            severity
          });
        } else {
          console.warn(`Notify action: event channel requested but no EventEmitter configured. Message: ${message}`);
        }
        break;

      default:
        // For custom channels, users should register handlers via Registry
        // For now, log a warning about unknown channel
        console.warn(`Notify action: unknown channel '${channel}'. Custom channels can be registered via Registry.`);
        return {
          success: false,
          notified: false,
          error: `Unknown notification channel: ${channel}`
        };
    }

    return {
      success: true,
      notified: true
    };
  }
};
