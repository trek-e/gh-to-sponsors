---
phase: 03-first-platform-integration
plan: 05
subsystem: email
tags: [retry-tokens, failure-notification, hmac, email-templates]

# Dependency graph
requires:
  - phase: 01-foundation-approval-loop
    provides: HMAC token signing, email provider abstraction
  - phase: 03-first-platform-integration (03-04)
    provides: Platform executor with success/failure tracking
provides:
  - Failure notification email with retry links
  - Retry token type and generation
  - Per-platform retry functionality
affects: [04-multi-platform, future-retry-handling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RetryTokenPayload extends existing token infrastructure
    - Per-platform retry tokens for granular control
    - Email template pattern extended for failure notifications

key-files:
  created: []
  modified:
    - src/types/token.ts
    - src/tokens/sign.ts
    - src/tokens/index.ts
    - src/email/templates.ts
    - src/email/index.ts
    - src/actions/process-approval.ts
    - src/server/index.ts
    - src/vercel/github.ts
    - src/vercel/pages.ts

key-decisions:
  - "Retry tokens use same HMAC signing as approval tokens"
  - "Per-platform retry links (not all-or-nothing)"
  - "Failure notification sent automatically when any platform fails"

patterns-established:
  - "RetryTokenPayload with platforms array for selective retry"
  - "Failure email shows success/failure breakdown with actionable retry buttons"

# Metrics
duration: 4min
completed: 2026-02-02
---

# Phase 3 Plan 05: Failure Notification Emails Summary

**Failure notification emails with per-platform retry links using HMAC-signed tokens**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-02T14:30:00Z
- **Completed:** 2026-02-02T14:34:00Z
- **Tasks:** 4
- **Files modified:** 9

## Accomplishments
- Extended token types to support retry action with platforms array
- Added generateRetryToken function using same HMAC infrastructure
- Created failure notification email template with success/failure breakdown
- Wired failure notifications into approval flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend token types for retry action** - `b0055cc` (feat)
2. **Task 2: Add retry token generation** - `ba74544` (feat)
3. **Task 3: Create failure notification email template** - `8a279dd` (feat)
4. **Task 4: Wire failure notifications into approval flow** - `21b4bcf` (feat)

## Files Created/Modified

- `src/types/token.ts` - Added RetryTokenPayload, updated TokenPayload union, updated VerificationResult
- `src/tokens/sign.ts` - Added generateRetryToken function
- `src/tokens/index.ts` - Export generateRetryToken
- `src/tokens/verify.ts` - Handle retry token verification with platforms field
- `src/email/templates.ts` - Added FailureNotificationData, renderFailureNotificationEmail
- `src/email/index.ts` - Export failure notification types and function
- `src/actions/process-approval.ts` - Added sendFailureNotification, integrated into approval flow
- `src/server/index.ts` - Handle retry tokens in approval endpoint
- `src/vercel/github.ts` - Added triggerRetry function for repository_dispatch
- `src/vercel/pages.ts` - Added renderRetryPage for retry confirmation

## Decisions Made

- **Per-platform retry tokens:** Each failed platform gets its own retry link, allowing granular control over which platforms to retry
- **Same HMAC infrastructure:** Retry tokens use identical signing mechanism as approval tokens for consistency and security
- **Automatic notification:** Failure notification sent automatically when any platform fails, keeping status as 'approved' for retry capability
- **Environment variables:** HMAC_SECRET, APPROVAL_URL, NOTIFICATION_EMAIL used for token generation and email routing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated verify.ts to handle retry tokens**
- **Found during:** Task 1 (token type extension)
- **Issue:** verify.ts returned incorrect type for retry tokens (missing platforms field)
- **Fix:** Added conditional return to include platforms array for retry action
- **Files modified:** src/tokens/verify.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** b0055cc (Task 1 commit)

**2. [Rule 3 - Blocking] Updated server/index.ts, github.ts, pages.ts for retry handling**
- **Found during:** Task 1 (token type extension)
- **Issue:** Server couldn't handle retry tokens, no triggerRetry function, no retry success page
- **Fix:** Added retry token handling in server, triggerRetry in github.ts, renderRetryPage in pages.ts
- **Files modified:** src/server/index.ts, src/vercel/github.ts, src/vercel/pages.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** b0055cc (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for complete retry flow. Server must handle retry tokens end-to-end.

## Issues Encountered

None - all supporting infrastructure was in place from previous phases.

## User Setup Required

**Environment variables needed for failure notifications:**
- `HMAC_SECRET` - Required for signing retry tokens (same as approval tokens)
- `APPROVAL_URL` - Base URL for retry links (same as approval links)
- `NOTIFICATION_EMAIL` - Optional, falls back to config.email.fromEmail

These should already be set from Phase 1 deployment.

## Next Phase Readiness

**Phase 3 Complete:**
- Ghost platform plugin fully integrated
- Platform executor handles multi-platform posting with error isolation
- Approval flow posts to all platforms and sends failure notifications
- Retry functionality allows per-platform retry without re-approval

**Ready for Phase 4:**
- Additional platform plugins can follow same pattern as Ghost
- Platform registry pattern supports any number of platforms
- Failure notification template works with any platform names

---
*Phase: 03-first-platform-integration*
*Completed: 2026-02-02*
