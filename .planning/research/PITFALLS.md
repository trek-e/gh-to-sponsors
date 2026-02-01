# Domain Pitfalls: GitHub-to-Supporter Syndication

**Domain:** Content syndication for open source creators
**Researched:** 2026-02-01
**Confidence:** MEDIUM to HIGH (verified with official docs and recent 2026 sources)

## Critical Pitfalls

Mistakes that cause rewrites, security breaches, or major reliability issues.

### Pitfall 1: GitHub Actions Scheduled Workflows are Unreliable

**What goes wrong:** Cron-triggered workflows miss executions, get delayed by 30+ minutes, or stop running entirely after 60 days of repo inactivity.

**Why it happens:** GitHub Actions scheduled workflows run asynchronously and are not guaranteed to execute at the scheduled time. During high-load periods (especially midnight UTC), workflows can be delayed or dropped entirely. Additionally, GitHub automatically disables scheduled workflows in public repositories after 60 days of no activity.

**Consequences:**
- Daily digests get skipped without warning
- Users lose trust when updates are inconsistent
- No notification when workflows are auto-disabled
- Cannot rely on precise timing for time-sensitive updates

**Prevention:**
- Build idempotency into all workflows (track last successful run timestamp)
- Implement fallback triggers using `repository_dispatch` or `workflow_dispatch`
- Add monitoring/alerting for missed executions (track expected vs actual runs)
- Use external cron service (Google Cloud Scheduler, Cronhub) to trigger via GitHub API as backup
- Document the 60-day auto-disable behavior for users
- Consider event-based triggers (`push`, `release`) as more reliable alternatives

**Detection:**
- Workflow history shows gaps in scheduled runs
- Manual check reveals workflow is disabled despite recent repo activity
- Users report missing digest emails

**Phase mapping:** Foundation phase must address scheduling reliability before any platform integration.

**Sources:**
- [GitHub Actions Cron Schedule Issues](https://github.com/orgs/community/discussions/134086)
- [Scheduled Workflow Delays](https://github.com/orgs/community/discussions/156282)
- [GitHub Docs: Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)

---

### Pitfall 2: OAuth Token Refresh Complexity Causes Auth Failures

**What goes wrong:** Platform integrations break silently when access tokens expire. Users see "authentication failed" errors weeks after initial setup, requiring re-authorization that loses configuration state.

**Why it happens:** All platforms (Patreon, Ko-fi, Ghost, Bluesky, Mastodon) use OAuth with short-lived access tokens. Implementing proper refresh token flow is complex:
- Refresh tokens themselves can expire (Zendesk: 90 days default)
- Token rotation (new refresh token with each access token) is security best practice but adds state complexity
- Patreon's scope accumulation quirk: re-authorization adds scopes instead of replacing them
- Third-party OAuth enforcement deadlines (Zendesk requires refresh flow by April 30, 2026)

**Consequences:**
- Silent failures where syndication stops working
- User frustration requiring periodic re-authentication
- Lost configuration if token refresh loses scope/permissions
- Security risk if refresh tokens stored insecurely

**Prevention:**
- Implement automatic token refresh 5-10 minutes before expiration
- Store refresh tokens securely (encrypted GitHub secrets, not plaintext)
- Handle refresh token expiration gracefully with user notification
- Use OIDC (OpenID Connect) instead of long-lived tokens where supported
- Test token expiration scenarios in development (simulate expired tokens)
- Track token expiration timestamps and surface warnings before expiration
- For Patreon: always request full scope set on re-authorization
- Plan for Zendesk-style enforcement: assume all platforms will require proper refresh flow

**Detection:**
- HTTP 401 responses from platform APIs
- Posts succeed initially but fail after days/weeks
- Logs show "invalid_token" or "expired_token" errors

**Phase mapping:** OAuth/authentication must be Phase 1 (before any platform integration). Token refresh is complex enough to justify dedicated research/testing time.

**Sources:**
- [Patreon OAuth Scopes Pitfall](https://www.patreondevelopers.com/t/simple-solutions-oauth-and-membership-data/4199)
- [Zendesk OAuth Refresh Token Requirement](https://support.zendesk.com/hc/en-us/articles/9182123625370)
- [OAuth 2.0 Refresh Tokens Guide](https://frontegg.com/blog/oauth-2-refresh-tokens)
- [Auth0: Refresh Token Best Practices](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)

---

### Pitfall 3: Email Approval Links Need Cryptographic Security

**What goes wrong:** Approval links get intercepted, reused, or exploited to post unauthorized content to user platforms.

**Why it happens:** Email approval links are a security attack vector:
- Links are plaintext in email (visible to email providers, proxies)
- Email gets forwarded/leaked, exposing approval URLs
- Without expiration, old links can be replayed
- Without HMAC signing, links can be forged/modified
- Token timeouts too short frustrate users; too long increase attack window

**Consequences:**
- Malicious actor approves/posts spam content to user's platforms
- Reputation damage for the tool and user
- Platform API keys get revoked after abuse
- Legal liability for unauthorized posting

**Prevention:**
- Use HMAC-signed tokens (HMAC-SHA256) to prevent forgery
- Include cryptographically random nonce in token generation
- Set token expiration (24-48 hours recommended, per industry standards)
- Use timing-safe comparison (`crypto.timingSafeEqual`) to validate tokens
- Make tokens single-use (mark as consumed after approval)
- Include `draft_id` and `user_id` in HMAC payload to prevent replay across users
- Log all approval attempts (timestamp, IP, result) for audit trail
- Consider rate limiting approval endpoint (prevent brute force)
- HTTPS-only for approval endpoint (never HTTP)
- Display approval preview before final confirmation (show what will be posted)

**Detection:**
- Multiple approval attempts for same draft
- Approval from unexpected IP/location
- User reports unauthorized posts
- Audit logs show expired token usage

**Phase mapping:** Approval flow security must be Phase 1. This cannot be retrofitted - build it correctly from the start.

**Sources:**
- [Email Verification Token Expiration Best Practices](https://emaillistvalidation.com/blog/email-verification-link-expiration-ensuring-security-and-user-experience-2/)
- [Zendesk Token Expiration: 24 hours](https://support.zendesk.com/hc/en-us/articles/4408894162714)
- [GitHub Webhook HMAC Verification](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

---

### Pitfall 4: Platform Rate Limits Cause Silent Posting Failures

**What goes wrong:** Syndication succeeds to some platforms but silently fails on others when rate limits are exceeded. No user notification, posts just disappear.

**Why it happens:** Every platform has different rate limits and enforcement:
- **GitHub Actions**: 1,000 requests/hour with GITHUB_TOKEN (easily exceeded), secondary limits on content-generating requests (80/min, 500/hour)
- **Bluesky**: 5,000 points/hour (1,666 creates/hour), 35,000 points/day (11,666 creates/day)
- **Patreon/Ko-fi/Ghost**: Undocumented or poorly documented limits
- **Mastodon**: Instance-specific limits, no universal standard
- Rate limits apply per IP, per account, per API key (varies by platform)
- Shared infrastructure (GitHub Actions, Cloudflare Workers) shares IP rate limits across all users

**Consequences:**
- Posts succeed on some platforms but silently fail on others
- Users assume all platforms succeeded when only partial success occurred
- Hitting rate limits can trigger temporary bans or API key revocation
- Shared infrastructure causes one user's abuse to affect all users

**Prevention:**
- Document each platform's rate limits explicitly in code/docs
- Implement exponential backoff with jitter for retries
- Parse rate limit headers (`X-RateLimit-Remaining`, `Retry-After`) from responses
- Track rate limit consumption per platform in state
- Queue posts with delays when approaching limits
- Return clear error messages to users when rate limited
- For GitHub Actions: use PAT (Personal Access Token) instead of GITHUB_TOKEN for higher limits
- For Bluesky: monitor point consumption (3 points per create)
- For Mastodon: query instance-specific limits on first use
- Build circuit breaker pattern (stop attempting after N failures)
- Consider platform-specific batch windows (spread posts over hours, not minutes)

**Detection:**
- HTTP 429 responses in logs
- Some platforms succeed while others fail
- Sudden increase in API errors after traffic spike
- Users report missing posts on specific platforms

**Phase mapping:** Rate limiting strategy needed in Phase 2 (platform integration). Each platform plugin must implement consistent retry/backoff logic.

**Sources:**
- [GitHub Actions Rate Limits 2026](https://www.kubeblogs.com/how-to-avoid-github-token-rate-limiting-issues-complete-guide-for-devops-teams/)
- [Bluesky Rate Limits](https://docs.bsky.app/docs/advanced-guides/rate-limits)
- [GitHub Secondary Rate Limits](https://github.com/orgs/community/discussions/28452)
- [Atlassian 2026 Point-Based Rate Limits](https://community.developer.atlassian.com/t/2026-point-based-rate-limits/97828)

---

### Pitfall 5: Email Deliverability Requires SPF/DKIM/DMARC Configuration

**What goes wrong:** Approval emails go to spam or get rejected entirely. Users never see drafts, assume tool is broken, abandon it.

**Why it happens:** Major email providers (Gmail, Outlook) now enforce strict authentication for transactional emails:
- Gmail/Outlook require SPF + DKIM + DMARC for senders of 5,000+ emails/day
- Microsoft enforcing modern authentication (no basic auth SMTP) by April 30, 2026
- 2048-bit DKIM keys required for enterprise filters in 2026
- Unauthenticated emails routed to Junk folder automatically
- Email links trigger spam filters (approval URLs look suspicious)
- Shared sending infrastructure can inherit poor reputation

**Consequences:**
- Users never receive approval emails
- Tool appears broken/non-functional
- Support burden from "not receiving emails"
- Users attribute problem to tool, not email configuration

**Prevention:**
- Use reputable transactional email provider (Resend, Postmark, SendGrid)
- Configure SPF, DKIM, and DMARC records for sending domain
- Use dedicated sending domain (not user's personal domain)
- Test email deliverability to major providers (Gmail, Outlook, Yahoo) before launch
- Monitor bounce rates and spam complaints
- Implement double opt-in for email addresses
- Keep approval email content simple (avoid spammy language)
- Warm up sending reputation (gradual volume increase)
- Provide alternative approval method (web UI fallback) if email fails
- Choose provider with separated infrastructure (Postmark's separate transactional/marketing servers)
- Use 2048-bit DKIM keys minimum
- Include functional unsubscribe link (Gmail/Outlook requirement for bulk senders)

**Detection:**
- High bounce rate in email provider dashboard
- Users report "not receiving emails"
- Emails land in spam folder during testing
- Authentication-Results header shows DMARC fail

**Phase mapping:** Email infrastructure is Phase 1 foundation. Cannot build approval flow without reliable email delivery.

**Sources:**
- [Email Deliverability 2026: SPF/DKIM/DMARC Checklist](https://www.egenconsulting.com/blog/email-deliverability-2026.html)
- [Outlook High-Volume Sender Requirements](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730)
- [Google Sender Guidelines](https://support.google.com/a/answer/81126?hl=en)
- [Postmark vs SendGrid Deliverability](https://www.courier.com/integrations/compare/postmark-vs-sendgrid)

---

### Pitfall 6: Ko-fi Has No Posting API (Webhook-Only)

**What goes wrong:** Team builds Ko-fi posting plugin, discovers Ko-fi only provides webhook (receive-only) API, not posting API. Wasted development time, feature must be cut.

**Why it happens:** Ko-fi's API is exclusively webhook-based for payment notifications. Unlike Patreon or Ghost, Ko-fi does not provide a public API for programmatically posting content to creator pages.

**Consequences:**
- Ko-fi cannot be supported as syndication target
- Marketing materials promise Ko-fi, must retract
- Users who rely on Ko-fi are disappointed
- Development time wasted before discovering limitation

**Prevention:**
- **Verify API capabilities before committing to platform support**
- Check official API documentation for write/POST endpoints
- Test API in development before announcing feature
- For Ko-fi specifically: document as "not supported" in roadmap
- Focus on platforms with bidirectional APIs (Patreon, Ghost, Bluesky, Mastodon)
- Consider alternative: Ko-fi integration via Zapier (if user has Pro account)
- Be transparent with users about Ko-fi limitation

**Detection:**
- Official Ko-fi API docs show only webhook endpoints
- No OAuth authorization flow for posting
- Community confirms Ko-fi is receive-only

**Phase mapping:** Platform API verification should happen in Research phase before roadmap creation. Document which platforms are technically feasible.

**Sources:**
- [Ko-fi API Documentation](https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook)
- [Ko-fi Integrations](https://help.ko-fi.com/hc/en-us/sections/11164383150365-Integrations)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded user experience.

### Pitfall 7: Plugin System Sandboxing is Extremely Difficult

**What goes wrong:** Plugin system allows malicious code execution, exposing user credentials or posting spam. Attempting to sandbox plugins with libraries like vm2 leads to security vulnerabilities.

**Why it happens:** Sandboxing untrusted JavaScript in Node.js is architecturally difficult:
- Popular library vm2 had 8 critical vulnerabilities in one year (7 in 4 months)
- vm2 deprecated and unmaintained as of 2023
- Node.js intercepts calls from sandbox, preventing proper isolation
- Proxy-based sandboxing has fundamental escape vectors
- Hardware virtualization (Docker, Lambda) is only reliable isolation

**Consequences:**
- Malicious plugin steals OAuth tokens from GitHub secrets
- Plugin posts spam content to user platforms
- Plugin exfiltrates user data
- Security vulnerabilities discovered after launch
- Cannot safely support community-contributed plugins

**Prevention:**
- **Do not attempt JavaScript sandboxing with vm2 or similar libraries**
- Instead: Use plugin architecture with constrained API surface
- Plugin as declarative config (JSON/YAML schema) not executable code
- If code execution needed: run plugins in separate containers (Docker)
- Or use serverless functions (AWS Lambda, Cloudflare Workers) per plugin
- Validate plugin manifests against strict schema
- Allowlist pattern: plugins declare required permissions explicitly
- Review all community plugins before allowing in registry
- Provide official plugins only for Phase 1 (defer community plugins)
- Use Web Workers or separate processes if sandboxing required
- Consider plugin system as "configuration presets" not "arbitrary code"

**Detection:**
- Security audit reveals sandbox escape vectors
- Plugin accesses resources outside declared permissions
- Code review shows vm2 usage

**Phase mapping:** Plugin architecture design is critical for Phase 3+. Do NOT rush this - security mistakes here are catastrophic.

**Sources:**
- [vm2 Critical Vulnerabilities 2026](https://semgrep.dev/blog/2026/calling-back-to-vm2-and-escaping-sandbox/)
- [Sandboxing NodeJS is Hard](https://pwnisher.gitlab.io/nodejs/sandbox/2019/02/21/sandboxing-nodejs-is-hard.html)
- [Secure Node Sandbox Approaches](https://medium.com/@devnullnor/a-secure-node-sandbox-f23b9fc9f2b0)

---

### Pitfall 8: Duplicate Post Detection Requires Idempotency Keys

**What goes wrong:** Retry logic or workflow re-runs cause duplicate posts on platforms. Users see same update posted 2-3 times, looks unprofessional.

**Why it happens:**
- GitHub Actions retries workflows on transient failures
- Approval link clicked multiple times (user impatience, email client preview)
- Rate limit retry logic re-posts after initial success
- Workflow re-run after partial success posts to platforms that already succeeded

**Consequences:**
- Duplicate posts annoy followers
- Platform spam detection flags account
- Loss of professional credibility
- Wasted API quota

**Prevention:**
- Generate unique `draft_id` for each content draft
- Track posting state per platform: `pending`, `posted`, `failed`
- Store platform-specific post IDs after successful post
- Check state before posting: skip if already `posted`
- Use platform-native idempotency if available (HTTP `Idempotency-Key` header)
- For approval links: mark draft as "approved" atomically before posting
- Implement two-phase commit pattern: lock -> post -> mark complete
- Add `X-GitHub-Delivery` header tracking for webhook-triggered workflows
- Log all posting attempts with timestamps for debugging
- Provide manual "reset draft state" escape hatch for stuck drafts

**Detection:**
- Same content posted multiple times to platform
- Workflow logs show multiple successful POST requests
- User reports duplicate posts

**Phase mapping:** State management must be designed in Phase 1 (foundation). Retrofitting idempotency is error-prone.

**Sources:**
- [Azure Service Bus Duplicate Detection](https://dev.to/vinayaksavle/day-5-ensuring-message-idempotency-with-duplicate-detection-in-azure-service-bus-llj)
- [Content Syndication Duplicate Content](https://customgpt.ai/avoid-duplicate-content-deduping-mirrors-syndication/)

---

### Pitfall 9: Serverless Functions Have Strict Timeout Limits

**What goes wrong:** Approval endpoint times out when posting to multiple slow platforms (Patreon API slow, Ghost publishing delay). User sees error, unsure if post succeeded.

**Why it happens:** Serverless platforms have aggressive timeout limits:
- Vercel Hobby: 10 seconds, Pro: 60 seconds
- AWS API Gateway: 29 seconds (Lambda can run 15 min but Gateway terminates)
- Cloudflare Workers: 30 seconds (paid), 10 seconds (free)
- Posting to 5 platforms sequentially can exceed limits

**Consequences:**
- Approval succeeds but user sees timeout error
- Partial success state (3/5 platforms posted)
- User retries, causing duplicate posts
- Cannot support many platforms simultaneously

**Prevention:**
- Use asynchronous posting pattern: approval triggers, returns immediately, posts in background
- Approval endpoint: validate token -> queue job -> return 202 Accepted
- Use GitHub Actions as async worker (triggered via `repository_dispatch`)
- Or use cloud queue (AWS SQS, Azure Queue, Google Cloud Tasks)
- Post to platforms in parallel (not sequential) to reduce latency
- Set realistic timeout expectations (60s minimum for multi-platform)
- Implement graceful degradation: post to critical platforms first
- Show user "posting in progress" status page they can check later
- Email notification when posting completes (success or failure)
- AWS Lambda Durable Functions (available 2026) can handle long workflows with built-in state

**Detection:**
- HTTP 504 Gateway Timeout responses
- Logs show function killed mid-execution
- User reports "error" but posts succeeded

**Phase mapping:** Async posting architecture needed in Phase 2 (approval flow). Cannot rely on synchronous HTTP for multi-platform posting.

**Sources:**
- [Vercel Function Timeouts](https://github.com/vercel/vercel/discussions/4502)
- [AWS Lambda Durable Functions 2026](https://byteiota.com/serverless-2-0-removes-state-barrier-built-in-persistence-arrives/)
- [Serverless Function Timeout Limits](https://github.com/serverless/serverless/issues/7496)

---

### Pitfall 10: Cross-Instance Mastodon Posting Complexity

**What goes wrong:** Mastodon integration works for mastodon.social but fails for smaller instances with different configurations. Edge case: user's instance has custom character limits, different filter rules, or disabled features.

**Why it happens:** Mastodon is decentralized - each instance can customize:
- Character limits (500 default, but configurable per instance)
- Content warnings/filters (server-side vs client-side filtering)
- Media attachment limits (4 default, varies by instance)
- ID formats (numeric vs non-numeric, varies by server software)
- Plain text unavailable for remote content (syntax varies across fediverse)

**Consequences:**
- Posts fail on specific instances with cryptic errors
- Character limit assumes 500, but user's instance is 280
- Hard-coded numeric ID parsing breaks on non-Mastodon servers (Pleroma, Misskey)
- Support burden from instance-specific issues

**Prevention:**
- Query instance capabilities on first use (`GET /api/v1/instance`)
- Store instance-specific limits in state (character limit, media limit)
- Always treat IDs as opaque strings (never cast to integer)
- Display `acct` field as `username@domain` for transparency
- Implement graceful fallback when features unavailable
- Test against multiple Mastodon versions and forks (Pleroma, Hometown, Glitch)
- Document instance requirements (minimum Mastodon version, required features)
- Handle missing features gracefully (no quote posts on some instances)
- Monitor `Deprecation` header for API changes

**Detection:**
- Integration works on mastodon.social but fails on user's instance
- ID parsing throws integer overflow errors
- Character limit validation incorrect
- User reports "API error" with specific instance

**Phase mapping:** Mastodon implementation Phase 3+ requires instance discovery/configuration. More complex than centralized platforms.

**Sources:**
- [Mastodon API Guidelines](https://docs.joinmastodon.org/api/guidelines/)
- [ID Handling Best Practices](https://github.com/McKael/mastodon-documentation/blob/master/Using-the-API/API.md)
- [Pleroma API Differences](https://docs-develop.pleroma.social/backend/development/API/differences_in_mastoapi_responses/)

---

### Pitfall 11: GitHub Actions Secrets Exposure via Logs

**What goes wrong:** Platform API keys accidentally logged to GitHub Actions output, exposing credentials publicly. Attacker uses leaked keys to spam user platforms.

**Why it happens:**
- Secrets printed to stdout/stderr not auto-masked
- Error messages include full API request (with auth headers)
- Debug mode logs show environment variables
- Third-party actions can access secrets and log them
- API responses include tokens in URLs (query params)

**Consequences:**
- API keys exposed in public workflow logs
- Attacker posts spam, platforms revoke keys
- User account banned from platforms
- Security incident requires key rotation

**Prevention:**
- Use `::add-mask::VALUE` to mask sensitive values in logs
- Never assign secrets to regular environment variables then log them
- Use intermediate environment variables for user input (prevents script injection)
- Audit all `echo`, `console.log`, `print` statements for secret leakage
- Enable "Read-only" permission for GITHUB_TOKEN by default
- Use OIDC instead of long-lived secrets where possible
- Rotate secrets regularly (30-90 days)
- Use environment-level secrets with approval requirements
- Never log full HTTP requests/responses
- Sanitize error messages before logging
- Use secret scanning tools (GitHub Advanced Security, GitGuardian)
- Review third-party actions before use (can access all secrets)

**Detection:**
- Secret scanning alerts in GitHub
- Audit logs show secrets accessed
- Workflow logs contain masked values (***) indicating near-miss
- Security researcher reports exposed key

**Phase mapping:** Secret management is Phase 1 security foundation. Must be correct before any platform integration.

**Sources:**
- [GitHub Actions Secrets Best Practices](https://www.blacksmith.sh/blog/best-practices-for-managing-secrets-in-github-actions)
- [GitHub Docs: Secrets Security](https://docs.github.com/en/actions/concepts/security/secrets)
- [GitHub Actions Security Cheat Sheet](https://blog.gitguardian.com/github-actions-security-cheat-sheet/)

---

### Pitfall 12: Bluesky IP-Based Rate Limiting for Shared Infrastructure

**What goes wrong:** Bluesky enforces global rate limits per IP address. When running on shared infrastructure (GitHub Actions, Cloudflare Workers), all users share the same IP pool, causing one user's activity to trigger rate limits for everyone.

**Why it happens:** Bluesky currently applies rate limits globally at 3,000 API calls per IP per 5 minutes. Shared infrastructure like GitHub Actions or Cloudflare Workers routes all traffic through limited IP ranges, meaning thousands of developers share the same IPs.

**Consequences:**
- Single high-volume user exhausts rate limit for all users
- Unpredictable failures: "worked yesterday, fails today"
- Cannot scale beyond single-user use cases
- Per-account limits don't help on shared IPs

**Prevention:**
- Avoid Bluesky integration on shared GitHub Actions runners (use self-hosted runner with dedicated IP)
- Monitor Bluesky's OAuth roadmap (planned to enable per-integration limits)
- Use rate limit headers to detect approaching limits
- Implement exponential backoff when rate limited
- Document IP-based limitation for users
- Consider proxying through dedicated VPS/server (not shared infra)
- Wait for Bluesky's per-account limit enforcement (planned improvement)
- Build circuit breaker to prevent retry storms

**Detection:**
- HTTP 429 responses from Bluesky API
- `RateLimitExceeded` errors on `createSession`
- Works in development, fails in production shared environment

**Phase mapping:** Bluesky integration should be Phase 3+ and clearly documented as having scaling limitations on shared infrastructure.

**Sources:**
- [Bluesky IP Rate Limit Discussion](https://github.com/bluesky-social/atproto/discussions/2160)
- [Cloudflare Workers Rate Limit Issue](https://github.com/bluesky-social/atproto/issues/3388)
- [Bluesky Rate Limits Documentation](https://docs.bsky.app/docs/advanced-guides/rate-limits)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 13: Patreon Email Verification Blocks OAuth Flow

**What goes wrong:** User attempts OAuth authorization with Patreon, gets error requiring email verification. User confused, blames tool.

**Why it happens:** Patreon requires email verification before OAuth authorization. If user hasn't verified their email, OAuth flow fails with error message.

**Consequences:**
- User cannot complete setup
- Assumes tool is broken
- Support request burden

**Prevention:**
- Document Patreon email verification requirement in setup docs
- Catch Patreon email verification error and show friendly message
- Provide link to Patreon settings for email verification
- Test OAuth flow with unverified account during development

**Detection:**
- OAuth error mentions email verification
- User reports "Patreon connection failed"

**Phase mapping:** Patreon integration Phase 2+. Document edge cases in user onboarding.

**Sources:**
- [Patreon OAuth Email Verification](https://www.patreondevelopers.com/t/simple-solutions-oauth-and-membership-data/4199)

---

### Pitfall 14: Ghost API Requires `include` Parameter for Related Data

**What goes wrong:** Ghost posts missing author names, tags, or featured images. Content looks incomplete.

**Why it happens:** Ghost Content API doesn't include related data by default. Must explicitly request via `include` parameter.

**Consequences:**
- Posts missing metadata
- User sees incomplete syndication
- Looks unprofessional

**Prevention:**
- Always use `?include=tags,authors` in Ghost API requests
- Document required includes for each endpoint
- Test with real Ghost instance, not mock data
- Use Ghost API demo scripts as reference

**Detection:**
- Ghost posts missing expected fields
- API response lacks `tags` or `authors` arrays

**Phase mapping:** Ghost integration Phase 2+. API quirk, easily documented.

**Sources:**
- [Ghost API Common Issues](https://abstract27.com/common-ghost-cms-issues-and-their-solutions/)
- [Ghost Content API Docs](https://docs.ghost.org/content-api)

---

### Pitfall 15: GitHub Actions Cache Rate Limiting (New 2026)

**What goes wrong:** Workflows fail with cache upload errors after exceeding 200 uploads/minute limit introduced January 2026.

**Why it happens:** GitHub Actions now enforces 200 cache uploads per minute per repository. Matrix builds generating unique cache keys across many parallel jobs can exceed this limit.

**Consequences:**
- Cache uploads fail silently
- Slower workflow performance (cache misses)
- Workflow failures if cache upload errors not handled

**Prevention:**
- Limit matrix parallelism (don't run 200+ jobs simultaneously)
- Use shared cache keys across matrix jobs where possible
- Handle cache upload failures gracefully (non-fatal errors)
- Monitor cache upload rate in high-parallelism workflows
- Consider cache alternatives for very large matrices

**Detection:**
- Cache upload errors in workflow logs
- Rate limit warnings from GitHub Actions

**Phase mapping:** Optimization phase. Not critical for MVP but affects large-scale usage.

**Sources:**
- [GitHub Actions Cache Rate Limit 2026](https://github.blog/changelog/2026-01-16-rate-limiting-for-actions-cache-entries/)
- [Cache Rate Limit News](https://blockchain.news/news/github-actions-cache-rate-limit-200-per-minute)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Foundation (Scheduling) | Scheduled workflows unreliable | Implement `repository_dispatch` fallback + external monitoring |
| Foundation (Auth) | OAuth token refresh complexity | Build refresh flow from day 1, test expiration scenarios |
| Foundation (Approval) | Email approval link security | HMAC signing + expiration + single-use tokens |
| Foundation (Email) | SPF/DKIM/DMARC deliverability | Use reputable provider (Postmark/Resend) + proper DNS config |
| Platform Integration (Patreon) | OAuth scope accumulation | Always request full scope set |
| Platform Integration (Ko-fi) | No posting API available | Document as unsupported, focus on other platforms |
| Platform Integration (Bluesky) | IP-based rate limiting | Use dedicated IP or document scaling limits |
| Platform Integration (Mastodon) | Instance-specific variations | Query instance capabilities, treat IDs as strings |
| Platform Integration (Ghost) | Missing `include` parameter | Always include related data in API requests |
| Platform Integration (All) | Rate limit enforcement | Implement retry with exponential backoff + circuit breakers |
| Approval Flow | Serverless timeout limits | Async posting pattern (202 Accepted + background job) |
| State Management | Duplicate post detection | Idempotency keys + state tracking per platform |
| Plugin System | Sandboxing security | Avoid code execution; use declarative config instead |
| Secrets Management | GitHub Actions log exposure | Use `::add-mask::`, audit logs, rotate regularly |

---

## Research Confidence Assessment

| Topic | Confidence | Reasoning |
|-------|------------|-----------|
| GitHub Actions scheduling | HIGH | Official docs + recent community reports (Jan 2026) |
| OAuth token refresh | HIGH | Multiple official sources (Zendesk, Auth0, Microsoft) |
| Email approval security | MEDIUM | Industry standards (HMAC, expiration) well-documented |
| Platform rate limits | MEDIUM | Official docs for Bluesky/GitHub, less clear for Patreon/Ko-fi |
| Email deliverability | HIGH | Multiple 2026 sources on SPF/DKIM/DMARC requirements |
| Ko-fi API limitations | HIGH | Official Ko-fi documentation confirms webhook-only |
| Plugin sandboxing | HIGH | vm2 deprecation well-documented, multiple security sources |
| Serverless timeouts | HIGH | Official platform documentation (Vercel, AWS) |
| Mastodon instance variations | MEDIUM | Official Mastodon docs + community experience |
| Bluesky IP rate limits | HIGH | Official Bluesky docs + GitHub issue discussions |

---

## Critical Unknowns / Needs Further Research

- **Patreon API rate limits**: Not documented publicly, requires testing or contacting support
- **Ghost API rate limits**: Documentation unclear on specific limits
- **Ko-fi API alternatives**: Confirm whether any third-party APIs exist for posting
- **Bluesky OAuth timeline**: When will per-integration limits launch?
- **AWS Lambda Durable Functions availability**: Announced Dec 2025, global rollout Q2 2026 - monitor for GA

---

## Summary for Roadmap Planning

**Must-address in Phase 1 (Foundation):**
1. Scheduled workflow reliability (external trigger backup)
2. OAuth token refresh flow (all platforms)
3. Email approval link security (HMAC + expiration)
4. Email deliverability (SPF/DKIM/DMARC)
5. Secrets management (no log exposure)
6. State management for idempotency

**Address per-platform (Phase 2+):**
7. Rate limiting strategy (platform-specific)
8. Patreon email verification UX
9. Ghost API `include` parameter
10. Mastodon instance discovery
11. Bluesky IP rate limit mitigation

**Defer to Phase 3+ (or cut scope):**
12. Plugin system (security complexity)
13. Ko-fi integration (no API available)

**Ongoing/operational:**
14. Secret rotation (30-90 days)
15. Rate limit monitoring
16. Deliverability monitoring

