/**
 * Bluesky Platform Plugin
 *
 * Implements PlatformPlugin interface for posting teasers to Bluesky.
 * Uses @atproto/api SDK for app password authentication and RichText for facet detection.
 */

import { AtpAgent, RichText } from '@atproto/api';
import type { PostState } from '../../types/state.js';
import type { PlatformPlugin, PostResult } from '../types.js';

/** Maximum retry attempts for rate limited requests */
const MAX_RETRIES = 3;

/** Maximum grapheme length for Bluesky posts */
const MAX_GRAPHEMES = 300;

/**
 * Bluesky platform plugin for posting teasers.
 *
 * Uses lazy authentication to avoid errors when credentials are not configured.
 * Implements exponential backoff with jitter for 429 rate limit responses.
 * Validates grapheme length and uses RichText for facet detection (links, hashtags, mentions).
 */
export class BlueskyPlugin implements PlatformPlugin {
  readonly name = 'bluesky';
  private agent: AtpAgent | null = null;
  private authenticated = false;

  constructor(
    private readonly identifier: string | undefined,
    private readonly password: string | undefined,
    private readonly defaultLang: string = 'en'
  ) {}

  /**
   * Check if Bluesky is properly configured with identifier and password.
   *
   * @returns true when both identifier and password are truthy
   */
  isConfigured(): boolean {
    return Boolean(this.identifier && this.password);
  }

  /**
   * Get or create the AtpAgent and authenticate if needed.
   * Lazy initialization defers authentication until first post.
   *
   * @throws Error if not configured
   */
  private async getAgent(): Promise<AtpAgent> {
    if (!this.agent) {
      if (!this.identifier || !this.password) {
        throw new Error('Bluesky not configured');
      }
      this.agent = new AtpAgent({ service: 'https://bsky.social' });
    }

    // Authenticate on first call only
    if (!this.authenticated) {
      await this.agent.login({
        identifier: this.identifier!,
        password: this.password!,
      });
      this.authenticated = true;
    }

    return this.agent;
  }

  /**
   * Post teaser content to Bluesky.
   *
   * Creates a new post with RichText facet detection for links, hashtags, and mentions.
   * Implements retry logic for rate limits (429 responses).
   * Validates grapheme length before posting.
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
      return { success: false, error: 'Bluesky not configured' };
    }

    // Create RichText for facet detection and grapheme validation
    const rt = new RichText({ text: state.teaser.text });
    await rt.detectFacets(await this.getAgent());

    // Validate grapheme length
    if (rt.graphemeLength > MAX_GRAPHEMES) {
      return {
        success: false,
        error: `Post exceeds 300 graphemes: ${rt.graphemeLength}`,
      };
    }

    const agent = await this.getAgent();
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const response = await agent.post({
          text: rt.text,
          facets: rt.facets,
          langs: [this.defaultLang],
        });

        // Extract rkey from URI: at://did:plc:abc/app.bsky.feed.post/xyz -> xyz
        const rkey = response.uri.split('/').pop();
        const platformUrl = `https://bsky.app/profile/${this.identifier}/post/${rkey}`;

        return {
          success: true,
          platformPostId: response.uri,
          platformUrl,
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

        // Return error without throwing (never-throw pattern)
        return {
          success: false,
          error: apiError?.message || String(error),
        };
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }
}
