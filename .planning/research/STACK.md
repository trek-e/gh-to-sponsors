# Technology Stack

**Project:** gh-to-sponsors
**Researched:** 2026-02-01
**Confidence:** HIGH (verified with official sources and Context7)

## Executive Summary

This stack is optimized for a GitHub Action + serverless syndication tool with minimal infrastructure. TypeScript throughout for type safety, official SDKs for platform integrations, and modern tooling that targets 2026 standards. The chosen technologies prioritize developer experience, active maintenance, and zero-to-minimal server management.

## Recommended Stack

### Core Runtime & Language

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 20.x or later | JavaScript runtime for Actions and serverless | Standard for GitHub Actions (supports nodejs20.x, nodejs22.x, nodejs24.x on AWS Lambda), mature ecosystem, async-first architecture perfect for I/O-heavy tasks | HIGH |
| TypeScript | 5.5+ | Type-safe development | Zero-cost type safety, required by Zod 5.5+, excellent IDE support, prevents runtime errors from API contract mismatches | HIGH |

**Rationale:** Node.js 20.x is the minimum "reasonably modern version" per GitHub's official typescript-action template. TypeScript 5.5+ is the minimum tested version for Zod (our validation library) and provides modern features like const type parameters and better inference.

### GitHub Action Development

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @actions/core | latest | GitHub Actions toolkit - logging, inputs, outputs | Official GitHub library, provides async operation support, error handling via `core.setFailed()` | HIGH |
| @actions/github | latest | GitHub API access from Actions | Official GitHub library, provides authenticated Octokit instance, webhook payload types | HIGH |
| Rollup | latest | Bundle TypeScript + dependencies into single file | Required by GitHub Actions (must run `npm run bundle`), uses @rollup/plugin-typescript and @rollup/plugin-node-resolve | HIGH |

**Rationale:** Official GitHub Actions TypeScript template uses Rollup (not webpack or esbuild) to compile TypeScript and dependencies into a single distributable file. This is critical - "If you do not run this step, your action will not work correctly when it is used in a workflow."

**Alternative considered:** @vercel/ncc (popular in community) - Not chosen because official template uses Rollup, better ecosystem alignment.

### GitHub API Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Octokit | latest (via @actions/github) | GitHub REST/GraphQL API client | Official JavaScript SDK, automatic auth in Actions, 1.65M+ npm downloads, comprehensive API coverage | HIGH |
| @octokit/webhooks | latest | Parse webhook payloads (optional) | Official webhook toolset, TypeScript types for all webhook events, 100% test coverage | HIGH |

**Rationale:** Octokit is the standard. Within GitHub Actions, `@actions/github` provides authenticated Octokit instance automatically. For webhook parsing (if needed for serverless endpoint), `@octokit/webhooks` provides type-safe event handling.

### Serverless Platform

| Technology | Free Tier | Purpose | Why | Confidence |
|------------|-----------|---------|-----|------------|
| Vercel Functions | 100GB bandwidth, 100K invocations/mo | Serverless endpoint for email approval links | Best DX for TypeScript/Node.js, auto-detects /api directory, built-in environment variables, generous free tier, native TypeScript support | HIGH |
| **Alternative:** Netlify Functions | 100GB bandwidth, 125K function calls/mo | Same purpose | Deno runtime (Edge Functions), good JAMstack integration, comparable free tier | MEDIUM |
| **Alternative:** Cloudflare Workers | Free tier available | Same purpose | Fastest cold starts (<5ms), V8 isolates, but 128MB memory limit and execution time constraints may be limiting | MEDIUM |

**Recommendation:** Use Vercel Functions for gh-to-sponsors.

**Why Vercel:**
- TypeScript-first (no runtime/language restrictions like Cloudflare)
- Node.js native (vs Deno on Netlify Edge)
- Excellent DX (auto-deploy on git push, preview URLs)
- No infrastructure config needed
- Free tier sufficient for MVP

**When to reconsider:** If extreme performance (<5ms cold start) becomes critical, consider Cloudflare Workers. By 2026, major platforms are converging on V8-like edge runtimes, so this is increasingly about ecosystem fit rather than raw performance.

### Email Service (Transactional)

| Service | Pricing | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| Resend | $0 for 3K emails/mo, then $20/mo for 50K | Send draft approval emails | Modern API (2024+), React email support (Node.js SDK), excellent DX, async/await native, minimal config, 40MB attachments, scheduling, idempotency keys | HIGH |
| **Alternative:** Postmark | $15/10K emails, $1.80/1K after | Same purpose | Specialist in transactional email, best deliverability, separate infrastructure for different email types, 338K+ npm downloads | HIGH |
| **Alternative:** SendGrid | $19.95/50K emails | Same purpose | Largest ecosystem (1.65M npm downloads), transactional + marketing in one, but 61% deliverability (vs Postmark's superior rate), complex setup | MEDIUM |

**Recommendation:** Use Resend for gh-to-sponsors.

**Why Resend:**
- Generous free tier (3K emails/month sufficient for MVP)
- Modern API designed 2024+ (not legacy)
- React email support (if we want pretty templates later)
- Simple authentication (single API key)
- Excellent documentation
- Official Node.js SDK: `npm install resend`

**Why NOT SendGrid:** Lower deliverability (61%) and complex sender authentication setup. This is a transactional-only use case, no need for marketing features.

**Why NOT Postmark:** More expensive at scale ($15 minimum vs Resend's $0 free tier), though Postmark wins on deliverability. If approval emails start bouncing, switch to Postmark.

### Platform API Libraries

#### Bluesky

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| @atproto/api | latest | Official Bluesky/AT Protocol SDK | Official SDK, actively maintained, supports BskyAgent for auth, 300-char posts, rich text formatting | HIGH |

**Installation:** `npm install @atproto/api`

**Usage:**
```typescript
import { BskyAgent } from '@atproto/api'

const agent = new BskyAgent({ service: 'https://bsky.social' })
await agent.login({ identifier: 'handle.example.com', password: 'app-password' })
await agent.post({ text: 'Update text', createdAt: new Date().toISOString() })
```

#### Mastodon

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| masto.js | v7.10.1+ (Jan 2026) | Universal Mastodon API client | Actively maintained (updated Jan 6, 2026), TypeScript-native, 6KB gzipped, Node 20+, works across Node/browser/Deno, REST API + streaming | HIGH |
| **Alternative:** megalodon | latest | Fediverse client (Mastodon, Pleroma, Friendica, Firefish) | Multi-platform Fediverse support, useful if supporting other ActivityPub platforms later | MEDIUM |

**Recommendation:** Use masto.js for gh-to-sponsors.

**Why masto.js:**
- Latest release: January 6, 2026 (very current)
- TypeScript-first with modern syntax
- Lightweight (6KB minified+gzipped)
- Node.js 20+ and npm 9+ (matches our stack)
- Single-platform focus (we only need Mastodon for v1)

**Installation:** `npm install masto`

**Usage:**
```typescript
import { createRestAPIClient } from 'masto'

const client = createRestAPIClient({
  url: 'https://mastodon.social',
  accessToken: process.env.MASTODON_TOKEN,
})

await client.v1.statuses.create({ status: 'Update text' })
```

#### Patreon

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| patreon-api.ts | latest | TypeScript V2 Patreon API client | Official patreon-js doesn't support V2 API, this is TypeScript-native, zero dependencies, works on Node.js and edge platforms (Cloudflare, Vercel), ESM + CJS support | MEDIUM |
| **Alternative:** patreon (official) | latest | Official Patreon SDK | Official but V1 API only, uses JsonApiDataStore pattern, OAuth support | LOW |

**Recommendation:** Use patreon-api.ts for gh-to-sponsors.

**Why patreon-api.ts:**
- V2 API support (official library is V1 only)
- TypeScript-native (type safety for API contracts)
- Zero dependencies (smaller bundle)
- Edge runtime compatible (future-proofs for Cloudflare if needed)

**Confidence note:** MEDIUM because this is a community library (not official), but necessary since official SDK lacks V2 support. Monitor for official V2 SDK releases.

**Installation:** `npm install patreon-api.ts`

#### Ko-fi

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| Custom implementation | N/A | Receive Ko-fi webhook notifications | Ko-fi has webhook API but no official SDK - implement custom Express/Vercel handler to receive POST requests, verify verification token | LOW |

**Recommendation:** Build custom webhook handler for gh-to-sponsors.

**Why custom:**
- No official SDK exists
- Ko-fi provides webhook endpoint (POST to your server)
- Simple verification: check `process.env.KOFI_VERIFICATION_TOKEN` matches webhook data
- Community implementations exist (ko-fi-discord-webhook, kofi-discord-alerts) but are Discord-specific

**Implementation pattern:**
```typescript
// Vercel function: /api/kofi-webhook.ts
export default async function handler(req, res) {
  const { verification_token, message } = req.body
  if (verification_token !== process.env.KOFI_VERIFICATION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  // Process Ko-fi payment data
  // Note: Ko-fi is for receiving payments, not posting updates
  // This tool likely doesn't need Ko-fi integration - no posting API exists
}
```

**CRITICAL NOTE:** Ko-fi does NOT have a posting API. They have webhooks for receiving payment notifications, but creators cannot post updates via API. Consider removing Ko-fi from requirements or clarifying use case (webhook for payment notifications only).

#### Ghost CMS

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| @tryghost/content-api | 1.12.3+ | Official Ghost Content API client | Official SDK, actively maintained (updated 3 days ago as of search), supports both Content API (read) and Admin API (write) | HIGH |

**Installation:** `npm install @tryghost/content-api`

**Note:** For posting content (Admin API), use the Admin API client from the same @tryghost SDK repository. The Content API is read-only.

**Usage (Admin API for posting):**
```typescript
import GhostAdminAPI from '@tryghost/admin-api'

const api = new GhostAdminAPI({
  url: 'https://yourdomain.ghost.io',
  key: process.env.GHOST_ADMIN_KEY,
  version: 'v5.0'
})

await api.posts.add({
  title: 'Release Announcement',
  html: '<p>Content here</p>',
  status: 'published'
})
```

### Validation & Type Safety

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| Zod | 3.x (tested with TS 5.5+) | Runtime schema validation | TypeScript-first, zero dependencies, 2KB gzipped, automatic type inference (no duplicate declarations), thriving ecosystem, actively maintained (MCP server added recently) | HIGH |

**Recommendation:** Use Zod for all runtime validation.

**Why Zod:**
- Schema = type (declare once, infer type automatically)
- Perfect for validating webhook payloads, API responses, config files
- Composable schemas (build complex types from simple ones)
- Excellent error messages

**Installation:** `npm install zod`

**Usage pattern:**
```typescript
import { z } from 'zod'

const EmailApprovalSchema = z.object({
  token: z.string().uuid(),
  action: z.enum(['approve', 'skip']),
  digest_id: z.string(),
})

type EmailApproval = z.infer<typeof EmailApprovalSchema>

// Runtime validation
const result = EmailApprovalSchema.parse(req.body)
```

### Testing

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| Vitest | latest | Unit/integration testing | 10-20x faster than Jest (8 seconds vs 12 minutes in real benchmarks), native ESM (no Babel transforms), Jest-compatible API, GitHub Actions reporter built-in, Vite integration | HIGH |
| **Alternative:** Jest | latest | Unit/integration testing | Industry standard, 100% test coverage in official templates, but significantly slower (sequential Babel transforms), mature ecosystem | HIGH |

**Recommendation:** Use Vitest for gh-to-sponsors.

**Why Vitest:**
- Dramatically faster (86x speedup reported: 12min → 8sec for 500 tests)
- Native ESM (no transformation overhead)
- Jest-compatible API (easy migration if needed)
- Built-in GitHub Actions reporter (auto-enables when `GITHUB_ACTIONS === 'true'`)
- Modern tooling (2025+ standard)

**Why NOT Jest:** Slower (uses Babel to transform TypeScript/JSX sequentially). Official GitHub Actions template uses Jest, but that's for compatibility with older projects. Vitest is the 2026 choice for greenfield.

**GitHub Actions integration:** Automatic when `process.env.GITHUB_ACTIONS === 'true'`. Add explicit reporter if using non-default reporters.

**Installation:** `npm install -D vitest`

### Code Quality

| Tool | Version | Purpose | Why | Confidence |
|------|---------|---------|-----|------------|
| ESLint | latest | Linting | Standard linting, catches bugs before runtime, TypeScript-aware rules via @typescript-eslint | HIGH |
| Prettier | latest | Code formatting | Opinionated formatter, eliminates style debates, integrates with ESLint | HIGH |

**Installation:** `npm install -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin`

### Environment Variables

| Tool | Version | Purpose | Why | Confidence |
|------|---------|---------|-----|------------|
| GitHub Actions Secrets | N/A (platform feature) | Store API keys for Actions runtime | Native GitHub feature, accessed via `${{ secrets.SECRET_NAME }}`, no .env file needed in CI | HIGH |
| Vercel Environment Variables | N/A (platform feature) | Store API keys for serverless functions | Native Vercel feature, configured via dashboard or CLI, auto-injected at runtime | HIGH |
| dotenv (dev only) | latest | Local development .env support | Industry standard, only load in non-production (`if (process.env.NODE_ENV !== 'production') require('dotenv').config()`), never commit .env to git | HIGH |

**Recommendation:** Use native platform secrets (GitHub Secrets, Vercel env vars) for production. Use dotenv only for local development.

**Why:** Platform secrets are more secure (encrypted, audit logs, fine-grained access control). dotenv is for local convenience only.

**Installation:** `npm install -D dotenv`

**Pattern:**
```typescript
// Load dotenv only in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

// Access secrets same way in dev and prod
const apiKey = process.env.RESEND_API_KEY
```

### Plugin Architecture

| Pattern | Libraries | Purpose | Why | Confidence |
|---------|-----------|---------|-----|------------|
| TypeScript Interface + Factory | Native TypeScript | Platform plugin system | Simple, type-safe, no dependencies needed - define `PlatformPlugin` interface, implement for each platform (Bluesky, Mastodon, etc.), load plugins via array/registry | HIGH |

**Recommendation:** Use TypeScript interfaces for plugin architecture.

**Why simple interfaces:**
- No framework needed (architect, javascript-plugin-architecture, etc.)
- TypeScript enforces plugin contract at compile time
- Easy for community to extend (implement interface, export plugin)
- Modular pattern: each plugin is self-contained

**Pattern:**
```typescript
// plugins/types.ts
export interface PlatformPlugin {
  name: string
  version: string
  initialize(config: PlatformConfig): Promise<void>
  post(content: string, metadata?: Record<string, any>): Promise<PostResult>
}

// plugins/bluesky.ts
export class BlueskyPlugin implements PlatformPlugin {
  name = 'bluesky'
  version = '1.0.0'

  async initialize(config) { /* auth */ }
  async post(content, metadata) { /* post to Bluesky */ }
}

// main.ts
const plugins: PlatformPlugin[] = [
  new BlueskyPlugin(),
  new MastodonPlugin(),
  new GhostPlugin(),
]

for (const plugin of plugins) {
  await plugin.initialize(config)
  await plugin.post(digest)
}
```

**Why NOT plugin frameworks:** Overkill for this use case. Architect (c9) and similar are for large-scale applications with complex plugin lifecycles. This tool needs ~5 platform plugins with simple post() methods.

### Content Generation (Optional)

| Service | Pricing | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| OpenAI GPT-4o / GPT-5 | API pricing | Generate digest prose from commit messages | Latest models (GPT-5.2 with 400K context), mature API, excellent for summarization | MEDIUM |
| Anthropic Claude 4 | API pricing | Alternative for content generation | Sonnet 4 and Opus 4 available, 200K token window (1M beta), considered more reliable than GPT for some tasks | MEDIUM |
| None (template-based) | Free | Generate digests from templates | Simple string templates + commit data, no AI needed for v1, avoids API costs and latency | HIGH |

**Recommendation:** Start with template-based generation for gh-to-sponsors v1. Add LLM support as optional plugin later.

**Why templates first:**
- Zero cost
- Zero latency
- Predictable output
- Sufficient for "Here's what I shipped this week: [commit list]"

**When to add LLM:** If users request more polished prose or automatic categorization of commits. Make it optional (plugin) so users can choose template-based (free/fast) or LLM-enhanced (costs/slower).

**If adding LLM later:**
- Use LangChain.js or direct API calls
- OpenAI SDK: `npm install openai`
- Anthropic SDK: `npm install @anthropic-ai/sdk`
- Both have Node.js + TypeScript support

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Language | TypeScript | JavaScript | Lose type safety, harder to maintain API contracts across 5+ platforms |
| Runtime | Node.js 20+ | Deno | Less mature ecosystem for GitHub Actions, Vercel/Netlify use Node by default |
| Bundler | Rollup | @vercel/ncc | Official template uses Rollup, better ecosystem alignment |
| Serverless | Vercel Functions | Cloudflare Workers | 128MB memory limit, execution time constraints, language restrictions (no native Node.js) |
| Serverless | Vercel Functions | Netlify Functions | Deno runtime (Edge Functions) vs Node.js, preference for Node.js ecosystem |
| Email | Resend | Postmark | Higher cost ($15 vs $0 free tier), though Postmark has better deliverability |
| Email | Resend | SendGrid | Lower deliverability (61%), complex setup, overkill for transactional-only |
| Testing | Vitest | Jest | 10-20x slower (Babel transforms), though Jest is more mature |
| Mastodon | masto.js | megalodon | Multi-platform support unnecessary (only need Mastodon for v1) |
| Patreon | patreon-api.ts | patreon (official) | Official SDK is V1 API only, we need V2 |
| Validation | Zod | Joi | Joi is CommonJS, less TypeScript-native, no automatic type inference |
| Validation | Zod | Yup | Similar to Joi issues, Zod has better TypeScript inference |

## Installation

### Core Dependencies

```bash
# GitHub Action runtime
npm install @actions/core @actions/github

# GitHub API
npm install octokit

# Platform SDKs
npm install @atproto/api masto @tryghost/content-api patreon-api.ts

# Email service
npm install resend

# Validation
npm install zod

# Environment variables (dev only)
npm install -D dotenv
```

### Dev Dependencies

```bash
# TypeScript
npm install -D typescript @types/node

# Bundling
npm install -D rollup @rollup/plugin-typescript @rollup/plugin-node-resolve

# Testing
npm install -D vitest

# Code quality
npm install -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

## Configuration Files Needed

1. **tsconfig.json** - TypeScript compiler options (target ES2022, module ESNext, strict mode)
2. **rollup.config.js** - Bundle configuration for GitHub Action
3. **vitest.config.ts** - Test configuration with GitHub Actions reporter
4. **.eslintrc.js** - Linting rules (TypeScript preset)
5. **.prettierrc** - Formatting rules
6. **action.yml** - GitHub Action metadata (inputs, outputs, runs config)
7. **vercel.json** - Vercel serverless function config (optional, auto-detects /api)
8. **.env.example** - Template for required environment variables (never commit actual .env)

## Environment Variables Required

### GitHub Action (via GitHub Secrets)

```bash
# GitHub (provided automatically in Actions)
GITHUB_TOKEN # Auto-provided by Actions

# Email service
RESEND_API_KEY # From Resend dashboard

# Approval endpoint
APPROVAL_ENDPOINT_URL # Your Vercel function URL

# Platform credentials
BLUESKY_HANDLE # Your Bluesky handle
BLUESKY_PASSWORD # Bluesky app password
MASTODON_URL # https://mastodon.social or your instance
MASTODON_ACCESS_TOKEN # From Mastodon app settings
PATREON_ACCESS_TOKEN # From Patreon developer portal
GHOST_URL # https://yourblog.ghost.io
GHOST_ADMIN_KEY # From Ghost admin settings
```

### Vercel Function (via Vercel env vars)

```bash
# Approval verification
APPROVAL_SECRET # Shared secret for token signing

# Database or state store (if needed for tracking approvals)
# Could use Vercel KV, Upstash Redis, or simple in-memory for MVP
```

## Ko-fi Clarification

**IMPORTANT:** Ko-fi does NOT have a posting API. The Ko-fi integration mentioned in project requirements is not feasible as described. Options:

1. **Remove Ko-fi from platform list** - Ko-fi is for receiving payments, not posting updates
2. **Use Ko-fi webhook for payment notifications** - Track donations, trigger thank-you posts on other platforms
3. **Clarify requirement** - If goal is to post to Ko-fi supporter feed, this is not possible via API

**Recommendation:** Remove Ko-fi from posting platforms or clarify that Ko-fi webhook is for payment tracking only, not content posting.

## Version Policy

- **Node.js:** Use 20.x (current LTS), upgrade to 22.x when GitHub Actions and Vercel both support it well
- **TypeScript:** Use 5.5+ (required by Zod), stay current with latest stable
- **Platform SDKs:** Use `latest` and monitor changelogs (breaking changes rare for stable APIs)
- **Dev tools:** Use `latest` (ESLint, Prettier, Vitest) - breaking changes don't affect runtime

## Sources

### Official Documentation
- [GitHub Actions TypeScript Template](https://github.com/actions/typescript-action) - Official setup, Rollup config, Node 20+ requirement
- [Bluesky API Docs](https://docs.bsky.app/docs/get-started) - @atproto/api installation and usage
- [Masto.js GitHub](https://github.com/neet/masto.js/) - Version 7.10.1, Jan 2026 update
- [Ghost SDK Repository](https://github.com/TryGhost/SDK) - Official SDK tools
- [Resend Node.js Docs](https://resend.com/nodejs) - Official Node.js integration guide
- [Zod Documentation](https://zod.dev/) - TypeScript 5.5+ requirement, features

### API References
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email) - Features, limits, examples
- [Postmark Email API](https://postmarkapp.com/blog/best-email-api) - Deliverability, pricing comparison
- [Octokit GitHub](https://github.com/octokit/octokit.js) - Official SDK repository

### Comparisons & Benchmarks
- [Cloudflare vs Vercel vs Netlify 2026](https://dev.to/dataformathub/cloudflare-vs-vercel-vs-netlify-the-truth-about-edge-performance-2026-50h0) - Performance comparison
- [Serverless Functions 2026](https://research.aimultiple.com/serverless-functions/) - Vercel vs Azure vs AWS
- [Vitest vs Jest Benchmarks](https://medium.com/engineering-playbook/jest-took-12-minutes-to-run-500-tests-vitest-took-8-seconds-860e7be3ffb6) - 86x speedup
- [TypeScript Testing Frameworks 2026](https://dev.to/agent-tools-dev/choosing-a-typescript-testing-framework-jest-vs-vitest-vs-playwright-vs-cypress-2026-7j9) - Framework comparison
- [Transactional Email Services 2026](https://www.emailvendorselection.com/transactional-email-services/) - Email API comparison
- [Best Email APIs for Node.js 2026](https://mailtrap.io/blog/best-email-api-for-nodejs-developers/) - Node-specific recommendations

### Platform-Specific Research
- [Ko-fi API Documentation](https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook) - Webhook only, no posting API
- [Patreon API Discussion](https://www.patreondevelopers.com/t/what-are-folks-using-for-node-js-and-api-v2/4128) - V2 API support status
- [Node.js Plugin Architecture](https://www.n-school.com/plugin-based-architecture-in-node-js/) - Patterns and examples
- [LLM Updates January 2026](https://llm-stats.com/llm-updates) - Current model capabilities

### Community Resources
- [5 Best Email APIs 2026](https://mailtrap.io/blog/email-api-flexibility/) - Feature comparison
- [Serverless Framework TypeScript](https://www.serverless.com/plugins/serverless-plugin-typescript) - AWS Lambda patterns
- [GitHub Actions dotenv](https://www.dotenv.org/docs/languages/nodejs/github-actions) - CI/CD environment variables
