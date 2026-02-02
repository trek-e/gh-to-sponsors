/**
 * State management using file-based storage compatible with GitHub Actions artifacts
 */

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { DigestState, PostState, PostStatus, PlatformPostState } from '../types/state.js';

export const DEFAULT_STATE_PATH = '.state/digest.json';

export const EMPTY_STATE: DigestState = {
  posts: {},
  usedTokens: [],
  lastRun: ''
};

/**
 * Load state from JSON file
 * @param path - Path to state file (default: .state/digest.json)
 * @returns DigestState object
 * @throws On JSON parse errors (corrupted state)
 */
export async function loadState(path: string = DEFAULT_STATE_PATH): Promise<DigestState> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content) as DigestState;
  } catch (error) {
    // If file doesn't exist, return empty state
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return EMPTY_STATE;
    }
    // Re-throw parse errors (corrupted state)
    throw error;
  }
}

/**
 * Save state to JSON file with atomic write pattern
 * @param state - DigestState to save
 * @param path - Path to state file (default: .state/digest.json)
 */
export async function saveState(
  state: DigestState,
  path: string = DEFAULT_STATE_PATH
): Promise<void> {
  // Ensure directory exists
  const dir = dirname(path);
  await fs.mkdir(dir, { recursive: true });

  // Atomic write pattern: write to temp file, then rename
  const tempPath = join(tmpdir(), `digest-state-${randomBytes(8).toString('hex')}.json`);

  try {
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tempPath, path);
  } catch (error) {
    // Clean up temp file if rename fails
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Update post status (immutable)
 * @param state - Current state
 * @param postId - Post ID to update
 * @param status - New status
 * @param platforms - Platform results (optional)
 * @returns New state with updated post
 */
export function updatePostStatus(
  state: DigestState,
  postId: string,
  status: PostStatus,
  platforms?: Record<string, PlatformPostState>
): DigestState {
  const existingPost = state.posts[postId];

  if (!existingPost) {
    throw new Error(`Post ${postId} not found in state`);
  }

  const updatedPost: PostState = {
    ...existingPost,
    status,
    ...(platforms && { platforms }),
    ...(status === 'approved' && { approvedAt: new Date().toISOString() })
  };

  return {
    ...state,
    posts: {
      ...state.posts,
      [postId]: updatedPost
    }
  };
}

/**
 * Mark token as used (immutable)
 * @param state - Current state
 * @param jti - Token ID to mark as used
 * @returns New state with jti added to usedTokens
 */
export function markTokenUsed(state: DigestState, jti: string): DigestState {
  return {
    ...state,
    usedTokens: [...state.usedTokens, jti]
  };
}

/**
 * Clean expired tokens from state (immutable)
 * @param state - Current state
 * @param maxAgeMs - Maximum age in milliseconds
 * @returns New state with old tokens removed
 */
export function cleanExpiredTokens(state: DigestState, maxAgeMs: number): DigestState {
  // For jti cleanup, we need to parse the timestamp from the jti if it contains one,
  // or we could track token timestamps separately. For now, we'll use a simpler approach:
  // Remove tokens that are older than maxAgeMs based on the lastRun timestamp.
  // This is a conservative approach that keeps tokens until we're sure they're expired.

  // If no lastRun, keep all tokens
  if (!state.lastRun) {
    return state;
  }

  const lastRunTime = new Date(state.lastRun).getTime();
  const cutoffTime = Date.now() - maxAgeMs;

  // If lastRun is older than cutoff, we can safely remove all tokens
  // since they were all created before the cutoff time
  if (lastRunTime < cutoffTime) {
    return {
      ...state,
      usedTokens: []
    };
  }

  // Otherwise, keep all tokens (they might still be valid)
  return state;
}

/**
 * Create new post in state (immutable)
 * @param state - Current state
 * @param post - Post data (without createdAt)
 * @returns New state with post added
 */
export function createPost(
  state: DigestState,
  post: Omit<PostState, 'createdAt'>
): DigestState {
  const newPost: PostState = {
    ...post,
    createdAt: new Date().toISOString()
  };

  return {
    ...state,
    posts: {
      ...state.posts,
      [newPost.id]: newPost
    }
  };
}

/**
 * Updates platform results for a post (immutable)
 *
 * Merges new platform results with existing ones, preserving any
 * platforms not included in the update.
 *
 * @param state - Current state
 * @param postId - Post ID to update
 * @param platformResults - Platform results to merge
 * @returns New state with updated platform results, or unchanged state if post not found
 */
export function updatePlatformResults(
  state: DigestState,
  postId: string,
  platformResults: Record<string, PlatformPostState>
): DigestState {
  const post = state.posts[postId];
  if (!post) {
    return state;
  }

  return {
    ...state,
    posts: {
      ...state.posts,
      [postId]: {
        ...post,
        platforms: {
          ...post.platforms,
          ...platformResults
        }
      }
    }
  };
}
