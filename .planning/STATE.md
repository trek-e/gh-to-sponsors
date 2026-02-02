# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Creators approve one email and their supporters on every platform get updated
**Current focus:** Phase 3 - First Platform Integration (Ghost CMS)

## Current Position

Phase: 3 of 6 (First Platform Integration)
Plan: 4 of 5 complete (03-01, 03-02, 03-03, 03-04)
Status: In progress
Last activity: 2026-02-02 - Completed 03-04-PLAN.md (approval integration)

Progress: [██████████████░░░░░░] ~75% (Phase 1 + Phase 2 + Phase 3 partial)

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 2.3 minutes
- Total execution time: 0.62 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Foundation & Approval Loop | 7/7 | 18 min | 2.6 min |
| 2 - Content Generation | 5/5 | 12 min | 2.4 min |
| 3 - First Platform Integration | 4/5 | 11 min | 2.8 min |

**Recent Trend:**
- Last 5 plans: 03-01 (2 min), 03-02 (4 min), 03-03 (4 min), 03-04 (1 min)
- Trend: Consistent fast execution

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Email-based approval (async workflow, works from any device, no web UI to build)
- GitHub Action as runtime (lives where the code is, familiar to target audience)
- Serverless approval endpoint (minimal infra, scales to zero, easy for others to deploy)
- Ko-fi excluded from v1 (no posting API exists, only webhook for payment notifications)

**From 01-01:**
- ESM-only modules (better tree-shaking, modern Node.js standard)
- Strict TypeScript mode (catch errors at compile time)
- Zod for config validation (type-safe with excellent error messages)
- YAML config files (more readable than JSON, supports inline comments)

**From 01-02:**
- HMAC-SHA256 for token signing (built-in crypto, no dependencies)
- timingSafeEqual for signature verification (prevents timing attacks)
- jti for replay prevention (tracks used tokens via UUID)
- base64url encoding (URL-safe tokens for email links)

**From 01-03:**
- Atomic write pattern for state saves (temp file + rename prevents corruption)
- Immutable state updates (all functions return new objects)
- Conservative token cleanup (based on lastRun timestamp)
- File-based state for artifact compatibility (no external database needed)

**From 01-04:**
- Email provider abstraction (supports Resend, SES, SendGrid)
- Factory pattern for provider selection (config-driven)
- Multipart email (HTML + text for deliverability)
- Inline CSS for email client compatibility
- Duplicate action buttons (top and bottom for UX)
- XSS protection via HTML escaping

**From 01-05:**
- @octokit/rest for GitHub API access (cleaner than raw fetch)
- Inline CSS for HTML responses (email client compatibility)
- jti in dispatch payload (Vercel can't upload artifacts, Action updates state)
- Simple zip extraction (avoids dependency for predictable artifact structure)
- HTML responses not JSON (approval links clicked in email clients)

**From 01-06:**
- Cron offset from top of hour (avoids GitHub Actions load delays)
- Artifact v6 for Node.js 24 compatibility (SHA256 validation, immutability)
- tsx for TypeScript execution (no build step needed)
- 90-day artifact retention (maximum default for state persistence)
- Stub digest for Phase 1 (real content generation is Phase 2)

**From 01-07:**
- User-driven deployment (requires credentials Claude cannot access)
- Comprehensive deployment guide in SUMMARY (serves as documentation)
- All components built and ready for deployment
- Phase 1 complete pending user verification

**From 02-01:**
- CommitType includes 'bot' and 'other' for non-conventional commits
- RepoConfig.displayName optional (defaults to owner/repo)
- Content thresholds: dailyThreshold=1, weeklyThreshold=3
- Multi-repo pattern: repos array replaces single owner/repo

**From 02-02:**
- Bot detection via author patterns + noreply.github.com emails
- Case-insensitive matching for bot names and commit types
- filterAndClassifyCommits returns { human: ClassifiedCommit[], botCount: number }

**From 02-03:**
- Safety limit of 500 commits per repo prevents runaway API calls
- startOfDay for date calculations ensures consistent time boundaries
- Sort repos by activity (most active first) for digest prioritization
- Continue on error for individual repos rather than fail entire aggregation

**From 02-04:**
- Claude Sonnet for balance of quality and cost
- Temperature 0.4 for factual digests, 0.7 for creative teasers
- Exponential backoff with jitter for 429 rate limits
- JSON output for teasers (easier parsing and validation)
- Zod schema validation for teaser structure
- Warn-only validation for digests (don't fail on missing links)

**From 02-05:**
- Store digest/teaser in PostState (enables posting without regeneration)
- Optional fields for backward compatibility with existing state
- Show teaser in email preview (user can review before approving)
- Content hash uses actual digest content for unique post ID

**From 03-01:**
- API key from env var not config (GHOST_ADMIN_API_KEY for security)
- Factory pattern for lazy plugin instantiation (mirrors email provider)
- PlatformPlugin interface: name, isConfigured(), post()
- Registry pattern: registerPlatform(), getConfiguredPlatforms()

**From 03-02:**
- GhostAPI type from ReturnType<typeof GhostAdminAPI> (callable constructor pattern)
- Tags as { name } objects per Ghost API requirements
- Status field inside post object (Ghost API pitfall #1)
- Lazy client initialization defers API instantiation until first use
- Never-throw pattern: always return PostResult, never throw exceptions

**From 03-03:**
- Promise.allSettled for error isolation (one platform failure doesn't block others)
- Defense in depth with try/catch wrapping for plugin bugs
- PlatformPostState replaces simple string PlatformResult (marked @deprecated)
- resultsToStateFormat bridges executor results to state persistence
- updatePlatformResults for immutable state updates

**From 03-04:**
- Ghost credentials from env vars (GHOST_API_URL, GHOST_ADMIN_API_KEY)
- Default status 'draft' and tags 'devlog,opensource' when not specified
- Status 'posted' only on all-platform success, 'approved' on partial/failure for retry
- Idempotent platform setup (initialized flag prevents duplicate registration)

### Pending Todos

**User Setup Required for Phase 1 Completion:**
- Deploy Vercel function with environment variables
- Configure GitHub repository secrets
- Run manual workflow test
- Verify complete approval flow end-to-end
- See: .planning/phases/01-foundation-approval-loop/01-07-SUMMARY.md

**User Setup Required for Phase 2 Content Generation:**
- Set ANTHROPIC_API_KEY environment variable (GitHub secret + Vercel)
- Source: Anthropic Console -> API Keys -> Create key

**User Setup Required for Phase 3 Ghost Integration:**
- Set GHOST_API_URL and GHOST_ADMIN_API_KEY environment variables
- Optional: GHOST_DEFAULT_STATUS, GHOST_DEFAULT_TAGS
- Source: Ghost Admin -> Settings -> Integrations -> Add custom integration

### Blockers/Concerns

**From Research:**
- GitHub Actions scheduled workflows are unreliable (30+ min delays, auto-disable after 60 days). Mitigation: workflow_dispatch fallback implemented in 01-06.
- Email deliverability requires SPF/DKIM/DMARC configuration. Provider abstraction supports Resend/SES/SendGrid (01-04).
- OAuth token refresh complexity must be solved before platform integrations (Phase 3+).

**Phase 1 Completion:**
- All code implemented and committed
- Deployment requires user credentials (Vercel auth, GitHub PAT, email API keys)
- User must complete deployment steps from 01-07-SUMMARY.md
- Once verified, Phase 1 is operationally complete

**Phase 2 Complete:**
- Content generation pipeline fully integrated
- generate-digest action produces real AI-generated content
- Approval emails show digest and teaser preview
- State stores content for Phase 3 platform posting

**Phase 3 Progress:**
- Ghost platform plugin complete with Admin API integration
- Platform executor handles multi-platform posting with error isolation
- Approval integration wires platform posting into approval flow
- Ready for end-to-end testing (03-05)

## Session Continuity

Last session: 2026-02-02 14:24 UTC
Stopped at: Completed 03-04-PLAN.md (approval integration)
Resume file: None
Next action: Execute 03-05 (end-to-end integration testing)
