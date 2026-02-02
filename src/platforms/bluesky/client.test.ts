/**
 * Tests for BlueskyPlugin
 *
 * TDD tests for Bluesky platform plugin implementing PlatformPlugin interface.
 * Tests cover isConfigured(), post(), rate limit retry, and grapheme validation.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PostState } from '../../types/state.js';

// Mock the @atproto/api module
vi.mock('@atproto/api', () => {
  return {
    AtpAgent: vi.fn().mockImplementation(() => ({
      login: vi.fn(),
      post: vi.fn(),
    })),
    RichText: vi.fn().mockImplementation((params) => ({
      text: params.text,
      graphemeLength: params.text.length,
      facets: [],
      detectFacets: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import { BlueskyPlugin } from './client.js';
import { AtpAgent, RichText } from '@atproto/api';

describe('BlueskyPlugin', () => {
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
      text: 'Check out our latest updates! #devlog #opensource',
      hashtags: ['#devlog', '#opensource'],
      characterCount: 52,
    },
    ...overrides,
  });

  describe('isConfigured', () => {
    it('returns true when both identifier and password are provided', () => {
      const plugin = new BlueskyPlugin(
        'user.bsky.social',
        'app-password-123'
      );

      expect(plugin.isConfigured()).toBe(true);
    });

    it('returns false when identifier is missing', () => {
      const plugin = new BlueskyPlugin(undefined, 'app-password-123');

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when password is missing', () => {
      const plugin = new BlueskyPlugin('user.bsky.social', undefined);

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when identifier is empty string', () => {
      const plugin = new BlueskyPlugin('', 'app-password-123');

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when password is empty string', () => {
      const plugin = new BlueskyPlugin('user.bsky.social', '');

      expect(plugin.isConfigured()).toBe(false);
    });

    it('returns false when both identifier and password are missing', () => {
      const plugin = new BlueskyPlugin(undefined, undefined);

      expect(plugin.isConfigured()).toBe(false);
    });
  });

  describe('post', () => {
    describe('validation', () => {
      it('returns error when state has no teaser', async () => {
        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
        );
        const state = makePostState({ teaser: undefined });

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('No teaser content');
      });

      it('returns error when plugin is not configured', async () => {
        const plugin = new BlueskyPlugin(undefined, undefined);
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Bluesky not configured');
      });

      it('returns error when post exceeds 300 graphemes', async () => {
        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
        );
        const longText = 'a'.repeat(301);
        const state = makePostState({
          teaser: {
            text: longText,
            hashtags: [],
            characterCount: 301,
          },
        });

        // Mock RichText to report actual length
        vi.mocked(RichText).mockImplementation((params) => ({
          text: params.text,
          graphemeLength: 301,
          facets: [],
          detectFacets: vi.fn().mockResolvedValue(undefined),
        }));

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Post exceeds 300 graphemes: 301');
      });
    });

    describe('successful post', () => {
      it('returns success with platformPostId and platformUrl on API success', async () => {
        const mockPost = vi.fn().mockResolvedValue({
          uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
          cid: 'bafyrei123',
        });

        const mockLogin = vi.fn().mockResolvedValue({
          success: true,
        });

        vi.mocked(AtpAgent).mockImplementation(() => ({
          login: mockLogin,
          post: mockPost,
        }) as unknown as InstanceType<typeof AtpAgent>);

        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
        );
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(true);
        expect(result.platformPostId).toBe('at://did:plc:abc123/app.bsky.feed.post/xyz789');
        expect(result.platformUrl).toBe('https://bsky.app/profile/user.bsky.social/post/xyz789');
      });

      it('calls login only on first post', async () => {
        const mockPost = vi.fn().mockResolvedValue({
          uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
          cid: 'bafyrei123',
        });

        const mockLogin = vi.fn().mockResolvedValue({
          success: true,
        });

        vi.mocked(AtpAgent).mockImplementation(() => ({
          login: mockLogin,
          post: mockPost,
        }) as unknown as InstanceType<typeof AtpAgent>);

        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
        );
        const state = makePostState();

        await plugin.post(state);
        await plugin.post(state);

        expect(mockLogin).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledTimes(2);
      });

      it('uses RichText for facet detection', async () => {
        const mockPost = vi.fn().mockResolvedValue({
          uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
          cid: 'bafyrei123',
        });

        const mockLogin = vi.fn().mockResolvedValue({
          success: true,
        });

        const mockDetectFacets = vi.fn().mockResolvedValue(undefined);

        vi.mocked(AtpAgent).mockImplementation(() => ({
          login: mockLogin,
          post: mockPost,
        }) as unknown as InstanceType<typeof AtpAgent>);

        vi.mocked(RichText).mockImplementation((params) => ({
          text: params.text,
          graphemeLength: params.text.length,
          facets: [{ index: { byteStart: 0, byteEnd: 5 } }],
          detectFacets: mockDetectFacets,
        }));

        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
        );
        const state = makePostState();

        await plugin.post(state);

        expect(mockDetectFacets).toHaveBeenCalled();
        expect(mockPost).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.any(String),
            facets: expect.any(Array),
            langs: ['en'],
          })
        );
      });

      it('includes default language en in post', async () => {
        const mockPost = vi.fn().mockResolvedValue({
          uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
          cid: 'bafyrei123',
        });

        const mockLogin = vi.fn().mockResolvedValue({
          success: true,
        });

        vi.mocked(AtpAgent).mockImplementation(() => ({
          login: mockLogin,
          post: mockPost,
        }) as unknown as InstanceType<typeof AtpAgent>);

        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
        );
        const state = makePostState();

        await plugin.post(state);

        expect(mockPost).toHaveBeenCalledWith(
          expect.objectContaining({
            langs: ['en'],
          })
        );
      });
    });

    describe('error handling', () => {
      it('returns error message on API failure without throwing', async () => {
        const mockPost = vi.fn().mockRejectedValue(new Error('API connection failed'));

        const mockLogin = vi.fn().mockResolvedValue({
          success: true,
        });

        vi.mocked(AtpAgent).mockImplementation(() => ({
          login: mockLogin,
          post: mockPost,
        }) as unknown as InstanceType<typeof AtpAgent>);

        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
        );
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('API connection failed');
      });

      it('does not throw exception on failure', async () => {
        const mockPost = vi.fn().mockRejectedValue(new Error('Network error'));

        const mockLogin = vi.fn().mockResolvedValue({
          success: true,
        });

        vi.mocked(AtpAgent).mockImplementation(() => ({
          login: mockLogin,
          post: mockPost,
        }) as unknown as InstanceType<typeof AtpAgent>);

        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
        );
        const state = makePostState();

        // Should not throw
        await expect(plugin.post(state)).resolves.toBeDefined();
      });
    });

    describe('retry logic', () => {
      it('retries on 429 rate limit error', async () => {
        const mockPost = vi
          .fn()
          .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
          .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
          .mockResolvedValue({
            uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
            cid: 'bafyrei123',
          });

        const mockLogin = vi.fn().mockResolvedValue({
          success: true,
        });

        vi.mocked(AtpAgent).mockImplementation(() => ({
          login: mockLogin,
          post: mockPost,
        }) as unknown as InstanceType<typeof AtpAgent>);

        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
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
        expect(mockPost).toHaveBeenCalledTimes(3);
      });

      it('returns error after max retries exceeded', async () => {
        const mockPost = vi
          .fn()
          .mockRejectedValue({ status: 429, message: 'Rate limited' });

        const mockLogin = vi.fn().mockResolvedValue({
          success: true,
        });

        vi.mocked(AtpAgent).mockImplementation(() => ({
          login: mockLogin,
          post: mockPost,
        }) as unknown as InstanceType<typeof AtpAgent>);

        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
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
        expect(mockPost).toHaveBeenCalledTimes(3);
      });

      it('does not retry on non-429 errors', async () => {
        const mockPost = vi
          .fn()
          .mockRejectedValue({ status: 401, message: 'Unauthorized' });

        const mockLogin = vi.fn().mockResolvedValue({
          success: true,
        });

        vi.mocked(AtpAgent).mockImplementation(() => ({
          login: mockLogin,
          post: mockPost,
        }) as unknown as InstanceType<typeof AtpAgent>);

        const plugin = new BlueskyPlugin(
          'user.bsky.social',
          'app-password-123'
        );
        const state = makePostState();

        const result = await plugin.post(state);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unauthorized');
        expect(mockPost).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('name property', () => {
    it('returns bluesky as the platform name', () => {
      const plugin = new BlueskyPlugin(
        'user.bsky.social',
        'app-password-123'
      );

      expect(plugin.name).toBe('bluesky');
    });
  });
});
