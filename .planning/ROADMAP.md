# Roadmap: gh-to-sponsors

## Overview

A 6-phase journey to build a GitHub-to-supporter syndication tool that lets creators approve one email and update all platforms. We start with infrastructure and approval workflow, prove the plugin architecture with a single platform (Ghost), expand to all supporter and social platforms, add intelligent scheduling and releases detection, then enable community extensibility. Each phase delivers verifiable capabilities that build toward the core value: eliminating manual cross-posting friction for crowdfunded open source creators.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Approval Loop** - Infrastructure, scheduling, and secure email-based approval workflow
- [x] **Phase 2: Content Generation** - GitHub activity monitoring and digest creation
- [x] **Phase 3: First Platform Integration** - Ghost posting and plugin architecture validation
- [ ] **Phase 4: Multi-Platform Expansion** - Bluesky and Mastodon integrations
- [ ] **Phase 5: Intelligence & Releases** - GitHub Releases detection and adaptive scheduling
- [ ] **Phase 6: Extensibility** - Plugin system documentation and community enablement

## Phase Details

### Phase 1: Foundation & Approval Loop
**Goal**: Creators receive email drafts with approve/skip links that trigger platform posting workflow
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, APPR-01, APPR-02, APPR-03, APPR-04, SCHD-01
**Success Criteria** (what must be TRUE):
  1. GitHub Action runs on schedule without manual intervention
  2. Creator receives email with preview of content to be posted
  3. Creator clicks approve link and platforms receive posting trigger
  4. Approval links expire after 24-48 hours and cannot be replayed
  5. System tracks which drafts are pending vs posted
**Plans**: 7 plans in 5 waves

Plans:
- [x] 01-01-PLAN.md — Project setup, types, and configuration schema
- [x] 01-02-PLAN.md — Token signing and verification (TDD)
- [x] 01-03-PLAN.md — State management with artifacts
- [x] 01-04-PLAN.md — Email provider abstraction and templates
- [x] 01-05-PLAN.md — Vercel approval endpoint
- [x] 01-06-PLAN.md — GitHub Actions workflows
- [x] 01-07-PLAN.md — End-to-end verification (checkpoint)

### Phase 2: Content Generation
**Goal**: System creates digestible updates from GitHub activity automatically
**Depends on**: Phase 1
**Requirements**: GHUB-01, GHUB-02, CONT-01, CONT-02, CONT-03
**Success Criteria** (what must be TRUE):
  1. User configures repos to monitor via YAML config file
  2. System aggregates commits from configured repos into readable digest
  3. System generates short teasers suitable for social platforms (under 300 chars)
  4. Digest uses commit messages to create meaningful summaries
**Plans**: 5 plans in 4 waves

Plans:
- [x] 02-01-PLAN.md — Types, config extension, and dependency installation
- [x] 02-02-PLAN.md — Bot detection and commit classification (TDD)
- [x] 02-03-PLAN.md — GitHub commit fetching and multi-repo aggregation
- [x] 02-04-PLAN.md — AI content generation with Anthropic Claude
- [x] 02-05-PLAN.md — Integration into generate-digest action

### Phase 3: First Platform Integration
**Goal**: Approved posts successfully publish to Ghost CMS with Admin API authentication
**Depends on**: Phase 2
**Requirements**: SUPP-01, EXTN-01
**Success Criteria** (what must be TRUE):
  1. User configures Ghost Admin API credentials via GitHub secrets
  2. Approved content posts to Ghost blog successfully
  3. Platform plugin interface defines contract for future platforms
  4. System handles rate limits and retries failed posts with exponential backoff
  5. Plugin architecture isolates platform failures from each other
**Plans**: 5 plans in 4 waves

Plans:
- [x] 03-01-PLAN.md — Platform types, plugin interface, and config schema (Wave 1)
- [x] 03-02-PLAN.md — Ghost plugin with Admin API and retry logic (Wave 2, TDD)
- [x] 03-03-PLAN.md — Platform executor with error isolation (Wave 2)
- [x] 03-04-PLAN.md — Wire platform posting into approval flow (Wave 3)
- [x] 03-05-PLAN.md — Failure notification emails with retry links (Wave 4)

### Phase 4: Multi-Platform Expansion
**Goal**: Single approval posts to all configured platforms (Bluesky, Mastodon)
**Depends on**: Phase 3
**Requirements**: SOCL-01, SOCL-02
**Success Criteria** (what must be TRUE):
  1. Teasers post to Bluesky with link back to full content
  2. Teasers post to Mastodon with link back to full content
  3. User can enable/disable platforms via configuration
  4. Platform failures don't block posting to other platforms
**Plans**: 4 plans in 3 waves

Plans:
- [ ] 04-01-PLAN.md — Config schema extensions, type definitions, SDK installation (Wave 1)
- [ ] 04-02-PLAN.md — BlueskyPlugin with RichText facets (Wave 2, TDD)
- [ ] 04-03-PLAN.md — MastodonPlugin with visibility settings (Wave 2, TDD)
- [ ] 04-04-PLAN.md — Wire platforms into setup and verify integration (Wave 3)

### Phase 5: Intelligence & Releases
**Goal**: System adapts posting cadence and detects GitHub Releases for announcements
**Depends on**: Phase 4
**Requirements**: GHUB-03, SCHD-02, SCHD-03
**Success Criteria** (what must be TRUE):
  1. GitHub Releases trigger immediate announcement drafts
  2. System falls back to weekly digest when no daily activity
  3. User can configure cadence (daily, weekly, or after N updates)
  4. System only sends emails when meaningful activity exists
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Extensibility
**Goal**: Community can create and contribute platform plugins
**Depends on**: Phase 5
**Requirements**: EXTN-02
**Success Criteria** (what must be TRUE):
  1. Documentation exists showing how to create a platform plugin
  2. Example plugin template demonstrates plugin interface
  3. Testing harness validates plugin implementations
  4. Community can submit plugins via documented process
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Approval Loop | 7/7 | Ready for deployment | 2026-02-01 |
| 2. Content Generation | 5/5 | Complete | 2026-02-02 |
| 3. First Platform Integration | 5/5 | Complete | 2026-02-02 |
| 4. Multi-Platform Expansion | 0/4 | Ready for execution | - |
| 5. Intelligence & Releases | 0/TBD | Not started | - |
| 6. Extensibility | 0/TBD | Not started | - |
