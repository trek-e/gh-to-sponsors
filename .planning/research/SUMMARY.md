# Project Research Summary

**Project:** gh-to-sponsors
**Domain:** GitHub-to-supporter content syndication automation
**Researched:** 2026-02-01
**Confidence:** MEDIUM-HIGH

## Executive Summary

gh-to-sponsors is a GitHub Action + serverless content syndication tool for open source creators who want to automatically post development updates to their crowdfunding supporters. The research reveals a clear approach: TypeScript-based GitHub Actions with serverless approval endpoints (Vercel/Cloudflare), email-based workflow for safety, and a plugin architecture for platform integrations. The recommended stack prioritizes official SDKs (Octokit, @atproto/api, masto.js) over community libraries, with Resend for transactional email and artifact-based state management to avoid external database dependencies.

**Critical discovery: Ko-fi has no posting API.** Ko-fi only provides webhook endpoints for receiving payment notifications, not posting content. This platform must be removed from syndication targets or requirements must be clarified as "payment tracking only." This is a hard blocker that invalidates any roadmap plans assuming Ko-fi posting capability.

The key risks center on infrastructure reliability and security: GitHub Actions scheduled workflows are unreliable (skip executions, auto-disable after 60 days), OAuth token refresh is complex across multiple platforms, email approval links require cryptographic security (HMAC signing, expiration), and platform rate limits vary wildly (Bluesky's IP-based limits affect shared infrastructure). The recommended mitigation strategy is defensive architecture from day 1: external scheduling triggers as fallback, token refresh built into authentication layer, HMAC-signed single-use approval tokens with 24-48 hour expiration, and per-platform rate limit tracking with exponential backoff.

## Key Findings

### Recommended Stack

The stack is optimized for GitHub Actions + serverless with minimal infrastructure. TypeScript throughout provides type safety critical for multi-platform API contracts. Node.js 20.x is the minimum version (GitHub Actions requirement), with official platform SDKs preferred over community alternatives. Rollup bundling is required by GitHub Actions (not webpack/esbuild), and Vitest for testing (10-20x faster than Jest). Email delivery uses Resend (generous free tier, modern API) over Postmark/SendGrid, with proper SPF/DKIM/DMARC configuration essential for deliverability.

**Core technologies:**
- **Node.js 20.x + TypeScript 5.5+**: GitHub Actions standard runtime with zero-cost type safety (required by Zod validation library)
- **GitHub Actions (@actions/core, @actions/github)**: Official toolkit with Rollup bundling (must run `npm run bundle` or action fails)
- **Vercel Functions**: Serverless approval endpoint with zero-config deployment, 100GB free tier, native TypeScript support (Cloudflare Workers for scale)
- **Resend**: Transactional email with 3K free emails/month, modern async/await API, React email support (vs Postmark's $15 minimum or SendGrid's 61% deliverability)
- **Official Platform SDKs**: @atproto/api (Bluesky), masto.js v7.10.1 (Mastodon Jan 2026), @tryghost/admin-api (Ghost), patreon-api.ts (V2 API support, official SDK lacks V2)
- **Zod 3.x**: Runtime validation with automatic type inference, 2KB gzipped, perfect for webhook/API response validation
- **Artifact-based state**: GitHub Actions artifacts for lightweight persistence (7-90 day retention), defer external DB until proven need

### Expected Features

Content syndication tools occupy a crowded space between enterprise workflow automation (Zapier) and social media schedulers (Buffer/Hootsuite). The feature landscape reveals clear patterns: multi-platform posting and scheduling are table stakes, while GitHub-native digest generation and email-only approval interface differentiate gh-to-sponsors. Critically, anti-features warn against web dashboard scope creep (8/10 users delete confusing apps), real-time posting spam (commit-by-commit updates annoy supporters), and X/Meta platform support (values-aligned exclusion).

**Must have (table stakes):**
- Multi-platform posting (3-5 platforms minimum expected)
- Scheduled automation (GitHub Actions cron is standard, but unreliable - needs fallback)
- Content preview/draft (email-based simpler than web UI)
- Approval workflow (email approve/skip links are expected safety valve)
- Platform-specific formatting (Patreon rich text vs Mastodon markdown vs Bluesky 300 chars)
- Error handling & retry (exponential backoff, rate limit awareness)
- Authentication management (OAuth refresh must "just work")
- Configuration per repo (YAML/JSON config file in .github/ directory)

**Should have (competitive differentiators):**
- GitHub-native digest generation (auto-generate from commits/PRs/releases, not just "I pushed code")
- Intelligent cadence (daily digest with weekly fallback prevents going silent)
- Teaser generation for social (short versions for Bluesky/Mastodon drive traffic to full posts)
- Plugin architecture (community can add platforms without core changes)
- GitHub Action native (runs where code is, zero external infrastructure)
- Values-aligned platform exclusion (explicit refusal to support X/Meta)
- Email-only interface (no dashboard to build/maintain, reduces scope 80%)
- Zero-infrastructure deployment (serverless, no servers to manage)

**Defer (v2+):**
- Web dashboard for editing posts (feature bloat, email approve/skip sufficient for v1)
- Analytics/engagement tracking (platforms already provide this, don't duplicate)
- Custom templating language (over-engineering, simple string interpolation sufficient)
- AI content generation (supporters pay for authentic creator voice, not GPT updates)
- Multi-user collaboration (single-user model simpler, only add if orgs demand it)

### Architecture Approach

Event-driven orchestration using GitHub Actions workflows with serverless approval endpoint. Core pattern: scheduled workflow generates digest, sends email with HMAC-signed approval links, serverless function validates token and triggers repository_dispatch, separate workflow posts to platforms in parallel. State management via GitHub Actions artifacts (7-90 day retention sufficient for MVP), with plugin architecture using TypeScript interfaces (no sandboxing - community plugins are trusted code, not arbitrary execution).

**Major components:**
1. **Scheduler** — GitHub Actions cron trigger (daily/weekly) with repository_dispatch fallback for reliability
2. **Content Generator** — Parse git log, PRs, releases to create digest with platform-specific formatting
3. **Email Sender** — Resend integration sends draft preview with HMAC-signed approve/skip links (24-48h expiration)
4. **Serverless Approval Endpoint** — Vercel Function validates token, triggers repository_dispatch with post payload
5. **Publishing Orchestrator** — Parallel matrix strategy posts to enabled platforms (fail-fast: false for resilience)
6. **Platform Plugins** — TypeScript interface implementations (PlatformPlugin.post(), .authenticate(), .supports()) for each platform
7. **State Storage** — Artifact-based tracking of pending/posted content with idempotency keys to prevent duplicates

**Critical patterns:**
- **Token-based approval**: HMAC-SHA256 signed tokens with expiration, single-use flag, includes draft_id/user_id to prevent replay
- **Async posting**: Approval returns 202 Accepted immediately, repository_dispatch triggers background workflow (avoids 60s serverless timeout)
- **Artifact state management**: Upload/download state.json at workflow boundaries, 90-day retention, handles race conditions
- **Plugin discovery**: TypeScript interfaces enforce contract, registry pattern loads plugins, no sandboxing (trusted code only)

### Critical Pitfalls

**Top 6 blockers from PITFALLS.md (12 total documented):**

1. **GitHub Actions scheduled workflows are unreliable** — Cron triggers miss executions (30+ min delays), auto-disable after 60 days repo inactivity. Prevention: implement repository_dispatch fallback, external cron trigger (Google Cloud Scheduler), track last successful run, document auto-disable behavior.

2. **Ko-fi has no posting API (CRITICAL BLOCKER)** — Ko-fi only provides webhook endpoints for payment notifications, not content posting. No workaround exists via official API. Prevention: remove Ko-fi from platform list or clarify as "payment tracking only, not syndication target."

3. **OAuth token refresh complexity causes silent auth failures** — All platforms use short-lived access tokens, refresh tokens expire (90 days default), Patreon has scope accumulation quirk. Prevention: build automatic refresh 5-10 min before expiration, store refresh tokens encrypted, handle expiration with user notification, test token expiration scenarios.

4. **Email approval links need cryptographic security** — Links are plaintext in email, can be forwarded/leaked, replayed if no expiration. Prevention: HMAC-SHA256 signing, 24-48h expiration, single-use flag, timing-safe comparison, audit logging, include draft_id/user_id in payload.

5. **Platform rate limits cause silent failures** — GitHub Actions: 1K/hr with GITHUB_TOKEN, 80/min secondary limit; Bluesky: 5K points/hr (1,666 posts); others undocumented. Prevention: parse rate limit headers, exponential backoff with jitter, queue posts when approaching limits, use PAT instead of GITHUB_TOKEN.

6. **Email deliverability requires SPF/DKIM/DMARC** — Gmail/Outlook enforce strict auth, unauthenticated emails go to spam, Microsoft requires modern auth by April 30, 2026. Prevention: use Resend/Postmark with proper DNS config, test deliverability to major providers, 2048-bit DKIM keys, warm up sending reputation.

**Moderate pitfalls (6 documented):**
- Plugin sandboxing is impossible in Node.js (vm2 deprecated, 8 CVEs in one year) - use trusted plugins only, no arbitrary code execution
- Duplicate post detection needs idempotency keys (track state per platform, use Idempotency-Key header where supported)
- Serverless timeout limits require async pattern (Vercel: 10s free/60s pro, must return 202 Accepted + background job)
- Mastodon instance variations (query /api/v1/instance for limits, treat IDs as strings, test against forks)
- Secrets exposure in logs (use ::add-mask::, never log requests/responses, audit echo/console.log statements)
- Bluesky IP-based rate limiting on shared infra (GitHub Actions shares IPs, one user affects all, use self-hosted runner or document limitation)

## Implications for Roadmap

Based on combined research, suggested 5-phase structure with clear dependencies and risk mitigation:

### Phase 1: Foundation & Approval Loop
**Rationale:** Cannot build anything without reliable scheduling, state management, and secure approval workflow. OAuth complexity and email deliverability are critical blockers that must be solved before platform integration. Ko-fi blocker discovered here informs platform selection.

**Delivers:**
- Scheduled workflow with repository_dispatch fallback
- Artifact-based state management (pending/posted tracking)
- Content generator (parse git log into digest)
- Email sender (Resend integration with SPF/DKIM/DMARC)
- Serverless approval endpoint (HMAC-signed tokens, 24-48h expiration)
- Repository dispatch handler workflow

**Addresses features:**
- Scheduled automation (with reliability fixes)
- Content preview/draft (email-based)
- Approval workflow (approve/skip links)
- Configuration per repo (YAML config)

**Avoids pitfalls:**
- Pitfall #1: Scheduled workflow unreliability (fallback triggers)
- Pitfall #4: Approval link security (HMAC signing)
- Pitfall #5: Email deliverability (proper DNS config)
- Pitfall #8: Duplicate detection (state management with idempotency)
- Pitfall #11: Secrets exposure (::add-mask:: from start)

**Research flag:** STANDARD PATTERNS - GitHub Actions approval workflows are well-documented, multiple reference implementations exist.

---

### Phase 2: Single Platform Integration (Patreon)
**Rationale:** Prove platform plugin architecture with one complete implementation before scaling to multiple platforms. Patreon chosen over Ko-fi (no API) and Ghost (fewer OAuth quirks). OAuth token refresh complexity is highest risk here.

**Delivers:**
- PlatformPlugin TypeScript interface
- Plugin registry pattern
- Patreon OAuth flow with token refresh
- Patreon post adapter (V2 API via patreon-api.ts)
- Rate limit tracking per platform
- Error handling & retry logic (exponential backoff)

**Uses stack:**
- patreon-api.ts (V2 API support)
- Zod validation for API responses
- GitHub Secrets for OAuth tokens

**Implements architecture:**
- Plugin architecture (interface + registry)
- Async posting pattern (202 Accepted + background)
- Token-based approval with platform targeting

**Avoids pitfalls:**
- Pitfall #2: OAuth token refresh (build from day 1)
- Pitfall #4: Platform rate limits (parse headers, backoff)
- Pitfall #9: Serverless timeouts (async pattern)
- Pitfall #13: Patreon email verification (friendly error message)

**Research flag:** NEEDS RESEARCH - Patreon rate limits undocumented, OAuth quirks (scope accumulation) need testing, V2 API community library requires validation.

---

### Phase 3: Multi-Platform Expansion
**Rationale:** With proven plugin architecture, add remaining platforms in parallel. Ghost and Mastodon have simpler auth than Bluesky. Ko-fi excluded (no posting API per research).

**Delivers:**
- Ghost adapter (@tryghost/admin-api, include parameter handling)
- Bluesky adapter (@atproto/api, BskyAgent auth)
- Mastodon adapter (masto.js, instance discovery)
- Platform-specific formatting (char limits, markdown support)
- Parallel posting strategy (GitHub Actions matrix)
- Platform enable/disable configuration

**Platforms NOT included:**
- Ko-fi (no posting API available, webhook-only)
- X/Twitter (values-aligned exclusion)
- Meta platforms (Facebook/Instagram/Threads - values-aligned exclusion)

**Avoids pitfalls:**
- Pitfall #2: Ko-fi blocker (excluded from scope)
- Pitfall #10: Mastodon instance variations (query capabilities)
- Pitfall #12: Bluesky IP rate limits (document shared infra limitation)
- Pitfall #14: Ghost API quirks (include parameter)

**Research flag:** NEEDS RESEARCH for Bluesky only - IP-based rate limiting on GitHub Actions shared infra needs testing, may require self-hosted runner recommendation.

---

### Phase 4: Intelligence & Optimization
**Rationale:** With core syndication working, add features that improve digest quality and posting intelligence. GitHub Releases detection and weekly fallback prevent going silent.

**Delivers:**
- GitHub Releases detection (trigger announcement workflow)
- Weekly digest fallback (if no daily activity)
- Teaser generation (short versions for Bluesky/Mastodon)
- Platform-specific formatting optimization
- Intelligent cadence (only post when meaningful activity)

**Addresses features:**
- GitHub-native digest generation (releases, not just commits)
- Intelligent cadence (daily/weekly fallback)
- Teaser generation for social (differentiator)

**Research flag:** STANDARD PATTERNS - Release detection via GitHub Events well-documented, teaser generation is string manipulation.

---

### Phase 5: Extensibility & Documentation
**Rationale:** With stable plugin system, enable community contributions. Plugin security must be carefully scoped (no sandboxing, trusted code only).

**Delivers:**
- Plugin development guide
- PlatformPlugin interface documentation
- Example plugin template
- Plugin testing harness
- Community platform registry (curated)

**Addresses features:**
- Plugin architecture (community extensibility)

**Avoids pitfalls:**
- Pitfall #7: Plugin sandboxing complexity (use trusted plugins only, document no arbitrary code execution)

**Research flag:** STANDARD PATTERNS - TypeScript plugin architectures well-documented (Fastify, Vite patterns).

---

### Phase Ordering Rationale

**Foundation-first approach:**
- Phase 1 builds all infrastructure (scheduling, approval, state) before touching external APIs
- Email deliverability and approval security are non-negotiable - must work before any platform integration
- Artifact-based state prevents vendor lock-in to external DB

**Single-platform validation:**
- Phase 2 proves plugin architecture with Patreon before committing to pattern
- OAuth token refresh is most complex in Patreon (scope accumulation), solve hardest problem first
- Ko-fi exclusion discovered in research informs platform selection

**Parallel expansion:**
- Phase 3 adds platforms in parallel (Ghost, Bluesky, Mastodon independent)
- Matrix strategy enables platform-specific rate limit handling
- Bluesky IP rate limit risk documented, not blocking (can deploy with warning)

**Intelligence deferred:**
- Phase 4 features (releases, teasers) are nice-to-have, not MVP blockers
- Weekly fallback prevents "going silent" but daily digest sufficient for v1
- Optimization comes after reliability proven

**Community plugins last:**
- Phase 5 deferred until plugin API stable
- No sandboxing means community plugins are trusted code (curated registry)
- Plugin system designed in Phase 2, opened to community in Phase 5

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 2 (Patreon integration):** Undocumented rate limits require testing, OAuth scope accumulation needs validation, patreon-api.ts is community library (not official) - needs reliability testing

- **Phase 3 (Bluesky integration):** IP-based rate limiting on GitHub Actions shared infrastructure is documented but mitigation strategy (self-hosted runner, dedicated IP) needs architecture decision and cost analysis

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Foundation):** GitHub Actions scheduled workflows, artifact state management, email approval patterns all have established implementations and documentation

- **Phase 4 (Intelligence):** GitHub Releases API well-documented, digest generation is string manipulation, no novel integration patterns

- **Phase 5 (Extensibility):** TypeScript plugin architecture patterns well-established (Fastify, Vite, VS Code extension models)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official GitHub Actions template, verified platform SDKs (Bluesky, Mastodon recent updates Jan 2026), Vercel/Resend widely deployed |
| Features | MEDIUM-HIGH | Verified against Buffer, Zapier, ConvertKit patterns, some assumptions about creator preferences (email-only interface) need validation |
| Architecture | MEDIUM | Artifact-based state and approval patterns verified, plugin security concerns well-researched (vm2 deprecation), async posting pattern standard for serverless |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls verified with official sources (GitHub Actions cron issues, Ko-fi API limitation, OAuth refresh requirements), some platform-specific issues need testing (Patreon rate limits, Bluesky IP limits) |

**Overall confidence:** MEDIUM-HIGH

Research is strongest on stack choices (official sources, recent 2026 updates) and critical blockers (Ko-fi limitation, scheduling unreliability). Moderate confidence on platform-specific integration details (rate limits, OAuth quirks) that need validation during implementation. Feature priorities based on analysis of similar tools but could benefit from early adopter validation.

### Gaps to Address

**Critical gaps requiring attention during implementation:**

- **Patreon API rate limits**: Not documented publicly. Must test incrementally and monitor for 429 responses, implement conservative rate limiting (assume 1 request/second until proven safe).

- **Bluesky IP rate limiting mitigation**: Research confirms IP-based limits affect GitHub Actions shared infrastructure. Decision needed: (1) document limitation and defer to Phase 4+, (2) recommend self-hosted runner (adds setup complexity), or (3) wait for Bluesky per-account limits (OAuth roadmap item, no ETA).

- **Ghost API rate limits**: Documentation vague on specific limits. Test with real Ghost instance during Phase 3, implement defensive rate limiting.

- **Email approval UX validation**: Assumption that "approve/skip" is sufficient needs validation with early adopters. If users demand "approve with edits," defer to v2 (adds web UI complexity).

- **Token expiration window**: 24-48 hour recommendation based on industry standards, but user behavior may require adjustment (too short frustrates busy users, too long increases security risk).

**Non-critical gaps for later optimization:**

- **Digest quality validation**: What makes a good GitHub activity digest? Commit-by-commit vs summary? Needs user feedback during Phase 4.

- **Teaser effectiveness**: What format drives clicks from Bluesky/Mastodon to full posts? Experimentation during Phase 4.

- **AWS Lambda Durable Functions availability**: Announced Dec 2025, global rollout Q2 2026. Could replace repository_dispatch pattern for async posting if available before Phase 2. Monitor for GA announcement.

## Sources

### Primary (HIGH confidence)

**Official Documentation:**
- [GitHub Actions TypeScript Template](https://github.com/actions/typescript-action) - Official setup, Rollup config, Node 20+ requirement
- [GitHub Actions Events Documentation](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows) - Scheduled workflow behavior, repository_dispatch
- [GitHub Actions Artifacts Documentation](https://docs.github.com/en/enterprise-server@3.12/actions/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow) - State management patterns
- [Bluesky API Documentation](https://docs.bsky.app/docs/get-started) - @atproto/api usage, rate limits
- [Bluesky Rate Limits](https://docs.bsky.app/docs/advanced-guides/rate-limits) - Point-based system (5K/hr, 35K/day)
- [Masto.js GitHub Repository](https://github.com/neet/masto.js/) - Version 7.10.1, Jan 2026 update
- [Ghost SDK Repository](https://github.com/TryGhost/SDK) - Official SDK tools, Admin API
- [Resend Node.js Documentation](https://resend.com/nodejs) - Official integration guide
- [Ko-fi API Documentation](https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook) - Confirms webhook-only, no posting API
- [Zendesk OAuth Requirements](https://support.zendesk.com/hc/en-us/articles/9182123625370) - Token refresh enforcement (industry pattern)
- [GitHub Webhook HMAC Verification](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) - Security pattern for approval links

**GitHub Community Issues:**
- [Scheduled Workflow Reliability Issues](https://github.com/orgs/community/discussions/134086) - Cron execution delays/failures
- [Secondary Rate Limits](https://github.com/orgs/community/discussions/28452) - Content-generating requests (80/min, 500/hr)
- [GitHub Actions Cache Rate Limit 2026](https://github.blog/changelog/2026-01-16-rate-limiting-for-actions-cache-entries/) - 200 uploads/minute limit

**Email Deliverability:**
- [Google Sender Guidelines](https://support.google.com/a/answer/81126?hl=en) - SPF/DKIM/DMARC requirements
- [Outlook High-Volume Sender Requirements](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730) - Modern auth by April 30, 2026

### Secondary (MEDIUM confidence)

**Platform Integrations:**
- [Patreon OAuth Scope Pitfall](https://www.patreondevelopers.com/t/simple-solutions-oauth-and-membership-data/4199) - Community-reported OAuth quirks
- [Patreon V2 API Discussion](https://www.patreondevelopers.com/t/what-are-folks-using-for-node-js-and-api-v2/4128) - patreon-api.ts validation
- [Mastodon API Guidelines](https://docs.joinmastodon.org/api/guidelines/) - Instance variations, ID handling

**Workflow Automation Patterns:**
- [Content Distribution Automation 2026 Guide](https://influenceflow.io/resources/content-distribution-automation-tool-the-complete-2026-guide/) - Industry patterns
- [Zapier vs IFTTT Comparison 2026](https://zapier.com/blog/zapier-vs-ifttt/) - Feature expectations
- [Buffer vs Hootsuite](https://buffer.com/resources/buffer-vs-hootsuite/) - Social media scheduler patterns

**Serverless Architecture:**
- [Serverless Functions Comparison 2026](https://research.aimultiple.com/serverless-functions/) - Vercel vs AWS vs Cloudflare
- [Cloudflare vs Vercel vs Netlify Performance](https://dev.to/dataformathub/cloudflare-vs-vercel-vs-netlify-the-truth-about-edge-performance-2026-50h0) - 2026 benchmarks
- [AWS Step Functions Manual Approval](https://aws.amazon.com/blogs/compute/implementing-serverless-manual-approval-steps-in-aws-step-functions-and-amazon-api-gateway/) - Approval workflow patterns

**Security Best Practices:**
- [Webhook Authentication - Svix](https://www.svix.com/resources/webhook-best-practices/authentication/) - HMAC signing patterns
- [GitHub Actions Secrets Best Practices](https://www.blacksmith.sh/blog/best-practices-for-managing-secrets-in-github-actions) - ::add-mask:: usage
- [OAuth 2.0 Refresh Tokens Guide](https://frontegg.com/blog/oauth-2-refresh-tokens) - Token refresh patterns

**Plugin Architecture:**
- [JavaScript Plugin Architecture with TypeScript](https://github.com/gr2m/javascript-plugin-architecture-with-typescript-definitions) - Interface patterns
- [Towards a Well-Typed Plugin Architecture](https://code.lol/post/programming/plugin-architecture/) - Type safety

### Tertiary (LOW confidence, needs validation)

**Testing & Performance:**
- [Vitest vs Jest Benchmarks](https://medium.com/engineering-playbook/jest-took-12-minutes-to-run-500-tests-vitest-took-8-seconds-860e7be3ffb6) - 86x speedup claim (anecdotal)
- [TypeScript Testing Frameworks 2026](https://dev.to/agent-tools-dev/choosing-a-typescript-testing-framework-jest-vs-vitest-vs-playwright-vs-cypress-2026-7j9) - Framework comparison

**Email Service Comparisons:**
- [Best Email APIs for Node.js 2026](https://mailtrap.io/blog/best-email-api-for-nodejs-developers/) - Resend vs Postmark vs SendGrid (marketing sources)
- [Postmark vs SendGrid Deliverability](https://www.courier.com/integrations/compare/postmark-vs-sendgrid) - Deliverability claims need validation

**Edge Cases & Gotchas:**
- [vm2 Security Issues 2026](https://semgrep.dev/blog/2026/calling-back-to-vm2-and-escaping-sandbox/) - Plugin sandboxing risks
- [Sandboxing NodeJS is Hard](https://pwnisher.gitlab.io/nodejs/sandbox/2019/02/21/sandboxing-nodejs-is-hard.html) - Fundamental limitations
- [Bluesky IP Rate Limit Discussion](https://github.com/bluesky-social/atproto/discussions/2160) - Community workarounds

---

**Research completed:** 2026-02-01
**Ready for roadmap:** Yes (with Ko-fi exclusion documented)

**BLOCKER IDENTIFIED:** Ko-fi has no posting API (webhook-only). Requirements must clarify Ko-fi scope or remove from platform list before roadmap creation.
