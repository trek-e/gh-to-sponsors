# gh-to-sponsors

## What This Is

A syndication tool for open source creators who use crowdfunding. It monitors GitHub activity, drafts digest updates and release announcements, and posts them to supporter platforms (Patreon, Ko-fi, Ghost) and social media (Bluesky, Mastodon) after email-based approval. Built for the community of crowdfunded developers who want to keep supporters informed without manual cross-posting.

## Core Value

Creators approve one email and their supporters on every platform get updated — no manual copying, no platform-hopping, no friction.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Configure which GitHub repos to monitor (single or multiple)
- [ ] Generate daily digest from commit activity
- [ ] Fall back to weekly digest when no daily activity
- [ ] Detect GitHub Releases and draft announcements
- [ ] Email drafts with approve/skip links
- [ ] Post to Patreon on approval
- [ ] Post to Ko-fi on approval
- [ ] Post to Ghost on approval
- [ ] Post teasers to Bluesky on approval
- [ ] Post teasers to Mastodon on approval
- [ ] Plugin architecture for adding new platforms
- [ ] Run as GitHub Action (scheduled + event-triggered)

### Out of Scope

- X/Twitter integration — explicitly excluded, platform enables fascism
- Meta platforms (Facebook, Instagram, Threads) — same reasoning
- Edit-before-send workflow — approve/skip is sufficient for v1
- Web dashboard — email-based flow is the interface
- Real-time notifications — daily/weekly cadence is intentional

## Context

**Problem being solved:** Open source creators manually copy-paste updates to multiple platforms. It's tedious enough that many just don't do it, leaving supporters uninformed.

**Current workflow (manual):**
1. Make commits, ship releases
2. Write update post
3. Log into Patreon, paste, post
4. Log into Ko-fi, paste, post
5. Log into Ghost, paste, post
6. Open Bluesky, write teaser, post
7. Open Mastodon, write teaser, post

**Target workflow (gh-to-sponsors):**
1. Make commits, ship releases
2. Receive email with draft
3. Click approve
4. Done — all platforms updated

**Audience:** Open source developers using crowdfunding (Patreon, Ko-fi, GitHub Sponsors, etc.) to sustain their work. Technical enough to set up a GitHub Action, but don't want to run infrastructure.

**Values:** This tool explicitly refuses to support platforms that enable hate and fascism. No X/Twitter. No Meta. This is a feature, not a limitation.

## Constraints

- **Infrastructure**: Minimal — GitHub Actions + serverless function for approval endpoint. No servers to manage.
- **Email service**: Need a transactional email API (Resend, SendGrid, Postmark) for sending drafts.
- **Platform APIs**: Each target platform needs API access for posting. Some may require OAuth, others API keys.
- **Plugin system**: Must be simple enough that community can add platforms without deep knowledge of core.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Email-based approval | Async workflow, works from any device, no web UI to build | — Pending |
| Approve/skip only (no edit) | Keeps v1 simple, auto-drafts should be good enough | — Pending |
| GitHub Action as runtime | Lives where the code is, familiar to target audience | — Pending |
| Serverless approval endpoint | Minimal infra, scales to zero, easy for others to deploy | — Pending |
| Plugin system for platforms | Community can add their own platforms, future-proofs the tool | — Pending |
| No X/Meta platforms | Values alignment, explicit stance against fascist-enabling platforms | — Pending |

---
*Last updated: 2025-02-01 after initialization*
