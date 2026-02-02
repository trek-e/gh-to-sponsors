/**
 * Platform plugin type definitions
 *
 * Defines the contract that all platform plugins must implement,
 * enabling consistent plugin behavior and compile-time type safety.
 */

import type { PostState } from '../types/state.js';

/**
 * Base configuration shared by all platforms
 */
export interface PlatformConfig {
  enabled: boolean;
}

/**
 * Result of a platform post operation
 */
export interface PostResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
}

/**
 * Platform plugin interface - contract for all platform implementations
 *
 * Follows the same abstraction pattern as EmailProvider in src/types/email.ts
 */
export interface PlatformPlugin {
  /** Platform identifier (e.g., 'ghost', 'bluesky') */
  readonly name: string;

  /** Check if platform is properly configured */
  isConfigured(): boolean;

  /** Transform and post content to platform */
  post(state: PostState): Promise<PostResult>;
}
