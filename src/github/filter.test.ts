/**
 * Tests for commit filtering and classification functions
 *
 * TDD tests for isBotCommit, classifyCommit, and filterAndClassifyCommits
 */

import { describe, expect, it } from 'vitest';
import type { Commit } from '../types/content.js';
import {
  classifyCommit,
  filterAndClassifyCommits,
  isBotCommit,
} from './filter.js';

describe('isBotCommit', () => {
  describe('author patterns', () => {
    it('returns true for author ending with [bot]', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'chore: bump deps',
          author: 'dependabot[bot]',
          email: 'dependabot@example.com',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(true);
    });

    it('returns true for renovate[bot]', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'chore: update deps',
          author: 'renovate[bot]',
          email: 'renovate@example.com',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(true);
    });

    it('returns true for github-actions[bot]', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'ci: automated commit',
          author: 'github-actions[bot]',
          email: 'actions@github.com',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(true);
    });

    it('is case-insensitive for author patterns', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'chore: bump deps',
          author: 'DEPENDABOT[BOT]',
          email: 'dependabot@example.com',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(true);
    });
  });

  describe('email patterns', () => {
    it('returns true for noreply.github.com emails', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'chore: bump deps',
          author: 'User',
          email: '49699333+dependabot[bot]@users.noreply.github.com',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(true);
    });
  });

  describe('known bot names', () => {
    it('returns true for author containing dependabot', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'chore: bump deps',
          author: 'dependabot-preview',
          email: 'support@dependabot.com',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(true);
    });

    it('returns true for author containing renovate', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'chore: update deps',
          author: 'renovate-bot',
          email: 'support@renovate.io',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(true);
    });

    it('returns true for author containing github-actions', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'ci: deploy',
          author: 'github-actions',
          email: 'noreply@github.com',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(true);
    });
  });

  describe('human commits', () => {
    it('returns false for regular human commits', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'feat: add login',
          author: 'John Doe',
          email: 'john@example.com',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(false);
    });

    it('returns false for commits with author not matching patterns', () => {
      expect(
        isBotCommit({
          sha: 'abc123',
          message: 'fix: bug',
          author: 'Jane Smith',
          email: 'jane@company.org',
          timestamp: '2026-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/commit/abc123',
        })
      ).toBe(false);
    });
  });
});

describe('classifyCommit', () => {
  describe('conventional commit types', () => {
    it('classifies feat: commits', () => {
      expect(classifyCommit('feat: add login')).toBe('feat');
    });

    it('classifies fix: commits', () => {
      expect(classifyCommit('fix: resolve token issue')).toBe('fix');
    });

    it('classifies docs: commits', () => {
      expect(classifyCommit('docs: update README')).toBe('docs');
    });

    it('classifies chore: commits', () => {
      expect(classifyCommit('chore: bump lodash')).toBe('chore');
    });

    it('classifies refactor: commits', () => {
      expect(classifyCommit('refactor: simplify logic')).toBe('refactor');
    });

    it('classifies test: commits', () => {
      expect(classifyCommit('test: add unit tests')).toBe('test');
    });

    it('classifies ci: commits', () => {
      expect(classifyCommit('ci: update workflow')).toBe('ci');
    });

    it('classifies perf: commits', () => {
      expect(classifyCommit('perf: optimize query')).toBe('perf');
    });

    it('classifies style: commits', () => {
      expect(classifyCommit('style: format code')).toBe('style');
    });

    it('classifies build: commits', () => {
      expect(classifyCommit('build: update webpack')).toBe('build');
    });

    it('classifies revert: commits', () => {
      expect(classifyCommit('revert: undo last commit')).toBe('revert');
    });
  });

  describe('scoped commits', () => {
    it('classifies feat(api): commits', () => {
      expect(classifyCommit('feat(api): add endpoint')).toBe('feat');
    });

    it('classifies fix(auth): commits', () => {
      expect(classifyCommit('fix(auth): resolve token issue')).toBe('fix');
    });

    it('classifies chore(deps): commits', () => {
      expect(classifyCommit('chore(deps): bump lodash')).toBe('chore');
    });
  });

  describe('case insensitivity', () => {
    it('classifies uppercase FEAT: commits', () => {
      expect(classifyCommit('FEAT: uppercase')).toBe('feat');
    });

    it('classifies mixed case Fix: commits', () => {
      expect(classifyCommit('Fix: mixed case')).toBe('fix');
    });
  });

  describe('multi-line messages', () => {
    it('uses only the first line for classification', () => {
      expect(classifyCommit('feat: add thing\n\nLong description')).toBe(
        'feat'
      );
    });

    it('uses only the first line even with multiple newlines', () => {
      expect(
        classifyCommit(
          'fix: bug\n\nThis is a long description\nWith multiple lines'
        )
      ).toBe('fix');
    });
  });

  describe('non-conventional commits', () => {
    it('returns other for non-conventional messages', () => {
      expect(classifyCommit('Update README.md')).toBe('other');
    });

    it('returns other for random messages', () => {
      expect(classifyCommit('WIP')).toBe('other');
    });

    it('returns other for messages without colon after type', () => {
      expect(classifyCommit('feat add login')).toBe('other');
    });
  });
});

describe('filterAndClassifyCommits', () => {
  const makeCommit = (
    overrides: Partial<Commit> = {}
  ): Commit => ({
    sha: 'abc123',
    message: 'feat: add feature',
    author: 'John Doe',
    email: 'john@example.com',
    timestamp: '2026-01-01T00:00:00Z',
    url: 'https://github.com/test/repo/commit/abc123',
    ...overrides,
  });

  it('classifies human commits', () => {
    const commits = [
      makeCommit({ sha: '1', message: 'feat: add login' }),
      makeCommit({ sha: '2', message: 'fix: resolve bug' }),
    ];

    const result = filterAndClassifyCommits(commits);

    expect(result.human).toHaveLength(2);
    expect(result.human[0].type).toBe('feat');
    expect(result.human[1].type).toBe('fix');
    expect(result.botCount).toBe(0);
  });

  it('filters out bot commits', () => {
    const commits = [
      makeCommit({ sha: '1', message: 'feat: add login' }),
      makeCommit({
        sha: '2',
        message: 'chore: bump deps',
        author: 'dependabot[bot]',
        email: 'dependabot@example.com',
      }),
    ];

    const result = filterAndClassifyCommits(commits);

    expect(result.human).toHaveLength(1);
    expect(result.human[0].sha).toBe('1');
    expect(result.botCount).toBe(1);
  });

  it('counts multiple bot commits', () => {
    const commits = [
      makeCommit({
        sha: '1',
        message: 'chore: bump lodash',
        author: 'dependabot[bot]',
      }),
      makeCommit({
        sha: '2',
        message: 'chore: update deps',
        author: 'renovate[bot]',
      }),
      makeCommit({ sha: '3', message: 'feat: add feature' }),
    ];

    const result = filterAndClassifyCommits(commits);

    expect(result.human).toHaveLength(1);
    expect(result.botCount).toBe(2);
  });

  it('sets isBot flag correctly on classified commits', () => {
    const commits = [
      makeCommit({ sha: '1', message: 'feat: add login' }),
    ];

    const result = filterAndClassifyCommits(commits);

    expect(result.human[0].isBot).toBe(false);
  });

  it('handles empty array', () => {
    const result = filterAndClassifyCommits([]);

    expect(result.human).toHaveLength(0);
    expect(result.botCount).toBe(0);
  });

  it('preserves all commit fields in classified commits', () => {
    const commits = [
      makeCommit({
        sha: 'sha123',
        message: 'feat: add login',
        author: 'John Doe',
        email: 'john@example.com',
        timestamp: '2026-01-01T00:00:00Z',
        url: 'https://github.com/test/repo/commit/sha123',
      }),
    ];

    const result = filterAndClassifyCommits(commits);
    const classified = result.human[0];

    expect(classified.sha).toBe('sha123');
    expect(classified.message).toBe('feat: add login');
    expect(classified.author).toBe('John Doe');
    expect(classified.email).toBe('john@example.com');
    expect(classified.timestamp).toBe('2026-01-01T00:00:00Z');
    expect(classified.url).toBe('https://github.com/test/repo/commit/sha123');
  });
});
