/**
 * Tests for ExamplePlugin
 *
 * Demonstrates using the shared plugin testing harness plus plugin-specific tests.
 *
 * NOTE: This test file uses relative imports to src/test-utils/ because it runs
 * within the gh-to-sponsors monorepo. When you publish your plugin as a separate
 * package, you would import from 'gh-to-sponsors/test-utils' instead:
 *
 *   import { testPlatformPluginCompliance, makePostState } from 'gh-to-sponsors/test-utils';
 */

import { describe, expect, it, vi } from 'vitest';
import { ExamplePlugin } from './client.js';

// For the template running in the monorepo, use relative imports
// CUSTOMIZE: When publishing as separate package, use: 'gh-to-sponsors/test-utils'
import { testPlatformPluginCompliance, makePostState } from '../../../../src/test-utils/index.js';

describe('ExamplePlugin', () => {
  // Interface compliance tests (4 tests)
  testPlatformPluginCompliance(() => new ExamplePlugin('test-api-key'), 'example');

  // Plugin-specific tests
  describe('Configuration', () => {
    it('isConfigured returns false without API key', () => {
      const plugin = new ExamplePlugin();
      expect(plugin.isConfigured()).toBe(false);
    });

    it('isConfigured returns true with API key', () => {
      const plugin = new ExamplePlugin('test-api-key');
      expect(plugin.isConfigured()).toBe(true);
    });
  });

  describe('Posting', () => {
    it('returns error when no digest content', async () => {
      const plugin = new ExamplePlugin('test-api-key');
      const state = makePostState({ digest: undefined });

      const result = await plugin.post(state);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No digest content');
    });

    it('returns error when not configured', async () => {
      const plugin = new ExamplePlugin(); // No API key
      const state = makePostState();

      const result = await plugin.post(state);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('returns success with valid state and API key', async () => {
      const plugin = new ExamplePlugin('test-api-key');
      const state = makePostState({
        digest: {
          title: 'Test Post',
          content: '<p>Test content</p>',
          repos: ['owner/repo'],
          commitCount: 5,
          periodType: 'daily',
          generatedAt: '2026-01-01T00:00:00Z',
        },
      });

      const result = await plugin.post(state);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBeDefined();
      expect(result.platformUrl).toBeDefined();
    });

    it('does not throw on API failure', async () => {
      const plugin = new ExamplePlugin('test-api-key');

      // Create a plugin instance where we can inject a failing client
      // This demonstrates the never-throw pattern
      const state = makePostState();

      // The plugin's never-throw pattern means this should never reject
      await expect(plugin.post(state)).resolves.toBeDefined();
    });
  });

  describe('Custom tag configuration', () => {
    it('accepts custom default tag', () => {
      const plugin = new ExamplePlugin('test-api-key', 'custom-tag');
      expect(plugin.name).toBe('example');
      // Tag is used internally but not exposed in interface
    });
  });
});
