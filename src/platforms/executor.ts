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
 * Posts content to all configured platforms.
 *
 * Strategy:
 * 1. Post to Ghost first (to get URL for social posts)
 * 2. Update state with Ghost result
 * 3. Compose teaser + link for social platforms
 * 4. Post to social platforms in parallel with composed content
 *
 * Uses Promise.allSettled for error isolation - one platform's failure
 * doesn't prevent posting to others.
 *
 * @param plugins - Array of configured platform plugins
 * @param state - Post state containing content to publish
 * @param githubFallback - Optional GitHub URL for fallback when Ghost unavailable
 * @returns Summary with per-platform results
 */
export async function postToAllPlatforms(
  plugins: PlatformPlugin[],
  state: PostState,
  githubFallback?: string
): Promise<ExecutionSummary> {
  // Separate Ghost from social platforms
  const ghostPlugin = plugins.find((p) => p.name === 'ghost');
  const socialPlugins = plugins.filter((p) => p.name !== 'ghost');

  const results: PlatformPostResult[] = [];

  // Step 1: Post to Ghost first (if configured)
  if (ghostPlugin) {
    try {
      const ghostResult = await ghostPlugin.post(state);
      results.push({
        platform: ghostPlugin.name,
        success: ghostResult.success,
        postId: ghostResult.platformPostId,
        postUrl: ghostResult.platformUrl,
        error: ghostResult.error,
      });

      // Step 2: Update state with Ghost result
      if (ghostResult.success && ghostResult.platformUrl) {
        state.platforms.ghost = {
          status: 'success',
          postId: ghostResult.platformPostId,
          postUrl: ghostResult.platformUrl,
          attemptedAt: new Date().toISOString(),
        };
      } else {
        state.platforms.ghost = {
          status: 'failed',
          error: ghostResult.error,
          attemptedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      // Catch any unexpected throws from Ghost plugin
      results.push({
        platform: ghostPlugin.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      state.platforms.ghost = {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        attemptedAt: new Date().toISOString(),
      };
    }
  }

  // Step 3: Compose teaser + link for social platforms
  const linkTarget = getLinkTarget();
  const composedTeaserText = composeSocialPostContent(state, linkTarget, githubFallback);

  // Create modified state for social platforms with composed content
  const socialState: PostState = {
    ...state,
    teaser: state.teaser
      ? {
          ...state.teaser,
          text: composedTeaserText,
          characterCount: composedTeaserText.length,
        }
      : undefined,
  };

  // Step 4: Post to social platforms in parallel
  const socialPromises = socialPlugins.map(async (plugin): Promise<PlatformPostResult> => {
    try {
      const result = await plugin.post(socialState);
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
  const socialSettled = await Promise.allSettled(socialPromises);

  const socialResults = socialSettled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    // This shouldn't happen since we wrap everything in try/catch,
    // but handle it for robustness
    return {
      platform: socialPlugins[index]?.name || 'unknown',
      success: false,
      error: String(outcome.reason),
    };
  });

  results.push(...socialResults);

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

/**
 * Gets the configured link target for social posts.
 * Reads from SOCIAL_LINK_TARGET environment variable.
 *
 * @returns Link target ('ghost', 'github', or custom URL)
 */
export function getLinkTarget(): string {
  return process.env.SOCIAL_LINK_TARGET || 'ghost';
}

/**
 * Composes social post content by appending link to teaser.
 *
 * Link target behavior:
 * - 'ghost': Uses Ghost URL from state if available, otherwise teaser only
 * - 'github': Uses provided GitHub fallback URL
 * - Custom URL: Uses the provided custom URL
 *
 * Fallback: If Ghost target fails and GitHub fallback provided, uses GitHub URL
 *
 * @param state - Post state containing teaser and platform results
 * @param target - Link target ('ghost', 'github', or custom URL)
 * @param githubFallback - Optional GitHub URL to use as fallback
 * @returns Composed content with teaser and link
 */
export function composeSocialPostContent(
  state: PostState,
  target: string,
  githubFallback?: string
): string {
  // Handle missing teaser gracefully
  if (!state.teaser?.text) {
    return '';
  }

  const teaserText = state.teaser.text;

  // Determine which URL to append
  let linkUrl: string | undefined;

  if (target === 'ghost') {
    // Try to get Ghost URL from state
    const ghostState = state.platforms.ghost;
    if (ghostState?.status === 'success' && ghostState.postUrl) {
      linkUrl = ghostState.postUrl;
    } else if (githubFallback) {
      // Fallback to GitHub if Ghost failed and fallback provided
      linkUrl = githubFallback;
    }
  } else if (target === 'github') {
    linkUrl = githubFallback;
  } else {
    // Custom URL
    linkUrl = target;
  }

  // Compose final content
  if (linkUrl) {
    return `${teaserText}\n\n${linkUrl}`;
  }

  return teaserText;
}
