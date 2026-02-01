---
phase: 01-foundation-approval-loop
plan: 03
subsystem: infrastructure
status: complete
tags: [state-management, artifacts, persistence, file-storage]

dependency-graph:
  requires:
    - 01-01  # Uses DigestState and PostState types
  provides:
    - state-management
    - artifact-persistence
    - immutable-state-updates
  affects:
    - 01-04  # Email module will track sent emails in state
    - 01-05  # Digest generation will create posts in state
    - 01-06  # Approval endpoint will update state
    - 01-07  # Posting workflow will read/update state

tech-stack:
  added: []
  patterns:
    - atomic-write-pattern
    - immutable-updates
    - file-based-state
    - replay-prevention

key-files:
  created:
    - src/state/artifacts.ts
    - src/state/index.ts
    - tests/state.test.ts
  modified: []

decisions:
  - id: atomic-write-pattern
    what: Use temp file + rename for atomic writes
    why: Prevents corrupted state if process crashes during write
    impact: State writes are atomic and safe from partial writes
  - id: immutable-state-updates
    what: All update functions return new state objects
    why: Prevents accidental mutations and enables time-travel debugging
    impact: All state operations must use spread operators
  - id: conservative-token-cleanup
    what: Clean expired tokens based on lastRun timestamp
    why: jti values don't contain timestamps, need separate tracking
    impact: Tokens cleaned when lastRun older than maxAge

metrics:
  duration: 4 minutes
  completed: 2026-02-01
---

# Phase 1 Plan 03: State Management Summary

**One-liner:** File-based state management with atomic writes, immutable updates, and replay prevention for artifact persistence

## What Was Built

Implemented a complete state management module using file-based storage compatible with GitHub Actions artifacts. The module provides CRUD operations for digest state, used tokens tracking, and platform posting results, with all operations following immutable patterns.

### Task 1: Create State Management Module

Created state management functions in `src/state/`:

**artifacts.ts** - Core state operations:

- `DEFAULT_STATE_PATH` = '.state/digest.json'
- `EMPTY_STATE` = { posts: {}, usedTokens: [], lastRun: '' }

**loadState(path?: string): Promise<DigestState>**

- Reads JSON file from specified path
- Returns EMPTY_STATE if file doesn't exist (no error)
- Throws only on corrupted JSON (parse errors)
- Gracefully handles first-run scenario

**saveState(state: DigestState, path?: string): Promise<void>**

- Creates directory if needed (mkdir -p behavior)
- Atomic write pattern: writes to temp file, then renames
- Pretty-prints JSON for human readability
- Safe from partial writes if process crashes

**updatePostStatus(state, postId, status, platforms?): DigestState**

- Updates existing post status
- Sets approvedAt timestamp when status === 'approved'
- Optionally updates platform results
- Immutable: returns new state, doesn't mutate input
- Throws if post not found

**markTokenUsed(state, jti): DigestState**

- Adds jti to usedTokens array for replay prevention
- Allows duplicates (simpler implementation)
- Immutable: returns new state

**cleanExpiredTokens(state, maxAgeMs): DigestState**

- Removes old tokens based on lastRun timestamp
- Conservative approach: only cleans when lastRun < cutoff
- Prevents unbounded state growth
- Returns unchanged state if lastRun is empty or recent

**createPost(state, post): DigestState**

- Adds new post with automatic createdAt timestamp
- Preserves existing posts
- Immutable: returns new state

**index.ts** - Re-export module:

- Clean exports for all functions and constants
- Single import point for consumers

### Task 2: Create State Management Tests

Created comprehensive test suite in `tests/state.test.ts`:

**loadState tests:**

1. Returns EMPTY_STATE when file doesn't exist ✓
2. Throws on corrupted JSON ✓
3. Loads valid state from file ✓

**saveState tests:**

4. Creates directory if not exists ✓
5. Saves state as pretty-printed JSON ✓
6. Roundtrip save/load preserves data ✓

**updatePostStatus tests:**

7. Updates existing post status ✓
8. Sets approvedAt when status is 'approved' ✓
9. Updates platforms when provided ✓
10. Throws when post not found ✓
11. Is immutable (original unchanged) ✓

**markTokenUsed tests:**

12. Adds jti to usedTokens array ✓
13. Allows duplicate tokens ✓
14. Is immutable ✓

**cleanExpiredTokens tests:**

15. Removes all tokens when lastRun is older than maxAge ✓
16. Keeps all tokens when lastRun is within maxAge ✓
17. Keeps all tokens when lastRun is empty ✓
18. Is immutable ✓

**createPost tests:**

19. Adds new post with timestamp ✓
20. Preserves existing posts ✓
21. Is immutable ✓

**Immutability verification:**

22. All update functions return new state objects ✓

**Test coverage:** All happy paths and error cases covered

## Verification Results

All verification criteria passed:

- ✅ npm test passes all 22 state tests
- ✅ State persists correctly across save/load cycle
- ✅ Missing file returns empty state (no crash)
- ✅ All update functions are immutable
- ✅ Token cleanup prevents unbounded growth
- ✅ TypeScript compilation passes with no errors

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

### Atomic Write Pattern

**Implementation:**

```typescript
// Write to temp file in OS tmpdir
const tempPath = join(tmpdir(), `digest-state-${randomBytes(8).toString('hex')}.json`);
await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');

// Atomic rename (POSIX guarantee)
await fs.rename(tempPath, path);
```

**Why this matters:**

- Prevents corrupted state if process crashes during write
- OS-level atomic operation (POSIX rename guarantee)
- Temp file in tmpdir avoids cross-filesystem issues
- Random suffix prevents collision if multiple processes

### Immutable State Updates

**Pattern used throughout:**

```typescript
return {
  ...state,
  posts: {
    ...state.posts,
    [postId]: { ...existingPost, status }
  }
};
```

**Benefits:**

- No accidental mutations
- Easy to debug (old state still exists)
- Enables time-travel debugging if needed
- Functional programming best practice

**Trade-off:** Slight performance cost for large states (acceptable for this use case)

### Conservative Token Cleanup

**Decision:** Clean tokens based on lastRun timestamp, not individual token timestamps

**Reasoning:**

- jti values (UUIDs) don't contain timestamps
- Tracking individual token timestamps would complicate state schema
- Conservative cleanup: only remove tokens when lastRun is definitely older than maxAge
- This is safe because we only call cleanup when saving state

**Implementation:**

```typescript
if (lastRunTime < cutoffTime) {
  return { ...state, usedTokens: [] };
}
```

**Edge case:** If lastRun is recent, keep all tokens even if some might be expired. This is safe because token verification also checks expiration timestamp.

### Pretty-Printed JSON

**Decision:** Save state with `JSON.stringify(state, null, 2)`

**Why:**

- Human-readable for debugging
- Git-friendly diffs (line-by-line changes)
- Negligible size difference (state file is small)
- Makes artifact inspection easier

## Known Issues

None identified. All tests pass and all operations work correctly.

## Next Phase Readiness

**State management complete** - Ready for use by other modules:

- ✅ loadState/saveState for artifact persistence
- ✅ createPost for digest generation
- ✅ updatePostStatus for approval workflow
- ✅ markTokenUsed for replay prevention
- ✅ cleanExpiredTokens to prevent unbounded growth
- ✅ All operations are immutable and type-safe

**Blockers:** None

**Concerns:** None

**Recommendations for next plans:**

1. Plan 01-04 (Email): Use state to track sent emails
2. Plan 01-05 (Digest): Use createPost to add new digests to state
3. Plan 01-06 (Approval): Use updatePostStatus and markTokenUsed on approval
4. Plan 01-07 (Posting): Use state to track platform posting results

## Commits

| Hash    | Message                                                | Files                                         |
| ------- | ------------------------------------------------------ | --------------------------------------------- |
| 771894b | feat(01-03): implement state management module         | src/state/artifacts.ts, src/state/index.ts    |
| a00a0ca | test(01-03): add comprehensive state management tests  | tests/state.test.ts                           |

## Artifacts

**State management module:**

- `src/state/artifacts.ts` - Core state operations (loadState, saveState, etc.)
- `src/state/index.ts` - Re-export module

**Tests:**

- `tests/state.test.ts` - 22 comprehensive tests covering all operations

**State structure:**

```typescript
interface DigestState {
  posts: Record<string, PostState>;
  usedTokens: string[];  // jti values for replay prevention
  lastRun: string;       // ISO timestamp
}

interface PostState {
  id: string;
  contentHash: string;
  status: 'pending' | 'approved' | 'skipped' | 'posted';
  platforms: Record<string, 'success' | 'failed'>;
  createdAt: string;
  approvedAt?: string;  // Set when status becomes 'approved'
}
```

## Dependencies

**Production:**

- None (uses Node.js built-ins only)
  - fs/promises for file I/O
  - path for path operations
  - os for tmpdir
  - crypto for random bytes

**Development:**

- vitest (already installed) - Testing framework

**Why no dependencies:**

- State management is simple file I/O
- Node.js built-ins are sufficient and reliable
- Fewer dependencies = fewer security/maintenance concerns
- Faster installs and smaller bundle

## Success Metrics

**Code quality:**

- 0 TypeScript errors
- 22 tests passing
- 100% immutable operations verified

**Test coverage:**

- All happy paths tested
- All error cases tested (missing file, corrupted JSON, post not found)
- Immutability verified for all update functions
- Roundtrip persistence verified

**API completeness:**

- loadState ✓
- saveState ✓
- updatePostStatus ✓
- markTokenUsed ✓
- cleanExpiredTokens ✓
- createPost ✓
- EMPTY_STATE constant ✓
- DEFAULT_STATE_PATH constant ✓

**Ready for integration:**

- Module exports clean API via index.ts
- All functions properly typed
- Documentation in code comments
- Test suite demonstrates usage patterns
