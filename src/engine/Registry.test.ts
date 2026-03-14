import { describe, it, expect, beforeEach } from 'vitest';
import { Registry } from './registry.js';
import type { ConditionDefinition, ActionDefinition, ReporterDefinition } from '../types/index.js';

describe('Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  describe('conditions', () => {
    it('should register and retrieve condition', () => {
      const condition: ConditionDefinition = {
        name: 'test',
        evaluate: async () => ({ matched: false })
      };
      registry.registerCondition('test', condition);
      expect(registry.hasCondition('test')).toBe(true);
    });

    it('should return false for unregistered condition', () => {
      expect(registry.hasCondition('nonexistent')).toBe(false);
    });

    it('should allow overwriting condition (no throw)', () => {
      const condition: ConditionDefinition = {
        name: 'test',
        evaluate: async () => ({ matched: false })
      };
      registry.registerCondition('test', condition);
      // Should not throw - just overwrites
      registry.registerCondition('test', condition);
      expect(registry.hasCondition('test')).toBe(true);
    });

    it('should have built-in conditions registered', () => {
      expect(registry.hasCondition('regex')).toBe(true);
      expect(registry.hasCondition('comparison')).toBe(true);
      expect(registry.hasCondition('exists')).toBe(true);
      expect(registry.hasCondition('composite')).toBe(true);
      expect(registry.hasCondition('math')).toBe(true);
      expect(registry.hasCondition('array')).toBe(true);
    });
  });

  describe('actions', () => {
    it('should register and retrieve action', () => {
      const action: ActionDefinition = {
        name: 'test',
        execute: async () => ({ success: true })
      };
      registry.registerAction('test', action);
      expect(registry.hasAction('test')).toBe(true);
    });

    it('should return false for unregistered action', () => {
      expect(registry.hasAction('nonexistent')).toBe(false);
    });

    it('should allow overwriting action (no throw)', () => {
      const action: ActionDefinition = {
        name: 'test',
        execute: async () => ({ success: true })
      };
      registry.registerAction('test', action);
      // Should not throw - just overwrites
      registry.registerAction('test', action);
      expect(registry.hasAction('test')).toBe(true);
    });

    it('should have built-in actions registered', () => {
      expect(registry.hasAction('flag')).toBe(true);
      expect(registry.hasAction('block')).toBe(true);
      expect(registry.hasAction('transform')).toBe(true);
      expect(registry.hasAction('notify')).toBe(true);
    });
  });

  describe('reporters', () => {
    it('should register and retrieve reporter', () => {
      const reporter: ReporterDefinition = {
        name: 'test',
        format: async () => 'test output'
      };
      registry.registerReporter('test', reporter);
      expect(registry.hasReporter('test')).toBe(true);
    });

    it('should return false for unregistered reporter', () => {
      expect(registry.hasReporter('nonexistent')).toBe(false);
    });

    it('should allow overwriting reporter (no throw)', () => {
      const reporter: ReporterDefinition = {
        name: 'test',
        format: async () => 'test'
      };
      registry.registerReporter('test', reporter);
      // Should not throw - just overwrites
      registry.registerReporter('test', reporter);
      expect(registry.hasReporter('test')).toBe(true);
    });

    it('should have built-in reporters registered', () => {
      expect(registry.hasReporter('json')).toBe(true);
      expect(registry.hasReporter('text')).toBe(true);
      expect(registry.hasReporter('html')).toBe(true);
      expect(registry.hasReporter('sarif')).toBe(true);
    });
  });
});
