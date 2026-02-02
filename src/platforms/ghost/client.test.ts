/**
 * Tests for GhostPlugin
 *
 * TDD tests for Ghost CMS platform plugin implementing PlatformPlugin interface.
 * Tests cover isConfigured(), post(), and retry logic.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PostState } from '../../types/state.js';

// Mock the @tryghost/admin-api module
vi.mock('@tryghost/admin-api', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      posts: {
        add: vi.fn(),
      },
    })),
  };
});

import { GhostPlugin } from './client.js';
import GhostAdminAPI from '@tryghost/admin-api';

describe('GhostPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makePostState = (overrides: Partial<PostState> = {}): PostState => ({
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

  describe('isConfigured', () => {
    it('returns true when both url and apiKey are provided', () => {
      const plugin = new GhostPlugin(
        'https://blog.example.com',
        'abc123:secret456'
      );

      expect(plugin.isConfigured()).toBe(true);
    });

    it('returns false when url is missing', () => {
      const plugin = new GhostPlugin(undefined, 'abc123:secret456');

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when apiKey is missing', () => {
      const plugin = new GhostPlugin('https://blog.example.com', undefined);

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when url is empty string', () => {
      const plugin = new GhostPlugin('', 'abc123:secret456');

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when apiKey is empty string', () => {
      const plugin = new GhostPlugin('https://blog.example.com', '');

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when both url and apiKey are missing', () => {
      const plugin = new GhostPlugin(undefined, undefined);

      expect(plugin.isConfigured()).toBe(false);
    });
  });

  describe('post', () => {
    describe('validation', () => {
      it('returns error when state has no digest', async () => {
        const plugin = new GhostPlugin(
          'https://blog.example.com',
          'abc123:secret456'
        );
        const state = makePostState({ digest: undefined });

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('No digest content');
      });

      it('returns error when plugin is not configured', async () => {
        const plugin = new GhostPlugin(undefined, undefined);
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Ghost not configured');
      });
    });

    describe('successful post', () => {
      it('returns success with platformPostId and platformUrl on API success', async () => {
        const mockAdd = vi.fn().mockResolvedValue({
          id: 'ghost-post-id-123',
          url: 'https://blog.example.com/weekly-update/',
        });

        vi.mocked(GhostAdminAPI).mockImplementation(() => ({
          posts: { add: mockAdd },
        }) as unknown as ReturnType<typeof GhostAdminAPI>);

        const plugin = new GhostPlugin(
          'https://blog.example.com',
          'abc123:secret456'
        );
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(true);
        expect(result.platformPostId).toBe('ghost-post-id-123');
        expect(result.platformUrl).toBe('https://blog.example.com/weekly-update/');
      });

      it('passes correct parameters to Ghost API', async () => {
        const mockAdd = vi.fn().mockResolvedValue({
          id: 'ghost-post-id-123',
          url: 'https://blog.example.com/weekly-update/',
        });

        vi.mocked(GhostAdminAPI).mockImplementation(() => ({
          posts: { add: mockAdd },
        }) as unknown as ReturnType<typeof GhostAdminAPI>);

        const plugin = new GhostPlugin(
          'https://blog.example.com',
          'abc123:secret456',
          ['devlog', 'opensource'],
          'draft'
        );
        const state = makePostState();

        await plugin.post(state);

        expect(mockAdd).toHaveBeenCalledWith(
          {
            title: 'Weekly Update',
            html: '<h2>What we shipped</h2><p>New features</p>',
            status: 'draft',
            custom_excerpt: 'Check out our latest updates!',
            tags: [{ name: 'devlog' }, { name: 'opensource' }],
          },
          { source: 'html' }
        );
      });

      it('uses published status when configured', async () => {
        const mockAdd = vi.fn().mockResolvedValue({
          id: 'ghost-post-id-123',
          url: 'https://blog.example.com/weekly-update/',
        });

        vi.mocked(GhostAdminAPI).mockImplementation(() => ({
          posts: { add: mockAdd },
        }) as unknown as ReturnType<typeof GhostAdminAPI>);

        const plugin = new GhostPlugin(
          'https://blog.example.com',
          'abc123:secret456',
          ['devlog'],
          'published'
        );
        const state = makePostState();

        await plugin.post(state);

        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'published' }),
          { source: 'html' }
        );
      });
    });

    describe('error handling', () => {
      it('returns error message on API failure without throwing', async () => {
        const mockAdd = vi.fn().mockRejectedValue(new Error('API connection failed'));

        vi.mocked(GhostAdminAPI).mockImplementation(() => ({
          posts: { add: mockAdd },
        }) as unknown as ReturnType<typeof GhostAdminAPI>);

        const plugin = new GhostPlugin(
          'https://blog.example.com',
          'abc123:secret456'
        );
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('API connection failed');
      });

      it('does not throw exception on failure', async () => {
        const mockAdd = vi.fn().mockRejectedValue(new Error('Network error'));

        vi.mocked(GhostAdminAPI).mockImplementation(() => ({
          posts: { add: mockAdd },
        }) as unknown as ReturnType<typeof GhostAdminAPI>);

        const plugin = new GhostPlugin(
          'https://blog.example.com',
          'abc123:secret456'
        );
        const state = makePostState();

        // Should not throw
        await expect(plugin.post(state)).resolves.toBeDefined();
      });
    });

    describe('retry logic', () => {
      it('retries on 429 rate limit error', async () => {
        const mockAdd = vi
          .fn()
          .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
          .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
          .mockResolvedValue({
            id: 'ghost-post-id-123',
            url: 'https://blog.example.com/weekly-update/',
          });

        vi.mocked(GhostAdminAPI).mockImplementation(() => ({
          posts: { add: mockAdd },
        }) as unknown as ReturnType<typeof GhostAdminAPI>);

        const plugin = new GhostPlugin(
          'https://blog.example.com',
          'abc123:secret456'
        );
        const state = makePostState();

        // Speed up test by reducing delays
        vi.useFakeTimers();
        const resultPromise = plugin.post(state);

        // Advance through the retry delays
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(3000);

        const result = await resultPromise;
        vi.useRealTimers();

        expect(result.success).toBe(true);
        expect(mockAdd).toHaveBeenCalledTimes(3);
      });

      it('returns error after max retries exceeded', async () => {
        const mockAdd = vi
          .fn()
          .mockRejectedValue({ status: 429, message: 'Rate limited' });

        vi.mocked(GhostAdminAPI).mockImplementation(() => ({
          posts: { add: mockAdd },
        }) as unknown as ReturnType<typeof GhostAdminAPI>);

        const plugin = new GhostPlugin(
          'https://blog.example.com',
          'abc123:secret456'
        );
        const state = makePostState();

        vi.useFakeTimers();
        const resultPromise = plugin.post(state);

        // Advance through all retry delays
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(3000);
        await vi.advanceTimersByTimeAsync(5000);

        const result = await resultPromise;
        vi.useRealTimers();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Rate limited');
        expect(mockAdd).toHaveBeenCalledTimes(3);
      });

      it('does not retry on non-429 errors', async () => {
        const mockAdd = vi
          .fn()
          .mockRejectedValue({ status: 401, message: 'Unauthorized' });

        vi.mocked(GhostAdminAPI).mockImplementation(() => ({
          posts: { add: mockAdd },
        }) as unknown as ReturnType<typeof GhostAdminAPI>);

        const plugin = new GhostPlugin(
          'https://blog.example.com',
          'abc123:secret456'
        );
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unauthorized');
        expect(mockAdd).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('name property', () => {
    it('returns ghost as the platform name', () => {
      const plugin = new GhostPlugin(
        'https://blog.example.com',
        'abc123:secret456'
      );

      expect(plugin.name).toBe('ghost');
    });
  });
});
