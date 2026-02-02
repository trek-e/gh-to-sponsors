# Phase 3: First Platform Integration (Ghost CMS) - Research

**Researched:** 2026-02-02
**Domain:** Ghost CMS Admin API, Plugin Architecture, TypeScript Interfaces
**Confidence:** HIGH (official docs verified)

## Summary

Ghost CMS provides a full-featured Admin API for programmatic content creation, making it an ideal first platform for the plugin architecture. Authentication uses JWT tokens generated from Admin API keys (stored as GitHub secrets), with posts created via `POST /ghost/api/admin/posts/`. The official `@tryghost/admin-api` JavaScript SDK handles JWT generation automatically and provides clean methods for post creation.

The plugin architecture should follow the Strategy pattern with a registry, mirroring the existing email provider abstraction in the codebase. Each platform plugin implements a common `PlatformPlugin` interface with a `post()` method that transforms digest content for its platform. Error isolation uses `Promise.allSettled()` to ensure one platform's failure doesn't block others.

**Primary recommendation:** Use `@tryghost/admin-api` v1.14.x with explicit TypeScript interfaces (via `@types/tryghost__admin-api`), following the existing email provider factory pattern for plugin architecture.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tryghost/admin-api` | ^1.14.3 | Ghost Admin API client | Official SDK, handles JWT auth automatically |
| `@types/tryghost__admin-api` | latest | TypeScript definitions | Community-maintained types for type safety |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jsonwebtoken` | ^9.x | JWT generation (if manual) | Only if not using SDK |
| `zod` | (existing) | Schema validation | Already in codebase for config validation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tryghost/admin-api` | `@ts-ghost/admin-api` | Full native TypeScript but requires Ghost 5.x+ and TypeScript 5+, less battle-tested |
| `@tryghost/admin-api` | Raw fetch + manual JWT | More control but must implement JWT signing manually |

**Installation:**
```bash
npm install @tryghost/admin-api
npm install --save-dev @types/tryghost__admin-api
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── platforms/                    # Platform plugins directory
│   ├── types.ts                  # PlatformPlugin interface
│   ├── registry.ts               # Plugin registration and discovery
│   ├── executor.ts               # Orchestrates multi-platform posting
│   └── ghost/                    # Ghost plugin implementation
│       ├── index.ts              # Ghost plugin exports
│       ├── client.ts             # Ghost API client wrapper
│       └── transformer.ts        # Digest -> Ghost post transformer
├── types/
│   └── platform.ts               # Platform-related types
└── config/
    └── schema.ts                 # Extended with platform config
```

**Rationale:** `src/platforms/` follows codebase convention (cf. `src/email/`, `src/github/`, `src/content/`). Each platform gets its own subdirectory for isolation.

### Pattern 1: Platform Plugin Interface

**What:** TypeScript interface defining the contract all platform plugins must implement
**When to use:** Every platform plugin
**Example:**
```typescript
// src/platforms/types.ts
import type { PostState } from '../types/state.js';

export interface PlatformConfig {
  enabled: boolean;
  // Platform-specific config extends this
}

export interface PostResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
}

export interface PlatformPlugin {
  /** Platform identifier (e.g., 'ghost', 'bluesky') */
  readonly name: string;

  /** Check if platform is properly configured */
  isConfigured(): boolean;

  /** Transform and post content to platform */
  post(state: PostState): Promise<PostResult>;
}
```

### Pattern 2: Plugin Registry (Factory Pattern)

**What:** Central registry for discovering and instantiating platform plugins
**When to use:** At startup and when executing posts
**Example:**
```typescript
// src/platforms/registry.ts
import type { PlatformPlugin } from './types.js';

const plugins = new Map<string, () => PlatformPlugin>();

export function registerPlatform(
  name: string,
  factory: () => PlatformPlugin
): void {
  plugins.set(name, factory);
}

export function getConfiguredPlatforms(): PlatformPlugin[] {
  return Array.from(plugins.values())
    .map(factory => factory())
    .filter(plugin => plugin.isConfigured());
}
```

### Pattern 3: Error Isolation with Promise.allSettled

**What:** Execute all platform posts in parallel, collecting all results regardless of individual failures
**When to use:** When posting to multiple platforms
**Example:**
```typescript
// src/platforms/executor.ts
import type { PlatformPlugin, PostResult } from './types.js';
import type { PostState } from '../types/state.js';

export interface ExecutionResult {
  platform: string;
  result: PostResult;
}

export async function executeAllPlatforms(
  plugins: PlatformPlugin[],
  state: PostState
): Promise<ExecutionResult[]> {
  const promises = plugins.map(async (plugin): Promise<ExecutionResult> => {
    try {
      const result = await plugin.post(state);
      return { platform: plugin.name, result };
    } catch (error) {
      return {
        platform: plugin.name,
        result: {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  });

  // Promise.allSettled ensures all platforms are attempted
  const settled = await Promise.allSettled(promises);

  return settled.map(s =>
    s.status === 'fulfilled'
      ? s.value
      : { platform: 'unknown', result: { success: false, error: s.reason } }
  );
}
```

### Pattern 4: Exponential Backoff with Jitter (Existing Pattern)

**What:** Retry failed requests with increasing delays plus random jitter
**When to use:** Rate limits (429) or transient failures
**Example from codebase:**
```typescript
// Source: src/content/generator.ts (existing implementation)
const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
const jitter = Math.random() * 1000;
const delay = baseDelay + jitter;
```

### Anti-Patterns to Avoid

- **Global mutable state for plugins:** Use registry pattern with factory functions, not global singletons
- **Throwing on platform failure:** Catch and return error results; let orchestrator decide on partial success
- **Blocking on first failure:** Use `Promise.allSettled()`, not `Promise.all()`
- **Hardcoding platform logic in core:** All platform-specific code lives in plugin directories

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ghost JWT auth | Manual JWT signing | `@tryghost/admin-api` | SDK handles token generation, refresh, and signing internally |
| HTML to Lexical | Custom converter | Ghost API `?source=html` | Ghost's API converts HTML automatically |
| Post validation | Custom field checks | Ghost API errors | API returns 422 for invalid posts |
| Rate limit handling | Custom throttling | Exponential backoff | Already proven pattern in codebase |

**Key insight:** Ghost's official SDK abstracts away JWT complexity. Manual JWT generation is only needed for non-Node environments or custom requirements.

## Ghost Admin API Reference

### Authentication

**Admin API Key Format:** `{id}:{secret}` (colon-separated)
- Obtain from Ghost Admin -> Settings -> Integrations -> Custom Integration
- Store as `GHOST_ADMIN_API_KEY` GitHub secret
- Also need `GHOST_API_URL` for the blog URL

**SDK handles JWT internally:**
```typescript
import GhostAdminAPI from '@tryghost/admin-api';

const api = new GhostAdminAPI({
  url: 'https://your-blog.ghost.io',
  key: process.env.GHOST_ADMIN_API_KEY,  // id:secret format
  version: 'v5.0'
});
```

**Manual JWT (if needed):**
```typescript
// JWT Header: { "alg": "HS256", "typ": "JWT", "kid": "{id}" }
// JWT Payload: { "iat": now, "exp": now+300, "aud": "/admin/" }
// Secret: decode hex secret to binary, sign with HS256
// Auth header: "Authorization: Ghost {token}"
```

### Post Creation

**Endpoint:** `POST /ghost/api/admin/posts/`

**Minimum Required Fields:**
- `title` - Post title (only required field)

**Common Optional Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `html` | string | HTML content (use with `?source=html`) |
| `lexical` | string | Lexical JSON content |
| `status` | 'draft' \| 'published' | Post status (default: 'draft') |
| `custom_excerpt` | string | Excerpt for social sharing |
| `tags` | string[] \| object[] | Tags by name or full objects |
| `slug` | string | URL slug |
| `featured` | boolean | Featured post flag |
| `visibility` | string | 'public', 'members', 'paid', etc. |

**Creating a Published Post with HTML:**
```typescript
// Source: Ghost official docs
const post = await api.posts.add({
  title: 'Weekly Development Update',
  html: '<h2>What we shipped</h2><p>...</p>',
  status: 'published',  // MUST be in post object, not separate param
  custom_excerpt: 'Teaser text for social sharing',
  tags: ['devlog', 'opensource']
}, { source: 'html' });  // Converts HTML to Lexical

// Returns post with id, url, etc.
console.log(post.url);  // https://blog.example.com/weekly-update/
```

**Critical Note:** The `status` field MUST be inside the post object, not as a separate parameter. This is a common mistake.

### Rate Limits

- **Ghost Pro:** Recommended < 50 requests/second (no strict limit published)
- **Self-hosted:** Default 100 requests per IP per hour (configurable)
- **Rate limit response:** HTTP 429 Too Many Requests

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 201 | Post created successfully | Extract post.url from response |
| 401 | Authentication failed | Check API key format, JWT validity |
| 403 | Forbidden | Key lacks permission or wrong API |
| 422 | Validation error | Check required fields, content format |
| 429 | Rate limited | Exponential backoff + retry |

**Error Response Format:**
```json
{
  "errors": [{
    "message": "Validation error",
    "context": "Title is required",
    "type": "ValidationError"
  }]
}
```

## Codebase Patterns to Follow

### Email Provider Abstraction (src/email/)

The existing email abstraction provides the exact pattern for platform plugins:

```typescript
// src/types/email.ts - Interface pattern
export interface EmailProvider {
  send(params: EmailParams): Promise<EmailResult>;
}

// src/email/resend.ts - Implementation pattern
export class ResendProvider implements EmailProvider {
  constructor(apiKey: string, private fromEmail: string) { ... }
  async send(params: EmailParams): Promise<EmailResult> { ... }
}

// src/email/factory.ts - Factory pattern
export function createEmailProvider(config: EmailConfig): EmailProvider {
  switch (config.provider) {
    case 'resend': return new ResendProvider(...);
    // ...
  }
}
```

**Apply to platforms:** Mirror this structure for `PlatformPlugin`, `GhostPlugin`, `createPlatformPlugin()`.

### Retry Logic (src/content/generator.ts)

```typescript
// Existing retry pattern to reuse
async function callWithRetry(/* ... */, retries = MAX_RETRIES) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await /* operation */;
    } catch (error) {
      const isRateLimit = error?.status === 429;
      if (isRateLimit && attempt < retries - 1) {
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 1000;
        await new Promise(r => setTimeout(r, baseDelay + jitter));
        attempt++;
      } else {
        throw error;
      }
    }
  }
}
```

### State Management (src/state/, src/types/state.ts)

```typescript
// Existing state structure supports platforms
export interface PostState {
  // ...
  platforms: Record<string, PlatformResult>;  // Already exists!
}

export type PlatformResult = 'success' | 'failed';
```

**Extension needed:** Add platform-specific data (post URLs, error details) to state.

### Config Schema (src/config/schema.ts)

```typescript
// Pattern for adding platform config
const platformSchema = z.object({
  ghost: z.object({
    enabled: z.boolean().default(true),
    url: z.string().url(),
    defaultTags: z.array(z.string()).default(['devlog', 'opensource']),
    defaultStatus: z.enum(['draft', 'published']).default('draft'),
  }).optional(),
});
```

## Common Pitfalls

### Pitfall 1: Status Parameter Placement

**What goes wrong:** Post created as draft despite passing `status: 'published'`
**Why it happens:** Status passed as separate parameter instead of in post object
**How to avoid:**
```typescript
// WRONG
api.posts.add({ title, html }, { status: 'published' });

// CORRECT
api.posts.add({ title, html, status: 'published' }, { source: 'html' });
```
**Warning signs:** All posts appear as drafts in Ghost Admin

### Pitfall 2: JWT Expiration

**What goes wrong:** 401 errors after token works initially
**Why it happens:** JWT tokens expire after 5 minutes
**How to avoid:** Use the SDK (creates fresh JWT per request) or regenerate tokens
**Warning signs:** Intermittent 401 errors on long-running operations

### Pitfall 3: HTML Content Loss

**What goes wrong:** HTML formatting lost or mangled in post
**Why it happens:** Ghost converts HTML to Lexical format (lossy operation)
**How to avoid:** Use well-formed HTML; for lossless, wrap in `<!--kg-card-begin: html-->`
```typescript
const losslessHtml = `<!--kg-card-begin: html-->${html}<!--kg-card-end: html-->`;
```
**Warning signs:** Missing formatting, broken layouts

### Pitfall 4: Plugin Failure Cascade

**What goes wrong:** One platform failure prevents posting to others
**Why it happens:** Using `Promise.all()` or sequential execution with early return
**How to avoid:** Use `Promise.allSettled()` for error isolation
**Warning signs:** Intermittent "all platforms failed" when only one has issues

### Pitfall 5: Missing Accept-Version Header

**What goes wrong:** Unexpected API behavior or errors
**Why it happens:** Ghost API no longer uses versioned URLs (v5+)
**How to avoid:** SDK handles this; for raw requests, include `Accept-Version: v5.0`
**Warning signs:** Strange error responses, deprecated behavior

## Code Examples

### Complete Ghost Plugin Implementation

```typescript
// src/platforms/ghost/client.ts
import GhostAdminAPI from '@tryghost/admin-api';
import type { PlatformPlugin, PostResult } from '../types.js';
import type { PostState } from '../../types/state.js';

const MAX_RETRIES = 3;

export class GhostPlugin implements PlatformPlugin {
  readonly name = 'ghost';
  private api: GhostAdminAPI | null = null;

  constructor(
    private url: string | undefined,
    private apiKey: string | undefined,
    private defaultTags: string[] = ['devlog', 'opensource'],
    private defaultStatus: 'draft' | 'published' = 'draft'
  ) {}

  isConfigured(): boolean {
    return Boolean(this.url && this.apiKey);
  }

  private getClient(): GhostAdminAPI {
    if (!this.api) {
      if (!this.url || !this.apiKey) {
        throw new Error('Ghost not configured');
      }
      this.api = new GhostAdminAPI({
        url: this.url,
        key: this.apiKey,
        version: 'v5.0'
      });
    }
    return this.api;
  }

  async post(state: PostState): Promise<PostResult> {
    if (!state.digest) {
      return { success: false, error: 'No digest content' };
    }

    const api = this.getClient();
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const post = await api.posts.add({
          title: state.digest.title,
          html: state.digest.content,
          status: this.defaultStatus,
          custom_excerpt: state.teaser?.text,
          tags: this.defaultTags
        }, { source: 'html' });

        return {
          success: true,
          platformPostId: post.id,
          platformUrl: post.url
        };
      } catch (error: unknown) {
        const apiError = error as { status?: number; message?: string };

        if (apiError?.status === 429 && attempt < MAX_RETRIES - 1) {
          const baseDelay = Math.pow(2, attempt) * 1000;
          const jitter = Math.random() * 1000;
          await new Promise(r => setTimeout(r, baseDelay + jitter));
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
}
```

### Platform Executor with Partial Success

```typescript
// src/platforms/executor.ts
import type { PlatformPlugin } from './types.js';
import type { PostState, PlatformResult } from '../types/state.js';

export interface PlatformPostResult {
  platform: string;
  success: boolean;
  url?: string;
  error?: string;
}

export interface ExecutionSummary {
  allSucceeded: boolean;
  anySucceeded: boolean;
  results: PlatformPostResult[];
  failedPlatforms: string[];
}

export async function postToAllPlatforms(
  plugins: PlatformPlugin[],
  state: PostState
): Promise<ExecutionSummary> {
  const promises = plugins.map(async (plugin): Promise<PlatformPostResult> => {
    try {
      const result = await plugin.post(state);
      return {
        platform: plugin.name,
        success: result.success,
        url: result.platformUrl,
        error: result.error
      };
    } catch (error) {
      return {
        platform: plugin.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  const settled = await Promise.allSettled(promises);
  const results = settled.map(s =>
    s.status === 'fulfilled'
      ? s.value
      : { platform: 'unknown', success: false, error: String(s.reason) }
  );

  return {
    allSucceeded: results.every(r => r.success),
    anySucceeded: results.some(r => r.success),
    results,
    failedPlatforms: results.filter(r => !r.success).map(r => r.platform)
  };
}
```

### Retry Token Generation for Failed Posts

```typescript
// src/platforms/retry.ts
import { generateApprovalToken } from '../tokens/sign.js';

export function generateRetryToken(
  postId: string,
  platform: string,
  ttlHours: number,
  secret: string
): string {
  // Reuse existing token infrastructure with 'retry' action
  // Payload includes which platform(s) to retry
  const payload = {
    postId,
    action: 'retry' as const,
    platforms: [platform],
    exp: Date.now() + (ttlHours * 60 * 60 * 1000),
    jti: crypto.randomUUID()
  };

  // Sign with existing HMAC pattern
  return signToken(payload, secret);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Versioned URLs (`/v3/admin/`) | Accept-Version header | Ghost 5.0 | Remove version from URL |
| MobileDoc content format | Lexical format | Ghost 5.0 | Use HTML with `?source=html` |
| Multiple API versions | Single current version | Ghost 5.0 | Simpler but less backward compat |

**Current Ghost Version:** 5.x (Lexical editor, Accept-Version header)

## Open Questions

1. **Draft vs Published default:**
   - What we know: Both work, user preference varies
   - What's unclear: Best default for this use case
   - Recommendation: Default to 'draft' for safety, make configurable via sponsors.yaml

2. **Partial success notification:**
   - What we know: User needs to know which platforms failed
   - What's unclear: Email format for partial success
   - Recommendation: Include success/failure breakdown in email, with retry links for failed platforms

3. **Ghost post URL availability timing:**
   - What we know: URL returned in create response
   - What's unclear: If URL is immediately accessible
   - Recommendation: Store URL in state immediately; it should be accessible (Ghost generates slug synchronously)

## Sources

### Primary (HIGH confidence)
- [Ghost Admin API Documentation](https://docs.ghost.org/admin-api) - Authentication, endpoints, post structure
- [Ghost Admin API JavaScript Client](https://docs.ghost.org/admin-api/javascript/) - SDK usage, configuration
- [Ghost API Demos Repository](https://github.com/TryGhost/api-demos) - Official examples
- [Creating a Post - Ghost Docs](https://docs.ghost.org/admin-api/posts/creating-a-post) - Post fields, status, tags

### Secondary (MEDIUM confidence)
- [Ghost Forum: Creating Published Posts](https://forum.ghost.org/t/how-to-use-admin-api-to-create-published-posts/46527) - Status parameter placement fix
- [Ghost Forum: Rate Limiting](https://forum.ghost.org/t/is-there-an-admin-api-rate-limiting/47039) - 50 req/sec recommendation
- [ts-ghost documentation](https://ts-ghost.dev/docs/admin-api) - TypeScript alternative
- [Bash JWT Example](https://gist.github.com/ErisDS/6334f0e70ec7390ec08530d5ef9bd0d5) - Manual JWT generation reference

### Tertiary (LOW confidence)
- Various Ghost Forum posts on error handling (403, 401 errors) - needs validation in implementation
- [Promise.allSettled MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled) - Error isolation pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK documentation verified
- Architecture: HIGH - Follows existing codebase patterns (email provider)
- Ghost API: HIGH - Official docs, multiple forum confirmations
- Plugin patterns: MEDIUM - Based on established TypeScript patterns, not Ghost-specific

**Research date:** 2026-02-02
**Valid until:** 60 days (Ghost API is stable, SDK updated monthly)
