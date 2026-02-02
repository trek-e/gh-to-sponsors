/**
 * Ghost CMS Platform Plugin
 *
 * STUB: This is a placeholder for the Ghost plugin implementation.
 * The real implementation will be created in 03-02-PLAN.md.
 */

import type { PostState } from '../../types/state.js';
import type { PlatformPlugin, PostResult } from '../types.js';

/**
 * Ghost CMS platform plugin for publishing digests.
 *
 * @see 03-02-PLAN.md for full implementation
 */
export class GhostPlugin implements PlatformPlugin {
  readonly name = 'ghost';

  constructor(
    private readonly url?: string,
    private readonly apiKey?: string,
    // These will be used in the real implementation (03-02)
    readonly tags: string[] = [],
    readonly postStatus: 'draft' | 'published' = 'draft'
  ) {}

  isConfigured(): boolean {
    return Boolean(this.url && this.apiKey);
  }

  async post(_state: PostState): Promise<PostResult> {
    // Stub implementation - will be replaced in 03-02
    if (!this.isConfigured()) {
      return { success: false, error: 'Ghost not configured' };
    }

    if (!_state.digest) {
      return { success: false, error: 'No digest content' };
    }

    // Placeholder - real implementation in 03-02
    return {
      success: false,
      error: 'Ghost plugin not yet implemented (see 03-02-PLAN.md)',
    };
  }
}
