/**
 * Tests for MastodonPlugin
 *
 * TDD tests for Mastodon platform plugin implementing PlatformPlugin interface.
 * Tests cover isConfigured(), post(), retry logic, and visibility settings.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PostState } from '../../types/state.js';

// Mock the masto module
vi.mock('masto', () => {
  return {
    createRestAPIClient: vi.fn().mockImplementation(() => ({
      v1: {
        statuses: {
          create: vi.fn(),
        },
      },
    })),
  };
});

import { MastodonPlugin } from './client.js';
import { createRestAPIClient } from 'masto';

describe('MastodonPlugin', () => {
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
    it('returns true when both instanceUrl and accessToken are provided', () => {
      const plugin = new MastodonPlugin(
        'https://mastodon.social',
        'token123'
      );

      expect(plugin.isConfigured()).toBe(true);
    });

    it('returns false when instanceUrl is missing', () => {
      const plugin = new MastodonPlugin(undefined, 'token123');

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when accessToken is missing', () => {
      const plugin = new MastodonPlugin('https://mastodon.social', undefined);

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when instanceUrl is empty string', () => {
      const plugin = new MastodonPlugin('', 'token123');

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when accessToken is empty string', () => {
      const plugin = new MastodonPlugin('https://mastodon.social', '');

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when both instanceUrl and accessToken are missing', () => {
      const plugin = new MastodonPlugin(undefined, undefined);

      expect(plugin.isConfigured()).toBe(false);
    });
  });

  describe('post', () => {
    describe('validation', () => {
      it('returns error when state has no teaser', async () => {
        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123'
        );
        const state = makePostState({ teaser: undefined });

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('No teaser content');
      });

      it('returns error when plugin is not configured', async () => {
        const plugin = new MastodonPlugin(undefined, undefined);
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Mastodon not configured');
      });
    });

    describe('successful post', () => {
      it('returns success with platformPostId and platformUrl on API success', async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: '123456',
          url: 'https://mastodon.social/@user/123456',
        });

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123'
        );
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(true);
        expect(result.platformPostId).toBe('123456');
        expect(result.platformUrl).toBe('https://mastodon.social/@user/123456');
      });

      it('passes correct parameters to Mastodon API', async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: '123456',
          url: 'https://mastodon.social/@user/123456',
        });

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123',
          'public'
        );
        const state = makePostState();

        await plugin.post(state);

        expect(mockCreate).toHaveBeenCalledWith({
          status: 'Check out our latest updates!',
          visibility: 'public',
          language: 'en',
        });
      });

      it('uses unlisted visibility when configured', async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: '123456',
          url: 'https://mastodon.social/@user/123456',
        });

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123',
          'unlisted'
        );
        const state = makePostState();

        await plugin.post(state);

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ visibility: 'unlisted' })
        );
      });

      it('uses private visibility when configured', async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: '123456',
          url: 'https://mastodon.social/@user/123456',
        });

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123',
          'private'
        );
        const state = makePostState();

        await plugin.post(state);

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ visibility: 'private' })
        );
      });

      it('defaults to public visibility when not specified', async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: '123456',
          url: 'https://mastodon.social/@user/123456',
        });

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123'
        );
        const state = makePostState();

        await plugin.post(state);

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ visibility: 'public' })
        );
      });

      it('includes language tag in posts', async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: '123456',
          url: 'https://mastodon.social/@user/123456',
        });

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123'
        );
        const state = makePostState();

        await plugin.post(state);

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ language: 'en' })
        );
      });
    });

    describe('error handling', () => {
      it('returns error message on API failure without throwing', async () => {
        const mockCreate = vi.fn().mockRejectedValue(new Error('API connection failed'));

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123'
        );
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('API connection failed');
      });

      it('does not throw exception on failure', async () => {
        const mockCreate = vi.fn().mockRejectedValue(new Error('Network error'));

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123'
        );
        const state = makePostState();

        // Should not throw
        await expect(plugin.post(state)).resolves.toBeDefined();
      });
    });

    describe('retry logic', () => {
      it('retries on 429 rate limit error', async () => {
        const mockCreate = vi
          .fn()
          .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
          .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
          .mockResolvedValue({
            id: '123456',
            url: 'https://mastodon.social/@user/123456',
          });

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123'
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
        expect(mockCreate).toHaveBeenCalledTimes(3);
      });

      it('returns error after max retries exceeded', async () => {
        const mockCreate = vi
          .fn()
          .mockRejectedValue({ status: 429, message: 'Rate limited' });

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123'
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
        expect(mockCreate).toHaveBeenCalledTimes(3);
      });

      it('does not retry on non-429 errors', async () => {
        const mockCreate = vi
          .fn()
          .mockRejectedValue({ status: 401, message: 'Unauthorized' });

        vi.mocked(createRestAPIClient).mockImplementation(() => ({
          v1: { statuses: { create: mockCreate } },
        }) as any);

        const plugin = new MastodonPlugin(
          'https://mastodon.social',
          'token123'
        );
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unauthorized');
        expect(mockCreate).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('name property', () => {
    it('returns mastodon as the platform name', () => {
      const plugin = new MastodonPlugin(
        'https://mastodon.social',
        'token123'
      );

      expect(plugin.name).toBe('mastodon');
    });
  });
});
