/**
 * Tests for plugin testing harness
 *
 * Validates that the harness itself works correctly by testing:
 * 1. makePostState factory creates valid PostState objects
 * 2. testPlatformPluginCompliance validates real plugins (using GhostPlugin)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { makePostState, testPlatformPluginCompliance } from './plugin-harness.js';

// Mock the @tryghost/admin-api module (same pattern as ghost/client.test.ts)
vi.mock('@tryghost/admin-api', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      posts: {
        add: vi.fn(),
      },
    })),
  };
});

import { GhostPlugin } from '../platforms/ghost/client.js';
import GhostAdminAPI from '@tryghost/admin-api';

describe('plugin-harness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('makePostState', () => {
    it('returns valid PostState with defaults', () => {
      const state = makePostState();

      // Verify core fields
      expect(state.id).toBe('post-123');
      expect(state.status).toBe('approved');
      expect(state.platforms).toEqual({});
      expect(state.createdAt).toBe('2026-01-01T00:00:00Z');

      // Verify digest
      expect(state.digest).toBeDefined();
      expect(state.digest?.title).toBe('Weekly Update');
      expect(state.digest?.content).toBe('<h2>What we shipped</h2><p>New features</p>');
      expect(state.digest?.repos).toEqual(['owner/repo']);
      expect(state.digest?.commitCount).toBe(5);
      expect(state.digest?.periodType).toBe('weekly');

      // Verify teaser
      expect(state.teaser).toBeDefined();
      expect(state.teaser?.text).toBe('Check out our latest updates!');
      expect(state.teaser?.hashtags).toEqual(['#devlog', '#opensource']);
      expect(state.teaser?.characterCount).toBe(32);
    });

    it('accepts overrides', () => {
      const state = makePostState({ id: 'custom-id' });

      expect(state.id).toBe('custom-id');
      // Other fields should still have defaults
      expect(state.status).toBe('approved');
      expect(state.digest?.title).toBe('Weekly Update');
    });

    it('accepts digest override', () => {
      const state = makePostState({ digest: undefined });

      expect(state.digest).toBeUndefined();
      // Other fields should still have defaults
      expect(state.id).toBe('post-123');
      expect(state.teaser?.text).toBe('Check out our latest updates!');
    });

    it('accepts deep partial overrides', () => {
      const state = makePostState({
        digest: {
          title: 'Custom Title',
          content: '<p>Custom content</p>',
          repos: ['custom/repo'],
          commitCount: 10,
          periodType: 'daily',
          generatedAt: '2026-02-01T00:00:00Z',
        },
      });

      expect(state.digest?.title).toBe('Custom Title');
      expect(state.digest?.periodType).toBe('daily');
      expect(state.digest?.commitCount).toBe(10);
    });
  });

  describe('testPlatformPluginCompliance with GhostPlugin', () => {
    it('validates GhostPlugin compliance', () => {
      // Set up mock to return success for GhostPlugin
      const mockAdd = vi.fn().mockResolvedValue({
        id: 'test-id',
        url: 'https://example.com/test',
      });

      vi.mocked(GhostAdminAPI).mockImplementation(() => ({
        posts: { add: mockAdd },
      }) as unknown as ReturnType<typeof GhostAdminAPI>);

      // Run compliance tests against GhostPlugin
      testPlatformPluginCompliance(
        () => new GhostPlugin('https://example.com', 'key:secret'),
        'ghost'
      );

      // The compliance suite will have been executed via the describe block
      // If it fails, the test will fail
    });
  });
});
