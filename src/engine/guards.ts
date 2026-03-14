// Type guard helpers for reducing duplication in condition/action implementations
import type {
  ConditionConfig,
  RegexConditionConfig,
  ComparisonConditionConfig,
  ExistsConditionConfig,
  CompositeConditionConfig,
  MathConditionConfig,
  ArrayConditionConfig,
  ActionConfig,
  FlagActionConfig,
  BlockActionConfig,
  TransformActionConfig,
  NotifyActionConfig
} from '../types/index.js';

// Condition type guards
export function isRegexCondition(config: ConditionConfig): config is RegexConditionConfig {
  return config.type === 'regex';
}

export function isComparisonCondition(config: ConditionConfig): config is ComparisonConditionConfig {
  return config.type === 'comparison';
}

export function isExistsCondition(config: ConditionConfig): config is ExistsConditionConfig {
  return config.type === 'exists';
}

export function isCompositeCondition(config: ConditionConfig): config is CompositeConditionConfig {
  return config.type === 'composite';
}

export function isMathCondition(config: ConditionConfig): config is MathConditionConfig {
  return config.type === 'math';
}

export function isArrayCondition(config: ConditionConfig): config is ArrayConditionConfig {
  return config.type === 'array';
}

// Action type guards
export function isFlagAction(config: ActionConfig): config is FlagActionConfig {
  return config.type === 'flag';
}

export function isBlockAction(config: ActionConfig): config is BlockActionConfig {
  return config.type === 'block';
}

export function isTransformAction(config: ActionConfig): config is TransformActionConfig {
  return config.type === 'transform';
}

export function isNotifyAction(config: ActionConfig): config is NotifyActionConfig {
  return config.type === 'notify';
}

// Assert functions for type narrowing with throw
export function assertRegexCondition(config: ConditionConfig): asserts config is RegexConditionConfig {
  if (!isRegexCondition(config)) {
    throw new Error(`Expected regex condition, got ${config.type}`);
  }
}

export function assertComparisonCondition(config: ConditionConfig): asserts config is ComparisonConditionConfig {
  if (!isComparisonCondition(config)) {
    throw new Error(`Expected comparison condition, got ${config.type}`);
  }
}

export function assertExistsCondition(config: ConditionConfig): asserts config is ExistsConditionConfig {
  if (!isExistsCondition(config)) {
    throw new Error(`Expected exists condition, got ${config.type}`);
  }
}

export function assertCompositeCondition(config: ConditionConfig): asserts config is CompositeConditionConfig {
  if (!isCompositeCondition(config)) {
    throw new Error(`Expected composite condition, got ${config.type}`);
  }
}

export function assertMathCondition(config: ConditionConfig): asserts config is MathConditionConfig {
  if (!isMathCondition(config)) {
    throw new Error(`Expected math condition, got ${config.type}`);
  }
}

export function assertArrayCondition(config: ConditionConfig): asserts config is ArrayConditionConfig {
  if (!isArrayCondition(config)) {
    throw new Error(`Expected array condition, got ${config.type}`);
  }
}

export function assertFlagAction(config: ActionConfig): asserts config is FlagActionConfig {
  if (!isFlagAction(config)) {
    throw new Error(`Expected flag action, got ${config.type}`);
  }
}

export function assertBlockAction(config: ActionConfig): asserts config is BlockActionConfig {
  if (!isBlockAction(config)) {
    throw new Error(`Expected block action, got ${config.type}`);
  }
}

export function assertTransformAction(config: ActionConfig): asserts config is TransformActionConfig {
  if (!isTransformAction(config)) {
    throw new Error(`Expected transform action, got ${config.type}`);
  }
}

export function assertNotifyAction(config: ActionConfig): asserts config is NotifyActionConfig {
  if (!isNotifyAction(config)) {
    throw new Error(`Expected notify action, got ${config.type}`);
  }
}
