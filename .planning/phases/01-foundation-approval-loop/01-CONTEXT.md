# Phase 1: Foundation & Approval Loop - Context

**Gathered:** 2025-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Infrastructure for scheduling, email-based approval, and secure approval link handling. Creators receive emails with draft previews, click approve/skip, and the system triggers platform posting. This phase builds the "plumbing" — content generation and actual platform posting are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Email design
- Content preview: Summary only (highlights, not full draft)
- Full draft viewable by clicking a link if needed

### Approval link behavior
- Already-used links: Show status ("Already posted to: Patreon, Ghost, Bluesky")
- Expiration: User configurable timeout (24 or 48 hours)
- Auto-action: User configurable — auto-approve, auto-skip, or require manual action after timeout
- This is a key differentiator: "set and forget" for busy creators

### Scheduling
- Cron reliability: Accept GitHub Actions delays (daily digests don't need precision)
- Time of day: User configurable via config
- Manual trigger: Both CLI command and GitHub workflow_dispatch UI
- 60-day disable: Documentation warning only, no automated keep-alive

### Email service
- User configurable: Support Amazon SES, Resend, SendGrid, or similar
- Abstract the email sending behind a provider interface
- Ship with Resend as default (good free tier, simple setup)

### State tracking
- Storage: GitHub Actions artifacts (built-in, no external dependencies)
- Track per post: Platform status (success/fail per platform), content hash (for deduplication)
- Retention and history viewing: Claude's discretion based on artifact limits

### Claude's Discretion
- Email subject line format
- Email link placement (top, bottom, or both)
- Email format (HTML vs plain text vs both)
- Confirmation page design after approval click
- History viewing mechanism
- State retention period
- Additional fields to track per post (timestamps, etc.)

</decisions>

<specifics>
## Specific Ideas

- Auto-approve/auto-skip after timeout is important — busy creators want "set and forget" option
- Users should be able to bring their own email service (SES for those who have it, Resend for simplicity)
- "Already posted" status page is preferred over error message when clicking used links

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-approval-loop*
*Context gathered: 2025-02-01*
