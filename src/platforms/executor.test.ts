/**
 * Tests for platform executor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PostState } from '../types/state.js';
import {
  composeSocialPostContent,
  getLinkTarget,
} from './executor.js';

describe('composeSocialPostContent', () => {
  let state: PostState;

  beforeEach(() => {
    state = {
      id: 'test-post',
      contentHash: 'hash123',
      status: 'approved',
      platforms: {},
      createdAt: '2026-02-01T00:00:00Z',
      teaser: {
        text: 'Check out this awesome update!',
        hashtags: ['devlog', 'opensource'],
        characterCount: 31,
      },
    };
  });

  it('appends Ghost URL when available and target is ghost', () => {
    state.platforms.ghost = {
      status: 'success',
      postUrl: 'https://blog.example.com/my-post',
      attemptedAt: '2026-02-01T00:00:00Z',
    };

    const result = composeSocialPostContent(state, 'ghost');

    expect(result).toBe('Check out this awesome update!\n\nhttps://blog.example.com/my-post');
  });

  it('returns teaser only when Ghost URL unavailable', () => {
    // No Ghost platform in state
    const result = composeSocialPostContent(state, 'ghost');

    expect(result).toBe('Check out this awesome update!');
  });

  it('returns teaser only when Ghost failed', () => {
    state.platforms.ghost = {
      status: 'failed',
      error: 'Ghost API error',
      attemptedAt: '2026-02-01T00:00:00Z',
    };

    const result = composeSocialPostContent(state, 'ghost');

    expect(result).toBe('Check out this awesome update!');
  });

  it('uses GitHub URL when target is github', () => {
    const result = composeSocialPostContent(state, 'github', 'https://github.com/user/repo');

    expect(result).toBe('Check out this awesome update!\n\nhttps://github.com/user/repo');
  });

  it('uses custom URL when target is custom URL', () => {
    const customUrl = 'https://my-custom-site.com/posts';
    const result = composeSocialPostContent(state, customUrl);

    expect(result).toBe('Check out this awesome update!\n\nhttps://my-custom-site.com/posts');
  });

  it('falls back to GitHub when Ghost fails and fallback provided', () => {
    state.platforms.ghost = {
      status: 'failed',
      error: 'Ghost API error',
      attemptedAt: '2026-02-01T00:00:00Z',
    };

    const result = composeSocialPostContent(
      state,
      'ghost',
      'https://github.com/user/repo'
    );

    expect(result).toBe('Check out this awesome update!\n\nhttps://github.com/user/repo');
  });

  it('handles missing teaser gracefully', () => {
    const stateNoTeaser = {
      ...state,
      teaser: undefined,
    };

    const result = composeSocialPostContent(stateNoTeaser, 'ghost');

    expect(result).toBe('');
  });

  it('handles empty teaser text', () => {
    state.teaser!.text = '';

    const result = composeSocialPostContent(state, 'ghost');

    expect(result).toBe('');
  });
});

describe('getLinkTarget', () => {
  const originalEnv = process.env.SOCIAL_LINK_TARGET;

  afterEach(() => {
    // Restore original env var
    if (originalEnv === undefined) {
      delete process.env.SOCIAL_LINK_TARGET;
    } else {
      process.env.SOCIAL_LINK_TARGET = originalEnv;
    }
  });

  it('returns ghost by default', () => {
    delete process.env.SOCIAL_LINK_TARGET;

    const result = getLinkTarget();

    expect(result).toBe('ghost');
  });

  it('reads SOCIAL_LINK_TARGET env var', () => {
    process.env.SOCIAL_LINK_TARGET = 'github';

    const result = getLinkTarget();

    expect(result).toBe('github');
  });

  it('returns custom URL from env var', () => {
    process.env.SOCIAL_LINK_TARGET = 'https://my-site.com';

    const result = getLinkTarget();

    expect(result).toBe('https://my-site.com');
  });
});

describe('postToAllPlatforms integration', () => {
  let state: PostState;

  beforeEach(() => {
    delete process.env.SOCIAL_LINK_TARGET;
    state = {
      id: 'test-post',
      contentHash: 'hash123',
      status: 'approved',
      platforms: {},
      createdAt: '2026-02-01T00:00:00Z',
      digest: {
        title: 'Daily Digest',
        content: '<p>Full digest content here</p>',
        repos: ['owner/repo'],
        commitCount: 5,
        periodType: 'daily',
        generatedAt: '2026-02-01T00:00:00Z',
      },
      teaser: {
        text: 'Check out this awesome update!',
        hashtags: ['devlog', 'opensource'],
        characterCount: 31,
      },
    };
  });

  it('posts Ghost first, then social platforms receive Ghost URL in teaser', async () => {
    const { postToAllPlatforms } = await import('./executor.js');

    // Mock Ghost plugin
    const ghostPlugin = {
      name: 'ghost',
      isConfigured: () => true,
      post: async () => ({
        success: true,
        platformPostId: 'ghost-123',
        platformUrl: 'https://blog.example.com/daily-digest',
      }),
    };

    // Mock Bluesky plugin - capture what it receives
    let blueskyReceivedState: PostState | undefined;
    const blueskyPlugin = {
      name: 'bluesky',
      isConfigured: () => true,
      post: async (postState: PostState) => {
        blueskyReceivedState = postState;
        return {
          success: true,
          platformPostId: 'bluesky-123',
          platformUrl: 'https://bsky.app/post/123',
        };
      },
    };

    const summary = await postToAllPlatforms([ghostPlugin, blueskyPlugin], state);

    expect(summary.allSucceeded).toBe(true);
    expect(summary.results).toHaveLength(2);
    expect(summary.results[0].platform).toBe('ghost');
    expect(summary.results[1].platform).toBe('bluesky');

    // Verify Bluesky received teaser with Ghost URL appended
    expect(blueskyReceivedState?.teaser?.text).toBe(
      'Check out this awesome update!\n\nhttps://blog.example.com/daily-digest'
    );
  });

  it('social platforms get teaser only when Ghost fails and no fallback', async () => {
    const { postToAllPlatforms } = await import('./executor.js');

    // Mock failing Ghost plugin
    const ghostPlugin = {
      name: 'ghost',
      isConfigured: () => true,
      post: async () => ({
        success: false,
        error: 'Ghost API error',
      }),
    };

    // Mock Mastodon plugin - capture what it receives
    let mastodonReceivedState: PostState | undefined;
    const mastodonPlugin = {
      name: 'mastodon',
      isConfigured: () => true,
      post: async (postState: PostState) => {
        mastodonReceivedState = postState;
        return {
          success: true,
          platformPostId: 'mastodon-123',
          platformUrl: 'https://mastodon.social/@user/123',
        };
      },
    };

    const summary = await postToAllPlatforms([ghostPlugin, mastodonPlugin], state);

    expect(summary.anySucceeded).toBe(true);
    expect(summary.failedPlatforms).toContain('ghost');
    expect(summary.successfulPlatforms).toContain('mastodon');

    // Verify Mastodon received teaser without link (Ghost failed, no fallback)
    expect(mastodonReceivedState?.teaser?.text).toBe('Check out this awesome update!');
  });

  it('GitHub fallback works when Ghost fails', async () => {
    const { postToAllPlatforms } = await import('./executor.js');

    // Mock failing Ghost plugin
    const ghostPlugin = {
      name: 'ghost',
      isConfigured: () => true,
      post: async () => ({
        success: false,
        error: 'Ghost API error',
      }),
    };

    // Mock Bluesky plugin - capture what it receives
    let blueskyReceivedState: PostState | undefined;
    const blueskyPlugin = {
      name: 'bluesky',
      isConfigured: () => true,
      post: async (postState: PostState) => {
        blueskyReceivedState = postState;
        return {
          success: true,
          platformPostId: 'bluesky-123',
          platformUrl: 'https://bsky.app/post/123',
        };
      },
    };

    const githubFallback = 'https://github.com/user/repo';
    const summary = await postToAllPlatforms([ghostPlugin, blueskyPlugin], state, githubFallback);

    expect(summary.anySucceeded).toBe(true);

    // Verify Bluesky received teaser with GitHub fallback URL
    expect(blueskyReceivedState?.teaser?.text).toBe(
      'Check out this awesome update!\n\nhttps://github.com/user/repo'
    );
  });
});
