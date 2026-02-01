---
phase: 01-foundation-approval-loop
plan: 02
subsystem: security
status: complete
tags: [token, hmac, security, tdd, cryptography]

dependency-graph:
  requires:
    - 01-01  # TokenPayload and VerificationResult types
  provides:
    - token-signing
    - token-verification
    - replay-prevention
  affects:
    - 01-03  # Will use tokens in state management
    - 01-04  # Will generate approval tokens for email links

tech-stack:
  added: []  # Uses built-in node:crypto only
  patterns:
    - hmac-sha256-signing
    - constant-time-comparison
    - replay-prevention-via-jti
    - base64url-encoding
    - tdd-red-green-refactor

key-files:
  created:
    - src/tokens/sign.ts
    - src/tokens/verify.ts
    - src/tokens/index.ts
    - tests/tokens.test.ts
  modified: []

decisions:
  - id: hmac-sha256
    what: Use HMAC-SHA256 for token signing
    why: Industry standard, built into Node.js crypto, no external dependencies
    impact: Tokens are URL-safe and cryptographically secure
  - id: timing-safe-equal
    what: Use timingSafeEqual for signature verification
    why: Prevents timing attacks that could reveal signature bytes
    impact: Security-critical constant-time comparison required
  - id: jti-replay-prevention
    what: Include jti (JWT ID) in token payload for replay prevention
    why: Without jti tracking, tokens can be reused before expiration
    impact: State must track used jti values
  - id: base64url-encoding
    what: Use base64url encoding for URL-safe tokens
    why: Tokens appear in email links, must be URL-safe (no +/= characters)
    impact: Compatible with standard base64 but safe for query parameters
  - id: synchronous-verification
    what: Make verifyToken synchronous (not async)
    why: No async operations needed, better performance, simpler API
    impact: Callers don't need to await verification

metrics:
  duration: 3 minutes
  completed: 2026-02-01
---

# Phase 1 Plan 02: Token Signing and Verification Summary

**One-liner:** HMAC-SHA256 token signing with constant-time verification using timingSafeEqual, supporting replay prevention via jti tracking

## What Was Built

Implemented secure token generation and verification for approval links using TDD (RED-GREEN-REFACTOR cycle). This is security-critical code that creates cryptographically signed tokens with expiration and replay prevention.

### TDD Cycle

**RED Phase:** Created failing tests with 9 test cases covering all verification modes

**GREEN Phase:** Implemented minimal code to pass all tests

**REFACTOR Phase:** Made verifyToken synchronous (removed unnecessary async)

### Task 1: Write Failing Tests (RED)

Created comprehensive test suite in `tests/tokens.test.ts`:

**Token Generation Tests:**
- generateApprovalToken creates token with all required fields (postId, action, exp, jti)
- signToken + verifyToken roundtrip succeeds

**Token Verification Tests:**
- Expired token returns `{ valid: false, reason: 'expired' }`
- Token with wrong secret returns `{ valid: false, reason: 'invalid-signature' }`
- Token with modified payload returns `{ valid: false, reason: 'invalid-signature' }`
- Token with jti in usedTokens returns `{ valid: false, reason: 'already-used' }`
- Garbage input returns `{ valid: false, reason: 'malformed' }`
- Empty string returns `{ valid: false, reason: 'malformed' }`
- Token without signature returns `{ valid: false, reason: 'malformed' }`

All tests initially failed (implementation files didn't exist).

**Commit:** 2b9f73d

### Task 2: Implement Token Signing (GREEN)

Created `src/tokens/sign.ts` with:

**signToken(payload, secret)**
- Serializes payload to JSON
- Encodes as base64url for URL safety
- Creates HMAC-SHA256 signature using `createHmac`
- Returns format: `base64url(payload).base64url(signature)`

**generateApprovalToken(postId, action, ttlHours, secret)**
- Creates TokenPayload with:
  - `postId`: Post identifier
  - `action`: 'approve' or 'skip'
  - `exp`: Expiration timestamp (now + ttlHours)
  - `jti`: Unique ID from `randomUUID()` for replay prevention
- Signs payload using signToken

**Commit:** e223750

### Task 3: Implement Token Verification (GREEN)

Created `src/tokens/verify.ts` with:

**verifyToken(token, secret, usedTokens?)**
- Parses token format: `encoded.signature`
- Computes expected signature using HMAC-SHA256
- **CRITICAL:** Uses `timingSafeEqual()` for constant-time comparison
  - Prevents timing attacks that could reveal signature bytes
  - Catches buffer length mismatches (tampered signatures)
- Decodes and validates payload
- Checks expiration (Date.now() > payload.exp)
- Checks jti against usedTokens array (replay prevention)
- Returns discriminated union:
  - `{ valid: true, postId, action, jti }` for valid tokens
  - `{ valid: false, reason }` for invalid tokens

**Error handling:**
- Malformed tokens (missing parts, invalid base64, invalid JSON)
- Invalid signatures (wrong secret, tampered payload, length mismatch)
- Expired tokens (exp < now)
- Already-used tokens (jti in usedTokens)

**Commit:** e223750

### Task 4: Refactor (REFACTOR)

Made verifyToken synchronous:
- Removed `async` keyword (no async operations)
- Changed return type from `Promise<VerificationResult>` to `VerificationResult`
- Updated tests to remove `await` and `async` keywords
- Better performance (no Promise overhead)
- Simpler API (callers don't need await)

All tests still pass after refactoring.

**Commit:** d8af3f0

## Verification Results

All verification criteria passed:

- ✅ npm test passes all token tests (9/9 tests)
- ✅ Tests cover all verification failure modes
- ✅ timingSafeEqual is used (line 49 in verify.ts)
- ✅ No external crypto dependencies (uses node:crypto only)
- ✅ TypeScript compiles without errors
- ✅ Token format: base64url(payload).base64url(signature)
- ✅ Payload contains: postId, action, exp, jti

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made verifyToken synchronous**
- **Found during:** GREEN phase refactor
- **Issue:** Function declared as async but had no async operations
- **Fix:** Removed async/await for better performance and simpler API
- **Files modified:** src/tokens/verify.ts, tests/tokens.test.ts
- **Commit:** d8af3f0

No other deviations - plan executed as written.

## Technical Decisions

### HMAC-SHA256 for Signing

**Why this algorithm:**
- Industry standard for message authentication
- Built into Node.js crypto (no dependencies)
- Fast and secure (256-bit output)
- URL-safe with base64url encoding

**Token format:** `base64url(JSON.stringify(payload)).base64url(hmac_signature)`

**Alternatives considered:**
- JWT libraries (overkill, adds dependencies, more features than needed)
- RSA signatures (slower, requires key management, unnecessary for symmetric secret)

### Constant-Time Comparison (timingSafeEqual)

**CRITICAL security requirement:**
- String comparison (`===`) returns immediately on first mismatch
- Timing differences reveal signature bytes (timing attack)
- Attacker can guess valid signature byte-by-byte

**timingSafeEqual guarantees:**
- Compares every byte regardless of matches
- Same execution time for any input (constant time)
- Throws if buffer lengths differ (catches tampering)

**Implementation notes:**
- Convert base64url strings to Buffers for comparison
- Wrap in try/catch (length mismatch throws, which is correct behavior)
- Always check signature BEFORE other validations (prevent timing leaks)

### Replay Prevention via jti

**Without jti tracking:**
- Token can be used multiple times before expiration
- Attacker intercepts approval link and reuses it
- Same post could be approved/skipped multiple times

**With jti (JWT ID):**
- Each token has unique ID from `randomUUID()`
- State tracks used jti values
- Verification checks if jti already used
- Once used, token becomes invalid even if not expired

**Storage considerations:**
- State must persist used jti values
- Can clean up expired jti values (older than max TTL)
- Prevents state growth over time

### Base64url Encoding

**Why base64url instead of base64:**
- Tokens appear in email links as query parameters
- Standard base64 uses `+`, `/`, and `=` characters
- These require URL encoding in query strings
- base64url uses `-`, `_`, and omits padding `=`
- Direct compatibility with URLs

**Example:**
- Standard: `eyJmb28iOiJiYXIifQ==`
- base64url: `eyJmb28iOiJiYXIifQ`

### Synchronous Verification

**Initial implementation:** Async function (Promise-based)

**Refactored to sync because:**
- No async operations (all crypto is synchronous)
- Promise overhead adds latency
- Simpler API (no await needed)
- Better stack traces (no async boundary)

**Performance impact:**
- Eliminates microtask queue overhead
- Faster verification (no Promise allocation)
- Synchronous crypto operations are fast (<1ms)

## Known Issues

None identified. All tests pass, TypeScript compiles cleanly.

## Next Phase Readiness

**Foundation complete** - Ready for Wave 3 plans:

- ✅ Token signing creates URL-safe HMAC-SHA256 tokens
- ✅ Token verification uses constant-time comparison
- ✅ Replay prevention via jti tracking
- ✅ Expiration enforcement
- ✅ Comprehensive test coverage (9 test cases)

**Blockers:** None

**Concerns:** None

**Recommendations for next plans:**

1. Plan 01-03 (State): Use `usedTokens: string[]` to track jti values
2. Plan 01-04 (Email): Use `generateApprovalToken()` to create approval links
3. Plan 01-05 (Vercel): Use `verifyToken()` in approval endpoint

## Commits

| Hash    | Message                                          | Files                             |
| ------- | ------------------------------------------------ | --------------------------------- |
| 2b9f73d | test(01-02): add failing tests for token signing and verification | tests/tokens.test.ts |
| e223750 | feat(01-02): implement HMAC-SHA256 token signing and verification | src/tokens/*.ts |
| d8af3f0 | refactor(01-02): make verifyToken synchronous   | src/tokens/verify.ts, tests/tokens.test.ts |

## Artifacts

**Token signing:**
- `src/tokens/sign.ts` - signToken() and generateApprovalToken()
- Uses `createHmac('sha256')` for signing
- Uses `randomUUID()` for jti generation
- Returns base64url-encoded tokens

**Token verification:**
- `src/tokens/verify.ts` - verifyToken() with timingSafeEqual
- Validates signature (constant-time comparison)
- Checks expiration (Date.now() > exp)
- Checks replay (jti in usedTokens)
- Returns discriminated union result

**Testing:**
- `tests/tokens.test.ts` - 9 comprehensive test cases
- Covers all success and failure modes
- Verifies token structure and security properties

**Exports:**
- `src/tokens/index.ts` - Clean public API

## Security Properties

**Cryptographic guarantees:**
- HMAC-SHA256 provides message authentication
- 256-bit signature prevents brute force attacks
- Constant-time comparison prevents timing attacks
- UUID v4 jti provides collision-resistant replay prevention

**Attack resistance:**
- ✅ Timing attacks: Prevented by timingSafeEqual
- ✅ Replay attacks: Prevented by jti tracking
- ✅ Tampering: Detected by HMAC signature
- ✅ Forgery: Prevented by secret key requirement
- ✅ Expiration bypass: Enforced by timestamp check

**Threat model:**
- Attacker cannot generate valid tokens without secret
- Attacker cannot modify tokens without detection
- Attacker cannot reuse tokens after first use
- Attacker cannot extend token expiration
- Attacker cannot determine signature via timing

## Dependencies

**Production:** None (uses built-in node:crypto only)

**Why no dependencies:**
- HMAC-SHA256 is built into Node.js
- randomUUID is built into Node.js
- timingSafeEqual is built into Node.js
- base64url encoding is built into Buffer class
- Zero supply chain risk for security-critical code

## Success Metrics

**Code quality:**
- 0 TypeScript errors
- 100% type coverage
- All tests pass (9/9)

**Security:**
- timingSafeEqual used for signature verification
- jti replay prevention implemented
- All failure modes tested

**TDD discipline:**
- RED: Tests written first (all failed)
- GREEN: Implementation makes tests pass
- REFACTOR: Code improved while maintaining tests
