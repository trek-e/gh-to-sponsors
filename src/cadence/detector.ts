/**
 * Cadence decision logic
 * Determines when to generate daily/weekly digests or skip entirely
 */

import type { DigestState } from '../types/state.js';
import type { CadenceConfig } from '../types/config.js';

/** Result of cadence decision */
export interface CadenceDecision {
  action: 'generate' | 'skip';
  periodType: 'daily' | 'weekly';
  reason: string;
  /** True when resuming after quiet period (immediate catch-up) */
  immediate?: boolean;
}

/**
 * Decide whether to generate a digest based on cadence mode and activity
 */
export function decideCadence(
  _state: DigestState,
  _config: CadenceConfig,
  _hasActivity: boolean
): CadenceDecision {
  // TODO: Implement in GREEN phase
  throw new Error('Not implemented');
}

/**
 * Update activity tracking in state (immutable)
 */
export function updateActivityTracking(
  _state: DigestState,
  _hasActivity: boolean
): DigestState {
  // TODO: Implement in GREEN phase
  throw new Error('Not implemented');
}
