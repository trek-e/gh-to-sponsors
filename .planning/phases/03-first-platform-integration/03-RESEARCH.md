# Phase 3: First Platform Integration - Research

**Researched:** 2026-02-02
**Domain:** Patreon API v2, OAuth2 authentication, TypeScript plugin architecture
**Confidence:** MEDIUM (critical limitation discovered)

## Summary

Research uncovered a **critical limitation**: Patreon's public API v2 does NOT support creating posts programmatically. The API is read-only for posts - you can fetch posts but cannot create them. This is confirmed by:

1. Official Patreon documentation showing only GET endpoints for posts
2. Patreon staff (codebard) explicitly stating "the api does not publicly support write operations yet" (confirmed as recently as January 2023)
3. Community requests for this feature dating back to 2018 remain unimplemented
4. Automation platforms (Zapier, IFTTT) cannot post to Patreon due to this limitation

**Primary recommendation:** Pivot Phase 3 to a different platform (Ghost CMS is recommended - it has full write API support) while keeping Patreon in scope for read-only operations (patron verification) in Phase 4. Alternatively, descope Patreon posting entirely and acknowledge it requires manual posting.

## Critical Finding: Patreon Post Creation Not Supported

### Evidence

| Source | Finding | Confidence |
|--------|---------|------------|
| [Official Patreon API Docs](https://docs.patreon.com/) | Only GET endpoints documented for posts | HIGH |
| [Patreon Developer Forum](https://www.patreondevelopers.com/t/can-we-use-api-to-create-simple-posts/4542) | Staff confirmed no write operations | HIGH |
| [Reverse-engineered API docs](https://github.com/oxguy3/patreon-api) | Undocumented endpoints exist but require session auth, not OAuth | MEDIUM |
| [Automation community](https://talk.automators.fm/t/automate-patreon-posts-from-an-rss-feed/5330) | "there's no API to then turn this into a Patreon post" | HIGH |

### What Patreon API v2 DOES Support

| Capability | Endpoint | Scope Required |
|------------|----------|----------------|
| Get user identity | GET /api/oauth2/v2/identity | `identity` |
| List campaigns | GET /api/oauth2/v2/campaigns | `campaigns` |
| List campaign members | GET /api/oauth2/v2/campaigns/{id}/members | `campaigns.members` |
| List campaign posts | GET /api/oauth2/v2/campaigns/{id}/posts | `campaigns.posts` |
| Get single post | GET /api/oauth2/v2/posts/{id} | `campaigns.posts` |
| Webhooks for pledge events | POST webhooks | `w:campaigns.webhook` |

### What Patreon API v2 Does NOT Support

- Creating posts (no POST endpoint)
- Updating posts (no PATCH/PUT endpoint)
- Deleting posts (no DELETE endpoint)
- Setting tier visibility on posts
- Uploading attachments to posts

### Workarounds Evaluated

| Approach | Viability | Risk |
|----------|-----------|------|
| Reverse-engineered session-based API | LOW - requires username/password, session cookies | HIGH - could break anytime, violates ToS |
| Browser automation (Puppeteer) | LOW - fragile, requires headless browser | HIGH - maintenance burden, slow |
| Manual posting via email notification | MEDIUM - user clicks link, posts manually | LOW - user friction |
| Pivot to Ghost CMS first | HIGH - Ghost has full write API | LOW - reorder phases |

## Recommended Path Forward

### Option A: Pivot to Ghost (Recommended)

Redefine Phase 3 to use **Ghost CMS** as the first platform:
- Ghost has a full Admin API with post creation
- Ghost is also on the Phase 4 list, so this just reorders work
- The plugin architecture can still be validated
- Patreon moves to Phase 4 for read-only patron verification

### Option B: Patreon Read-Only + Notification

If Patreon must be Phase 3:
- Implement OAuth and token refresh (still valuable)
- Instead of posting, send user a formatted email with:
  - Pre-formatted post content ready to copy
  - Deep link to Patreon's post creation page
  - Instructions for one-click posting
- Track in state that notification was sent

### Option C: Descope Patreon Posting

Remove Patreon from SUPP-01 requirement:
- Acknowledge automated Patreon posting is not possible
- Focus on platforms with write APIs (Ghost, Bluesky, Mastodon)
- Document limitation in project scope

## Patreon OAuth (Still Useful for Read Operations)

If Patreon is kept for any purpose, here's the OAuth research:

### Token Lifecycle

| Token Type | Lifetime | Refresh Method |
|------------|----------|----------------|
| Access Token | ~31 days | Use refresh token |
| Refresh Token | Long-lived (until invalidated) | Rotates on use |
| Creator Access Token | Non-expiring (new clients) | Manual regeneration |

### OAuth Flow for GitHub Actions

```
1. User manually obtains tokens via Patreon Developer Portal
2. User stores as GitHub secrets: PATREON_ACCESS_TOKEN, PATREON_REFRESH_TOKEN
3. Workflow checks token expiration before API calls
4. If expiring soon (< 7 days), refresh and update state
5. If refresh fails, email user with re-auth instructions
```

### Token Refresh Implementation

```typescript
// Token refresh endpoint
POST https://www.patreon.com/api/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=REFRESH_TOKEN
&client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
```

### Rate Limits

| Limit Type | Threshold | Response |
|------------|-----------|----------|
| Client level | 100 requests / 2 seconds | HTTP 429 |
| Token level | 100 requests / minute | HTTP 429 |
| Bad request limit | 2000+ 4xx responses / 10 min | 30 min block |

**Rate limit response:**
```json
{
  "code_name": "RequestThrottled",
  "detail": "You have made too many attempts. Please try again later.",
  "retry_after_seconds": 9,
  "status": "429"
}
```

### Recommended Library

**patreon-api.ts** (npm package):
- TypeScript-first API v2 client
- Built-in token refresh with `refreshToken()` method
- Token store abstraction for persistence
- Auto-validation of token expiration

```bash
npm install patreon-api.ts
```

## Plugin Architecture Patterns

Regardless of which platform is first, the plugin architecture research is valuable.

### Standard Stack

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type safety | Already in project |
| Zod | 3.x | Runtime validation | Already in project |
| (none) | - | Plugin loading | Keep it simple |

### Recommended Interface

Based on existing codebase patterns (EmailProvider interface):

```typescript
// src/types/platform.ts
export interface PlatformConfig {
  enabled: boolean;
  // Platform-specific config via discriminated union
}

export interface PostContent {
  digest: DigestContent;
  teaser: TeaserContent;
  linkTarget: string; // URL to full content
}

export interface PlatformResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
}

export interface PlatformPlugin {
  /** Platform identifier */
  readonly name: string;

  /** Check if platform is configured and enabled */
  isEnabled(config: Config): boolean;

  /** Validate credentials before posting */
  validateCredentials(): Promise<boolean>;

  /** Transform content for this platform */
  formatContent(content: PostContent): Promise<string>;

  /** Publish to platform */
  publish(content: PostContent): Promise<PlatformResult>;

  /** Refresh credentials if needed (OAuth tokens) */
  refreshCredentials?(): Promise<boolean>;
}
```

### Factory Pattern (Following EmailProvider)

```typescript
// src/platforms/factory.ts
export function createPlatformPlugin(
  name: string,
  config: PlatformConfig
): PlatformPlugin {
  switch (name) {
    case 'ghost':
      return new GhostPlugin(config);
    case 'bluesky':
      return new BlueskyPlugin(config);
    case 'mastodon':
      return new MastodonPlugin(config);
    default:
      throw new Error(`Unknown platform: ${name}`);
  }
}
```

### Recommended File Organization

```
src/
├── platforms/
│   ├── index.ts         # Re-exports
│   ├── factory.ts       # createPlatformPlugin
│   ├── types.ts         # PlatformPlugin interface
│   ├── ghost.ts         # Ghost implementation
│   ├── bluesky.ts       # Bluesky implementation
│   └── mastodon.ts      # Mastodon implementation
├── types/
│   └── platform.ts      # Platform types
```

### Error Isolation Pattern

```typescript
// Publish to all enabled platforms, isolate failures
async function publishToAllPlatforms(
  content: PostContent,
  plugins: PlatformPlugin[]
): Promise<Record<string, PlatformResult>> {
  const results: Record<string, PlatformResult> = {};

  for (const plugin of plugins) {
    try {
      results[plugin.name] = await plugin.publish(content);
    } catch (error) {
      results[plugin.name] = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  return results;
}
```

## Codebase Patterns to Follow

### Exponential Backoff (from src/content/generator.ts)

```typescript
const MAX_RETRIES = 3;

async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  let attempt = 0;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: unknown) {
      const apiError = error as { status?: number };
      const isRateLimit = apiError?.status === 429;
      const isLastAttempt = attempt >= retries - 1;

      if (isRateLimit && !isLastAttempt) {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        console.warn(`Rate limited. Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      } else {
        throw error;
      }
    }
  }

  throw new Error('Max retries exceeded');
}
```

### Provider Abstraction (from src/email/)

The email provider pattern is ideal for platforms:

```typescript
// Interface defines contract
export interface EmailProvider {
  send(params: EmailParams): Promise<EmailResult>;
}

// Factory creates implementations
export function createEmailProvider(config: EmailConfig): EmailProvider {
  switch (config.provider) {
    case 'resend': return new ResendProvider(...);
    case 'ses': return new SESProvider(...);
    default: throw new Error(`Unknown provider`);
  }
}
```

### State Management (from src/state/artifacts.ts)

- Immutable state updates with spread operators
- Atomic file writes (temp file + rename)
- State stored in `.state/digest.json`
- JSON serializable for GitHub Actions artifacts

### Config Extension Pattern (from src/config/schema.ts)

```typescript
// Add platform configs to main config schema
const platformConfigSchema = z.object({
  ghost: ghostConfigSchema.optional(),
  bluesky: blueskyConfigSchema.optional(),
  mastodon: mastodonConfigSchema.optional(),
});

// Platforms auto-enable if configured
// Can be explicitly disabled
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Patreon API client | Custom HTTP calls | patreon-api.ts | Token refresh, types built-in |
| OAuth token refresh | Manual token management | Library token store | Edge cases, expiration handling |
| HTTP retry logic | Custom retry loops | Existing callWithRetry pattern | Already proven in codebase |
| Plugin type safety | Duck typing | TypeScript interfaces | Compile-time validation |

## Common Pitfalls

### Pitfall 1: Assuming Patreon Has Write API

**What goes wrong:** Planning features that require post creation
**Why it happens:** Other platforms have write APIs; assumption of parity
**How to avoid:** Verify API capabilities before planning
**Warning signs:** No POST/PUT/PATCH endpoints in docs

### Pitfall 2: Token Storage in GitHub Secrets

**What goes wrong:** Can't update secrets programmatically during workflow
**Why it happens:** GitHub secrets are read-only during workflow execution
**How to avoid:** Store refreshed tokens in state artifact, not secrets
**Warning signs:** Token refresh logic that tries to update secrets

### Pitfall 3: Single Retry Delay

**What goes wrong:** Thundering herd on rate limit recovery
**Why it happens:** All retries fire at same interval
**How to avoid:** Exponential backoff WITH jitter
**Warning signs:** Multiple 429s in succession

### Pitfall 4: Silent Auth Failures

**What goes wrong:** User doesn't know posting failed due to auth
**Why it happens:** Generic error handling, no user notification
**How to avoid:** Email user on auth failure with re-auth instructions
**Warning signs:** Posts stuck in "failed" state without explanation

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Patreon API v1 | API v2 | 2020 | v1 deprecated, different scopes model |
| patreon-js (official) | patreon-api.ts (community) | 2023 | Better TypeScript, v2 support |
| Non-expiring tokens | 31-day expiring tokens | 2020 | Must implement refresh |

**Deprecated/outdated:**
- Patreon API v1: Deprecated, use v2
- patreon-js: Unmaintained official library, use patreon-api.ts
- Direct API calls: Use typed client library

## Open Questions

1. **Ghost as alternative first platform?**
   - What we know: Ghost has full Admin API with post creation
   - What's unclear: Whether user prefers to reorder phases
   - Recommendation: Present options to user for decision

2. **Token storage approach**
   - What we know: GitHub secrets are read-only during workflow
   - What's unclear: Best pattern for persisting refreshed tokens
   - Recommendation: Store in state artifact alongside post data

3. **Patreon for patron verification only?**
   - What we know: API supports reading member/patron data
   - What's unclear: Whether this is valuable without posting
   - Recommendation: Could use for tier-gating content on external platforms

## Sources

### Primary (HIGH confidence)
- [Patreon API v2 Documentation](https://docs.patreon.com/) - Official reference
- [Patreon Developer Forum - Post Creation](https://www.patreondevelopers.com/t/can-we-use-api-to-create-simple-posts/4542) - Staff confirmation
- Project codebase patterns (src/content/generator.ts, src/email/, src/state/)

### Secondary (MEDIUM confidence)
- [patreon-api.ts npm](https://www.npmjs.com/package/patreon-api.ts) - Community TypeScript client
- [Patreon Developer Forum - Token Expiration](https://www.patreondevelopers.com/t/does-the-creators-access-token-expire/523) - Token lifecycle
- [TypeScript Plugin Architecture](https://dev.to/hexshift/designing-a-plugin-system-in-typescript-for-modular-web-applications-4db5) - Design patterns

### Tertiary (LOW confidence)
- [Reverse-engineered Patreon API](https://github.com/oxguy3/patreon-api) - Undocumented endpoints (not recommended)

## Metadata

**Confidence breakdown:**
- Patreon limitation: HIGH - Multiple authoritative sources confirm
- Plugin architecture: HIGH - Based on existing codebase patterns
- OAuth flow: MEDIUM - Patreon-specific docs are sparse
- Token lifecycle: MEDIUM - Community knowledge, some official confirmation
- Alternative platforms: LOW - Requires further research if pivoting

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (Patreon API is stable/stagnant)

---

## Recommendation Summary

**The primary blocker for Phase 3 as designed is that Patreon does not support programmatic post creation.**

Suggested action:
1. Discuss with user: Pivot to Ghost CMS as first platform?
2. If yes: Phase 3 becomes Ghost posting, Patreon moves to Phase 4 for patron verification
3. If no: Implement "copy-paste" workflow with formatted email notifications

The plugin architecture research is valid regardless of which platform is first.
