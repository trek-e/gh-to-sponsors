/**
 * Example platform plugin for gh-to-sponsors
 *
 * This is a complete example demonstrating all required patterns for
 * implementing a PlatformPlugin. Copy this file and customize the marked
 * sections for your platform.
 */

import type { PlatformPlugin, PostResult } from 'gh-to-sponsors/platforms/types';
import type { PostState } from 'gh-to-sponsors/types/state';

/**
 * Example platform API client (mock implementation)
 *
 * CUSTOMIZE: Replace with your platform's SDK or API client type
 */
interface ExampleClient {
  post(content: string, options: { tag?: string }): Promise<{ id: string; url: string }>;
}

/**
 * Maximum number of retry attempts for rate-limited requests
 */
const MAX_RETRIES = 3;

/**
 * Example platform plugin implementation
 *
 * Demonstrates all required patterns:
 * - Constructor with optional configuration
 * - Lazy client initialization
 * - Never-throw error handling
 * - Retry logic with exponential backoff
 * - Content validation
 * - Configuration validation
 */
export class ExamplePlugin implements PlatformPlugin {
  readonly name = 'example';

  private client: ExampleClient | null = null;
  private apiKey: string | undefined;
  private defaultTag: string;

  /**
   * Create a new ExamplePlugin instance
   *
   * @param apiKey - API key for authentication (optional, checked via isConfigured)
   * @param defaultTag - Default tag to apply to posts (defaults to 'devlog')
   *
   * CUSTOMIZE: Add your platform-specific configuration parameters
   */
  constructor(apiKey?: string, defaultTag: string = 'devlog') {
    this.apiKey = apiKey;
    this.defaultTag = defaultTag;
  }

  /**
   * Check if plugin is properly configured
   *
   * @returns true if plugin has required credentials, false otherwise
   *
   * Pattern: Simple boolean check, no throwing
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Get or create the platform API client
   *
   * @returns API client instance
   * @throws Error if not configured (only called after configuration check)
   *
   * Pattern: Lazy initialization - defer SDK/client creation until first use
   * CUSTOMIZE: Replace with your platform's SDK initialization
   */
  private getClient(): ExampleClient {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('API key is required');
      }

      // CUSTOMIZE: Replace with your platform's SDK instantiation
      // Example: this.client = new YourPlatformSDK({ apiKey: this.apiKey });
      this.client = {
        post: async (content: string, options: { tag?: string }) => {
          // Mock implementation for template
          return {
            id: 'post-' + Date.now(),
            url: `https://example.com/posts/post-${Date.now()}`,
          };
        },
      };
    }

    return this.client;
  }

  /**
   * Post content to the platform
   *
   * @param state - PostState containing digest and metadata
   * @returns PostResult with success/failure and platform-specific data
   *
   * Pattern: Never-throw - always return PostResult, catch all errors
   * Pattern: Retry logic with exponential backoff for rate limits
   * Pattern: Content and configuration validation
   *
   * CUSTOMIZE: Modify content transformation and API call for your platform
   */
  async post(state: PostState): Promise<PostResult> {
    // Content validation
    if (!state.digest) {
      return {
        success: false,
        error: 'No digest content to post',
      };
    }

    // Configuration validation
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Example plugin is not configured. Set API key.',
      };
    }

    try {
      const client = this.getClient();

      // CUSTOMIZE: Transform PostState content for your platform's API
      // This example uses the digest title as the post content
      const content = state.digest.title;

      // CUSTOMIZE: Add platform-specific parameters
      const options = {
        tag: this.defaultTag,
      };

      // Retry logic with exponential backoff
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          // CUSTOMIZE: Replace with your platform's API call
          const response = await client.post(content, options);

          return {
            success: true,
            platformPostId: response.id,
            platformUrl: response.url,
          };
        } catch (error) {
          lastError = error as Error;

          // Check if it's a rate limit error (429)
          // CUSTOMIZE: Adjust condition based on your platform's error format
          const isRateLimited = error instanceof Error && error.message.includes('429');

          if (isRateLimited && attempt < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s, 4s
            const delayMs = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }

          // Not rate limited or out of retries, break and return error
          break;
        }
      }

      // All retries exhausted or non-retriable error
      return {
        success: false,
        error: lastError?.message || 'Unknown error posting to Example platform',
      };
    } catch (error) {
      // Never-throw pattern: catch any unexpected errors
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
