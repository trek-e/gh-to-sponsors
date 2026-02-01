/**
 * Tests for state management module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadState,
  saveState,
  updatePostStatus,
  markTokenUsed,
  cleanExpiredTokens,
  createPost,
  EMPTY_STATE
} from '../src/state/index.js';
import type { DigestState, PostState } from '../src/types/state.js';

describe('loadState', () => {
  let testDir: string;
  let testPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `state-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testPath = join(testDir, 'digest.json');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('returns EMPTY_STATE when file does not exist', async () => {
    const state = await loadState(testPath);
    expect(state).toEqual(EMPTY_STATE);
  });

  it('throws on corrupted JSON', async () => {
    await fs.writeFile(testPath, 'invalid json{{{', 'utf-8');
    await expect(loadState(testPath)).rejects.toThrow();
  });

  it('loads valid state from file', async () => {
    const expectedState: DigestState = {
      posts: {
        'post-1': {
          id: 'post-1',
          contentHash: 'hash123',
          status: 'approved',
          platforms: { twitter: 'success' },
          createdAt: '2026-02-01T12:00:00Z',
          approvedAt: '2026-02-01T13:00:00Z'
        }
      },
      usedTokens: ['jti-1', 'jti-2'],
      lastRun: '2026-02-01T12:00:00Z'
    };

    await fs.writeFile(testPath, JSON.stringify(expectedState), 'utf-8');

    const state = await loadState(testPath);
    expect(state).toEqual(expectedState);
  });
});

describe('saveState', () => {
  let testDir: string;
  let testPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `state-test-${Date.now()}-${Math.random()}`);
    testPath = join(testDir, 'digest.json');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('creates directory if not exists', async () => {
    const state: DigestState = {
      posts: {},
      usedTokens: [],
      lastRun: ''
    };

    await saveState(state, testPath);

    const exists = await fs.access(testPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('saves state as pretty-printed JSON', async () => {
    const state: DigestState = {
      posts: {
        'post-1': {
          id: 'post-1',
          contentHash: 'hash123',
          status: 'pending',
          platforms: {},
          createdAt: '2026-02-01T12:00:00Z'
        }
      },
      usedTokens: ['jti-1'],
      lastRun: '2026-02-01T12:00:00Z'
    };

    await saveState(state, testPath);

    const content = await fs.readFile(testPath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed).toEqual(state);
    expect(content).toContain('\n'); // Pretty-printed has newlines
  });

  it('roundtrip preserves data', async () => {
    const originalState: DigestState = {
      posts: {
        'post-1': {
          id: 'post-1',
          contentHash: 'hash123',
          status: 'posted',
          platforms: {
            twitter: 'success',
            mastodon: 'failed'
          },
          createdAt: '2026-02-01T12:00:00Z',
          approvedAt: '2026-02-01T13:00:00Z'
        },
        'post-2': {
          id: 'post-2',
          contentHash: 'hash456',
          status: 'skipped',
          platforms: {},
          createdAt: '2026-02-01T14:00:00Z'
        }
      },
      usedTokens: ['jti-1', 'jti-2', 'jti-3'],
      lastRun: '2026-02-01T15:00:00Z'
    };

    await saveState(originalState, testPath);
    const loadedState = await loadState(testPath);

    expect(loadedState).toEqual(originalState);
  });
});

describe('updatePostStatus', () => {
  it('updates existing post status', () => {
    const state: DigestState = {
      posts: {
        'post-1': {
          id: 'post-1',
          contentHash: 'hash123',
          status: 'pending',
          platforms: {},
          createdAt: '2026-02-01T12:00:00Z'
        }
      },
      usedTokens: [],
      lastRun: ''
    };

    const newState = updatePostStatus(state, 'post-1', 'skipped');

    expect(newState.posts['post-1'].status).toBe('skipped');
  });

  it('sets approvedAt when status is approved', () => {
    const state: DigestState = {
      posts: {
        'post-1': {
          id: 'post-1',
          contentHash: 'hash123',
          status: 'pending',
          platforms: {},
          createdAt: '2026-02-01T12:00:00Z'
        }
      },
      usedTokens: [],
      lastRun: ''
    };

    const beforeApproval = Date.now();
    const newState = updatePostStatus(state, 'post-1', 'approved');
    const afterApproval = Date.now();

    expect(newState.posts['post-1'].status).toBe('approved');
    expect(newState.posts['post-1'].approvedAt).toBeDefined();

    const approvedAt = new Date(newState.posts['post-1'].approvedAt!).getTime();
    expect(approvedAt).toBeGreaterThanOrEqual(beforeApproval);
    expect(approvedAt).toBeLessThanOrEqual(afterApproval);
  });

  it('updates platforms when provided', () => {
    const state: DigestState = {
      posts: {
        'post-1': {
          id: 'post-1',
          contentHash: 'hash123',
          status: 'approved',
          platforms: {},
          createdAt: '2026-02-01T12:00:00Z',
          approvedAt: '2026-02-01T13:00:00Z'
        }
      },
      usedTokens: [],
      lastRun: ''
    };

    const platforms = {
      twitter: 'success' as const,
      mastodon: 'failed' as const
    };

    const newState = updatePostStatus(state, 'post-1', 'posted', platforms);

    expect(newState.posts['post-1'].platforms).toEqual(platforms);
  });

  it('throws when post not found', () => {
    const state: DigestState = {
      posts: {},
      usedTokens: [],
      lastRun: ''
    };

    expect(() => updatePostStatus(state, 'nonexistent', 'approved')).toThrow('Post nonexistent not found');
  });

  it('is immutable (original state unchanged)', () => {
    const state: DigestState = {
      posts: {
        'post-1': {
          id: 'post-1',
          contentHash: 'hash123',
          status: 'pending',
          platforms: {},
          createdAt: '2026-02-01T12:00:00Z'
        }
      },
      usedTokens: [],
      lastRun: ''
    };

    const originalStatus = state.posts['post-1'].status;
    updatePostStatus(state, 'post-1', 'approved');

    expect(state.posts['post-1'].status).toBe(originalStatus);
  });
});

describe('markTokenUsed', () => {
  it('adds jti to usedTokens array', () => {
    const state: DigestState = {
      posts: {},
      usedTokens: ['jti-1'],
      lastRun: ''
    };

    const newState = markTokenUsed(state, 'jti-2');

    expect(newState.usedTokens).toContain('jti-1');
    expect(newState.usedTokens).toContain('jti-2');
    expect(newState.usedTokens).toHaveLength(2);
  });

  it('allows duplicate tokens (adds anyway)', () => {
    const state: DigestState = {
      posts: {},
      usedTokens: ['jti-1'],
      lastRun: ''
    };

    const newState = markTokenUsed(state, 'jti-1');

    expect(newState.usedTokens).toHaveLength(2);
    expect(newState.usedTokens.filter(jti => jti === 'jti-1')).toHaveLength(2);
  });

  it('is immutable (original state unchanged)', () => {
    const state: DigestState = {
      posts: {},
      usedTokens: ['jti-1'],
      lastRun: ''
    };

    const originalLength = state.usedTokens.length;
    markTokenUsed(state, 'jti-2');

    expect(state.usedTokens).toHaveLength(originalLength);
  });
});

describe('cleanExpiredTokens', () => {
  it('removes all tokens when lastRun is older than maxAge', () => {
    const oldDate = new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(); // 100 hours ago

    const state: DigestState = {
      posts: {},
      usedTokens: ['jti-1', 'jti-2', 'jti-3'],
      lastRun: oldDate
    };

    const maxAgeMs = 48 * 60 * 60 * 1000; // 48 hours
    const newState = cleanExpiredTokens(state, maxAgeMs);

    expect(newState.usedTokens).toHaveLength(0);
  });

  it('keeps all tokens when lastRun is within maxAge', () => {
    const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago

    const state: DigestState = {
      posts: {},
      usedTokens: ['jti-1', 'jti-2', 'jti-3'],
      lastRun: recentDate
    };

    const maxAgeMs = 48 * 60 * 60 * 1000; // 48 hours
    const newState = cleanExpiredTokens(state, maxAgeMs);

    expect(newState.usedTokens).toHaveLength(3);
  });

  it('keeps all tokens when lastRun is empty', () => {
    const state: DigestState = {
      posts: {},
      usedTokens: ['jti-1', 'jti-2'],
      lastRun: ''
    };

    const maxAgeMs = 48 * 60 * 60 * 1000;
    const newState = cleanExpiredTokens(state, maxAgeMs);

    expect(newState.usedTokens).toHaveLength(2);
  });

  it('is immutable (original state unchanged)', () => {
    const oldDate = new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString();

    const state: DigestState = {
      posts: {},
      usedTokens: ['jti-1', 'jti-2'],
      lastRun: oldDate
    };

    const originalLength = state.usedTokens.length;
    cleanExpiredTokens(state, 48 * 60 * 60 * 1000);

    expect(state.usedTokens).toHaveLength(originalLength);
  });
});

describe('createPost', () => {
  it('adds new post with timestamp', () => {
    const state: DigestState = {
      posts: {},
      usedTokens: [],
      lastRun: ''
    };

    const postData: Omit<PostState, 'createdAt'> = {
      id: 'post-1',
      contentHash: 'hash123',
      status: 'pending',
      platforms: {}
    };

    const beforeCreate = Date.now();
    const newState = createPost(state, postData);
    const afterCreate = Date.now();

    expect(newState.posts['post-1']).toBeDefined();
    expect(newState.posts['post-1'].id).toBe('post-1');
    expect(newState.posts['post-1'].contentHash).toBe('hash123');
    expect(newState.posts['post-1'].status).toBe('pending');
    expect(newState.posts['post-1'].createdAt).toBeDefined();

    const createdAt = new Date(newState.posts['post-1'].createdAt).getTime();
    expect(createdAt).toBeGreaterThanOrEqual(beforeCreate);
    expect(createdAt).toBeLessThanOrEqual(afterCreate);
  });

  it('preserves existing posts', () => {
    const state: DigestState = {
      posts: {
        'post-1': {
          id: 'post-1',
          contentHash: 'hash123',
          status: 'approved',
          platforms: {},
          createdAt: '2026-02-01T12:00:00Z',
          approvedAt: '2026-02-01T13:00:00Z'
        }
      },
      usedTokens: [],
      lastRun: ''
    };

    const newPostData: Omit<PostState, 'createdAt'> = {
      id: 'post-2',
      contentHash: 'hash456',
      status: 'pending',
      platforms: {}
    };

    const newState = createPost(state, newPostData);

    expect(newState.posts['post-1']).toEqual(state.posts['post-1']);
    expect(newState.posts['post-2']).toBeDefined();
  });

  it('is immutable (original state unchanged)', () => {
    const state: DigestState = {
      posts: {},
      usedTokens: [],
      lastRun: ''
    };

    const originalPostsCount = Object.keys(state.posts).length;

    createPost(state, {
      id: 'post-1',
      contentHash: 'hash123',
      status: 'pending',
      platforms: {}
    });

    expect(Object.keys(state.posts)).toHaveLength(originalPostsCount);
  });
});

describe('immutability verification', () => {
  it('all update functions return new state objects', () => {
    const state: DigestState = {
      posts: {
        'post-1': {
          id: 'post-1',
          contentHash: 'hash123',
          status: 'pending',
          platforms: {},
          createdAt: '2026-02-01T12:00:00Z'
        }
      },
      usedTokens: ['jti-1'],
      lastRun: '2026-02-01T12:00:00Z'
    };

    const newState1 = updatePostStatus(state, 'post-1', 'approved');
    const newState2 = markTokenUsed(state, 'jti-2');
    const newState3 = cleanExpiredTokens(state, 1000);
    const newState4 = createPost(state, {
      id: 'post-2',
      contentHash: 'hash456',
      status: 'pending',
      platforms: {}
    });

    // All should return different object references
    expect(newState1).not.toBe(state);
    expect(newState2).not.toBe(state);
    expect(newState3).not.toBe(state);
    expect(newState4).not.toBe(state);

    // Original state should be unchanged
    expect(state.posts['post-1'].status).toBe('pending');
    expect(state.usedTokens).toHaveLength(1);
    expect(Object.keys(state.posts)).toHaveLength(1);
  });
});
