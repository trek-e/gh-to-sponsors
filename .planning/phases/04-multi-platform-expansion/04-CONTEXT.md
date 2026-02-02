# Phase 4: Multi-Platform Expansion - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Single approval posts teasers to Bluesky and Mastodon with links back to full content. Users can enable/disable platforms via configuration. Platform failures don't block posting to other platforms (established in Phase 3). Ghost integration is already complete (Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Authentication Approach
- Bluesky: OAuth flow (not app passwords)
- Mastodon: OAuth with token refresh
- Instance URL for Mastodon: Check env var first, fall back to config file
- If token refresh fails: Email user with re-auth instructions (same pattern as Ghost)

### Post Content Formatting
- Teaser already sized from Phase 2 (under 280 chars) — fits both platforms
- Include hashtags from Phase 2 teaser generation
- Link target: Configurable by user (Ghost URL, GitHub repo/releases, or custom)

### Platform-Specific Behavior
- Bluesky language tag: English (en) by default
- Mastodon visibility: Configurable (public, unlisted, followers-only)

### Failure & Partial Success
- Combined failure notification email (Ghost + Bluesky + Mastodon in single email)
- Platform toggle: Auto-enable if credentials exist, but allow explicit `enabled: false` override
- Existing retry infrastructure from Phase 3 applies to new platforms

### Claude's Discretion
- Bluesky facets for rich text (links, hashtags) — decide based on complexity/benefit
- Mastodon Content Warnings — decide based on use case (likely skip for dev updates)
- Link card/embed handling — decide based on what each platform API supports
- Platform ordering (Ghost first vs parallel) — decide based on link target config
- Rate limit retry pattern — tune per platform if needed, otherwise reuse Ghost pattern

</decisions>

<specifics>
## Specific Ideas

- Reuse PlatformPlugin interface from Phase 3 — BlueskyPlugin and MastodonPlugin follow same pattern as GhostPlugin
- State tracking already supports multiple platforms (PlatformPostState from 03-03)
- Failure notifications already support multiple platforms (03-05)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-multi-platform-expansion*
*Context gathered: 2026-02-02*
