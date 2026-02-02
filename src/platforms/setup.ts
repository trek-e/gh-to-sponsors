/**
 * Platform setup module
 *
 * Registers all available platforms based on environment configuration.
 * Uses idempotent initialization pattern - safe to call multiple times.
 */

import { registerPlatform, getConfiguredPlatforms } from './registry.js';
import { GhostPlugin } from './ghost/index.js';
import { BlueskyPlugin } from './bluesky/index.js';
import type { PlatformPlugin } from './types.js';

let initialized = false;

/**
 * Registers all available platforms based on environment configuration.
 * Call once at startup before using getConfiguredPlatforms().
 *
 * Idempotent - safe to call multiple times, only registers once.
 */
export function setupPlatforms(): void {
  if (initialized) return;

  // Register Ghost plugin
  // Config comes from env vars: GHOST_API_URL, GHOST_ADMIN_API_KEY
  // Optional config from env: GHOST_DEFAULT_STATUS, GHOST_DEFAULT_TAGS
  registerPlatform('ghost', () => {
    const url = process.env.GHOST_API_URL;
    const apiKey = process.env.GHOST_ADMIN_API_KEY;
    const defaultStatus = (process.env.GHOST_DEFAULT_STATUS as 'draft' | 'published') || 'draft';
    const defaultTags = process.env.GHOST_DEFAULT_TAGS?.split(',').map(t => t.trim()) || ['devlog', 'opensource'];

    return new GhostPlugin(url, apiKey, defaultTags, defaultStatus);
  });

  // Register Bluesky plugin
  // Config from env vars: BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD
  // Optional: BLUESKY_DEFAULT_LANG (defaults to 'en')
  registerPlatform('bluesky', () => {
    const identifier = process.env.BLUESKY_IDENTIFIER;
    const appPassword = process.env.BLUESKY_APP_PASSWORD;
    const defaultLang = process.env.BLUESKY_DEFAULT_LANG || 'en';

    return new BlueskyPlugin(identifier, appPassword, defaultLang);
  });

  // Future platforms will be registered here:
  // registerPlatform('mastodon', () => new MastodonPlugin(...));

  initialized = true;
}

/**
 * Gets all configured platforms, initializing registry if needed.
 *
 * Convenience function that ensures setupPlatforms() has been called
 * before returning configured platforms.
 *
 * @returns Array of configured plugin instances
 */
export function getReadyPlatforms(): PlatformPlugin[] {
  setupPlatforms();
  return getConfiguredPlatforms();
}
