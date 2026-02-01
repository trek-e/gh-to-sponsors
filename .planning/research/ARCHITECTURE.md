# Architecture Patterns

**Domain:** GitHub Action + Serverless Content Syndication
**Researched:** 2026-02-01
**Confidence:** MEDIUM (verified patterns, some domain-specific extrapolation)

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                   │
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │  Scheduler  │───▶│ Content Gen  │───▶│  Email Sender  │ │
│  │  (cron)     │    │   (digest)   │    │   (Resend)     │ │
│  └─────────────┘    └──────────────┘    └────────────────┘ │
│                                                   │           │
│  ┌─────────────┐    ┌──────────────┐            │           │
│  │  Release    │───▶│ Content Gen  │────────────┘           │
│  │  (trigger)  │    │(announcement)│                         │
│  └─────────────┘    └──────────────┘                         │
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │ Repo        │───▶│  Platform    │───▶│   Platform N   │ │
│  │ Dispatch    │    │  Plugin 1    │    │                │ │
│  │ (approval)  │    └──────────────┘    └────────────────┘ │
│  └─────────────┘                                             │
└───────────────────────────────────────────────────────────┬─┘
                                                             │
                    ┌────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │  Serverless Function      │
        │  (Vercel/Cloudflare)      │
        │                           │
        │  /approve?token=xyz       │
        │  /reject?token=xyz        │
        │                           │
        │  Validates token          │
        │  Triggers repo_dispatch   │
        └───────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │   State Storage           │
        │   (GitHub Artifacts)      │
        │                           │
        │   pending_posts.json      │
        │   posted_content.json     │
        └───────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Scheduler** | Trigger workflow on cron schedule (daily/weekly) | Content Generator |
| **Release Trigger** | Trigger workflow on GitHub release event | Content Generator |
| **Content Generator** | Create digest/announcement from GitHub activity | Email Sender, State Storage |
| **Email Sender** | Send draft with approve/reject links | Serverless Approval Endpoint |
| **Serverless Approval Endpoint** | Validate tokens, trigger approval workflow | GitHub API (repository_dispatch) |
| **Repository Dispatch Handler** | Execute approved action (post to platforms) | Platform Plugins |
| **Platform Plugins** | Post content to specific platforms (Patreon, Ko-fi, etc.) | External Platform APIs |
| **State Storage** | Track pending/posted content, prevent duplicates | All components (read/write) |

### Data Flow

**1. Digest Generation Flow**
```
Cron Schedule → GitHub Actions
  → Analyze commits (git log)
  → Generate digest content
  → Load state (artifacts from last run)
  → Check if content already posted
  → Generate approval token (HMAC-SHA256)
  → Save pending post to state
  → Send email with approve/reject links
  → Upload state artifact
```

**2. Approval Flow**
```
User clicks approve link → Serverless Function
  → Validate token (signature + expiry)
  → Trigger repository_dispatch event
    - event_type: "content_approved"
    - client_payload: { token, platform_targets }
  → Return success page
```

**3. Publishing Flow**
```
repository_dispatch → GitHub Actions
  → Download state artifact
  → Validate token in payload
  → Load pending post
  → For each platform plugin:
    - Authenticate with platform API
    - Transform content for platform
    - Post content
    - Record result
  → Update state (move to posted)
  → Upload state artifact
```

## Patterns to Follow

### Pattern 1: Token-Based Approval Links
**What:** Generate cryptographic tokens for one-time approval actions
**When:** Email-based approval workflows without persistent database
**Implementation:**
```typescript
// Generate approval token
function generateApprovalToken(postId: string, action: 'approve' | 'reject'): string {
  const payload = {
    postId,
    action,
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };

  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', process.env.APPROVAL_SECRET)
    .update(data)
    .digest('hex');

  return Buffer.from(JSON.stringify({ data, signature })).toString('base64url');
}

// Validate approval token
function validateApprovalToken(token: string): { postId: string; action: string } | null {
  const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());

  // Verify signature
  const expectedSig = crypto
    .createHmac('sha256', process.env.APPROVAL_SECRET)
    .update(decoded.data)
    .digest('hex');

  if (expectedSig !== decoded.signature) return null;

  const payload = JSON.parse(decoded.data);

  // Check expiry
  if (Date.now() > payload.expiresAt) return null;

  return { postId: payload.postId, action: payload.action };
}
```

**References:**
- [Webhook Authentication Best Practices - Svix](https://www.svix.com/resources/webhook-best-practices/authentication/)
- [Securing Webhook Endpoints - APIsec](https://www.apisec.ai/blog/securing-webhook-endpoints-best-practices)

### Pattern 2: Artifact-Based State Management
**What:** Use GitHub Actions artifacts as lightweight state persistence
**When:** Minimal state that doesn't justify external database
**Implementation:**
```typescript
// Save state at end of workflow
import * as artifact from '@actions/artifact';

const state = {
  pending: [
    { id: 'digest-2026-02-01', content: '...', created: Date.now() }
  ],
  posted: [
    { id: 'release-v1.2.3', platforms: ['patreon', 'kofi'], posted: Date.now() }
  ]
};

const artifactClient = artifact.create();
await artifactClient.uploadArtifact(
  'syndication-state',
  ['./state.json'],
  '.',
  { retentionDays: 90 }
);

// Load state at start of workflow
const downloadResponse = await artifactClient.downloadArtifact('syndication-state');
const state = JSON.parse(fs.readFileSync('./state.json', 'utf8'));
```

**Limitations:**
- 7-day default retention (configurable up to 90 days)
- Cannot update in-place (upload creates new version)
- Download requires artifacts from previous run to exist

**References:**
- [GitHub Actions Artifacts Documentation](https://docs.github.com/en/enterprise-server@3.12/actions/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow)
- [Caching and Artifacts Best Practices](https://innosufiyan.hashnode.dev/caching-and-artifacts-in-github-actions-speed-up-your-cicd-workflows)

### Pattern 3: Repository Dispatch for Cross-Workflow Communication
**What:** Trigger workflow from external source (serverless function)
**When:** Approval endpoint needs to trigger publishing workflow
**Implementation:**
```typescript
// In serverless function
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

await octokit.rest.repos.createDispatchEvent({
  owner: 'username',
  repo: 'repo-name',
  event_type: 'content_approved',
  client_payload: {
    token: validatedToken,
    postId: payload.postId,
    platforms: ['patreon', 'kofi', 'ghost']
  }
});

// In workflow file
on:
  repository_dispatch:
    types: [content_approved]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Publish to platforms
        run: |
          POST_ID="${{ github.event.client_payload.postId }}"
          # ... publishing logic
```

**Limitations:**
- Only triggers workflow on default branch
- Max 10 top-level properties in client_payload
- Max 65,535 characters total in payload

**References:**
- [GitHub Actions repository_dispatch Documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [Triggering GitHub Actions Using Repository Dispatches](https://dev.to/teamhive/triggering-github-actions-using-repository-dispatches-39d1)

### Pattern 4: Plugin Architecture with TypeScript Interfaces
**What:** Type-safe plugin system for platform integrations
**When:** Extensibility for community-contributed platforms
**Implementation:**
```typescript
// Core plugin interface
interface PlatformPlugin {
  name: string;
  authenticate(config: Record<string, string>): Promise<void>;
  post(content: PostContent): Promise<PostResult>;
  supports(feature: string): boolean;
}

interface PostContent {
  title?: string;
  body: string;
  teaser?: string; // For social media
  tags?: string[];
}

interface PostResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Plugin registration with type safety
class PluginRegistry {
  private plugins = new Map<string, PlatformPlugin>();

  register(plugin: PlatformPlugin) {
    this.plugins.set(plugin.name, plugin);
  }

  async post(platformName: string, content: PostContent): Promise<PostResult> {
    const plugin = this.plugins.get(platformName);
    if (!plugin) throw new Error(`Unknown platform: ${platformName}`);
    return plugin.post(content);
  }
}

// Example plugin implementation
class PatreonPlugin implements PlatformPlugin {
  name = 'patreon';
  private accessToken?: string;

  async authenticate(config: Record<string, string>): Promise<void> {
    this.accessToken = config.PATREON_ACCESS_TOKEN;
  }

  async post(content: PostContent): Promise<PostResult> {
    const response = await fetch('https://www.patreon.com/api/oauth2/v2/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          type: 'post',
          attributes: {
            title: content.title,
            content: content.body,
            is_public: false
          }
        }
      })
    });

    return {
      success: response.ok,
      url: response.ok ? (await response.json()).data.attributes.url : undefined,
      error: response.ok ? undefined : await response.text()
    };
  }

  supports(feature: string): boolean {
    return ['title', 'body', 'tags'].includes(feature);
  }
}
```

**References:**
- [TypeScript Plugin Architecture with Type Definitions](https://github.com/gr2m/javascript-plugin-architecture-with-typescript-definitions)
- [Towards a Well-Typed Plugin Architecture](https://code.lol/post/programming/plugin-architecture/)
- [Fastify Plugin Architecture](https://encore.dev/articles/best-typescript-backend-frameworks)

### Pattern 5: Event-Driven Orchestration
**What:** Use GitHub Actions workflow events to chain operations
**When:** Multiple independent operations need coordination
**Implementation:**
```yaml
# Main workflow: Generate and send
name: Daily Digest
on:
  schedule:
    - cron: '0 9 * * *'  # 9 AM daily

jobs:
  generate:
    runs-on: ubuntu-latest
    outputs:
      has_content: ${{ steps.check.outputs.has_content }}
    steps:
      - id: check
        run: echo "has_content=true" >> $GITHUB_OUTPUT
      - name: Generate digest
        run: npm run generate-digest
      - uses: actions/upload-artifact@v4
        with:
          name: pending-post
          path: pending.json

  send:
    needs: generate
    if: needs.generate.outputs.has_content == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: pending-post
      - name: Send email
        run: npm run send-approval-email

# Approval workflow: Triggered by serverless function
name: Publish Content
on:
  repository_dispatch:
    types: [content_approved]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: syndication-state
      - name: Publish to platforms
        env:
          POST_ID: ${{ github.event.client_payload.postId }}
        run: npm run publish
```

**References:**
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
- [Best Patterns: Building GitHub Actions Workflows](https://medium.com/@wtr/best-patterns-building-github-actions-workflows-6b03655223ca)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Long-Lived Secrets in Email Links
**What:** Including API keys or secrets directly in email approval links
**Why bad:** Email is insecure; links could be forwarded, logged, or intercepted
**Consequences:** Compromised credentials, unauthorized posting
**Instead:** Use short-lived signed tokens that expire and can only be used once

**Detection:** Review email template generation code for any `env.` references in URLs

### Anti-Pattern 2: Synchronous Multi-Platform Posting
**What:** Posting to platforms sequentially in a single job
**Why bad:** One slow/failing platform blocks others; long workflow execution time
**Consequences:** Timeouts, incomplete syndication, wasted compute minutes
**Instead:** Use matrix strategy to parallelize platform posting

```yaml
# Good: Parallel posting
jobs:
  publish:
    strategy:
      matrix:
        platform: [patreon, kofi, ghost, bluesky, mastodon]
      fail-fast: false  # Continue other platforms if one fails
    steps:
      - name: Post to ${{ matrix.platform }}
        run: npm run publish -- --platform=${{ matrix.platform }}
```

**References:**
- [GitHub Actions Pricing Changes 2026](https://resources.github.com/actions/2026-pricing-changes-for-github-actions)

### Anti-Pattern 3: Using GitHub Actions Cache for State
**What:** Storing syndication state in Actions cache instead of artifacts
**Why bad:** Cache is for dependencies, not application state; less reliable
**Consequences:** State loss when cache evicted (7 days max), race conditions
**Instead:** Use artifacts for application state, cache for dependencies (node_modules)

**Detection:** Look for `actions/cache@v3` with state/data files in paths

**References:**
- [What's the Difference Between Artifacts and Cache?](https://echobind.com/post/difference-between-artifacts-and-cache-in-GitHub-Actions)

### Anti-Pattern 4: Hardcoded Platform Configuration
**What:** Platform-specific code embedded in workflow files
**Why bad:** Adding platforms requires workflow changes, not plugin-friendly
**Consequences:** Can't support community plugins, maintenance nightmare
**Instead:** Load platform configuration from JSON, use plugin discovery

```typescript
// Good: Configuration-driven
const platforms = JSON.parse(fs.readFileSync('platforms.json', 'utf8'));
for (const platform of platforms.enabled) {
  const plugin = await import(`./plugins/${platform}.js`);
  await registry.register(plugin.default);
}
```

### Anti-Pattern 5: Email Approval Without Expiration
**What:** Approval tokens that never expire
**Why bad:** Old drafts could be approved days/weeks later
**Consequences:** Posting stale content, confusion
**Instead:** 7-day expiration on tokens, explicit "expired" response in serverless function

**Detection:** Check token generation code for expiry timestamp

## Scalability Considerations

| Concern | At 1 user | At 100 users | At 10K users |
|---------|-----------|--------------|--------------|
| **Workflow execution** | Personal account free tier (2,000 min/month) | Self-hosted runners or paid plan | Dedicated self-hosted runner pool |
| **State storage** | Artifacts (built-in) | Artifacts (built-in) | Consider external DB (DynamoDB/Firestore) |
| **Approval endpoint** | Vercel free tier | Vercel Pro or Cloudflare Workers | Cloudflare Workers (unlimited free tier) |
| **Email sending** | Resend free tier (100/day) | Resend paid or SendGrid | SendGrid/Postmark with volume pricing |
| **Platform APIs** | Per-user credentials | Per-user credentials | Rate limiting coordination needed |

**Key scaling point:** Serverless approval endpoint is the first bottleneck. Recommendation:

- 1-100 users: Vercel Functions (free tier: 100GB-hrs/month)
- 100-1K users: Cloudflare Workers (10M requests/day free)
- 1K+ users: Cloudflare Workers + Durable Objects for state

**References:**
- [Top Serverless Functions: Vercel vs Azure vs AWS in 2026](https://research.aimultiple.com/serverless-functions/)
- [Cloudflare Workers for Edge API Authentication](https://flareapp.io/blog/leveraging-cloudflare-workers-for-edge-api-authentication)

## Build Order Recommendations

Based on component dependencies, recommended build order:

### Phase 1: Foundation
1. **State management** (artifacts read/write utilities)
2. **Content generator** (digest from git log)
3. **Local testing harness** (mock GitHub Actions environment)

*Rationale:* State and content are core primitives. Can't test email or approval without content to work with.

### Phase 2: Approval Loop
4. **Email sender** (Resend integration, template rendering)
5. **Serverless approval endpoint** (token validation, repository_dispatch)
6. **Repository dispatch handler** (workflow triggered by approval)

*Rationale:* Approval loop must work end-to-end before adding platforms. Can mock publishing initially.

### Phase 3: Platform Integration
7. **Plugin architecture** (interface, registry, discovery)
8. **First platform plugin** (Patreon or Ko-fi)
9. **Additional platforms** (parallel development possible)

*Rationale:* Plugin system proven with one platform before scaling to many.

### Phase 4: Optimization
10. **Parallel posting** (matrix strategy)
11. **Error handling and retry** (platform failures)
12. **Monitoring and logging** (workflow insights)

*Rationale:* Reliability features added after core functionality proven.

## Deployment Architecture Options

### Option A: Vercel (Recommended for MVP)
```
GitHub Actions → Vercel Functions → GitHub API
```

**Pros:**
- Zero-config deployment from GitHub
- Built-in environment variable management
- OIDC federation for secure credentials
- Good free tier

**Cons:**
- Cold starts on free tier
- 60s timeout on Hobby plan
- Less generous than Cloudflare Workers at scale

**References:**
- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [Securing a Serverless API on Vercel using JWTs](https://curity.io/resources/learn/serverless-zero-trust-api-on-vercel/)

### Option B: Cloudflare Workers (Recommended for Scale)
```
GitHub Actions → Cloudflare Workers → GitHub API
```

**Pros:**
- 10M requests/day free tier
- Sub-millisecond cold starts
- Workers KV for state (better than artifacts at scale)
- OAuth provider library available

**Cons:**
- Requires separate deployment setup
- Edge runtime constraints (no Node.js API)
- More configuration complexity

**References:**
- [Cloudflare Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider)
- [OAuth 2.0 Authentication Server with Workers](https://blog.cloudflare.com/oauth-2-0-authentication-server/)

### Option C: AWS Lambda + API Gateway
```
GitHub Actions → API Gateway → Lambda → GitHub API
```

**Pros:**
- Mature serverless platform
- Step Functions for complex approval workflows
- Good monitoring/logging

**Cons:**
- More complex setup
- Higher cold starts
- Cost accumulates faster

**References:**
- [AWS Step Functions Manual Approval Pattern](https://aws.amazon.com/blogs/compute/implementing-serverless-manual-approval-steps-in-aws-step-functions-and-amazon-api-gateway/)

**Recommendation:** Start with Vercel (Option A) for simplicity, migrate to Cloudflare Workers (Option B) if/when scaling beyond 100 active users.

## State Management Trade-offs

### Artifacts (GitHub Actions built-in)

**Good for:**
- Single-user or small team use
- Minimal state (< 100 pending posts)
- No external dependencies
- Quick MVP

**Limitations:**
- 7-90 day retention only
- No atomic updates (race conditions possible)
- Tied to workflow runs
- Can't query/filter easily

### External Database (DynamoDB, Firestore, Supabase)

**Good for:**
- Multi-user SaaS
- Large state volumes
- Complex queries
- Long-term history

**Limitations:**
- Requires API credentials
- External dependency
- Cost considerations
- More complexity

**Recommendation for gh-to-sponsors:** Start with artifacts (matches "minimal infrastructure" constraint), provide migration path to external DB as opt-in for power users.

## Security Considerations

### Token Generation
- Use HMAC-SHA256 minimum (SHA-1 deprecated)
- Include timestamp for expiration
- Rotate secrets quarterly
- Store secrets in encrypted configuration (GitHub Secrets)

### Serverless Function
- Validate every parameter (postId, action, token)
- Use constant-time comparison to prevent timing attacks
- Rate limit by IP (Cloudflare automatic, Vercel needs middleware)
- Log approval attempts (successful and failed)

### Platform Credentials
- Store per-user in GitHub repository secrets
- Support organization-level secrets for teams
- Never log credentials or include in error messages
- Use read-only tokens where possible

### Email Links
- HTTPS only (enforced by serverless platforms)
- No credentials in query params
- Single-use tokens (mark as consumed in state)
- Explicit "expired" vs "invalid" messaging

**References:**
- [Webhook Authentication Best Practices](https://www.svix.com/resources/webhook-best-practices/authentication/)
- [Securing Webhook Endpoints](https://www.apisec.ai/blog/securing-webhook-endpoints-best-practices)

## Sources

**GitHub Actions Architecture:**
- [GitHub Actions Re-Architecture (2026)](https://github.blog/news-insights/product-news/lets-talk-about-github-actions/)
- [Best Patterns: Building GitHub Actions Workflows](https://medium.com/@wtr/best-patterns-building-github-actions-workflows-6b03655223ca)
- [Storing and Sharing Data from a Workflow](https://docs.github.com/en/enterprise-server@3.12/actions/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow)

**Serverless Approval Workflows:**
- [AWS Step Functions Manual Approval](https://aws.amazon.com/blogs/compute/implementing-serverless-manual-approval-steps-in-aws-step-functions-and-amazon-api-gateway/)
- [Serverless Architecture in 2026](https://middleware.io/blog/serverless-architecture/)

**Plugin Architecture:**
- [JavaScript Plugin Architecture with TypeScript](https://github.com/gr2m/javascript-plugin-architecture-with-typescript-definitions)
- [Towards a Well-Typed Plugin Architecture](https://code.lol/post/programming/plugin-architecture/)
- [Best TypeScript Backend Frameworks in 2026](https://encore.dev/articles/best-typescript-backend-frameworks)

**State Management:**
- [Artifacts vs Cache in GitHub Actions](https://echobind.com/post/difference-between-artifacts-and-cache-in-GitHub-Actions)
- [Caching and Artifacts Best Practices](https://innosufiyan.hashnode.dev/caching-and-artifacts-in-github-actions-speed-up-your-cicd-workflows)
- [Collaborative State Machines](https://collaborativestatemachines.github.io/)

**Authentication & Security:**
- [Webhook Authentication Best Practices - Svix](https://www.svix.com/resources/webhook-best-practices/authentication/)
- [Securing Webhook Endpoints - APIsec](https://www.apisec.ai/blog/securing-webhook-endpoints-best-practices)
- [Vercel JWT Security](https://curity.io/resources/learn/serverless-zero-trust-api-on-vercel/)
- [Cloudflare Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider)

**Multi-Platform Integration:**
- [10 Best Unified Social Media APIs (2026)](https://www.outstand.so/blog/best-unified-social-media-apis-for-devs)
- [Social Media API - Post to 13 Platforms](https://getlate.dev/)

**Repository Dispatch:**
- [GitHub Actions repository_dispatch Documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [Triggering GitHub Actions Using Repository Dispatches](https://dev.to/teamhive/triggering-github-actions-using-repository-dispatches-39d1)

**Content Syndication:**
- [Syndicate Elsewhere GitHub Action](https://github.com/marketplace/actions/syndicate-elsewhere)
- [GitHub Action for Syndication Links (Jan 2025)](https://fundor333.medium.com/github-action-for-syndication-links-33d3d2703708)
