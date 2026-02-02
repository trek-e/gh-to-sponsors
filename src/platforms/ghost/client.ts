/**
 * Ghost CMS Platform Plugin
 *
 * Implements PlatformPlugin interface for publishing digests to Ghost CMS.
 * Uses @tryghost/admin-api SDK for JWT authentication and post creation.
 */

import GhostAdminAPI from '@tryghost/admin-api';
import type { PostState } from '../../types/state.js';
import type { PlatformPlugin, PostResult } from '../types.js';

/** Maximum retry attempts for rate limited requests */
const MAX_RETRIES = 3;

/** Type for the Ghost Admin API client instance */
type GhostAPI = ReturnType<typeof GhostAdminAPI>;

/**
 * Ghost CMS platform plugin for publishing digests.
 *
 * Uses lazy initialization for the API client to avoid errors when
 * credentials are not configured. Implements exponential backoff with
 * jitter for 429 rate limit responses.
 */
export class GhostPlugin implements PlatformPlugin {
  readonly name = 'ghost';
  private api: GhostAPI | null = null;

  constructor(
    private readonly url: string | undefined,
    private readonly apiKey: string | undefined,
    private readonly defaultTags: string[] = ['devlog', 'opensource'],
    private readonly defaultStatus: 'draft' | 'published' = 'draft'
  ) {}

  /**
   * Check if Ghost is properly configured with URL and API key.
   *
   * @returns true when both url and apiKey are truthy
   */
  isConfigured(): boolean {
    return Boolean(this.url && this.apiKey);
  }

  /**
   * Get or create the Ghost Admin API client.
   * Lazy initialization avoids errors when credentials are missing.
   *
   * @throws Error if not configured
   */
  private getClient(): GhostAPI {
    if (!this.api) {
      if (!this.url || !this.apiKey) {
        throw new Error('Ghost not configured');
      }
      this.api = new GhostAdminAPI({
        url: this.url,
        key: this.apiKey,
        version: 'v5.0',
      });
    }
    return this.api;
  }

  /**
   * Post digest content to Ghost CMS.
   *
   * Creates a new post with the digest content, applying configured tags
   * and status. Implements retry logic for rate limits (429 responses).
   *
   * @param state - Post state containing digest content
   * @returns PostResult with success status, post ID, URL, or error message
   */
  async post(state: PostState): Promise<PostResult> {
    // Validate digest content exists
    if (!state.digest) {
      return { success: false, error: 'No digest content' };
    }

    // Validate configuration
    if (!this.isConfigured()) {
      return { success: false, error: 'Ghost not configured' };
    }

    const api = this.getClient();
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        // Create post with status INSIDE post object (per RESEARCH.md pitfall #1)
        // Tags as array of { name } objects (Ghost API format)
        const post = await api.posts.add(
          {
            title: state.digest.title,
            html: state.digest.content,
            status: this.defaultStatus,
            custom_excerpt: state.teaser?.text,
            tags: this.defaultTags.map((name) => ({ name })),
          },
          { source: 'html' }
        );

        return {
          success: true,
          platformPostId: post.id,
          platformUrl: post.url,
        };
      } catch (error: unknown) {
        const apiError = error as { status?: number; message?: string };
        const isRateLimit = apiError?.status === 429;
        const isLastAttempt = attempt >= MAX_RETRIES - 1;

        if (isRateLimit && !isLastAttempt) {
          // Exponential backoff with jitter (from src/content/generator.ts)
          const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;

          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
          continue;
        }

        // Return error without throwing (per must_haves truths)
        return {
          success: false,
          error: apiError?.message || String(error),
        };
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }
}
