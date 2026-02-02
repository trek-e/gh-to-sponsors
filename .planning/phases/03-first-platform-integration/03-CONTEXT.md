# Phase 3: First Platform Integration - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Approved posts successfully publish to Patreon with OAuth authentication. This phase establishes the plugin architecture that future platforms will use. Content generation (Phase 2) provides the digest/teaser; this phase posts it. Ghost, Bluesky, and Mastodon integrations are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### OAuth & Authentication Flow
- GitHub Action secret only (no CLI OAuth flow, no browser redirect)
- User manually obtains Patreon API credentials and adds as GitHub secret
- Auto-refresh tokens before expiration (check expiry during workflow runs)
- If token refresh fails, email user with re-authentication instructions
- Don't fail workflow silently on auth issues

### Post Formatting & Visibility
- Tier visibility is configurable per-post in config (user sets minimum tier)
- Post teaser + link to full content (not full digest on Patreon)
- Link target before Ghost integration: GitHub repo or releases page
- No hashtags on Patreon posts (save for social platforms in Phase 4)

### Failure Handling & Retries
- Exponential backoff + jitter for rate limits (same pattern as Anthropic API)
- After all retries fail: mark post as 'failed' in state, email user with details
- Failed posts can be manually retried via email link (similar to approve/skip flow)

### Plugin Interface Design
- Platforms auto-enable if credentials configured, but can be explicitly disabled in config
- Each plugin transforms content for its platform (not same content everywhere)
- Patreon plugin receives digest, returns platform-specific format (teaser + link)

### Claude's Discretion
- Token storage approach (in state artifact vs separate)
- Partial success behavior (one platform fails, others succeed)
- Plugin interface formality (TypeScript interface vs duck typing)
- Plugin file organization (src/platforms/ vs src/plugins/)

</decisions>

<specifics>
## Specific Ideas

- Retry link in failure email mirrors the approve/skip pattern (token-based, secure)
- Patreon posts should feel like a teaser that drives traffic to the full update
- Plugin architecture should make adding Ghost (Phase 4) straightforward

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-first-platform-integration*
*Context gathered: 2026-02-02*
