import type { ActionDefinition, TransformActionConfig, ConditionResult, FileInput, ActionResult, ActionConfig } from '../../types/index.js';
import { assertTransformAction } from '../guards.js';

export const transformAction: ActionDefinition = {
  name: 'transform',
  execute: async (
    config: ActionConfig,
    _context: Record<string, unknown>,
    matches: ConditionResult,
    file: FileInput
  ): Promise<ActionResult> => {
    assertTransformAction(config);
    const cfg = config as TransformActionConfig;

    const { field, transformation, replacement, wrapWith } = cfg;

    // Only support transforming file content for now
    if (field !== 'content') {
      return {
        success: false,
        error: `Transform action only supports 'content' field, got '${field}'`,
        transformed: undefined
      };
    }

    // If no matches, nothing to transform
    if (!matches.matched || !matches.matches || matches.matches.length === 0) {
      return {
        success: true,
        transformed: file.content
      };
    }

    let transformed = file.content;

    // Apply transformation to each match (work backwards to preserve indices)
    const sortedMatches = [...matches.matches].sort((a, b) => b.line - a.line || b.column - a.column);

    for (const match of sortedMatches) {
      // Calculate the actual index in the string
      const lines = transformed.split('\n');
      let index = 0;

      // Calculate position up to the match line
      for (let i = 0; i < match.line - 1; i++) {
        index += lines[i].length + 1; // +1 for newline
      }
      // Add the column offset
      index += match.column - 1;

      // Find the match text at this position
      const matchText = match.text;

      // Apply the transformation
      let replacementText = matchText;
      switch (transformation) {
        case 'replace':
          replacementText = replacement ?? '';
          break;
        case 'remove':
          replacementText = '';
          break;
        case 'uppercase':
          replacementText = matchText.toUpperCase();
          break;
        case 'lowercase':
          replacementText = matchText.toLowerCase();
          break;
        case 'wrap':
          if (wrapWith) {
            replacementText = `${wrapWith.prefix}${matchText}${wrapWith.suffix}`;
          }
          break;
        case 'trim':
          replacementText = matchText.trim();
          break;
      }

      // Replace the match at the calculated position
      if (index >= 0 && index <= transformed.length) {
        transformed = transformed.slice(0, index) + replacementText + transformed.slice(index + matchText.length);
      }
    }

    return {
      success: true,
      transformed
    };
  }
};
