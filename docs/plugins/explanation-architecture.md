# Plugin Architecture: Why Things Work This Way

An explanation of the design decisions behind the gh-to-sponsors plugin system.

## Overview

The `PlatformPlugin` interface is deliberately minimal: just 3 members (`name`, `isConfigured()`, `post()`). But the patterns around it - lazy initialization, never-throw error handling, factory registration, and Promise.allSettled orchestration - are what make plugins reliable in production.

This document explains **why** each pattern exists and the problems it solves.

## The Plugin Contract

### Why So Minimal?

The `PlatformPlugin` interface has only 3 members:

```typescript
export interface PlatformPlugin {
  readonly name: string;
  isConfigured(): boolean;
  post(state: PostState): Promise<PostResult>;
}
```

**Why not more?** Many plugin systems include:
- Lifecycle hooks (init, destroy, beforePost, afterPost)
- Config schema validation
- Built-in rate limiting
- State management
- Event emitters

**Our philosophy:** A minimal interface has several advantages:

1. **Low barrier to entry** - Anyone can implement 3 members
2. **Easy to test** - No complex lifecycle to mock
3. **Easy to understand** - No hidden behavior
4. **Flexibility** - Plugins decide their own implementation details

**Trade-off:** Plugin authors implement common patterns themselves (retry logic, rate limiting). We provide examples in existing plugins to copy.

### Real-World Comparison

**Over-engineered plugin interface:**
```typescript
interface ComplexPlugin {
  name: string;
  schema: ConfigSchema;
  init(): Promise<void>;
  destroy(): Promise<void>;
  beforePost(state: PostState): Promise<PostState>;
  post(state: PostState): Promise<PostResult>;
  afterPost(result: PostResult): Promise<void>;
  onError(error: Error): Promise<void>;
}
```

**Our interface:**
```typescript
interface PlatformPlugin {
  name: string;
  isConfigured(): boolean;
  post(state: PostState): Promise<PostResult>;
}
```

The complex interface requires implementing 8 methods. Ours requires 3. The complex version looks powerful, but in practice most plugins leave lifecycle hooks empty or duplicate logic across hooks.

## Never-Throw Pattern

### The Problem

Throwing exceptions in async plugin code can crash the entire posting flow:

```typescript
// BAD: Throwing plugin
async post(state: PostState): Promise<PostResult> {
  const client = this.getClient();
  const result = await client.post(state.teaser.text);
  // What if this throws?
  return { success: true, platformUrl: result.url };
}

// Executor code
for (const plugin of plugins) {
  await plugin.post(state); // If this throws, loop stops
}
```

If Bluesky throws an exception, Ghost never gets to post.

### The Solution

Return errors instead of throwing:

```typescript
async post(state: PostState): Promise<PostResult> {
  try {
    const client = this.getClient();
    const result = await client.post(state.teaser.text);
    return { success: true, platformUrl: result.url };
  } catch (error) {
    // Catch and return, don't throw
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

**Contract:** `post()` MUST return `PostResult`, never throw.

### Executor Defense in Depth

The executor adds an extra try/catch wrapper for plugin bugs:

```typescript
// From src/platforms/executor.ts
const socialPromises = socialPlugins.map(async (plugin): Promise<PlatformPostResult> => {
  try {
    const result = await plugin.post(socialState);
    return {
      platform: plugin.name,
      success: result.success,
      postId: result.platformPostId,
      postUrl: result.platformUrl,
      error: result.error,
    };
  } catch (error) {
    // Defense in depth - plugins should return errors, not throw
    // But catch anyway in case plugin has bugs
    return {
      platform: plugin.name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
```

**Why wrap?** Even if a plugin violates the contract and throws, the executor contains the damage.

## Lazy Initialization

### The Problem

If plugin constructors created API clients immediately:

```typescript
export class BlueskyPlugin implements PlatformPlugin {
  private agent: AtpAgent;

  constructor(identifier: string, password: string) {
    // BAD: Create client in constructor
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
    await this.agent.login({ identifier, password }); // Can't await in constructor!
  }
}
```

**Issues:**
1. Can't await in constructors (not async)
2. Every factory call creates a connection (wasteful)
3. Unconfigured plugins fail loudly during setup

### The Factory Problem

The registry creates ALL plugins on every run:

```typescript
// From src/platforms/registry.ts
export function getConfiguredPlatforms(): PlatformPlugin[] {
  return Array.from(plugins.values())
    .map(factory => factory())  // Calls EVERY factory
    .filter(plugin => plugin.isConfigured());
}
```

If Ghost is configured but Bluesky isn't, and Bluesky's constructor tried to connect:

```typescript
registerPlatform('bluesky', () => {
  return new BlueskyPlugin(
    process.env.BLUESKY_IDENTIFIER,  // undefined
    process.env.BLUESKY_APP_PASSWORD  // undefined
  );
  // If constructor connects, this throws!
});
```

The registry would crash before Ghost gets to post.

### The Solution

Defer client creation until `post()` is called:

```typescript
export class BlueskyPlugin implements PlatformPlugin {
  private agent: AtpAgent | null = null;
  private authenticated = false;

  constructor(
    private readonly identifier: string | undefined,
    private readonly password: string | undefined
  ) {
    // Constructor does NOT create client
  }

  private async getAgent(): Promise<AtpAgent> {
    if (!this.agent) {
      if (!this.identifier || !this.password) {
        throw new Error('Bluesky not configured');
      }
      this.agent = new AtpAgent({ service: 'https://bsky.social' });
    }

    if (!this.authenticated) {
      await this.agent.login({
        identifier: this.identifier!,
        password: this.password!,
      });
      this.authenticated = true;
    }

    return this.agent;
  }

  async post(state: PostState): Promise<PostResult> {
    // Validate first
    if (!this.isConfigured()) {
      return { success: false, error: 'Bluesky not configured' };
    }

    // Create client only when posting
    const agent = await this.getAgent();
    // ... use agent ...
  }
}
```

**Benefits:**
1. Unconfigured plugins can be instantiated without errors
2. Factory calls are cheap (no network I/O)
3. Connection happens only for configured plugins that actually post
4. Can await async initialization in `getAgent()`

### Real-World Impact

Without lazy init:
- Starting gh-to-sponsors with only Ghost configured would fail if Bluesky credentials are missing
- Every `getConfiguredPlatforms()` call would create new API connections

With lazy init:
- All plugins instantiate successfully
- Only configured plugins that pass `isConfigured()` create connections
- Connections happen once per posting flow

## Factory Registration

### The Problem

Storing plugin instances creates stale credential problems:

```typescript
// BAD: Storing instances
const plugins = new Map<string, PlatformPlugin>();

export function registerPlatform(name: string, plugin: PlatformPlugin): void {
  plugins.set(name, plugin);
}

// Problem: What if credentials change?
registerPlatform('ghost', new GhostPlugin(
  process.env.GHOST_API_URL,
  process.env.GHOST_ADMIN_API_KEY
));

// Later: env vars updated, but plugin still has old values
```

### The Solution

Store factory functions, not instances:

```typescript
type PlatformFactory = () => PlatformPlugin;

const plugins = new Map<string, PlatformFactory>();

export function registerPlatform(name: string, factory: PlatformFactory): void {
  plugins.set(name, factory);
}

export function getPlatform(name: string): PlatformPlugin | undefined {
  const factory = plugins.get(name);
  return factory ? factory() : undefined;
}
```

**Benefits:**
1. **Fresh credentials** - Factory reads env vars on each call
2. **No stale state** - New instance for each posting flow
3. **Testable** - Tests can mock env vars and get fresh instances

### Usage Pattern

```typescript
// From src/platforms/setup.ts
registerPlatform('ghost', () => {
  const url = process.env.GHOST_API_URL;
  const apiKey = process.env.GHOST_ADMIN_API_KEY;
  const defaultStatus = process.env.GHOST_DEFAULT_STATUS || 'draft';
  const defaultTags = process.env.GHOST_DEFAULT_TAGS?.split(',') || ['devlog', 'opensource'];

  return new GhostPlugin(url, apiKey, defaultTags, defaultStatus);
});
```

Every time `getPlatform('ghost')` or `getConfiguredPlatforms()` is called, the factory runs and reads current env vars.

### Trade-off

**Cost:** Creating plugin instances on every call is slightly more expensive than reusing a singleton.

**Benefit:** Eliminates entire classes of bugs around stale credentials, leaked state, and testing.

**Verdict:** The cost is negligible (factory just reads env vars and calls `new`), and the benefits are huge.

## Error Isolation with Promise.allSettled

### The Problem

Posting to multiple platforms with `Promise.all`:

```typescript
// BAD: Using Promise.all
const promises = plugins.map(p => p.post(state));
const results = await Promise.all(promises);
```

If Mastodon's promise rejects, `Promise.all` short-circuits and Ghost/Bluesky results are lost.

### The Solution

Use `Promise.allSettled` for error isolation:

```typescript
// From src/platforms/executor.ts
const socialPromises = socialPlugins.map(async (plugin): Promise<PlatformPostResult> => {
  try {
    const result = await plugin.post(socialState);
    return {
      platform: plugin.name,
      success: result.success,
      // ... other fields ...
    };
  } catch (error) {
    return {
      platform: plugin.name,
      success: false,
      error: String(error),
    };
  }
});

const socialSettled = await Promise.allSettled(socialPromises);

const socialResults = socialSettled.map((outcome, index) => {
  if (outcome.status === 'fulfilled') {
    return outcome.value;
  }
  // Even if the promise rejected, handle it gracefully
  return {
    platform: socialPlugins[index]?.name || 'unknown',
    success: false,
    error: String(outcome.reason),
  };
});
```

**Guarantee:** Every platform gets a chance to post, regardless of failures.

### Sequential vs Parallel

The executor uses a hybrid approach:

```typescript
// Step 1: Post to Ghost first (sequential)
const ghostPlugin = plugins.find(p => p.name === 'ghost');
if (ghostPlugin) {
  const ghostResult = await ghostPlugin.post(state);
  // Store Ghost URL in state
}

// Step 2: Post to social platforms in parallel
const socialPlugins = plugins.filter(p => p.name !== 'ghost');
const socialPromises = socialPlugins.map(p => p.post(composedState));
const socialResults = await Promise.allSettled(socialPromises);
```

**Why Ghost first?** Social posts include a link. Ghost provides that link. Posting Ghost first ensures social posts can reference it.

**Why social in parallel?** Bluesky doesn't depend on Mastodon. Running in parallel is faster and still isolated via `allSettled`.

See `src/platforms/executor.ts` lines 56-176 for the complete flow.

## Retry with Exponential Backoff

### The Problem

Rate limits (429 responses) are transient. Immediate retry hammers the API:

```typescript
// BAD: Immediate retry
try {
  await api.post(content);
} catch (error) {
  if (error.status === 429) {
    await api.post(content); // Immediate retry fails again
  }
}
```

### The Solution

Exponential backoff with jitter:

```typescript
const MAX_RETRIES = 3;
let attempt = 0;

while (attempt < MAX_RETRIES) {
  try {
    const result = await api.post(content);
    return { success: true, ...result };
  } catch (error) {
    const isRateLimit = error.status === 429;
    const isLastAttempt = attempt >= MAX_RETRIES - 1;

    if (isRateLimit && !isLastAttempt) {
      // Exponential backoff: 1s, 2s, 4s
      const baseDelay = Math.pow(2, attempt) * 1000;
      // Add jitter: 0-1000ms random
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
      continue;
    }

    return { success: false, error: String(error) };
  }
}

return { success: false, error: 'Max retries exceeded' };
```

**Parameters:**
- `MAX_RETRIES = 3` → Total wait: ~1s + ~2s + ~4s = ~7s maximum
- Jitter prevents thundering herd (all clients retrying simultaneously)
- Only retry 429, not 401/403/500 (those are permanent errors)

### Why Jitter Matters

Without jitter, 100 users hitting rate limit at `T=0`:
- All retry at `T=1s` (second wave hits API)
- All retry at `T=3s` (third wave hits API)
- All retry at `T=7s` (fourth wave hits API)

With jitter (0-1000ms random):
- Retry spread across `T=1s` to `T=2s`
- Retry spread across `T=3s` to `T=4s`
- Retry spread across `T=7s` to `T=8s`

Spreading retries reduces load spikes.

### Implementation

See real examples in:
- `src/platforms/ghost/client.ts` lines 88-133
- `src/platforms/bluesky/client.ts` lines 107-149
- `src/platforms/mastodon/client.ts` lines 82-124

All use identical retry logic for consistency.

## Content Flow

### Different Platforms, Different Content

**Long-form platforms** (Ghost, Dev.to, Hashnode):
- Use `state.digest.content` (full HTML)
- Use `state.digest.title` as post title

**Social platforms** (Bluesky, Mastodon, Twitter):
- Use `state.teaser.text` (200-300 characters)
- Get composed content with link appended

### Link Composition

The executor composes social content before calling social plugins:

```typescript
// From src/platforms/executor.ts
export function composeSocialPostContent(
  state: PostState,
  target: string,
  githubFallback?: string
): string {
  if (!state.teaser?.text) {
    return '';
  }

  const teaserText = state.teaser.text;
  let linkUrl: string | undefined;

  if (target === 'ghost') {
    const ghostState = state.platforms.ghost;
    if (ghostState?.status === 'success' && ghostState.postUrl) {
      linkUrl = ghostState.postUrl;
    } else if (githubFallback) {
      linkUrl = githubFallback;
    }
  } else if (target === 'github') {
    linkUrl = githubFallback;
  } else {
    linkUrl = target; // Custom URL
  }

  if (linkUrl) {
    return `${teaserText}\n\n${linkUrl}`;
  }

  return teaserText;
}
```

**Flow:**
1. Post to Ghost → get `ghostResult.platformUrl`
2. Update `state.platforms.ghost` with URL
3. Compose social content: `teaser + "\n\n" + ghostUrl`
4. Create modified state with composed content
5. Pass modified state to social plugins

**Why in executor, not plugins?** Link composition is cross-platform logic. Ghost provides the URL, social platforms consume it. The executor orchestrates this dependency.

### Content Type Detection

Plugins should detect the type of post and use appropriate content:

```typescript
async post(state: PostState): Promise<PostResult> {
  // For long-form platform
  if (!state.digest) {
    return { success: false, error: 'No digest content' };
  }
  const html = state.digest.content;

  // For social platform
  if (!state.teaser) {
    return { success: false, error: 'No teaser content' };
  }
  const text = state.teaser.text;

  // For release announcement
  if (state.release) {
    // Use release-specific formatting
    const text = `${state.release.title}\n\n${state.release.body}`;
  }
}
```

See `src/types/state.ts` lines 41-56 for the complete `PostState` interface.

## Summary

The plugin system design principles:

1. **Minimal interface** - Low barrier to entry, easy to understand
2. **Never-throw** - Return errors, don't throw (enables error isolation)
3. **Lazy initialization** - Defer connection until use (saves resources, handles missing creds)
4. **Factory registration** - Fresh credentials, no stale state
5. **Promise.allSettled** - Error isolation across platforms
6. **Exponential backoff** - Handle rate limits gracefully
7. **Executor orchestration** - Handle cross-platform dependencies (Ghost → social links)

Each pattern solves a specific production problem. Together they create a reliable multi-platform posting system.

## See Also

- [Tutorial: Your First Plugin](./tutorial-first-plugin.md) - Build a plugin using these patterns
- [API Reference](./reference-api.md) - Type definitions and interfaces
- [How-to: Testing](./howto-testing.md) - Test these patterns effectively
- Source code examples:
  - `src/platforms/types.ts` - Interface definitions
  - `src/platforms/registry.ts` - Factory pattern
  - `src/platforms/executor.ts` - Error isolation and orchestration
  - `src/platforms/ghost/client.ts` - Lazy init and retry logic
