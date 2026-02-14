---
phase: 06-extensibility
plan: 01
type: execution
completed: 2026-02-14T16:16:12Z
duration: 1m 40s
subsystem: test-utils
tags: [testing, plugin-harness, developer-experience, extensibility]

dependency_graph:
  requires: [platforms/types, types/state]
  provides: [test-utils/plugin-harness, test-utils/makePostState, test-utils/testPlatformPluginCompliance]
  affects: [plugin-development, third-party-plugins]

tech_stack:
  added: []
  patterns: [test-factory-pattern, compliance-testing, barrel-exports]

key_files:
  created:
    - src/test-utils/plugin-harness.ts
    - src/test-utils/plugin-harness.test.ts
    - src/test-utils/index.ts
  modified: []

decisions:
  - summary: "Factory pattern for test PostState objects (same as existing ghost/client.test.ts)"
    rationale: "Consistency with existing test patterns, proven approach"
    alternatives: ["Builder pattern", "Hardcoded fixtures"]
  - summary: "Compliance suite returns void and uses Vitest describe blocks"
    rationale: "Integrates naturally into existing test suites, familiar pattern"
    alternatives: ["Return test results array", "Custom assertion framework"]
  - summary: "Plugin factory function parameter instead of plugin instance"
    rationale: "Ensures fresh plugin instance for each test, avoids shared state"
    alternatives: ["Pass plugin instance directly"]

metrics:
  tasks_completed: 2
  tests_added: 5
  tests_total: 200
  files_created: 3
  lines_added: 222
---

# Phase 06 Plan 01: Plugin Testing Harness Summary

**One-liner:** Created shared plugin testing harness with makePostState factory and testPlatformPluginCompliance suite for validating PlatformPlugin implementations.

## What Was Built

Created `src/test-utils/` directory with reusable testing utilities for plugin authors:

1. **makePostState factory** - Creates valid PostState objects with sensible defaults and supports partial overrides (same pattern as ghost/client.test.ts)
2. **testPlatformPluginCompliance suite** - Validates the 4 critical PlatformPlugin behaviors:
   - name property matches expected value
   - isConfigured() returns boolean
   - post() returns Promise<PostResult> with correct shape
   - post() never throws (always resolves)
3. **Barrel export** - `src/test-utils/index.ts` exports both utilities for easy importing

## Verification Results

- TypeScript compilation: PASSED (npx tsc --noEmit)
- Plugin harness tests: PASSED (5 new tests)
- Full test suite: PASSED (200 total tests, no regressions)
- GhostPlugin compliance validation: PASSED

## Deviations from Plan

None - plan executed exactly as written.

## Key Implementation Details

**makePostState defaults:**
- id: 'post-123'
- status: 'approved'
- digest with title, content, repos, commitCount, periodType, generatedAt
- teaser with text, hashtags, characterCount
- Empty platforms object
- Supports deep partial overrides for flexible testing

**testPlatformPluginCompliance checks:**
1. Name property verification
2. isConfigured() type checking (must return boolean)
3. PostResult shape validation (success + platformPostId/platformUrl OR error)
4. Never-throw guarantee (post() must resolve, not reject)

**Testing pattern:**
- Compliance suite uses Vitest describe blocks
- Plugin factory function ensures fresh instances per test
- Validated against GhostPlugin to prove harness works

## Files Created

1. **src/test-utils/plugin-harness.ts** (108 lines)
   - makePostState factory with partial override support
   - testPlatformPluginCompliance suite with 4 compliance tests
   - JSDoc documentation for both exports

2. **src/test-utils/plugin-harness.test.ts** (114 lines)
   - Tests for makePostState (defaults, overrides, deep partials)
   - Tests for testPlatformPluginCompliance (validates against GhostPlugin)
   - Mock setup for @tryghost/admin-api

3. **src/test-utils/index.ts** (6 lines)
   - Barrel export re-exporting plugin-harness utilities

## Test Coverage

**New tests added: 5**

1. makePostState returns valid PostState with defaults
2. makePostState accepts overrides
3. makePostState accepts digest override
4. makePostState accepts deep partial overrides
5. testPlatformPluginCompliance validates GhostPlugin

**Total test count: 200** (195 existing + 5 new, no regressions)

## Integration Points

**Imports from:**
- `src/platforms/types.ts` - PlatformPlugin interface
- `src/types/state.ts` - PostState type
- `vitest` - Testing framework (describe, expect, it)

**Used by (future):**
- Third-party plugin authors validating their implementations
- BlueskyPlugin tests (already use makePostState pattern, can now import)
- MastodonPlugin tests (already use makePostState pattern, can now import)
- Future platform plugin tests

## Developer Experience Impact

**Before:** Each plugin author must independently figure out what to test and create their own PostState factories.

**After:** Plugin authors can:
1. Import makePostState to create valid test PostState objects
2. Call testPlatformPluginCompliance to validate their plugin meets the interface contract
3. Focus on plugin-specific behavior testing instead of interface compliance

**Example usage:**
```typescript
import { makePostState, testPlatformPluginCompliance } from '@/test-utils';
import { MyPlugin } from './my-plugin';

describe('MyPlugin', () => {
  // Validate compliance (4 tests)
  testPlatformPluginCompliance(
    () => new MyPlugin('config'),
    'my-platform'
  );

  // Add plugin-specific tests
  it('transforms content correctly', async () => {
    const plugin = new MyPlugin('config');
    const state = makePostState({
      digest: { title: 'Custom' }
    });
    const result = await plugin.post(state);
    // ... assertions
  });
});
```

## Self-Check: PASSED

**Files created:**
- FOUND: src/test-utils/plugin-harness.ts
- FOUND: src/test-utils/plugin-harness.test.ts
- FOUND: src/test-utils/index.ts

**Commits created:**
- FOUND: 9b7c011 (feat(06-01): create plugin testing harness)
- FOUND: 2ab2e3b (test(06-01): add plugin harness tests)

**Test results:**
- 200 tests passing (195 existing + 5 new)
- No TypeScript errors
- No regressions

All success criteria met.
