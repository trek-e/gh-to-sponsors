/**
 * Tests for cadence decision logic
 * TDD RED phase: Write failing tests first
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { decideCadence, updateActivityTracking, type CadenceDecision } from './detector.js';
import type { DigestState } from '../types/state.js';
import type { CadenceConfig } from '../types/config.js';

describe('decideCadence', () => {
  let baseState: DigestState;
  let baseConfig: CadenceConfig;

  beforeEach(() => {
    baseState = {
      posts: {},
      usedTokens: [],
      lastRun: '2026-02-01T00:00:00Z',
      lastActivityDate: '2026-02-01',
      consecutiveQuietDays: 0,
      cadenceMode: 'auto',
    };

    baseConfig = {
      mode: 'auto',
      weeklyDay: 1, // Monday
      quietPeriodDays: 3,
      activityThreshold: 1,
    };
  });

  describe('mode="daily"', () => {
    beforeEach(() => {
      baseConfig.mode = 'daily';
    });

    it('should generate daily digest when there is activity', () => {
      const result = decideCadence(baseState, baseConfig, true);

      expect(result).toEqual<CadenceDecision>({
        action: 'generate',
        periodType: 'daily',
        reason: expect.any(String),
      });
    });

    it('should skip when there is no activity', () => {
      const result = decideCadence(baseState, baseConfig, false);

      expect(result).toEqual<CadenceDecision>({
        action: 'skip',
        periodType: 'daily',
        reason: 'No activity',
      });
    });
  });

  describe('mode="weekly"', () => {
    beforeEach(() => {
      baseConfig.mode = 'weekly';
      baseConfig.weeklyDay = 1; // Monday
    });

    it('should generate weekly digest on correct day with activity', () => {
      // Mock Date to be a Monday
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-02T10:00:00Z')); // Monday

      const result = decideCadence(baseState, baseConfig, true);

      expect(result).toEqual<CadenceDecision>({
        action: 'generate',
        periodType: 'weekly',
        reason: expect.any(String),
      });

      vi.useRealTimers();
    });

    it('should skip on wrong day even with activity', () => {
      // Mock Date to be a Tuesday
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-03T10:00:00Z')); // Tuesday

      const result = decideCadence(baseState, baseConfig, true);

      expect(result).toEqual<CadenceDecision>({
        action: 'skip',
        periodType: 'weekly',
        reason: 'Not weekly day',
      });

      vi.useRealTimers();
    });

    it('should skip on correct day with no activity', () => {
      // Mock Date to be a Monday
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-02T10:00:00Z')); // Monday

      const result = decideCadence(baseState, baseConfig, false);

      expect(result).toEqual<CadenceDecision>({
        action: 'skip',
        periodType: 'weekly',
        reason: 'No activity',
      });

      vi.useRealTimers();
    });
  });

  describe('mode="auto"', () => {
    beforeEach(() => {
      baseConfig.mode = 'auto';
    });

    it('should generate daily when there is activity and not in quiet period', () => {
      baseState.consecutiveQuietDays = 0;

      const result = decideCadence(baseState, baseConfig, true);

      expect(result).toEqual<CadenceDecision>({
        action: 'generate',
        periodType: 'daily',
        reason: expect.any(String),
      });
      expect(result.immediate).toBeUndefined();
    });

    it('should skip when no activity and under quiet threshold', () => {
      baseState.consecutiveQuietDays = 2;

      const result = decideCadence(baseState, baseConfig, false);

      expect(result).toEqual<CadenceDecision>({
        action: 'skip',
        periodType: 'daily',
        reason: expect.any(String),
      });
    });

    it('should generate weekly when no activity and quiet period exceeded', () => {
      baseState.consecutiveQuietDays = 3; // Equal to threshold
      // Mock Date to be any day
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-02T10:00:00Z'));

      const result = decideCadence(baseState, baseConfig, false);

      expect(result).toEqual<CadenceDecision>({
        action: 'generate',
        periodType: 'weekly',
        reason: expect.any(String),
      });

      vi.useRealTimers();
    });

    it('should generate daily with immediate=true when activity resumes after quiet period', () => {
      baseState.consecutiveQuietDays = 5; // Was quiet for 5 days

      const result = decideCadence(baseState, baseConfig, true);

      expect(result).toEqual<CadenceDecision>({
        action: 'generate',
        periodType: 'daily',
        reason: expect.any(String),
        immediate: true,
      });
    });

    it('should handle exactly at quiet threshold boundary', () => {
      baseState.consecutiveQuietDays = 3; // Exactly at threshold

      const result = decideCadence(baseState, baseConfig, true);

      expect(result.action).toBe('generate');
      expect(result.immediate).toBe(true);
    });

    it('should use default quietPeriodDays=3 when not specified', () => {
      delete baseConfig.quietPeriodDays;
      baseState.consecutiveQuietDays = 3;

      const result = decideCadence(baseState, baseConfig, false);

      expect(result.action).toBe('generate');
      expect(result.periodType).toBe('weekly');
    });
  });

  describe('edge cases', () => {
    it('should handle first run with undefined tracking fields', () => {
      const firstRunState: DigestState = {
        posts: {},
        usedTokens: [],
        lastRun: '2026-02-01T00:00:00Z',
        // No tracking fields set
      };

      const result = decideCadence(firstRunState, baseConfig, true);

      expect(result.action).toBe('generate');
    });

    it('should handle undefined consecutiveQuietDays as 0', () => {
      baseState.consecutiveQuietDays = undefined;

      const result = decideCadence(baseState, baseConfig, false);

      expect(result.action).toBe('skip'); // Under quiet threshold (0 < 3)
    });

    it('should use default weeklyDay=1 when not specified', () => {
      delete baseConfig.weeklyDay;
      baseConfig.mode = 'weekly';

      // Mock to Monday
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-02T10:00:00Z')); // Monday

      const result = decideCadence(baseState, baseConfig, true);

      expect(result.action).toBe('generate');

      vi.useRealTimers();
    });
  });
});

describe('updateActivityTracking', () => {
  let baseState: DigestState;

  beforeEach(() => {
    baseState = {
      posts: {},
      usedTokens: [],
      lastRun: '2026-02-01T00:00:00Z',
      lastActivityDate: '2026-01-30',
      consecutiveQuietDays: 2,
      cadenceMode: 'auto',
    };

    // Mock Date to Feb 2
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-02T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when hasActivity=true', () => {
    it('should set lastActivityDate to today', () => {
      const result = updateActivityTracking(baseState, true);

      expect(result.lastActivityDate).toBe('2026-02-02');
    });

    it('should reset consecutiveQuietDays to 0', () => {
      const result = updateActivityTracking(baseState, true);

      expect(result.consecutiveQuietDays).toBe(0);
    });

    it('should maintain immutability - not modify original state', () => {
      const originalDays = baseState.consecutiveQuietDays;
      updateActivityTracking(baseState, true);

      expect(baseState.consecutiveQuietDays).toBe(originalDays);
    });
  });

  describe('when hasActivity=false', () => {
    it('should increment consecutiveQuietDays', () => {
      const result = updateActivityTracking(baseState, false);

      expect(result.consecutiveQuietDays).toBe(3);
    });

    it('should NOT increment if already checked today', () => {
      baseState.lastActivityDate = '2026-02-02'; // Same as mocked date
      baseState.consecutiveQuietDays = 5;

      const result = updateActivityTracking(baseState, false);

      expect(result.consecutiveQuietDays).toBe(5); // No increment
    });

    it('should not change lastActivityDate', () => {
      const result = updateActivityTracking(baseState, false);

      expect(result.lastActivityDate).toBe('2026-01-30'); // Unchanged
    });

    it('should maintain immutability - not modify original state', () => {
      const originalDays = baseState.consecutiveQuietDays;
      updateActivityTracking(baseState, false);

      expect(baseState.consecutiveQuietDays).toBe(originalDays);
    });
  });

  describe('edge cases', () => {
    it('should handle first run with no previous tracking', () => {
      const firstRunState: DigestState = {
        posts: {},
        usedTokens: [],
        lastRun: '2026-02-01T00:00:00Z',
      };

      const resultWithActivity = updateActivityTracking(firstRunState, true);
      expect(resultWithActivity.lastActivityDate).toBe('2026-02-02');
      expect(resultWithActivity.consecutiveQuietDays).toBe(0);

      const resultWithoutActivity = updateActivityTracking(firstRunState, false);
      expect(resultWithoutActivity.consecutiveQuietDays).toBe(1);
    });

    it('should preserve other state properties', () => {
      const result = updateActivityTracking(baseState, true);

      expect(result.posts).toBe(baseState.posts);
      expect(result.usedTokens).toBe(baseState.usedTokens);
      expect(result.lastRun).toBe(baseState.lastRun);
    });
  });
});
