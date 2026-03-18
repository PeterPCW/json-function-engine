import type { Finding, FunctionDefinition } from '../types/index.js';

/**
 * Enriches findings with metadata from their source function definitions.
 *
 * This class handles adding contextual information to findings such as:
 * - category
 * - recommendation
 * - catches/fix metadata
 *
 * Separating this into its own class improves separation of concerns:
 * - Executor produces raw findings
 * - FindingEnricher adds human-readable metadata
 * - Engine orchestrates the flow
 */
export class FindingEnricher {
  /**
   * Enrich findings with metadata from their source function definitions
   * @param findings - The findings to enrich
   * @param functions - The function definitions to extract metadata from
   * @returns The enriched findings (same array, mutated)
   */
  enrich(findings: Finding[], functions: FunctionDefinition[]): Finding[] {
    // Build a map of functionId -> function for quick lookup
    const functionMap = new Map<string, FunctionDefinition>();
    for (const fn of functions) {
      functionMap.set(fn.id, fn);
    }

    // Enrich each finding with metadata from its source function
    for (const finding of findings) {
      const fn = functionMap.get(finding.functionId);
      if (!fn) continue;

      // Add category
      if (fn.category) {
        finding.category = fn.category;
      }

      // Add recommendation
      if (fn.recommendation) {
        finding.recommendation = fn.recommendation;
      }

      // Add catches and fix to metadata
      if (fn.catches || fn.fix) {
        if (!finding.metadata) finding.metadata = {};
        if (fn.catches) finding.metadata.catches = fn.catches;
        if (fn.fix) finding.metadata.fix = fn.fix;
      }
    }

    return findings;
  }
}
