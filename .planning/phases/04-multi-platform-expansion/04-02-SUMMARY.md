---
phase: 04-multi-platform-expansion
plan: 02
subsystem: platforms
status: complete
completed: 2026-02-02
duration: 7 minutes

requires:
  - 04-01 # Platform configuration types

provides:
  - BlueskyPlugin implementing PlatformPlugin
  - App password authentication with lazy login
  - RichText facet detection for links/hashtags/mentions
  - Grapheme length validation (300 limit)

affects:
  - 04-04 # Platform registration will register Bluesky

tech-stack:
  added:
    - "@atproto/api RichText class for facet detection"
  patterns:
    - "Lazy authentication pattern (login on first post)"
    - "Exponential backoff retry for 429 rate limits"
    - "Never-throw pattern (returns PostResult)"

decisions:
  - decision: "Use app password auth over OAuth"
    rationale: "Official Bluesky guidance recommends app passwords for headless clients/bots; OAuth adds significant complexity (DPoP, PAR, client metadata hosting)"
    alternatives: ["OAuth with @atproto/oauth-client-node"]
    source: "04-RESEARCH.md"

  - decision: "Validate grapheme length not string length"
    rationale: "Bluesky enforces 300 grapheme limit; JavaScript string.length counts UTF-16 code units not visual characters"
    pattern: "rt.graphemeLength > MAX_GRAPHEMES"
    source: "04-RESEARCH.md Pitfall 1"

  - decision: "Use RichText class for facet detection"
    rationale: "Facets require UTF-8 byte offsets; hand-rolling this is error-prone due to UTF-16/UTF-8 differences"
    pattern: "await rt.detectFacets(agent)"
    source: "04-RESEARCH.md Don't Hand-Roll"

key-files:
  created:
    - path: "src/platforms/bluesky/client.ts"
      purpose: "BlueskyPlugin implementation"
      exports: ["BlueskyPlugin"]
      lines: 147
    - path: "src/platforms/bluesky/client.test.ts"
      purpose: "TDD tests for BlueskyPlugin"
      coverage: "isConfigured, successful post, error handling, rate limits, grapheme validation"
      lines: 458
    - path: "src/platforms/bluesky/index.ts"
      purpose: "Barrel export"
      lines: 5

  modified: []

tags: [bluesky, atproto, tdd, platform-plugin, rich-text, facets, grapheme-validation]
---

# Phase 4 Plan 2: Bluesky Plugin Summary

**One-liner:** Bluesky posting with app password auth, RichText facet detection, and grapheme validation

## What Was Built

Implemented BlueskyPlugin following the TDD cycle and GhostPlugin pattern:

**TDD Cycle:**
1. **RED:** Created failing tests covering all behavior (19 test cases)
2. **GREEN:** Implemented BlueskyPlugin to pass all tests
3. **REFACTOR:** No refactoring needed (clean implementation)

**Core features:**
- Implements PlatformPlugin interface (name, isConfigured, post)
- Lazy authentication (login on first getAgent() call)
- RichText class for automatic facet detection (links, hashtags, mentions)
- Grapheme length validation (300 limit per Bluesky requirements)
- Exponential backoff with jitter for 429 rate limits
- Never-throw pattern (returns PostResult with success/error)

**Test coverage (19 tests):**
- isConfigured: 6 tests (various credential combinations)
- Validation: 3 tests (no teaser, not configured, grapheme limit)
- Successful post: 4 tests (basic success, lazy login, RichText facets, language tag)
- Error handling: 2 tests (API failure, no-throw guarantee)
- Retry logic: 3 tests (429 retry, max retries, non-429 no-retry)
- Name property: 1 test

## Decisions Made

### 1. App Password Authentication (Not OAuth)

**Decision:** Use app password authentication via identifier + password
**Rationale:**
- Official Bluesky guidance: OAuth "not currently recommended for headless clients like bots"
- App passwords work immediately without infrastructure setup
- OAuth requires: DPoP keypairs, PAR, client metadata hosting, state stores
- Simplicity aligns with v1 goals

**Alternatives considered:**
- OAuth via @atproto/oauth-client-node (rejected: significant complexity for bot use case)

**Source:** 04-RESEARCH.md "Critical Decision Point: Bluesky Authentication"

### 2. RichText for Facet Detection

**Decision:** Use @atproto/api RichText class for all facet operations
**Rationale:**
- Facets require UTF-8 byte offsets but JavaScript uses UTF-16
- Hand-rolling byte index calculations is error-prone
- RichText.detectFacets() handles links, hashtags, mentions automatically
- One-line API: `await rt.detectFacets(agent)`

**Pattern:**
```typescript
const rt = new RichText({ text: state.teaser.text });
await rt.detectFacets(agent);
// rt.facets now populated with proper byte offsets
```

**Source:** 04-RESEARCH.md "Don't Hand-Roll" section

### 3. Grapheme Length Validation

**Decision:** Validate `rt.graphemeLength` not `string.length`
**Rationale:**
- Bluesky enforces 300 grapheme limit (visual characters)
- JavaScript string.length counts UTF-16 code units (not graphemes)
- Emoji-heavy posts would fail with string.length check
- RichText class provides correct graphemeLength property

**Example pitfall avoided:**
- "Hello 👋🏽" has string.length=8 but graphemeLength=7
- Manual counting would incorrectly reject valid posts

**Source:** 04-RESEARCH.md "Pitfall 1: Bluesky Character Limit is Graphemes"

### 4. Lazy Authentication Pattern

**Decision:** Authenticate on first getAgent() call, not in constructor
**Rationale:**
- Matches GhostPlugin pattern (consistency)
- Avoids errors when credentials not configured
- Defers network calls until actually needed
- Supports isConfigured() without side effects

**Pattern:**
```typescript
private authenticated = false;

private async getAgent(): Promise<AtpAgent> {
  if (!this.agent) {
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
  }
  if (!this.authenticated) {
    await this.agent.login({ identifier, password });
    this.authenticated = true;
  }
  return this.agent;
}
```

## Implementation Notes

### Following GhostPlugin Pattern

BlueskyPlugin mirrors GhostPlugin structure exactly:
- Lazy client initialization (getAgent vs getClient)
- Same retry logic (MAX_RETRIES=3, exponential backoff with jitter)
- Same error handling (never throw from post())
- Same PostResult structure

**Differences from Ghost:**
- Uses teaser not digest (Bluesky 300 graphemes vs Ghost unlimited)
- RichText facets (Bluesky-specific feature)
- Grapheme validation (Ghost has no character limit)

### Retry Logic

Reuses proven exponential backoff pattern from GhostPlugin:
```typescript
const baseDelay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s
const jitter = Math.random() * 1000;
await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
```

Retries only on 429 status, fails immediately on other errors (401, 403, etc.)

### Post URL Construction

Bluesky post URIs: `at://did:plc:abc123/app.bsky.feed.post/xyz789`
Web URLs: `https://bsky.app/profile/{identifier}/post/{rkey}`

Extract rkey from response.uri and build URL:
```typescript
const rkey = response.uri.split('/').pop();
const platformUrl = `https://bsky.app/profile/${this.identifier}/post/${rkey}`;
```

### Language Tag

Included `langs: ['en']` in all posts per RESEARCH.md Pitfall 6:
- Improves discoverability in language-filtered feeds
- Default to 'en' (could be made configurable later)

## Testing Strategy

### TDD Benefits Observed

1. **Tests caught implementation issues early:**
   - Mock state bleeding between tests (RichText graphemeLength)
   - TypeScript type mismatches in mocks

2. **Tests document behavior:**
   - Clear examples of all success/failure cases
   - Grapheme validation edge case explicit

3. **Tests enable confident refactoring:**
   - Can modify implementation knowing tests verify correctness

### Mock Strategy

Mocked @atproto/api module with minimal implementation:
- AtpAgent: login(), post()
- RichText: text, graphemeLength, facets, detectFacets()

Used `as any` type assertions to avoid complex type matching while maintaining test clarity.

**Mock reset pattern:**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(RichText).mockImplementation(/* default behavior */);
});
```

Prevents mock state bleeding between tests.

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Environment setup needed for 04-04 (platform registration):**
- Set `BLUESKY_IDENTIFIER` environment variable (e.g., "user.bsky.social")
- Set `BLUESKY_APP_PASSWORD` environment variable (from Bluesky Settings -> App Passwords)

**Ready for:**
- 04-03 (Mastodon plugin) - parallel implementation, same pattern
- 04-04 (Platform registration) - register Bluesky with factory function

## Performance Notes

**Duration:** 7 minutes
- TDD RED: ~2 minutes (write failing tests)
- TDD GREEN: ~3 minutes (implement to pass tests)
- TypeScript fixes: ~1 minute (type assertions in mocks)
- Documentation: ~1 minute (this summary)

**Velocity:** Fast execution, TDD cycle efficient when following existing pattern.

## Lessons Learned

1. **Mock reset is critical:** vi.clearAllMocks() alone doesn't reset implementation mocks - must explicitly reset mockImplementation in beforeEach

2. **Type assertions in tests are OK:** Using `as any` for complex SDK types (RichText) keeps tests readable without requiring full type matching

3. **RESEARCH.md pitfalls were accurate:** Grapheme vs string length, facet byte offsets, language tags all materialized as documented

4. **Following existing patterns accelerates development:** GhostPlugin provided complete blueprint, reducing decision-making overhead

## Files Changed

**Created:**
- src/platforms/bluesky/client.ts (147 lines)
- src/platforms/bluesky/client.test.ts (458 lines)
- src/platforms/bluesky/index.ts (5 lines)

**Modified:** None

**Total:** 610 lines added

## Verification

✅ All 19 tests pass
✅ TypeScript compiles without errors
✅ isConfigured() returns true when credentials provided
✅ post() returns success with platformPostId and platformUrl
✅ post() validates grapheme length under 300
✅ post() uses RichText for facet detection
✅ post() retries on 429 with exponential backoff
✅ post() never throws (returns PostResult)

**Commits:**
- 7f280d0: test(04-02): add failing test for BlueskyPlugin (RED)
- 30d1e91: feat(04-02): implement BlueskyPlugin (GREEN)

## Dependencies on This Work

**04-03 (Mastodon plugin):**
- Can reference BlueskyPlugin tests for similar structure
- Similar PlatformPlugin implementation pattern

**04-04 (Platform registration):**
- Will register BlueskyPlugin in setup.ts
- Environment variables: BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD

## Known Limitations

1. **Hardcoded language:** Currently defaults to 'en' - could make configurable via PlatformsConfig.bluesky.defaultLang

2. **No link embeds:** Posts include text links but not rich embeds (Open Graph cards) - requires fetching metadata and uploading thumbnail

3. **Single service endpoint:** Hardcoded to 'https://bsky.social' - AT Protocol supports other PDS instances but unlikely to be needed

4. **No retry-after header support:** Exponential backoff is fixed; could inspect Retry-After header from 429 responses

These are acceptable for v1 - can enhance in future phases if needed.
