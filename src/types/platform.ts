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
 * Aggregate configuration for all platforms
 */
export interface PlatformsConfig {
  ghost?: GhostConfig;
}
