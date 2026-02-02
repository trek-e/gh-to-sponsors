/**
 * Mastodon Platform Plugin
 *
 * Implements PlatformPlugin interface for posting teasers to Mastodon.
 * Uses masto SDK for REST API client with OAuth token authentication.
 */

import { createRestAPIClient } from 'masto';
import type { PostState } from '../../types/state.js';
import type { PlatformPlugin, PostResult } from '../types.js';

/** Maximum retry attempts for rate limited requests */
const MAX_RETRIES = 3;

/** Type for the Mastodon REST API client instance */
type MastodonClient = ReturnType<typeof createRestAPIClient>;

/**
 * Mastodon platform plugin for posting teasers.
 *
 * Uses lazy initialization for the API client to avoid errors when
 * credentials are not configured. Implements exponential backoff with
 * jitter for 429 rate limit responses.
 */
export class MastodonPlugin implements PlatformPlugin {
  readonly name = 'mastodon';
  private client: MastodonClient | null = null;

  constructor(
    private readonly instanceUrl: string | undefined,
    private readonly accessToken: string | undefined,
    private readonly visibility: 'public' | 'unlisted' | 'private' = 'public'
  ) {}

  /**
   * Check if Mastodon is properly configured with instanceUrl and access token.
   *
   * @returns true when both instanceUrl and accessToken are truthy
   */
  isConfigured(): boolean {
    return Boolean(this.instanceUrl && this.accessToken);
  }

  /**
   * Get or create the Mastodon REST API client.
   * Lazy initialization avoids errors when credentials are missing.
   *
   * @throws Error if not configured
   */
  private getClient(): MastodonClient {
    if (!this.client) {
      if (!this.instanceUrl || !this.accessToken) {
        throw new Error('Mastodon not configured');
      }
      this.client = createRestAPIClient({
        url: this.instanceUrl,
        accessToken: this.accessToken,
      });
    }
    return this.client;
  }

  /**
   * Post teaser content to Mastodon.
   *
   * Creates a new status with the teaser text, applying configured visibility
   * setting and language tag. Implements retry logic for rate limits (429 responses).
   *
   * @param state - Post state containing teaser content
   * @returns PostResult with success status, post ID, URL, or error message
   */
  async post(state: PostState): Promise<PostResult> {
    // Validate teaser content exists
    if (!state.teaser) {
      return { success: false, error: 'No teaser content' };
    }

    // Validate configuration
    if (!this.isConfigured()) {
      return { success: false, error: 'Mastodon not configured' };
    }

    const client = this.getClient();
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        // Create status with teaser text, visibility, and language
        const status = await client.v1.statuses.create({
          status: state.teaser.text,
          visibility: this.visibility,
          language: 'en',
        });

        return {
          success: true,
          platformPostId: status.id,
          platformUrl: status.url || undefined,
        };
      } catch (error: unknown) {
        const apiError = error as { status?: number; message?: string };
        const isRateLimit = apiError?.status === 429;
        const isLastAttempt = attempt >= MAX_RETRIES - 1;

        if (isRateLimit && !isLastAttempt) {
          // Exponential backoff with jitter (from GhostPlugin pattern)
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
