/**
 * Cadence decision logic
 * Determines when to generate daily/weekly digests or skip entirely
 */

import type { DigestState } from '../types/state.js';
import type { CadenceConfig } from '../types/config.js';

/** Default values for cadence configuration */
const DEFAULTS = {
  weeklyDay: 1, // Monday
  quietPeriodDays: 3,
} as const;

/** Result of cadence decision */
export interface CadenceDecision {
  action: 'generate' | 'skip';
  periodType: 'daily' | 'weekly';
  reason: string;
  /** True when resuming after quiet period (immediate catch-up) */
  immediate?: boolean;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current day of week (0 = Sunday, 1 = Monday, etc.)
 */
function getTodayDayOfWeek(): number {
  return new Date().getUTCDay();
}

/**
 * Decide whether to generate a digest based on cadence mode and activity
 */
export function decideCadence(
  state: DigestState,
  config: CadenceConfig,
  hasActivity: boolean
): CadenceDecision {
  const mode = config.mode;
  const quietPeriodDays = config.quietPeriodDays ?? DEFAULTS.quietPeriodDays;
  const consecutiveQuietDays = state.consecutiveQuietDays ?? 0;

  switch (mode) {
    case 'daily':
      return handleDailyMode(hasActivity);

    case 'weekly':
      return handleWeeklyMode(config, hasActivity);

    case 'auto':
      return handleAutoMode(hasActivity, consecutiveQuietDays, quietPeriodDays);

    default:
      // TypeScript exhaustive check
      const _exhaustive: never = mode;
      throw new Error(`Unknown cadence mode: ${_exhaustive}`);
  }
}

/**
 * Handle daily mode: generate if activity, skip otherwise
 */
function handleDailyMode(hasActivity: boolean): CadenceDecision {
  if (hasActivity) {
    return {
      action: 'generate',
      periodType: 'daily',
      reason: 'Daily mode with activity',
    };
  }

  return {
    action: 'skip',
    periodType: 'daily',
    reason: 'No activity',
  };
}

/**
 * Handle weekly mode: check if today is the weekly day
 */
function handleWeeklyMode(config: CadenceConfig, hasActivity: boolean): CadenceDecision {
  const weeklyDay = config.weeklyDay ?? DEFAULTS.weeklyDay;
  const todayDay = getTodayDayOfWeek();

  if (todayDay !== weeklyDay) {
    return {
      action: 'skip',
      periodType: 'weekly',
      reason: 'Not weekly day',
    };
  }

  if (!hasActivity) {
    return {
      action: 'skip',
      periodType: 'weekly',
      reason: 'No activity',
    };
  }

  return {
    action: 'generate',
    periodType: 'weekly',
    reason: `Weekly day (${weeklyDay})`,
  };
}

/**
 * Handle auto mode: intelligent scheduling based on activity patterns
 */
function handleAutoMode(
  hasActivity: boolean,
  consecutiveQuietDays: number,
  quietPeriodDays: number
): CadenceDecision {
  const isQuietPeriod = consecutiveQuietDays >= quietPeriodDays;

  if (hasActivity) {
    // Activity detected
    if (isQuietPeriod) {
      // Resuming after quiet period - immediate catch-up
      return {
        action: 'generate',
        periodType: 'daily',
        reason: 'Activity resumed after quiet period',
        immediate: true,
      };
    }

    // Normal daily activity
    return {
      action: 'generate',
      periodType: 'daily',
      reason: 'Daily activity detected',
    };
  }

  // No activity
  if (isQuietPeriod) {
    // Quiet period reached - switch to weekly mode
    return {
      action: 'generate',
      periodType: 'weekly',
      reason: `Quiet period (${consecutiveQuietDays} days) - weekly summary`,
    };
  }

  // Under quiet threshold - skip
  return {
    action: 'skip',
    periodType: 'daily',
    reason: `No activity (${consecutiveQuietDays}/${quietPeriodDays} quiet days)`,
  };
}

/**
 * Update activity tracking in state (immutable)
 * Returns a new state object with updated tracking fields
 */
export function updateActivityTracking(
  state: DigestState,
  hasActivity: boolean
): DigestState {
  const today = getTodayDate();
  const currentQuietDays = state.consecutiveQuietDays ?? 0;
  const lastActivityDate = state.lastActivityDate;

  if (hasActivity) {
    // Activity detected - reset quiet days and update last activity date
    return {
      ...state,
      lastActivityDate: today,
      consecutiveQuietDays: 0,
    };
  }

  // No activity - increment quiet days (but only once per day)
  const alreadyCheckedToday = lastActivityDate === today;

  if (alreadyCheckedToday) {
    // Already checked today, don't increment again
    return { ...state };
  }

  // Increment quiet days
  return {
    ...state,
    consecutiveQuietDays: currentQuietDays + 1,
  };
}
