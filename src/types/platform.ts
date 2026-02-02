/**
 * Platform-specific configuration types
 *
 * Each platform has its own configuration interface extending PlatformConfig.
 * API keys come from environment variables, not config files (security).
 */

/**
 * Ghost CMS platform configuration
 *
 * Note: apiKey comes from GHOST_ADMIN_API_KEY environment variable,
 * not from config file (security best practice).
 */
export interface GhostConfig {
  enabled: boolean;
  url: string;
  defaultTags: string[];
  defaultStatus: 'draft' | 'published';
}

/**
 * Bluesky platform configuration
 *
 * Note: Authentication credentials (BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD)
 * come from environment variables, not config file (security best practice).
 */
export interface BlueskyConfig {
  enabled: boolean;
  defaultLang: string; // BCP-47 language code, default 'en'
}

/**
 * Mastodon platform configuration
 *
 * Note: Access token (MASTODON_ACCESS_TOKEN) comes from environment variable,
 * not from config file (security best practice).
 */
export interface MastodonConfig {
  enabled: boolean;
  instanceUrl: string; // e.g., "https://mastodon.social"
  visibility: 'public' | 'unlisted' | 'private'; // default 'public'
}

/**
 * Aggregate configuration for all platforms
 */
export interface PlatformsConfig {
  ghost?: GhostConfig;
  bluesky?: BlueskyConfig;
  mastodon?: MastodonConfig;
}
