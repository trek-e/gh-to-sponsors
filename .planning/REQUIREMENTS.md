# Requirements: gh-to-sponsors

**Defined:** 2025-02-01
**Core Value:** Creators approve one email and their supporters on every platform get updated

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### GitHub Monitoring

- [ ] **GHUB-01**: User can configure one or more repos to monitor
- [ ] **GHUB-02**: System monitors commits and aggregates activity
- [ ] **GHUB-03**: System detects GitHub Releases and triggers announcements

### Content Generation

- [ ] **CONT-01**: System generates digest from recent commits
- [ ] **CONT-02**: System generates short teasers for social platforms
- [ ] **CONT-03**: System supports simple templates using commit messages

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

- [ ] **SUPP-01**: System posts to Patreon on approval
- [ ] **SUPP-02**: System posts to Ghost on approval

### Social Platforms

- [ ] **SOCL-01**: System posts teasers to Bluesky on approval
- [ ] **SOCL-02**: System posts teasers to Mastodon on approval

### Extensibility

- [ ] **EXTN-01**: Plugin architecture allows adding new platforms
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
| GHUB-01 | TBD | Pending |
| GHUB-02 | TBD | Pending |
| GHUB-03 | TBD | Pending |
| CONT-01 | TBD | Pending |
| CONT-02 | TBD | Pending |
| CONT-03 | TBD | Pending |
| SCHD-01 | TBD | Pending |
| SCHD-02 | TBD | Pending |
| SCHD-03 | TBD | Pending |
| APPR-01 | TBD | Pending |
| APPR-02 | TBD | Pending |
| APPR-03 | TBD | Pending |
| APPR-04 | TBD | Pending |
| SUPP-01 | TBD | Pending |
| SUPP-02 | TBD | Pending |
| SOCL-01 | TBD | Pending |
| SOCL-02 | TBD | Pending |
| EXTN-01 | TBD | Pending |
| EXTN-02 | TBD | Pending |
| INFR-01 | TBD | Pending |
| INFR-02 | TBD | Pending |
| INFR-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22 (pending roadmap creation)

---
*Requirements defined: 2025-02-01*
*Last updated: 2025-02-01 after scoping*
