# Phase 5: Intelligence & Releases - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

System adapts posting cadence (daily vs weekly) based on activity levels and detects GitHub Releases as special announcement triggers. Users can configure cadence preferences. The system only sends emails when meaningful activity exists.

</domain>

<decisions>
## Implementation Decisions

### Release Detection
- GitHub Releases trigger immediate approval email (don't wait for scheduled run)
- Release announcements are separate posts, distinct from regular commit digests
- Release content includes: title/tag, release notes body, link to release page, download links if available
- Pre-release and draft release handling is configurable by user (some want beta announcements, some don't)

### Cadence Logic
- Two modes available: daily digest and weekly digest
- Default to daily with automatic fallback to weekly when quiet
- First activity after an extended quiet period triggers immediate digest (not waiting for next scheduled run)

### Quiet Period Handling
- When no activity: Claude decides (likely silent skip - no notification)
- Activity resumption triggers immediate digest

### Claude's Discretion
- What counts as "meaningful activity" threshold (1+ commits vs N commits)
- When daily mode should fall back to weekly (after how many quiet days)
- Whether to track patterns/streaks (if it adds value)
- Config file vs env vars vs both (follow existing project patterns)
- Per-repo cadence overrides vs global only (based on complexity vs value)
- GitHub Actions cron vs internal scheduling logic
- Time-of-day send preferences (if complexity is worth it)

</decisions>

<specifics>
## Specific Ideas

- Releases should feel special/important, not just another digest
- The system should be "quiet when you are" - don't spam if nothing is happening
- First activity after quiet period = immediate update (users are excited when work resumes)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-intelligence-releases*
*Context gathered: 2026-02-02*
