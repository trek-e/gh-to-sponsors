# Plugin API Reference

Complete API reference for developing platform plugins in gh-to-sponsors.

## PlatformPlugin Interface

The core interface that all platform plugins must implement.

```typescript
export interface PlatformPlugin {
  /** Platform identifier (e.g., 'ghost', 'bluesky') */
  readonly name: string;

  /** Check if platform is properly configured */
  isConfigured(): boolean;

  /** Transform and post content to platform */
  post(state: PostState): Promise<PostResult>;
}
```

### Properties

#### `name: string`

**Type:** `readonly string`

**Description:** Unique identifier for the platform. Used by the registry for lookups and in state tracking.

**Examples:**
- `'ghost'` - Ghost CMS
- `'bluesky'` - Bluesky social network
- `'mastodon'` - Mastodon instance
- `'telegram'` - Telegram channel

**Constraints:**
- Must be lowercase
- Must be unique across all registered plugins
- Should be human-readable

### Methods

#### `isConfigured(): boolean`

**Description:** Checks whether the plugin has valid credentials and configuration to make API calls.

**Returns:** `true` if the plugin is ready to use, `false` otherwise.

**Usage:** Called by `getConfiguredPlatforms()` to filter out plugins that aren't ready to post. A plugin should return `false` if any required credentials (API keys, tokens, URLs) are missing or invalid.

**Example Implementation:**

```typescript
isConfigured(): boolean {
  return Boolean(this.apiUrl && this.apiKey);
}
```

#### `post(state: PostState): Promise<PostResult>`

**Description:** Posts content to the platform. This is the core method where platform-specific API calls happen.

**Parameters:**
- `state: PostState` - Complete post state including digest, teaser, and platform results

**Returns:** `Promise<PostResult>` - Result object indicating success or failure

**Contract:**
- **MUST NOT throw exceptions** - Always return a `PostResult` with `success: false` on errors
- Should validate that required content exists (digest for long-form, teaser for social)
- Should check `isConfigured()` before attempting API calls
- Should implement retry logic for transient failures (429 rate limits)
- Should return platform-specific post IDs and URLs when successful

**Example Implementation:**

```typescript
async post(state: PostState): Promise<PostResult> {
  // Validate content
  if (!state.teaser) {
    return { success: false, error: 'No teaser content' };
  }

  // Validate configuration
  if (!this.isConfigured()) {
    return { success: false, error: 'Platform not configured' };
  }

  try {
    const result = await this.apiClient.createPost(state.teaser.text);
    return {
      success: true,
      platformPostId: result.id,
      platformUrl: result.url,
    };
  } catch (error) {
    // Never throw - return error in PostResult
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

## PostResult Type

The return type for `post()` method calls.

```typescript
export interface PostResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
}
```

### Fields

#### `success: boolean`

**Required:** Yes

**Description:** Indicates whether the post operation succeeded.

**Values:**
- `true` - Post was successfully created on the platform
- `false` - Post failed (see `error` field for details)

#### `platformPostId?: string`

**Required:** No (but recommended for successful posts)

**Description:** Platform-specific identifier for the created post. Used for tracking and debugging.

**Examples:**
- Ghost: `"507f1f77bcf86cd799439011"` (MongoDB ObjectId)
- Bluesky: `"at://did:plc:abc123/app.bsky.feed.post/xyz789"` (AT URI)
- Mastodon: `"109382045633993933"` (Status ID)

#### `platformUrl?: string`

**Required:** No (but recommended for successful posts)

**Description:** Public URL where the post can be viewed. Used for social link composition and user notifications.

**Examples:**
- Ghost: `"https://blog.example.com/weekly-update-jan-2026/"`
- Bluesky: `"https://bsky.app/profile/user.bsky.social/post/xyz789"`
- Mastodon: `"https://mastodon.social/@username/109382045633993933"`

#### `error?: string`

**Required:** No (but required when `success: false`)

**Description:** Human-readable error message explaining why the post failed.

**Examples:**
- `"No teaser content"`
- `"Platform not configured"`
- `"Post exceeds 300 graphemes: 315"`
- `"Rate limit exceeded"`

### Success Example

```typescript
{
  success: true,
  platformPostId: "507f1f77bcf86cd799439011",
  platformUrl: "https://blog.example.com/weekly-update/"
}
```

### Failure Example

```typescript
{
  success: false,
  error: "Bluesky not configured"
}
```

## PostState Type

The state object passed to `post()` containing all content and metadata.

```typescript
export interface PostState {
  id: string;
  contentHash: string;
  status: PostStatus;
  platforms: Record<string, PlatformPostState>;
  createdAt: string;
  approvedAt?: string;
  digest?: {
    title: string;
    content: string;
    repos: string[];
    commitCount: number;
    periodType: 'daily' | 'weekly';
    generatedAt: string;
  };
  teaser?: {
    text: string;
    hashtags: string[];
    characterCount: number;
  };
  release?: ReleaseAnnouncement;
}
```

### Core Fields

#### `id: string`

Unique identifier for this post. Format: `digest-{period}-{hash}` for digests, `release-{hash}` for releases.

#### `contentHash: string`

SHA-256 hash of the content for deduplication.

#### `status: PostStatus`

Current status of the post. Type: `'pending' | 'approved' | 'skipped' | 'posted'`

#### `platforms: Record<string, PlatformPostState>`

Results from previous platform post attempts. Keyed by platform name.

```typescript
export interface PlatformPostState {
  status: 'success' | 'failed' | 'pending';
  postId?: string;
  postUrl?: string;
  error?: string;
  attemptedAt?: string;
}
```

#### `createdAt: string`

ISO 8601 timestamp when the post was created.

#### `approvedAt?: string`

ISO 8601 timestamp when the user approved the post. `undefined` for unapproved posts.

### Content Fields

#### `digest?: object`

Long-form content for blog platforms (Ghost). Contains:

- `title: string` - Post title
- `content: string` - Full HTML content
- `repos: string[]` - Repositories covered
- `commitCount: number` - Total commits
- `periodType: 'daily' | 'weekly'` - Update frequency
- `generatedAt: string` - ISO timestamp

**When to use:** Long-form platforms like Ghost should use `digest.content`.

#### `teaser?: object`

Short-form content for social platforms. Contains:

- `text: string` - Teaser text (typically 200-300 characters)
- `hashtags: string[]` - Suggested hashtags
- `characterCount: number` - Character count for validation

**When to use:** Social platforms (Bluesky, Mastodon) should use `teaser.text`.

**Note:** The executor composes `teaser.text + link` before passing to social platforms. See `composeSocialPostContent()` in `src/platforms/executor.ts`.

#### `release?: ReleaseAnnouncement`

Release announcement data when post is triggered by a GitHub release.

```typescript
export interface ReleaseAnnouncement {
  type: 'release';
  tagName: string;
  title: string;
  body: string;
  releaseUrl: string;
  downloadLinks: Array<{ name: string; url: string }>;
  isPrerelease: boolean;
  repoName: string;
}
```

**When to use:** Check `state.release` to detect release announcements and adjust formatting.

## PlatformConfig Type

Base configuration interface for platform settings.

```typescript
export interface PlatformConfig {
  enabled: boolean;
}
```

All platform-specific configs should extend this base interface:

```typescript
export interface GhostConfig extends PlatformConfig {
  defaultStatus?: 'draft' | 'published';
  defaultTags?: string[];
}
```

## Registry Functions

Functions for registering and retrieving platform plugins.

### `registerPlatform(name: string, factory: () => PlatformPlugin): void`

**Description:** Register a platform plugin factory with the global registry.

**Parameters:**
- `name: string` - Platform identifier (must match `plugin.name`)
- `factory: () => PlatformPlugin` - Function that creates a plugin instance

**Usage:** Call during app initialization to make a plugin available.

**Example:**

```typescript
import { registerPlatform } from 'gh-to-sponsors/platforms/registry';
import { GhostPlugin } from './ghost/client.js';

registerPlatform('ghost', () => {
  const url = process.env.GHOST_API_URL;
  const apiKey = process.env.GHOST_ADMIN_API_KEY;
  return new GhostPlugin(url, apiKey);
});
```

### `getPlatform(name: string): PlatformPlugin | undefined`

**Description:** Get a specific platform plugin by name.

**Parameters:**
- `name: string` - Platform identifier

**Returns:** Plugin instance or `undefined` if not registered.

**Usage:** Use when you need a specific platform.

**Example:**

```typescript
const ghost = getPlatform('ghost');
if (ghost?.isConfigured()) {
  await ghost.post(state);
}
```

### `getConfiguredPlatforms(): PlatformPlugin[]`

**Description:** Get all registered plugins that are properly configured.

**Returns:** Array of plugin instances where `isConfigured()` returns `true`.

**Usage:** Use when posting to all available platforms.

**Example:**

```typescript
const plugins = getConfiguredPlatforms();
for (const plugin of plugins) {
  const result = await plugin.post(state);
  console.log(`${plugin.name}: ${result.success}`);
}
```

### `getAllPlatformNames(): string[]`

**Description:** Get names of all registered platforms (configured or not).

**Returns:** Array of platform identifiers.

**Usage:** Use for showing available platforms in UI or debugging.

**Example:**

```typescript
const allPlatforms = getAllPlatformNames();
console.log(`Registered platforms: ${allPlatforms.join(', ')}`);
// Output: "Registered platforms: ghost, bluesky, mastodon"
```

## Plugin Lifecycle

The lifecycle of a platform plugin from registration to posting:

```
┌─────────────────┐
│  Registration   │  registerPlatform('ghost', factory)
│  (app startup)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Factory Call   │  factory() creates plugin instance
│  (on demand)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ isConfigured()  │  Check if plugin has valid credentials
│     check       │
└────────┬────────┘
         │
         ├─── false ──> Plugin excluded from posting
         │
         ▼ true
┌─────────────────┐
│   post(state)   │  Post content to platform
│   invocation    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostResult     │  Return success/failure to executor
│    returned     │
└─────────────────┘
```

### When Each Step Occurs

1. **Registration** - Once at application startup via `setupPlatforms()`
2. **Factory Call** - Every time `getConfiguredPlatforms()` or `getPlatform()` is called
3. **isConfigured() Check** - Every time `getConfiguredPlatforms()` is called
4. **post() Invocation** - When executor posts to all platforms or retries a specific platform
5. **PostResult Return** - Immediately after post attempt (success or failure)

## Environment Variables

Platform plugins follow a consistent naming convention for environment variables:

### Pattern: `PLATFORM_SETTING`

All uppercase, platform name first, then the setting name.

### Examples

**Ghost:**
- `GHOST_API_URL` - Ghost instance URL (e.g., `https://blog.example.com`)
- `GHOST_ADMIN_API_KEY` - Admin API key (format: `id:secret`)
- `GHOST_DEFAULT_STATUS` - Default post status (`draft` or `published`)
- `GHOST_DEFAULT_TAGS` - Comma-separated tag list (e.g., `devlog,opensource`)

**Bluesky:**
- `BLUESKY_IDENTIFIER` - Handle or DID (e.g., `user.bsky.social`)
- `BLUESKY_APP_PASSWORD` - App-specific password from Settings
- `BLUESKY_DEFAULT_LANG` - Language code (e.g., `en`)

**Mastodon:**
- `MASTODON_INSTANCE_URL` - Instance URL (e.g., `https://mastodon.social`)
- `MASTODON_ACCESS_TOKEN` - OAuth access token
- `MASTODON_VISIBILITY` - Post visibility (`public`, `unlisted`, or `private`)

### Reading in Factory Functions

Environment variables should be read in the **factory function**, not in the plugin constructor:

```typescript
registerPlatform('myplatform', () => {
  // Read env vars here, in the factory
  const apiKey = process.env.MYPLATFORM_API_KEY;
  const apiUrl = process.env.MYPLATFORM_API_URL;

  // Pass to constructor
  return new MyPlatformPlugin(apiUrl, apiKey);
});
```

**Why:** This allows fresh credentials on each factory call and keeps the plugin class testable.

## See Also

- [Tutorial: Your First Plugin](./tutorial-first-plugin.md) - Step-by-step guide
- [How-to: Testing](./howto-testing.md) - Testing patterns and examples
- [Explanation: Architecture](./explanation-architecture.md) - Design decisions and rationale
