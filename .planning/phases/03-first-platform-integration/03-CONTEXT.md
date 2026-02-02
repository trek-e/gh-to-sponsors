# Phase 3: First Platform Integration - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning
**Platform:** Ghost CMS (pivoted from Patreon due to API limitations)

<domain>
## Phase Boundary

Approved posts successfully publish to Ghost CMS with Admin API authentication. This phase establishes the plugin architecture that future platforms will use. Content generation (Phase 2) provides the digest/teaser; this phase posts it. Bluesky and Mastodon integrations are Phase 4.

**Why Ghost instead of Patreon:** Research confirmed Patreon's API v2 is read-only — no endpoints exist for creating posts. Ghost has a full Admin API with post creation. Patreon has been descoped entirely from v1.

</domain>

<decisions>
## Implementation Decisions

### Ghost Authentication
- Admin API key stored as GitHub secret (GHOST_ADMIN_API_KEY)
- Admin API uses JWT signed with key for authentication
- No OAuth flow needed — Admin API keys don't expire
- User creates key in Ghost Admin → Integrations → Custom Integration

### Post Formatting & Publishing
- Full digest posted as Ghost draft or published post (user configurable)
- Post includes teaser as excerpt for social sharing
- Link target: Ghost post URL (available after creation)
- Tags configurable in sponsors.yaml (default: #devlog, #opensource)

### Failure Handling & Retries
- Exponential backoff + jitter for rate limits (same pattern as Anthropic API)
- After all retries fail: mark post as 'failed' in state, email user with details
- Failed posts can be manually retried via email link (similar to approve/skip flow)

### Plugin Interface Design
- Platforms auto-enable if credentials configured, but can be explicitly disabled in config
- Each plugin transforms content for its platform (not same content everywhere)
- Ghost plugin receives digest, creates formatted Ghost post

### Claude's Discretion
- Partial success behavior (one platform fails, others succeed)
- Plugin interface formality (TypeScript interface vs duck typing)
- Plugin file organization (src/platforms/ vs src/plugins/)
- Ghost post status on creation (draft vs published)

</decisions>

<specifics>
## Specific Ideas

- Retry link in failure email mirrors the approve/skip pattern (token-based, secure)
- Ghost posts should include proper metadata (excerpt, tags, feature image placeholder)
- Plugin architecture should make adding Bluesky/Mastodon (Phase 4) straightforward
- Consider storing Ghost post URL in state for use in social teasers

</specifics>

<deferred>
## Deferred Ideas

- Patreon integration — no posting API exists (descoped from v1)

</deferred>

---

*Phase: 03-first-platform-integration*
*Context gathered: 2026-02-02*
*Pivot reason: Patreon API is read-only, cannot create posts*
