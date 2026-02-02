# Requirements: gh-to-sponsors

**Defined:** 2025-02-01
**Core Value:** Creators approve one email and their supporters on every platform get updated

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### GitHub Monitoring

- [x] **GHUB-01**: User can configure one or more repos to monitor
- [x] **GHUB-02**: System monitors commits and aggregates activity
- [ ] **GHUB-03**: System detects GitHub Releases and triggers announcements

### Content Generation

- [x] **CONT-01**: System generates digest from recent commits
- [x] **CONT-02**: System generates short teasers for social platforms
- [x] **CONT-03**: System supports simple templates using commit messages

### Scheduling

- [ ] **SCHD-01**: System runs daily and generates digest if activity exists
- [ ] **SCHD-02**: System falls back to weekly digest if no daily activity
- [ ] **SCHD-03**: User can configure cadence (daily, weekly, or after N updates)

### Approval Workflow

- [ ] **APPR-01**: System emails draft preview to creator
- [ ] **APPR-02**: Email includes approve/skip links
- [ ] **APPR-03**: Serverless endpoint handles approval clicks
- [ ] **APPR-04**: System triggers platform posting on approval

### Supporter Platforms

- [x] **SUPP-01**: System posts to Ghost on approval

### Social Platforms

- [ ] **SOCL-01**: System posts teasers to Bluesky on approval
- [ ] **SOCL-02**: System posts teasers to Mastodon on approval

### Extensibility

- [x] **EXTN-01**: Plugin architecture allows adding new platforms
- [ ] **EXTN-02**: Documentation exists for creating platform plugins

### Infrastructure

- [ ] **INFR-01**: Runs as GitHub Action (scheduled + event-triggered)
- [ ] **INFR-02**: Serverless approval endpoint (Vercel or similar)
- [ ] **INFR-03**: Email service integration (Resend or similar)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Content

- **CONT-04**: AI-assisted commit summarization
- **CONT-05**: Custom template language

### Additional Platforms

- **PLAT-01**: Discord integration
- **PLAT-02**: Telegram integration
- **PLAT-03**: LinkedIn integration (if values-aligned)

### Collaboration

- **COLB-01**: Multi-user approval workflows
- **COLB-02**: Team notification settings

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Ko-fi integration | No posting API exists (webhook-only for payment notifications) |
| Patreon integration | No posting API exists (read-only API, cannot create posts) |
| X/Twitter integration | Platform enables fascism — values-aligned exclusion |
| Meta platforms (Facebook, Instagram, Threads) | Same reasoning as X/Twitter |
| Edit-before-send workflow | Approve/skip is sufficient for v1 |
| Web dashboard | Email-based flow is the interface |
| Real-time notifications | Daily/weekly cadence is intentional |
| Analytics/engagement tracking | Platforms already provide this |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Pending |
| APPR-01 | Phase 1 | Pending |
| APPR-02 | Phase 1 | Pending |
| APPR-03 | Phase 1 | Pending |
| APPR-04 | Phase 1 | Pending |
| SCHD-01 | Phase 1 | Pending |
| GHUB-01 | Phase 2 | Complete |
| GHUB-02 | Phase 2 | Complete |
| CONT-01 | Phase 2 | Complete |
| CONT-02 | Phase 2 | Complete |
| CONT-03 | Phase 2 | Complete |
| SUPP-01 | Phase 3 | Complete |
| EXTN-01 | Phase 3 | Complete |
| SOCL-01 | Phase 4 | Pending |
| SOCL-02 | Phase 4 | Pending |
| GHUB-03 | Phase 5 | Pending |
| SCHD-02 | Phase 5 | Pending |
| SCHD-03 | Phase 5 | Pending |
| EXTN-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21 ✓
- Unmapped: 0

---
*Requirements defined: 2025-02-01*
*Last updated: 2026-02-02 — Phase 3 complete (Ghost + plugin architecture)*
