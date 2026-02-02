# Phase 2: Content Generation - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate digestible updates from GitHub activity automatically. System aggregates commits from configured repos into readable summaries for supporter platforms, plus short teasers for social platforms (under 300 chars). This phase creates content — posting to platforms is Phase 3+.

</domain>

<decisions>
## Implementation Decisions

### Digest Content & Structure
- Group commits by repository with separate sections per repo
- AI-generated summaries combining multiple commits into prose (not raw commit messages)
- Conversational/update tone: "This week I worked on..." personal newsletter style
- Blog post style narrative paragraphs explaining the work
- Include links to individual commits/PRs for those who want details
- Consistent format even when only one repo had activity
- Fallback to longer period if no activity (no daily → check weekly → skip if still nothing)

### Social Teasers
- Auto-generate relevant hashtags (#opensource, #devlog, etc.)
- Under 300 characters to fit platform limits

### Multi-Repo Handling
- Separate sections with clear heading per repo
- Each repo gets its own summary paragraph
- Consistent structure regardless of number of active repos

### Activity Filtering
- Bot commits (dependabot, renovate) summarized as one item: "Updated N dependencies"
- Time-based minimum threshold: daily needs 1+ commit, weekly needs 3+
- Only generate digest when there's meaningful activity

### Claude's Discretion
- Digest title/headline format (auto-generated, date-based, or repo-based)
- Whether to include commit/activity stats
- Teaser link target (full post, GitHub, or landing page depending on platform)
- Whether teasers differ per platform or stay consistent
- What teasers emphasize (biggest change, summary, or CTA)
- Repo display names (GitHub name unless configured otherwise)
- Repo ordering (most active first, config order, or alphabetical)
- Merge commit handling (skip or include based on signal)
- CI/docs-only commit handling (skip, downplay, or include)

</decisions>

<specifics>
## Specific Ideas

- Tone should feel like a personal developer newsletter — the creator talking to their supporters
- Links to commits/PRs give supporters who want to dive deeper the option
- Bot commits are noise but worth a one-liner summary ("Updated 5 dependencies")
- Empty periods should fallback gracefully rather than send empty emails

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-content-generation*
*Context gathered: 2026-02-01*
