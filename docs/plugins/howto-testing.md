# How to Test Your Plugin

A practical guide to testing platform plugins with Vitest, mocked APIs, and compliance testing.

## Overview

Testing platform plugins requires:

1. **Compliance testing** - Verify your plugin implements the `PlatformPlugin` interface correctly
2. **Unit testing** - Test plugin-specific logic with mocked API responses
3. **Edge case testing** - Handle missing content, API failures, and rate limits

**Tools:**
- [Vitest](https://vitest.dev/) - Fast, modern test runner
- `vi.mock()` - Mock external API modules
- `vi.useFakeTimers()` - Test retry logic without real delays

## Using Test Fixtures with makePostState

All platform tests need realistic `PostState` objects. Create a helper function to generate test fixtures:

```typescript
import type { PostState } from 'gh-to-sponsors/types/state';

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
```

### Usage Examples

**Default state:**
```typescript
const state = makePostState();
// Has both digest and teaser
```

**Custom digest content:**
```typescript
const state = makePostState({
  digest: {
    title: 'Daily Update',
    content: '<p>Bug fixes</p>',
    repos: ['myorg/myrepo'],
    commitCount: 2,
    periodType: 'daily',
    generatedAt: '2026-01-02T00:00:00Z',
  },
});
```

**Missing teaser (test validation):**
```typescript
const state = makePostState({ teaser: undefined });
// Plugin should return error
```

**Release announcement:**
```typescript
const state = makePostState({
  release: {
    type: 'release',
    tagName: 'v1.2.0',
    title: 'Version 1.2.0',
    body: 'New features and bug fixes',
    releaseUrl: 'https://github.com/owner/repo/releases/tag/v1.2.0',
    downloadLinks: [],
    isPrerelease: false,
    repoName: 'owner/repo',
  },
});
```

## Mocking External APIs

Platform plugins depend on external SDKs (e.g., `@tryghost/admin-api`, `@atproto/api`). Use Vitest's `vi.mock()` to replace these with test doubles.

### Pattern: Mock at Module Level

Mock the entire module before importing your plugin:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock BEFORE importing the plugin
vi.mock('@tryghost/admin-api', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      posts: {
        add: vi.fn(),
      },
    })),
  };
});

// NOW import the plugin and the mocked module
import { GhostPlugin } from './client.js';
import GhostAdminAPI from '@tryghost/admin-api';
```

### Example: Ghost Plugin Testing

```typescript
describe('GhostPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully posts digest to Ghost', async () => {
    const plugin = new GhostPlugin(
      'https://blog.example.com',
      'abc123:secret456'
    );

    const state = makePostState();

    // Configure mock to return success
    const mockAdd = vi.fn().mockResolvedValue({
      id: 'ghost-post-id',
      url: 'https://blog.example.com/weekly-update/',
    });

    vi.mocked(GhostAdminAPI).mockImplementation(() => ({
      posts: { add: mockAdd },
    } as any));

    const result = await plugin.post(state);

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe('ghost-post-id');
    expect(result.platformUrl).toBe('https://blog.example.com/weekly-update/');

    // Verify API was called with correct parameters
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
});
```

### Example: Bluesky Plugin Testing

Bluesky uses `@atproto/api` which exports both `AtpAgent` and `RichText`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the entire @atproto/api module
vi.mock('@atproto/api', () => {
  return {
    AtpAgent: vi.fn().mockImplementation(() => ({
      login: vi.fn().mockResolvedValue({}),
      post: vi.fn(),
    })),
    RichText: vi.fn().mockImplementation(({ text }: { text: string }) => ({
      text,
      facets: [],
      graphemeLength: text.length,
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

  it('successfully posts teaser to Bluesky', async () => {
    const plugin = new BlueskyPlugin('user.bsky.social', 'app-password');
    const state = makePostState();

    // Configure mock to return success
    const mockPost = vi.fn().mockResolvedValue({
      uri: 'at://did:plc:abc/app.bsky.feed.post/xyz',
    });

    vi.mocked(AtpAgent).mockImplementation(() => ({
      login: vi.fn().mockResolvedValue({}),
      post: mockPost,
    } as any));

    const result = await plugin.post(state);

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe('at://did:plc:abc/app.bsky.feed.post/xyz');
    expect(mockPost).toHaveBeenCalled();
  });
});
```

## Testing Error Handling

Plugins must never throw exceptions. Test that errors are returned as `PostResult { success: false, error }`.

### Test: Missing Content

```typescript
it('returns error when state has no teaser', async () => {
  const plugin = new BlueskyPlugin('user.bsky.social', 'app-password');
  const state = makePostState({ teaser: undefined });

  const result = await plugin.post(state);

  expect(result.success).toBe(false);
  expect(result.error).toBe('No teaser content');
});
```

### Test: Unconfigured Plugin

```typescript
it('returns error when not configured', async () => {
  const plugin = new BlueskyPlugin(undefined, undefined);
  const state = makePostState();

  const result = await plugin.post(state);

  expect(result.success).toBe(false);
  expect(result.error).toBe('Bluesky not configured');
});
```

### Test: API Failure

```typescript
it('returns error when API call fails', async () => {
  const plugin = new GhostPlugin(
    'https://blog.example.com',
    'abc123:secret456'
  );
  const state = makePostState();

  // Configure mock to reject
  const mockAdd = vi.fn().mockRejectedValue(
    new Error('Network error')
  );

  vi.mocked(GhostAdminAPI).mockImplementation(() => ({
    posts: { add: mockAdd },
  } as any));

  const result = await plugin.post(state);

  expect(result.success).toBe(false);
  expect(result.error).toBe('Network error');
});
```

## Testing Rate Limit Retry

Plugins should retry on 429 rate limit responses with exponential backoff. Use `vi.useFakeTimers()` to test this without real delays.

### Example from Ghost Plugin Tests

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

it('retries on 429 rate limit with exponential backoff', async () => {
  vi.useFakeTimers();

  const plugin = new GhostPlugin(
    'https://blog.example.com',
    'abc123:secret456'
  );
  const state = makePostState();

  const mockAdd = vi
    .fn()
    // First attempt: 429 rate limit
    .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
    // Second attempt: 429 again
    .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
    // Third attempt: success
    .mockResolvedValueOnce({
      id: 'ghost-post-id',
      url: 'https://blog.example.com/weekly-update/',
    });

  vi.mocked(GhostAdminAPI).mockImplementation(() => ({
    posts: { add: mockAdd },
  } as any));

  // Start the post operation
  const resultPromise = plugin.post(state);

  // Advance timers to trigger retries
  // First retry: ~1000ms + jitter
  await vi.advanceTimersByTimeAsync(2000);
  // Second retry: ~2000ms + jitter
  await vi.advanceTimersByTimeAsync(3000);

  const result = await resultPromise;

  expect(result.success).toBe(true);
  expect(mockAdd).toHaveBeenCalledTimes(3);

  vi.useRealTimers();
});
```

### Verify Retry Limits

Test that plugins stop retrying after `MAX_RETRIES` attempts:

```typescript
it('stops retrying after MAX_RETRIES attempts', async () => {
  vi.useFakeTimers();

  const plugin = new GhostPlugin(
    'https://blog.example.com',
    'abc123:secret456'
  );
  const state = makePostState();

  // Always return 429
  const mockAdd = vi.fn().mockRejectedValue({
    status: 429,
    message: 'Rate limited',
  });

  vi.mocked(GhostAdminAPI).mockImplementation(() => ({
    posts: { add: mockAdd },
  } as any));

  const resultPromise = plugin.post(state);

  // Advance through all retry attempts
  await vi.advanceTimersByTimeAsync(10000);

  const result = await resultPromise;

  expect(result.success).toBe(false);
  expect(result.error).toBe('Max retries exceeded');
  expect(mockAdd).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3

  vi.useRealTimers();
});
```

### Non-Retriable Errors

Verify that non-429 errors don't trigger retries:

```typescript
it('does not retry on non-429 errors', async () => {
  const plugin = new GhostPlugin(
    'https://blog.example.com',
    'abc123:secret456'
  );
  const state = makePostState();

  // Return 401 unauthorized (not retriable)
  const mockAdd = vi.fn().mockRejectedValue({
    status: 401,
    message: 'Unauthorized',
  });

  vi.mocked(GhostAdminAPI).mockImplementation(() => ({
    posts: { add: mockAdd },
  } as any));

  const result = await plugin.post(state);

  expect(result.success).toBe(false);
  expect(result.error).toBe('Unauthorized');
  expect(mockAdd).toHaveBeenCalledTimes(1); // No retries
});
```

## Testing Plugin Configuration

Test `isConfigured()` with all credential combinations:

```typescript
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

  it('returns false when both are missing', () => {
    const plugin = new GhostPlugin(undefined, undefined);
    expect(plugin.isConfigured()).toBe(false);
  });
});
```

## Running Tests

### Watch Mode (Development)

```bash
npx vitest
```

Runs tests on file changes. Great for TDD workflow.

### Single Run (CI)

```bash
npx vitest run
```

Runs all tests once and exits. Use in GitHub Actions and pre-commit hooks.

### Coverage

```bash
npx vitest run --coverage
```

Generates coverage report. Requires `@vitest/coverage-v8` package.

### Specific File

```bash
npx vitest src/platforms/ghost/client.test.ts
```

Run tests for a single file.

## Test Organization Best Practices

### 1. Group Related Tests

Use nested `describe` blocks for logical organization:

```typescript
describe('GhostPlugin', () => {
  describe('isConfigured', () => {
    // All isConfigured tests here
  });

  describe('post', () => {
    describe('validation', () => {
      // Validation error tests
    });

    describe('success cases', () => {
      // Happy path tests
    });

    describe('retry logic', () => {
      // Retry behavior tests
    });
  });
});
```

### 2. Clear Test Names

Use descriptive test names that explain the scenario and expected outcome:

**Good:**
```typescript
it('returns error when state has no digest', async () => {
  // ...
});
```

**Bad:**
```typescript
it('handles missing digest', async () => {
  // ...
});
```

### 3. One Assertion Per Test

Focus each test on a single behavior:

**Good:**
```typescript
it('successfully posts digest to Ghost', async () => {
  const result = await plugin.post(state);
  expect(result.success).toBe(true);
});

it('returns Ghost post URL when successful', async () => {
  const result = await plugin.post(state);
  expect(result.platformUrl).toMatch(/^https:\/\/blog\.example\.com/);
});
```

**Bad:**
```typescript
it('posts to Ghost', async () => {
  const result = await plugin.post(state);
  expect(result.success).toBe(true);
  expect(result.platformUrl).toMatch(/^https:\/\/blog\.example\.com/);
  expect(mockAdd).toHaveBeenCalled();
  // Testing too many things
});
```

### 4. Clean Up Between Tests

Use `beforeEach` to reset mocks:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Complete Test Suite Example

See real-world examples in the gh-to-sponsors codebase:

- `src/platforms/ghost/client.test.ts` - Ghost plugin (19 tests)
- `src/platforms/bluesky/client.test.ts` - Bluesky plugin (19 tests)
- `src/platforms/mastodon/client.test.ts` - Mastodon plugin (20 tests)

Each test file covers:
- Configuration validation
- Content validation
- Successful posting
- API error handling
- Rate limit retry logic
- Edge cases

## See Also

- [Tutorial: Your First Plugin](./tutorial-first-plugin.md) - Build a complete plugin
- [API Reference](./reference-api.md) - Type definitions and interfaces
- [Architecture Explanation](./explanation-architecture.md) - Why plugins work this way
