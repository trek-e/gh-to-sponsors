/**
 * Platform plugin registry
 *
 * Central registry for discovering and instantiating platform plugins.
 * Follows the factory pattern from src/email/factory.ts for lazy instantiation.
 */

import type { PlatformPlugin } from './types.js';

type PlatformFactory = () => PlatformPlugin;

const plugins = new Map<string, PlatformFactory>();

/**
 * Register a platform plugin factory
 *
 * @param name - Platform identifier (e.g., 'ghost', 'bluesky')
 * @param factory - Factory function that creates the plugin instance
 */
export function registerPlatform(name: string, factory: PlatformFactory): void {
  plugins.set(name, factory);
}

/**
 * Get a platform plugin by name
 *
 * @param name - Platform identifier
 * @returns Plugin instance or undefined if not registered
 */
export function getPlatform(name: string): PlatformPlugin | undefined {
  const factory = plugins.get(name);
  return factory ? factory() : undefined;
}

/**
 * Get all configured platform plugins
 *
 * Returns only plugins that are properly configured (have valid credentials).
 * Used when posting to all available platforms.
 *
 * @returns Array of configured plugin instances
 */
export function getConfiguredPlatforms(): PlatformPlugin[] {
  return Array.from(plugins.values())
    .map(factory => factory())
    .filter(plugin => plugin.isConfigured());
}

/**
 * Get all registered platform names
 *
 * @returns Array of registered platform identifiers
 */
export function getAllPlatformNames(): string[] {
  return Array.from(plugins.keys());
}
