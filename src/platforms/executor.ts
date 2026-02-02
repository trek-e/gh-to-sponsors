/**
 * Platform executor for multi-platform posting orchestration
 *
 * Uses Promise.allSettled for error isolation - one platform's failure
 * doesn't prevent posting to others. Provides clear success/failure summary
 * and state-compatible result format.
 */

import type { PlatformPlugin } from './types.js';
import type { PostState, PlatformPostState } from '../types/state.js';

/**
 * Result of posting to a single platform
 */
export interface PlatformPostResult {
  platform: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

/**
 * Summary of posting to all platforms
 */
export interface ExecutionSummary {
  /** True if all platforms succeeded */
  allSucceeded: boolean;
  /** True if at least one platform succeeded */
  anySucceeded: boolean;
  /** Individual results for each platform */
  results: PlatformPostResult[];
  /** Names of platforms that succeeded */
  successfulPlatforms: string[];
  /** Names of platforms that failed */
  failedPlatforms: string[];
}

/**
 * Posts content to all configured platforms in parallel.
 *
 * Uses Promise.allSettled for error isolation - one platform's failure
 * doesn't prevent posting to others.
 *
 * @param plugins - Array of configured platform plugins
 * @param state - Post state containing content to publish
 * @returns Summary with per-platform results
 */
export async function postToAllPlatforms(
  plugins: PlatformPlugin[],
  state: PostState
): Promise<ExecutionSummary> {
  const promises = plugins.map(async (plugin): Promise<PlatformPostResult> => {
    try {
      const result = await plugin.post(state);
      return {
        platform: plugin.name,
        success: result.success,
        postId: result.platformPostId,
        postUrl: result.platformUrl,
        error: result.error,
      };
    } catch (error) {
      // Catch any unexpected throws (plugins should return errors, not throw)
      // Defense in depth - plugins may have bugs
      return {
        platform: plugin.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Promise.allSettled ensures all platform posts complete regardless of failures
  const settled = await Promise.allSettled(promises);

  const results = settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    // This shouldn't happen since we wrap everything in try/catch,
    // but handle it for robustness
    return {
      platform: plugins[index]?.name || 'unknown',
      success: false,
      error: String(outcome.reason),
    };
  });

  const successfulPlatforms = results.filter((r) => r.success).map((r) => r.platform);
  const failedPlatforms = results.filter((r) => !r.success).map((r) => r.platform);

  return {
    allSucceeded: failedPlatforms.length === 0 && results.length > 0,
    anySucceeded: successfulPlatforms.length > 0,
    results,
    successfulPlatforms,
    failedPlatforms,
  };
}

/**
 * Converts execution results to state-compatible format
 *
 * @param results - Array of platform post results
 * @returns Record suitable for PostState.platforms
 */
export function resultsToStateFormat(
  results: PlatformPostResult[]
): Record<string, PlatformPostState> {
  const now = new Date().toISOString();
  const platformStates: Record<string, PlatformPostState> = {};

  for (const result of results) {
    platformStates[result.platform] = {
      status: result.success ? 'success' : 'failed',
      postId: result.postId,
      postUrl: result.postUrl,
      error: result.error,
      attemptedAt: now,
    };
  }

  return platformStates;
}
