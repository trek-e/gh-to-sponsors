/**
 * Plugin testing harness
 *
 * Provides shared test utilities for validating PlatformPlugin implementations.
 * Exports makePostState factory for creating test PostState objects and
 * testPlatformPluginCompliance suite for validating plugin contract compliance.
 */

import { describe, expect, it } from 'vitest';
import type { PlatformPlugin } from '../platforms/types.js';
import type { PostState } from '../types/state.js';

/**
 * Factory function to create valid PostState objects for testing
 *
 * Creates a PostState with sensible defaults that can be overridden
 * via partial overrides. Follows same pattern as makePostState in
 * ghost/client.test.ts.
 *
 * @param overrides - Partial PostState to override defaults
 * @returns Complete PostState object suitable for plugin testing
 */
export const makePostState = (overrides: Partial<PostState> = {}): PostState => ({
  id: 'post-123',
  contentHash: 'hash-abc',
  status: 'approved',
  platforms: {},
  createdAt: '2026-01-01T00:00:00Z',
  digest: {
    title: 'Weekly Update',
    content: '<h2>What we shipped</h2><p>New features</p>',
    repos: ['owner/repo'],
    commitCount: 5,
    periodType: 'weekly',
    generatedAt: '2026-01-01T00:00:00Z',
  },
  teaser: {
    text: 'Check out our latest updates!',
    hashtags: ['#devlog', '#opensource'],
    characterCount: 32,
  },
  ...overrides,
});

/**
 * Compliance test suite for PlatformPlugin implementations
 *
 * Validates that a plugin correctly implements the 4 critical behaviors
 * defined by the PlatformPlugin interface:
 * 1. name property is set correctly
 * 2. isConfigured() returns boolean
 * 3. post() returns Promise<PostResult> with correct shape
 * 4. post() never throws (always resolves, errors returned in result)
 *
 * @param pluginFactory - Function that creates a fresh plugin instance
 * @param pluginName - Expected value of plugin.name property
 */
export const testPlatformPluginCompliance = (
  pluginFactory: () => PlatformPlugin,
  pluginName: string
): void => {
  describe(`PlatformPlugin compliance for ${pluginName}`, () => {
    it('has correct name property', () => {
      const plugin = pluginFactory();
      expect(plugin.name).toBe(pluginName);
    });

    it('isConfigured() returns boolean', () => {
      const plugin = pluginFactory();
      const result = plugin.isConfigured();
      expect(typeof result).toBe('boolean');
    });

    it('post() returns Promise<PostResult>', async () => {
      const plugin = pluginFactory();
      const state = makePostState();
      const result = await plugin.post(state);

      // Verify PostResult shape
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        // Success result should have platformPostId and platformUrl
        expect(typeof result.platformPostId).toBe('string');
        expect(typeof result.platformUrl).toBe('string');
      } else {
        // Failure result should have error message
        expect(typeof result.error).toBe('string');
      }
    });

    it('does not throw from post()', async () => {
      const plugin = pluginFactory();
      const state = makePostState();

      // Should resolve, not reject
      await expect(plugin.post(state)).resolves.toBeDefined();
    });
  });
};
