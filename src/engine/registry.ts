import type {
  ConditionDefinition,
  ActionDefinition,
  ReporterDefinition,
  ConditionConfig,
  ActionConfig,
  ReporterFormat,
  ExecutionContext,
  FileInput,
  ConditionResult,
  ActionResult,
  Finding,
  FormatOptions
} from '../types/index.js';
import { matchFileExtension } from '../utils/regex.js';
import { RegistryError } from '../utils/errors.js';
import {
  regexCondition,
  comparisonCondition,
  existsCondition,
  compositeCondition,
  mathCondition,
  arrayCondition
} from './conditions/index.js';
import {
  flagAction,
  blockAction,
  transformAction,
  notifyAction
} from './actions/index.js';
import { builtInReporters } from './reporters/index.js';

export class Registry {
  private conditions: Map<string, ConditionDefinition> = new Map();
  private actions: Map<string, ActionDefinition> = new Map();
  private reporters: Map<string, ReporterDefinition> = new Map();

  constructor() {
    this.registerBuiltInConditions();
    this.registerBuiltInActions();
    this.registerBuiltInReporters();
  }

  private registerBuiltInConditions(): void {
    this.registerCondition('regex', regexCondition);
    this.registerCondition('comparison', comparisonCondition);
    this.registerCondition('exists', existsCondition);
    this.registerCondition('composite', compositeCondition);
    this.registerCondition('math', mathCondition);
    this.registerCondition('array', arrayCondition);
  }

  private registerBuiltInActions(): void {
    this.registerAction('flag', flagAction);
    this.registerAction('block', blockAction);
    this.registerAction('transform', transformAction);
    this.registerAction('notify', notifyAction);
  }

  private registerBuiltInReporters(): void {
    // Register all built-in reporters from separate module
    for (const [name, reporter] of Object.entries(builtInReporters)) {
      this.registerReporter(name, reporter);
    }
  }

  // Public methods for custom registration
  registerCondition(name: string, definition: ConditionDefinition): void {
    this.conditions.set(name, definition);
  }

  registerAction(name: string, definition: ActionDefinition): void {
    this.actions.set(name, definition);
  }

  registerReporter(name: string, definition: ReporterDefinition): void {
    this.reporters.set(name, definition);
  }

  hasCondition(type: string): boolean {
    return this.conditions.has(type);
  }

  hasAction(type: string): boolean {
    return this.actions.has(type);
  }

  hasReporter(type: string): boolean {
    return this.reporters.has(type);
  }

  async evaluateCondition(
    config: ConditionConfig,
    context: ExecutionContext,
    file: FileInput
  ): Promise<ConditionResult> {
    // Check file extension filter
    if (!matchFileExtension(file.path, config.fileExtensions)) {
      return { matched: false };
    }

    const definition = this.conditions.get(config.type);
    if (!definition) {
      throw new RegistryError(
        `Unknown condition type: '${config.type}' for file '${file.path}'. ` +
        `Available types: ${Array.from(this.conditions.keys()).join(', ')}`,
        config.type,
        Array.from(this.conditions.keys())
      );
    }

    // Pass registry reference to conditions that need it (like composite)
    return definition.evaluate(config, context, file, this);
  }

  async executeAction(
    config: ActionConfig,
    context: ExecutionContext,
    conditionResult: ConditionResult,
    file: FileInput
  ): Promise<ActionResult> {
    const definition = this.actions.get(config.type);
    if (!definition) {
      throw new RegistryError(
        `Unknown action type: '${config.type}' for file '${file.path}'. ` +
        `Available types: ${Array.from(this.actions.keys()).join(', ')}`,
        config.type,
        Array.from(this.actions.keys())
      );
    }

    return definition.execute(config, context, conditionResult, file);
  }

  format(findings: Finding[], format: ReporterFormat, options?: FormatOptions): string | Promise<string> {
    const definition = this.reporters.get(format);
    if (!definition) {
      throw new RegistryError(
        `Unknown reporter format: '${format}'. ` +
        `Available formats: ${Array.from(this.reporters.keys()).join(', ')}`,
        format,
        Array.from(this.reporters.keys())
      );
    }

    return definition.format(findings, options);
  }

  getConditionNames(): string[] {
    return Array.from(this.conditions.keys());
  }

  getActionNames(): string[] {
    return Array.from(this.actions.keys());
  }

  getReporterNames(): string[] {
    return Array.from(this.reporters.keys());
  }
}
