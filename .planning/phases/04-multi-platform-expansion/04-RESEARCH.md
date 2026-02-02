# Phase 4: Multi-Platform Expansion - Research

**Researched:** 2026-02-02
**Domain:** Social media platform APIs (Bluesky AT Protocol, Mastodon ActivityPub)
**Confidence:** MEDIUM

## Summary

Phase 4 extends the existing platform plugin architecture to support Bluesky and Mastodon. The codebase already has a well-designed PlatformPlugin interface, registry pattern, and executor with Promise.allSettled - new platforms follow the same GhostPlugin pattern.

The user decided on OAuth for both platforms. However, research reveals a critical finding: **Bluesky's official guidance explicitly states OAuth is NOT recommended for "headless" clients like bots**. App passwords remain the recommended approach for automated posting scenarios. This creates a tension with the user's decision that needs resolution.

Mastodon OAuth is straightforward with masto.js (v7.10.0), which handles token management internally. Mastodon's character limits vary by instance (default 500, queryable via API).

**Primary recommendation:** Re-evaluate Bluesky auth strategy - app passwords are simpler and officially recommended for bot use cases. For Mastodon, use masto.js which abstracts OAuth complexity.

## Critical Decision Point: Bluesky Authentication

### User Decision
- Bluesky: OAuth flow (not app passwords)

### Research Finding
The official Bluesky documentation states:
> "OAuth is not currently recommended as an auth solution for 'headless' clients, such as command-line tools or bots."

Source: [OAuth Roadmap Discussion](https://github.com/bluesky-social/atproto/discussions/2656)

### OAuth Complexity for Server-Side
Bluesky OAuth requires:
1. **Public client metadata** - Must host a JSON document at a public HTTPS URL
2. **DPoP (Demonstrating Proof of Possession)** - Mandatory for all clients, requires cryptographic keypairs
3. **Pushed Authorization Requests (PAR)** - Required for all client types
4. **Session/State stores** - Custom implementations for token persistence
5. **Client metadata hosting** - Your app must serve `/client-metadata.json` and `/jwks.json`

### App Password Alternative
App passwords provide:
- Simple identifier + password authentication via `createSession`
- Access/refresh JWT token management
- Works immediately without infrastructure setup
- Officially recommended for bots

### Recommendation
**Option A (Recommended):** Use app passwords for Bluesky - aligns with official guidance, simpler implementation
**Option B:** Implement OAuth if user insists - requires hosting client metadata, implementing stores, significant complexity

This decision affects implementation scope significantly.

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@atproto/api` | ^0.18.x | Bluesky API client | Official SDK with RichText helper, facet detection |
| `masto` | ^7.10.x | Mastodon API client | Modern TypeScript SDK, actively maintained since 2018, 6kB minified |

### For OAuth (If Chosen)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@atproto/oauth-client-node` | ^0.2.x | Bluesky OAuth for Node.js | If OAuth required |
| `@atproto/jwk-jose` | ^0.1.x | JWT key generation | Required with oauth-client-node |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `masto` | `mastodon-api` | masto is more modern, better TypeScript support |
| `masto` | `node-mastodon` | masto has better maintenance, cleaner API |
| `@atproto/api` | Raw fetch | SDK handles RichText facets, UTF-8 byte indexing |

**Installation (App Password approach):**
```bash
npm install @atproto/api masto
```

**Installation (OAuth approach - additional):**
```bash
npm install @atproto/oauth-client-node @atproto/jwk-jose
```

## Architecture Patterns

### Existing Codebase Patterns to Follow

The codebase has established patterns that new platforms MUST follow:

```
src/platforms/
├── types.ts           # PlatformPlugin interface (42 lines)
├── registry.ts        # Plugin registration/discovery (57 lines)
├── executor.ts        # Promise.allSettled orchestration (126 lines)
├── setup.ts           # Platform initialization (54 lines)
└── ghost/
    ├── index.ts       # Barrel export
    └── client.ts      # GhostPlugin implementation (135 lines)
```

### New Platform Structure

```
src/platforms/
├── bluesky/
│   ├── index.ts       # Barrel export
│   └── client.ts      # BlueskyPlugin implements PlatformPlugin
└── mastodon/
    ├── index.ts       # Barrel export
    └── client.ts      # MastodonPlugin implements PlatformPlugin
```

### Pattern 1: PlatformPlugin Interface

Every platform implements this interface from `src/platforms/types.ts`:

```typescript
export interface PlatformPlugin {
  readonly name: string;
  isConfigured(): boolean;
  post(state: PostState): Promise<PostResult>;
}
```

### Pattern 2: Lazy Client Initialization

From GhostPlugin - initialize API client only when needed:

```typescript
export class BlueskyPlugin implements PlatformPlugin {
  readonly name = 'bluesky';
  private agent: AtpAgent | null = null;

  constructor(
    private readonly identifier: string | undefined,
    private readonly password: string | undefined
  ) {}

  isConfigured(): boolean {
    return Boolean(this.identifier && this.password);
  }

  private async getAgent(): Promise<AtpAgent> {
    if (!this.agent) {
      if (!this.identifier || !this.password) {
        throw new Error('Bluesky not configured');
      }
      this.agent = new AtpAgent({ service: 'https://bsky.social' });
      await this.agent.login({
        identifier: this.identifier,
        password: this.password
      });
    }
    return this.agent;
  }
}
```

### Pattern 3: Retry with Exponential Backoff

From GhostPlugin lines 86-122:

```typescript
const MAX_RETRIES = 3;

while (attempt < MAX_RETRIES) {
  try {
    // API call
  } catch (error) {
    const isRateLimit = error?.status === 429;
    const isLastAttempt = attempt >= MAX_RETRIES - 1;

    if (isRateLimit && !isLastAttempt) {
      const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
      attempt++;
      continue;
    }

    return { success: false, error: error?.message || String(error) };
  }
}
```

### Pattern 4: Platform Registration

From `src/platforms/setup.ts`:

```typescript
registerPlatform('bluesky', () => {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  return new BlueskyPlugin(identifier, password);
});

registerPlatform('mastodon', () => {
  const instanceUrl = process.env.MASTODON_INSTANCE_URL;
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;
  const visibility = process.env.MASTODON_VISIBILITY as 'public' | 'unlisted' | 'private' || 'public';
  return new MastodonPlugin(instanceUrl, accessToken, visibility);
});
```

### Anti-Patterns to Avoid

- **Throwing from post():** Return `{ success: false, error: message }` instead - executor wraps but plugins should handle gracefully
- **Blocking on failure:** executor uses Promise.allSettled, plugins don't need to coordinate
- **Custom retry implementations:** Reuse the existing exponential backoff pattern from Ghost

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bluesky RichText/Facets | Manual byte offset calculation | `@atproto/api` RichText class | UTF-8/UTF-16 encoding differences are complex; SDK handles byte indexing |
| Bluesky facet detection | Regex for links/hashtags/mentions | `rt.detectFacets(agent)` | Handles mention DID resolution, proper byte offsets |
| Mastodon API | Raw fetch calls | `masto` library | Handles pagination, rate limit headers, TypeScript types |
| Token refresh | Manual refresh logic | SDK built-in (both platforms) | Edge cases with concurrent refresh, token expiry |
| Character counting | `String.length` | `rt.graphemeLength` (Bluesky) | Graphemes vs code units matter for limits |

**Key insight:** Both platforms have official/well-maintained SDKs that handle complex encoding and auth edge cases. The RichText class for Bluesky is particularly important because JavaScript uses UTF-16 while AT Protocol uses UTF-8 for facet byte indexing.

## Common Pitfalls

### Pitfall 1: Bluesky Character Limit is Graphemes, Not Characters

**What goes wrong:** Posts rejected with "must not be longer than 300 graphemes"
**Why it happens:** Using `string.length` which counts UTF-16 code units, not visual characters
**How to avoid:** Use `RichText.graphemeLength` property
**Warning signs:** Emoji-heavy posts getting rejected despite appearing short

```typescript
const rt = new RichText({ text: content });
if (rt.graphemeLength > 300) {
  return { success: false, error: 'Post exceeds 300 grapheme limit' };
}
```

### Pitfall 2: Mastodon Character Limits Vary by Instance

**What goes wrong:** Posts work on one instance, fail on another
**Why it happens:** Default is 500 but instances can configure different limits
**How to avoid:** Query instance configuration via `GET /api/v2/instance`
**Warning signs:** "Text character limit of X exceeded" errors

```typescript
// Response includes: configuration.statuses.max_characters
const instance = await masto.v2.instance.fetch();
const maxChars = instance.configuration.statuses.max_characters;
```

### Pitfall 3: Bluesky Facets Require Byte Offsets, Not Character Indices

**What goes wrong:** Links/hashtags render incorrectly or break
**Why it happens:** JavaScript `.slice()` uses code units; Bluesky needs UTF-8 byte offsets
**How to avoid:** Always use RichText class, never calculate facets manually
**Warning signs:** Mentions/links appearing in wrong positions, broken rich text

### Pitfall 4: Bluesky Rate Limits Use Points, Not Simple Counts

**What goes wrong:** Hit rate limits unexpectedly
**Why it happens:** CREATE=3 points, UPDATE=2, DELETE=1; 5000 points/hour
**How to avoid:** Monitor rate limit headers, respect 429 responses
**Warning signs:** Getting 429s well below expected request count

### Pitfall 5: Mastodon Token Storage

**What goes wrong:** Tokens work initially but stop working
**Why it happens:** Mastodon is moving to expiring tokens (currently eternal, changing soon)
**How to avoid:** Implement refresh token flow even if not strictly needed yet
**Warning signs:** Authentication failures after extended periods

### Pitfall 6: Missing Language Tags on Bluesky

**What goes wrong:** Posts not discoverable in language-filtered feeds
**Why it happens:** Omitting `langs` field
**How to avoid:** Always include `langs: ['en']` (or appropriate language code)
**Warning signs:** Posts not appearing in expected feeds

## Code Examples

### Bluesky: Create Post with RichText (App Password Auth)

```typescript
// Source: https://docs.bsky.app/docs/advanced-guides/post-richtext
import { AtpAgent, RichText } from '@atproto/api';

const agent = new AtpAgent({ service: 'https://bsky.social' });
await agent.login({
  identifier: process.env.BLUESKY_IDENTIFIER!,
  password: process.env.BLUESKY_APP_PASSWORD!
});

// Teaser text with link
const text = `${teaser.text} ${linkUrl}`;

// Create RichText and detect facets (links, mentions, hashtags)
const rt = new RichText({ text });
await rt.detectFacets(agent);

// Validate length
if (rt.graphemeLength > 300) {
  throw new Error(`Post exceeds 300 graphemes: ${rt.graphemeLength}`);
}

// Create post
const response = await agent.post({
  text: rt.text,
  facets: rt.facets,
  langs: ['en'],
  createdAt: new Date().toISOString()
});

// response.uri = "at://did:plc:xxx/app.bsky.feed.post/xxx"
// response.cid = content hash
```

### Mastodon: Create Status with Visibility

```typescript
// Source: https://neet.github.io/masto.js/
import { createRestAPIClient } from 'masto';

const masto = createRestAPIClient({
  url: process.env.MASTODON_INSTANCE_URL!,
  accessToken: process.env.MASTODON_ACCESS_TOKEN!
});

// Create status with configured visibility
const status = await masto.v1.statuses.create({
  status: `${teaser.text} ${linkUrl}`,
  visibility: 'public', // or 'unlisted', 'private', 'direct'
  language: 'en'
});

// status.url = "https://instance.social/@user/123456"
// status.id = "123456"
```

### Query Mastodon Instance Limits

```typescript
// Source: https://docs.joinmastodon.org/methods/instance/
const instance = await masto.v2.instance.fetch();
const config = instance.configuration;

console.log({
  maxCharacters: config.statuses.max_characters,      // default: 500
  maxMediaAttachments: config.statuses.max_media_attachments,  // default: 4
  charsReservedPerUrl: config.statuses.characters_reserved_per_url  // default: 23
});
```

### BlueskyPlugin Implementation Pattern

```typescript
// Following GhostPlugin pattern from src/platforms/ghost/client.ts
import { AtpAgent, RichText } from '@atproto/api';
import type { PostState } from '../../types/state.js';
import type { PlatformPlugin, PostResult } from '../types.js';

const MAX_RETRIES = 3;
const BLUESKY_GRAPHEME_LIMIT = 300;

export class BlueskyPlugin implements PlatformPlugin {
  readonly name = 'bluesky';
  private agent: AtpAgent | null = null;
  private authenticated = false;

  constructor(
    private readonly identifier: string | undefined,
    private readonly password: string | undefined,
    private readonly defaultLang: string = 'en'
  ) {}

  isConfigured(): boolean {
    return Boolean(this.identifier && this.password);
  }

  private async getAgent(): Promise<AtpAgent> {
    if (!this.agent) {
      if (!this.isConfigured()) {
        throw new Error('Bluesky not configured');
      }
      this.agent = new AtpAgent({ service: 'https://bsky.social' });
    }

    if (!this.authenticated) {
      await this.agent.login({
        identifier: this.identifier!,
        password: this.password!
      });
      this.authenticated = true;
    }

    return this.agent;
  }

  async post(state: PostState): Promise<PostResult> {
    if (!state.teaser) {
      return { success: false, error: 'No teaser content' };
    }

    if (!this.isConfigured()) {
      return { success: false, error: 'Bluesky not configured' };
    }

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        const agent = await this.getAgent();

        // Build text with link
        const linkUrl = this.getLinkUrl(state);
        const text = `${state.teaser.text}\n\n${linkUrl}`;

        // Create RichText and detect facets
        const rt = new RichText({ text });
        await rt.detectFacets(agent);

        // Validate length
        if (rt.graphemeLength > BLUESKY_GRAPHEME_LIMIT) {
          return {
            success: false,
            error: `Post exceeds ${BLUESKY_GRAPHEME_LIMIT} graphemes: ${rt.graphemeLength}`
          };
        }

        const response = await agent.post({
          text: rt.text,
          facets: rt.facets,
          langs: [this.defaultLang],
          createdAt: new Date().toISOString()
        });

        return {
          success: true,
          platformPostId: response.uri,
          platformUrl: `https://bsky.app/profile/${this.identifier}/post/${response.uri.split('/').pop()}`
        };
      } catch (error: unknown) {
        const apiError = error as { status?: number; message?: string };
        const isRateLimit = apiError?.status === 429;
        const isLastAttempt = attempt >= MAX_RETRIES - 1;

        if (isRateLimit && !isLastAttempt) {
          const baseDelay = Math.pow(2, attempt) * 1000;
          const jitter = Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
          attempt++;
          continue;
        }

        return {
          success: false,
          error: apiError?.message || String(error)
        };
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  private getLinkUrl(state: PostState): string {
    // TODO: Implement configurable link target (Ghost URL, GitHub, custom)
    return state.platforms?.ghost?.postUrl || '';
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bluesky app passwords only | OAuth available (not recommended for bots) | 2024 | OAuth adds complexity; app passwords still preferred for automation |
| Mastodon eternal tokens | Moving to expiring tokens | In progress (2025-2026) | Will require refresh token implementation |
| BskyAgent class | AtpAgent class | @atproto/api v0.14 | BskyAgent deprecated |
| masto v6.x | masto v7.x | 2024 | API changes, check migration guide |

**Deprecated/outdated:**
- `BskyAgent` - Use `AtpAgent` instead
- Username/password login on Bluesky - Officially deprecated in favor of OAuth (but app passwords still work for bots)
- masto v5.x/v6.x - Current is v7.10.x

## Platform-Specific Configuration

### Bluesky Configuration

```typescript
// src/types/platform.ts addition
export interface BlueskyConfig {
  enabled: boolean;
  defaultLang: string;  // BCP-47 language code, default 'en'
}
```

Environment variables:
- `BLUESKY_IDENTIFIER` - Handle (e.g., "user.bsky.social")
- `BLUESKY_APP_PASSWORD` - App password (not account password)

### Mastodon Configuration

```typescript
// src/types/platform.ts addition
export interface MastodonConfig {
  enabled: boolean;
  instanceUrl: string;    // e.g., "https://mastodon.social"
  visibility: 'public' | 'unlisted' | 'private';  // default 'public'
}
```

Environment variables:
- `MASTODON_INSTANCE_URL` - Instance URL (env var first, config fallback per user decision)
- `MASTODON_ACCESS_TOKEN` - OAuth access token

### Config Schema Updates

```typescript
// src/config/schema.ts addition
export const blueskyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultLang: z.string().default('en'),
});

export const mastodonConfigSchema = z.object({
  enabled: z.boolean().default(true),
  instanceUrl: z.string().url('Valid Mastodon instance URL required'),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
});

export const platformsConfigSchema = z.object({
  ghost: ghostConfigSchema.optional(),
  bluesky: blueskyConfigSchema.optional(),
  mastodon: mastodonConfigSchema.optional(),
});
```

## Rate Limits Summary

### Bluesky

| Operation | Limit | Window | Points |
|-----------|-------|--------|--------|
| Record creation | 5,000 points | 1 hour | CREATE=3, UPDATE=2, DELETE=1 |
| Record creation | 35,000 points | 1 day | Same point system |
| General API | 3,000 requests | 5 minutes | IP-based |
| Session creation | 30 requests | 5 minutes | Per account |

Source: [Bluesky Rate Limits](https://docs.bsky.app/docs/advanced-guides/rate-limits)

### Mastodon

| Operation | Limit | Window |
|-----------|-------|--------|
| All endpoints | 300 requests | 5 minutes |
| Status deletion | 30 requests | 30 minutes |
| Media upload | 30 requests | 30 minutes |
| Per IP | 7,500 requests | 5 minutes |

Source: [Mastodon Rate Limits](https://docs.joinmastodon.org/api/rate-limits/)

## Decisions for Claude's Discretion

### Bluesky Facets for Rich Text

**Recommendation: USE facets**

Facets are low complexity when using the RichText SDK class:
```typescript
const rt = new RichText({ text });
await rt.detectFacets(agent);  // One line handles everything
```

Benefits:
- Links become clickable
- Hashtags become searchable/discoverable
- Mentions notify users

Cost: Essentially free with SDK - don't hand-roll.

### Mastodon Content Warnings

**Recommendation: SKIP for dev updates**

Content warnings (spoiler_text) are intended for sensitive content, not general posts. Dev log updates don't need warnings. If needed later, add as optional config.

### Link Card/Embed Handling

**Bluesky:** Supports external embeds with Open Graph data, but requires fetching OG metadata and uploading thumbnail. **Recommendation: Skip initially** - links in text with facets are sufficient. Add embeds as future enhancement.

**Mastodon:** Automatically generates link cards from URLs in post text. **Recommendation: Just include URL** - no extra work needed.

### Platform Ordering

**Recommendation: Parallel execution**

The executor already uses `Promise.allSettled` for parallel posting. Keep this pattern:
- Ghost, Bluesky, and Mastodon all post in parallel
- Each failure is isolated
- Combined failure notification email aggregates all results

If link target is Ghost URL, Ghost should succeed first. However:
- Ghost post returns URL immediately on success
- Other platforms can start posting with the URL
- If Ghost fails, other platforms will have invalid link (acceptable - user gets notified)

For configurable link targets (GitHub, custom), parallel is fine.

### Rate Limit Retry Pattern

**Recommendation: Reuse Ghost pattern**

The existing exponential backoff with jitter from GhostPlugin (lines 86-122) is appropriate for both platforms:
- Bluesky: Returns 429 for rate limits
- Mastodon: Returns 429 for rate limits, provides retry-after header

No platform-specific tuning needed initially.

## Open Questions

### 1. Bluesky OAuth vs App Passwords

**What we know:** User decided OAuth; official guidance says app passwords for bots
**What's unclear:** Is there a specific reason for OAuth requirement?
**Recommendation:** Clarify with user - significant implementation difference

### 2. Mastodon Token Refresh Timing

**What we know:** Currently tokens don't expire; this is changing
**What's unclear:** Exact timeline and behavior of new token expiry
**Recommendation:** Implement defensive refresh handling; masto.js may handle this internally

### 3. Link Target Configuration

**What we know:** User wants configurable link target (Ghost URL, GitHub, custom)
**What's unclear:** Exact config structure and precedence
**Recommendation:** Plan task to design config schema for link target

## Sources

### Primary (HIGH confidence)
- [Bluesky Post Rich Text Documentation](https://docs.bsky.app/docs/advanced-guides/post-richtext) - Facets, byte indexing
- [Bluesky Rate Limits](https://docs.bsky.app/docs/advanced-guides/rate-limits) - Point system, limits
- [Mastodon Statuses API](https://docs.joinmastodon.org/methods/statuses/) - Visibility, parameters
- [Mastodon Rate Limits](https://docs.joinmastodon.org/api/rate-limits/) - Request limits
- [masto.js GitHub](https://github.com/neet/masto.js/) - TypeScript SDK

### Secondary (MEDIUM confidence)
- [Bluesky OAuth Client Guide](https://docs.bsky.app/docs/advanced-guides/oauth-client) - DPoP requirements
- [Mastodon OAuth API](https://docs.joinmastodon.org/methods/oauth/) - Token endpoints
- [@atproto/api npm](https://www.npmjs.com/package/@atproto/api) - Package info
- [masto npm](https://www.npmjs.com/package/masto) - Package info (v7.10.0)

### Tertiary (LOW confidence)
- [OAuth Roadmap Discussion](https://github.com/bluesky-social/atproto/discussions/2656) - Bot guidance
- [Mastodon OAuth Roadmap Issue](https://github.com/mastodon/mastodon/issues/34316) - Token expiry plans

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDKs with good documentation
- Architecture: HIGH - Following existing codebase patterns exactly
- Pitfalls: MEDIUM - Based on documentation and common issues, not production experience
- Bluesky OAuth: LOW - User decision conflicts with official guidance

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - APIs stable, auth landscape evolving)
