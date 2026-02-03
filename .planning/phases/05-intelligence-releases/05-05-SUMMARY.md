---
phase: 05-intelligence-releases
plan: 05
subsystem: workflow
tags: [github-actions, releases, workflow, typescript, automation]

# Dependency graph
requires:
  - phase: 05-03
    provides: Release content generation (generateReleaseContent, buildReleaseAnnouncement)
provides:
  - handle-release.yml workflow triggered by release:published events
  - handle-release.ts action for processing releases
  - npm script for handle-release execution
affects: [06-smart-batching, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Release event workflow with pre-release filtering
    - Environment variable passing for release context
    - Shared state artifact between digest and release workflows

key-files:
  created:
    - .github/workflows/handle-release.yml
    - src/actions/handle-release.ts
  modified:
    - package.json
    - src/email/templates.ts

key-decisions:
  - "Extended ApprovalEmailData.periodType to include 'release' (required for email template)"
  - "Use 'daily' periodType for digest compatibility (release posts immediately)"
  - "Post ID format: release-{sha256(repo+tag)} for uniqueness"
  - "Repository variables for pre-release/draft filtering (INCLUDE_PRERELEASES, INCLUDE_DRAFTS)"

patterns-established:
  - "Release-specific workflow pattern with event payload parsing"
  - "Release announcement stores both release data and digest/teaser for platform posting"

# Metrics
duration: 4min
completed: 2026-02-03
---

# Phase 05 Plan 05: Release Event Handling Summary

**GitHub Actions release workflow with handle-release action for immediate announcement approval emails**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-03T01:49:21Z
- **Completed:** 2026-02-03T01:53:33Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Release workflow triggers on release:published with pre-release/draft filtering
- handle-release.ts parses release env, generates AI content, sends approval email
- State stores release announcement + digest/teaser for platform posting
- Concurrency group prevents state corruption from rapid releases

## Task Commits

Each task was committed atomically:

1. **Task 1: Create handle-release.yml workflow** - `9f68a9e` (feat)
2. **Task 2: Create handle-release.ts action** - `d109101` (feat)
3. **Task 3: Add npm script for handle-release** - `8da245c` (chore)

## Files Created/Modified

- `.github/workflows/handle-release.yml` - Release event workflow with pre-release filtering
- `src/actions/handle-release.ts` - Action that processes release and sends approval email
- `package.json` - Added handle-release npm script
- `src/email/templates.ts` - Extended periodType to include 'release'

## Decisions Made

- **Extended ApprovalEmailData.periodType:** Added 'release' value to support release-specific email subject/content (Rule 2 - Missing Critical)
- **Digest periodType 'daily':** Used 'daily' for release digest to maintain compatibility with platform posting logic (releases are immediate, not weekly)
- **Repository variables for filtering:** Used GitHub Actions repository variables (vars.INCLUDE_PRERELEASES, vars.INCLUDE_DRAFTS) instead of secrets since they're boolean flags

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended ApprovalEmailData.periodType**
- **Found during:** Task 2 (handle-release.ts creation)
- **Issue:** ApprovalEmailData.periodType only supported 'daily' | 'weekly', not 'release'
- **Fix:** Added 'release' to the union type in src/email/templates.ts
- **Files modified:** src/email/templates.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** d109101 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential type extension for release feature to work. No scope creep.

## Issues Encountered

None - plan executed as specified after the type extension.

## User Setup Required

None - release workflow uses existing secrets (EMAIL_API_KEY, APPROVAL_SECRET, etc.) and optional repository variables (INCLUDE_PRERELEASES, INCLUDE_DRAFTS).

## Next Phase Readiness

- Release handling complete - releases now trigger immediate approval emails
- Platform posting reuses existing approval flow (handle-approval already handles postId lookup)
- Ready for Phase 6 (Smart Batching) or deployment verification

---
*Phase: 05-intelligence-releases*
*Completed: 2026-02-03*
