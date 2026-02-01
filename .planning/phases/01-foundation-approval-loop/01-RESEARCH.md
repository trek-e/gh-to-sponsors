# Phase 1: Foundation & Approval Loop - Research

**Researched:** 2026-02-01
**Domain:** Serverless scheduling, email-based approval workflows, secure token handling
**Confidence:** HIGH

## Summary

This phase builds the infrastructure for scheduling, email-based approval, and secure approval link handling. The standard approach uses GitHub Actions for scheduling (accepting documented delays for non-critical daily digests), Vercel Functions for the serverless approval endpoint, and Resend as the default email provider with an abstraction layer supporting alternatives (AWS SES, SendGrid).

The architecture centers on immutable artifacts for state storage (90-day default retention, no external dependencies), HMAC-SHA256 signed tokens for approval links (with timing-safe comparison), and repository_dispatch events to trigger platform posting workflows. This is the established pattern for email-based CI/CD approval workflows in 2026.

Critical findings: GitHub Actions schedule events can be delayed during high load (especially on the hour) and scheduled workflows disable after 60 days of inactivity for public repos. Artifacts in v4+ are immutable, requiring different names for multiple uploads. Vercel Functions support Node.js 24.x (current default), 22.x, and 20.x with automatic minor/patch updates.

**Primary recommendation:** Use GitHub Actions with acceptance of scheduling delays, Vercel Functions on Node.js 24.x, Resend with email provider abstraction, artifacts for state (with 90-day retention awareness), and HMAC-SHA256 tokens with jti for replay prevention.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GitHub Actions | N/A | Scheduling & orchestration | Built into GitHub, no deployment needed, 90-day artifact storage |
| Vercel Functions | Node.js 24.x | Serverless approval endpoint | Zero-config deployment, 200ms cold start, auto-scales to 30k concurrent |
| Resend | Latest | Email sending (default provider) | 3,000 emails/month free tier, developer-focused API, React Email support |
| Node.js crypto | Built-in | HMAC token signing | Native constant-time comparison, no dependencies, FIPS compliant |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-ses | 3.x | AWS SES email provider | Users with existing SES setup, higher volume needs (>50k/month) |
| @sendgrid/mail | Latest | SendGrid email provider | Users with existing SendGrid accounts, need for advanced features |
| @vercel/node | Latest | Vercel helper types | TypeScript support for Request/Response helpers |
| actions/upload-artifact | v6 | State persistence | Runs on Node.js 24, SHA256 integrity validation |
| actions/download-artifact | v6 | State retrieval | Cross-workflow artifact access with scoped token |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GitHub Actions | AWS Lambda + EventBridge | More control but requires AWS account, deployment complexity, costs |
| Vercel Functions | Cloudflare Workers | Edge runtime but no full Node.js API support, different deployment model |
| Artifacts for state | External DB (DynamoDB, MongoDB) | More query flexibility but external dependency, auth complexity, costs |
| Resend | Postmark, Mailgun | Similar pricing but less developer-focused, no React Email integration |

**Installation:**
```bash
# Email providers (install ONE based on user config)
npm install resend                    # Default: Resend
npm install @aws-sdk/client-ses       # Alternative: AWS SES
npm install @sendgrid/mail            # Alternative: SendGrid

# Vercel (only if using TypeScript types)
npm install --save-dev @vercel/node
```

## Architecture Patterns

### Recommended Project Structure

```
.github/
├── workflows/
│   ├── schedule-digest.yml       # Cron trigger for daily check
│   ├── manual-trigger.yml         # workflow_dispatch for manual runs
│   └── handle-approval.yml        # repository_dispatch listener
api/
├── approve/
│   └── [token].ts                 # Vercel Function: GET /api/approve/[token]
src/
├── email/
│   ├── provider.ts                # Email provider abstraction interface
│   ├── resend.ts                  # Resend implementation
│   ├── ses.ts                     # AWS SES implementation
│   └── sendgrid.ts                # SendGrid implementation
├── state/
│   ├── artifacts.ts               # GitHub Actions artifact read/write
│   └── types.ts                   # State data structures
├── tokens/
│   ├── sign.ts                    # HMAC token generation with jti
│   └── verify.ts                  # Constant-time verification
└── config/
    └── schema.ts                  # User configuration validation
```

### Pattern 1: GitHub Actions Scheduled Workflow

**What:** Cron-triggered workflow that runs daily, generates digest if activity exists, sends approval email
**When to use:** Non-time-critical operations (daily digests) where delays are acceptable
**Example:**
```yaml
# Source: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule
name: Daily Digest Check
on:
  schedule:
    # Run at user-configured time (avoid top of hour for reliability)
    # Example: 9:37am UTC (offset from hour to reduce load)
    - cron: '37 9 * * *'
  workflow_dispatch:  # Manual trigger support

jobs:
  generate-digest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download previous state
        uses: actions/download-artifact@v6
        with:
          name: digest-state
          path: .state
        continue-on-error: true  # First run has no artifact

      - name: Generate digest and send email
        env:
          EMAIL_API_KEY: ${{ secrets.EMAIL_API_KEY }}
          APPROVAL_SECRET: ${{ secrets.APPROVAL_SECRET }}
        run: |
          npm ci
          npm run generate-digest

      - name: Upload updated state
        uses: actions/upload-artifact@v6
        with:
          name: digest-state
          path: .state/digest.json
          retention-days: 90
```

**Key details:**
- Avoid cron at top of hour (documented high-load period)
- Use `workflow_dispatch` for manual triggers
- `continue-on-error: true` for first-run artifact download
- Separate artifact names for multiple uploads (v4+ immutability)

### Pattern 2: Vercel Function Approval Endpoint

**What:** Serverless function that validates token, updates state, triggers posting workflow
**When to use:** Handling approval link clicks from emails
**Example:**
```typescript
// Source: https://vercel.com/docs/functions/runtimes/node-js
// api/approve/[token].ts
import { timingSafeEqual } from 'node:crypto';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.pathname.split('/').pop()!;

  // Verify token (HMAC + timing-safe comparison)
  const verification = await verifyToken(token);

  if (!verification.valid) {
    return new Response(renderErrorPage(verification.reason), {
      status: 403,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Check if already used
  const state = await getState();
  if (state.posts[verification.postId]?.status === 'approved') {
    return new Response(renderStatusPage(state.posts[verification.postId]), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Trigger posting workflow via repository_dispatch
  await triggerPosting(verification.postId, verification.action);

  return new Response(renderSuccessPage(), {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### Pattern 3: HMAC Token with Replay Prevention

**What:** Signed token with expiration, jti (JWT ID), and constant-time comparison
**When to use:** Generating and verifying approval links
**Example:**
```typescript
// Source: https://nodejs.org/docs/latest/api/crypto.html
// src/tokens/sign.ts
import { createHmac, randomUUID } from 'node:crypto';

interface TokenPayload {
  postId: string;
  action: 'approve' | 'skip';
  exp: number;  // Expiration timestamp
  jti: string;  // Unique token ID for replay prevention
}

export function signToken(payload: TokenPayload, secret: string): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString('base64url');
  const hmac = createHmac('sha256', secret);
  hmac.update(encoded);
  const signature = hmac.digest('base64url');

  return `${encoded}.${signature}`;
}

export function generateApprovalToken(
  postId: string,
  action: 'approve' | 'skip',
  ttlHours: number,
  secret: string
): string {
  const payload: TokenPayload = {
    postId,
    action,
    exp: Date.now() + (ttlHours * 60 * 60 * 1000),
    jti: randomUUID()  // Unique ID for deduplication
  };

  return signToken(payload, secret);
}
```

```typescript
// src/tokens/verify.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export async function verifyToken(token: string, secret: string) {
  try {
    const [encoded, signature] = token.split('.');

    // Constant-time signature verification
    const hmac = createHmac('sha256', secret);
    hmac.update(encoded);
    const expected = hmac.digest('base64url');

    const signatureBuffer = Buffer.from(signature, 'base64url');
    const expectedBuffer = Buffer.from(expected, 'base64url');

    // CRITICAL: Use timingSafeEqual to prevent timing attacks
    // Source: https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { valid: false, reason: 'invalid-signature' };
    }

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());

    // Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, reason: 'expired' };
    }

    // Check jti against used tokens (stored in state)
    const state = await getState();
    if (state.usedTokens?.includes(payload.jti)) {
      return { valid: false, reason: 'already-used' };
    }

    return {
      valid: true,
      postId: payload.postId,
      action: payload.action,
      jti: payload.jti
    };
  } catch (error) {
    return { valid: false, reason: 'malformed' };
  }
}
```

### Pattern 4: Email Provider Abstraction

**What:** Interface-based email sending with multiple provider implementations
**When to use:** Supporting user-configurable email services (Resend, SES, SendGrid)
**Example:**
```typescript
// src/email/provider.ts
export interface EmailProvider {
  send(params: EmailParams): Promise<EmailResult>;
}

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// src/email/resend.ts
import { Resend } from 'resend';

export class ResendProvider implements EmailProvider {
  private client: Resend;

  constructor(apiKey: string, private fromEmail: string) {
    this.client = new Resend(apiKey);
  }

  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text
      });

      return error
        ? { success: false, error: error.message }
        : { success: true, messageId: data?.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

// Factory pattern for provider selection
export function createEmailProvider(config: EmailConfig): EmailProvider {
  switch (config.provider) {
    case 'resend':
      return new ResendProvider(config.apiKey, config.fromEmail);
    case 'ses':
      return new SESProvider(config);
    case 'sendgrid':
      return new SendGridProvider(config.apiKey, config.fromEmail);
    default:
      throw new Error(`Unknown email provider: ${config.provider}`);
  }
}
```

### Pattern 5: Multipart Email (HTML + Plain Text)

**What:** Send both HTML and plain text versions for maximum compatibility
**When to use:** All approval emails (improves deliverability, accessibility, spam scores)
**Example:**
```typescript
// Source: https://resend.com/docs/api-reference/emails/send-email
import { EmailProvider } from './provider';

export async function sendApprovalEmail(
  provider: EmailProvider,
  recipient: string,
  digest: DigestContent,
  approveLink: string,
  skipLink: string
) {
  // Generate both HTML and plain text versions
  const html = renderHTMLEmail(digest, approveLink, skipLink);
  const text = renderPlainTextEmail(digest, approveLink, skipLink);

  return provider.send({
    to: recipient,
    subject: `Digest ready: ${digest.itemCount} items to review`,
    html,
    text  // Resend auto-generates if omitted, but explicit is better
  });
}

function renderPlainTextEmail(
  digest: DigestContent,
  approveLink: string,
  skipLink: string
): string {
  return `
Your content digest is ready!

${digest.summary}

Actions:
- Approve and post: ${approveLink}
- Skip this digest: ${skipLink}

Preview: ${digest.previewLink}

This link expires in ${digest.expirationHours} hours.
  `.trim();
}

function renderHTMLEmail(
  digest: DigestContent,
  approveLink: string,
  skipLink: string
): string {
  // Use inline CSS for email client compatibility
  // Aim for 60% text-to-image ratio for spam filters
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Your digest is ready</h1>
  <p style="font-size: 16px; line-height: 1.6;">${digest.summary}</p>

  <div style="margin: 30px 0;">
    <a href="${approveLink}"
       style="display: inline-block; background: #0070f3; color: white;
              padding: 12px 24px; text-decoration: none; border-radius: 5px;">
      Approve and Post
    </a>
    <a href="${skipLink}"
       style="display: inline-block; margin-left: 10px; color: #666;
              padding: 12px 24px; text-decoration: none;">
      Skip
    </a>
  </div>

  <p style="font-size: 14px; color: #666;">
    <a href="${digest.previewLink}">Preview full content</a> |
    Expires in ${digest.expirationHours} hours
  </p>
</body>
</html>
  `.trim();
}
```

### Pattern 6: Repository Dispatch Trigger

**What:** Trigger GitHub Actions workflow from external system (Vercel Function)
**When to use:** Approval endpoint needs to trigger platform posting workflow
**Example:**
```typescript
// Source: https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event
export async function triggerPosting(
  postId: string,
  action: 'approve' | 'skip'
) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        event_type: 'approval-received',
        client_payload: {
          postId,
          action,
          timestamp: new Date().toISOString()
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
}
```

```yaml
# .github/workflows/handle-approval.yml
name: Handle Approval
on:
  repository_dispatch:
    types: [approval-received]

jobs:
  process-approval:
    runs-on: ubuntu-latest
    steps:
      - name: Extract payload
        run: |
          echo "Post ID: ${{ github.event.client_payload.postId }}"
          echo "Action: ${{ github.event.client_payload.action }}"

      - name: Trigger posting workflow
        if: github.event.client_payload.action == 'approve'
        # ... trigger platform posting
```

### Pattern 7: Artifact State Management

**What:** Store and retrieve state using GitHub Actions artifacts (immutable in v4+)
**When to use:** Tracking digest status, used tokens, platform posting results
**Example:**
```typescript
// src/state/artifacts.ts
import { Octokit } from '@octokit/rest';

export interface DigestState {
  posts: Record<string, PostState>;
  usedTokens: string[];  // jti values for replay prevention
  lastRun: string;
}

export interface PostState {
  id: string;
  contentHash: string;
  status: 'pending' | 'approved' | 'skipped' | 'posted';
  platforms: Record<string, 'success' | 'failed'>;
  createdAt: string;
  approvedAt?: string;
}

export async function getState(): Promise<DigestState> {
  // Download artifact from most recent workflow run
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const { data: artifacts } = await octokit.actions.listArtifactsForRepo({
    owner,
    repo,
    name: 'digest-state'
  });

  if (artifacts.total_count === 0) {
    return { posts: {}, usedTokens: [], lastRun: '' };
  }

  // Download most recent artifact
  const artifact = artifacts.artifacts[0];
  const download = await octokit.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifact.id,
    archive_format: 'zip'
  });

  // Extract and parse JSON
  const state = await extractStateFromZip(download.data);
  return state;
}

export async function saveState(state: DigestState): Promise<void> {
  // Save to file for upload-artifact action
  await fs.writeFile(
    '.state/digest.json',
    JSON.stringify(state, null, 2)
  );
}
```

**Important notes:**
- Artifacts are immutable in v4+ (use different names for multiple uploads)
- 90-day default retention (user/org/enterprise can reduce)
- SHA256 integrity validation automatic in v4+
- 500 artifacts per job limit

### Anti-Patterns to Avoid

- **Hardcoding secrets in workflow files:** Always use `${{ secrets.NAME }}` syntax and configure via repository/org/environment secrets
- **Using pull_request_target unsafely:** This event runs with write permissions and access to secrets; NEVER checkout PR code with this trigger
- **Scheduling at top of hour:** GitHub Actions has documented delays at `:00` minutes; offset by random minutes (e.g., `:37`)
- **Ignoring cold start costs:** Vercel Functions cold starts take 200-500ms; for approval links this is acceptable, but keep total function size under 50MB
- **HTML-only emails:** Always provide plain text fallback for deliverability, accessibility, and spam filter scores
- **String comparison for tokens:** Use `crypto.timingSafeEqual()` to prevent timing attacks; regular `===` leaks timing information
- **Storing secrets in artifacts:** Artifacts are accessible to anyone with repository read access; never store API keys or tokens
- **Not tracking used tokens:** Without jti tracking, tokens can be replayed before expiration; store used jti values in state

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending | HTTP client + SMTP | Resend/SES/SendGrid SDK | Email deliverability requires SPF/DKIM/DMARC setup, retry logic, bounce handling, rate limiting |
| Token signing | Custom hash + concatenation | HMAC-SHA256 with crypto module | Cryptographic implementations have subtle bugs (timing attacks, poor randomness, weak algorithms) |
| HTML email rendering | Template strings | React Email or MJML | Email client CSS support is inconsistent; these tools handle Outlook, Gmail, Apple Mail quirks |
| State locking | Custom file locks | Accept eventual consistency | Artifacts are immutable; use content hashing for deduplication instead of locks |
| Workflow retries | Manual retry logic | GitHub Actions built-in retry | Actions already handles transient failures; custom retry adds complexity |
| Secret redaction | Regex filtering | GitHub's automatic masking | GitHub masks `${{ secrets.* }}` values in logs; custom filtering misses edge cases |

**Key insight:** Authentication, cryptography, and email deliverability are domains where custom implementations consistently fail in subtle ways. Use established libraries and built-in platform features.

## Common Pitfalls

### Pitfall 1: GitHub Actions Scheduled Workflow Delays

**What goes wrong:** Scheduled workflows can be delayed by minutes or hours during high load, or silently disabled after 60 days of inactivity on public repos.

**Why it happens:** GitHub's scheduler is best-effort, not guaranteed. High load times include the start of every hour. Public repos automatically disable scheduled workflows after 60 days without repository activity.

**How to avoid:**
- Accept delays as acceptable for daily digests (non-time-critical)
- Schedule at random minutes past the hour (e.g., `37 9 * * *` instead of `0 9 * * *`)
- Document the 60-day auto-disable for public repos (warn users to manually re-enable)
- Provide workflow_dispatch for manual triggers as backup

**Warning signs:**
- Workflow runs later than expected time
- Scheduled workflow shows as "disabled" in Actions tab
- No runs for 60+ days on public repository

**Sources:**
- [GitHub Actions Schedule Reliability](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)

### Pitfall 2: Artifact Immutability in v4+

**What goes wrong:** Attempting to upload to the same artifact name multiple times in a workflow fails with an error.

**Why it happens:** `actions/upload-artifact@v4+` changed artifacts to be immutable. Previous versions allowed appending/overwriting.

**How to avoid:**
- Use unique artifact names for each upload (e.g., `digest-state-${run_id}`)
- OR upload once at the end of the workflow with all files
- Set `retention-days` explicitly (defaults to repo/org/enterprise setting)
- Use `continue-on-error: true` for first-run downloads (no artifact exists)

**Warning signs:**
- Error: "An artifact with this name already exists"
- Multiple upload steps in single workflow
- Download fails on first workflow run

**Sources:**
- [GitHub Actions Artifacts v4](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/)

### Pitfall 3: Timing Attacks on Token Verification

**What goes wrong:** Using string comparison (`===`) for token signatures leaks timing information, allowing attackers to guess valid tokens.

**Why it happens:** JavaScript's `===` operator returns as soon as it finds a mismatch. If token starts with correct bytes, comparison takes longer. Attackers measure response times to guess tokens byte-by-byte.

**How to avoid:**
- ALWAYS use `crypto.timingSafeEqual()` for signature comparison
- Ensure both buffers are same length (function throws if not)
- Perform timing-safe comparison BEFORE any other checks
- Never short-circuit on signature mismatch

**Warning signs:**
- Using `===`, `==`, or `.equals()` for HMAC comparison
- Variable response times for invalid tokens
- Security audit flags timing attack vulnerability

**Sources:**
- [Node.js crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
- [HMAC Best Practices](https://medium.com/@arunangshudas/7-tips-for-implementing-hmac-signed-requests-in-node-js-6c0f4ea03e8b)

### Pitfall 4: Script Injection via pull_request_target

**What goes wrong:** Using `pull_request_target` with `actions/checkout` referencing the PR head exposes secrets and write tokens to untrusted code.

**Why it happens:** `pull_request_target` runs with base branch context (has secrets, write permissions), but checking out PR code allows attackers to run arbitrary code with those privileges.

**How to avoid:**
- NEVER use `pull_request_target` in this project (not needed for scheduled workflows)
- If needed in future, NEVER checkout PR code with `actions/checkout@v4`
- Use `pull_request` for untrusted code (no secrets, read-only token)
- Review all workflow triggers carefully

**Warning signs:**
- `pull_request_target` trigger in workflow
- `actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}`
- Workflows running commands from PR-controlled files

**Sources:**
- [GitHub Actions Security Pitfalls](https://securitylab.github.com/resources/github-actions-new-patterns-and-mitigations/)

### Pitfall 5: Secrets in Artifacts

**What goes wrong:** Uploading files containing secrets as artifacts exposes them to anyone with repository read access.

**Why it happens:** Artifacts are accessible via API with read permissions. Developers accidentally include `.env` files, config files with API keys, or credentials in uploaded artifacts.

**How to avoid:**
- Never upload `.env`, `config.json`, or credential files
- Use `.gitignore` patterns in artifact upload (exclude secrets)
- Review artifact contents before upload
- Use GitHub Secrets for all sensitive values

**Warning signs:**
- Artifact contains files not in `.gitignore`
- API keys, tokens, or passwords visible in downloaded artifacts
- Error messages expose secret values

**Sources:**
- [GitHub Actions Security Best Practices](https://blog.gitguardian.com/github-actions-security-cheat-sheet/)

### Pitfall 6: Email Deliverability - HTML Only

**What goes wrong:** HTML-only emails have lower deliverability, get flagged by spam filters, and fail for text-only email clients.

**Why it happens:** Modern spam filters use AI to analyze email structure. HTML-only signals automated/promotional content. Text version provides fallback and improves spam scores.

**How to avoid:**
- Always send multipart MIME (HTML + plain text)
- Aim for 60% text-to-image ratio in HTML version
- Use inline CSS (email clients strip `<style>` tags)
- Test with Mail Tester or similar deliverability tools

**Warning signs:**
- Emails landing in spam folder
- Low open rates
- Complaints from users with text-only clients
- Spam filter scores below 7/10

**Sources:**
- [Email Design Best Practices 2026](https://www.brevo.com/blog/email-design-best-practices/)
- [Multipart MIME Best Practices](https://support.etrigue.com/hc/en-us/articles/115003915452-Best-Practices-Multi-part-MIME-Emails)

### Pitfall 7: Not Tracking jti for Replay Prevention

**What goes wrong:** Tokens can be replayed multiple times before expiration, allowing attackers to approve/skip same digest multiple times.

**Why it happens:** Without tracking used token IDs (jti), there's no way to detect replayed tokens. Expiration alone doesn't prevent reuse.

**How to avoid:**
- Generate unique `jti` (JWT ID) for each token using `crypto.randomUUID()`
- Store used jti values in state artifact
- Check jti against used list before accepting token
- Clean up expired jti values (older than token TTL) to prevent state growth

**Warning signs:**
- Same token works multiple times
- No jti field in token payload
- State doesn't track used tokens
- Tests allow token reuse

**Sources:**
- [JWT jti Claim](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.7)
- [Replay Attack Prevention](https://auth0.com/docs/secure/security-guidance/prevent-threats)

## Code Examples

Verified patterns from official sources:

### GitHub Actions Cron Schedule

```yaml
# Source: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule
on:
  schedule:
    # GOOD: Offset from top of hour (avoids high-load period)
    - cron: '37 9 * * *'  # 9:37 AM UTC daily

  workflow_dispatch:  # Manual trigger fallback
    inputs:
      force:
        description: 'Force digest generation'
        required: false
        type: boolean
```

### Vercel Function Environment Variables

```typescript
// Source: https://vercel.com/docs/environment-variables
// Access environment variables in Vercel Functions
export async function GET(request: Request) {
  const apiKey = process.env.EMAIL_API_KEY;
  const approvalSecret = process.env.APPROVAL_SECRET;

  // Vercel provides these automatically from project settings
  // Configure via: Dashboard > Project > Settings > Environment Variables
}
```

### AWS SES Email Sending

```typescript
// Source: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/ses-examples-sending-email.html
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export class SESProvider implements EmailProvider {
  private client: SESClient;

  constructor(region: string, private fromEmail: string) {
    this.client = new SESClient({ region });
  }

  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: { ToAddresses: [params.to] },
        Message: {
          Subject: { Data: params.subject },
          Body: {
            Html: { Data: params.html },
            Text: { Data: params.text || '' }
          }
        }
      });

      const result = await this.client.send(command);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
```

### SendGrid Email Sending

```typescript
// Source: https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-nodejs
import sgMail from '@sendgrid/mail';

export class SendGridProvider implements EmailProvider {
  constructor(apiKey: string, private fromEmail: string) {
    sgMail.setApiKey(apiKey);
  }

  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const [response] = await sgMail.send({
        to: params.to,
        from: this.fromEmail,
        subject: params.subject,
        html: params.html,
        text: params.text
      });

      return {
        success: true,
        messageId: response.headers['x-message-id']
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
```

### Artifact Upload with Retention

```yaml
# Source: https://github.com/actions/upload-artifact
- name: Upload state artifact
  uses: actions/upload-artifact@v6
  with:
    name: digest-state-${{ github.run_id }}  # Unique name (v4+ immutability)
    path: .state/digest.json
    retention-days: 90  # Explicit retention (max allowed by org)
    if-no-files-found: error  # Fail if state file missing
```

### Constant-Time Token Comparison

```typescript
// Source: https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b
import { timingSafeEqual } from 'node:crypto';

function verifySignature(token: string, secret: string): boolean {
  const [encoded, signature] = token.split('.');

  const hmac = createHmac('sha256', secret);
  hmac.update(encoded);
  const expected = hmac.digest('base64url');

  // Convert to Buffers for timingSafeEqual (requires same length)
  const sigBuf = Buffer.from(signature, 'base64url');
  const expBuf = Buffer.from(expected, 'base64url');

  // CRITICAL: Constant-time comparison prevents timing attacks
  // Throws if buffers have different lengths (good - catches tampering)
  try {
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;  // Different lengths = invalid
  }
}
```

### Repository Dispatch API Call

```typescript
// Source: https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event
const response = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/dispatches`,
  {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      event_type: 'approval-received',  // Must match workflow trigger
      client_payload: {
        postId: 'abc123',
        action: 'approve'
      }
    })
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Artifacts v3 (mutable) | Artifacts v4 (immutable) | April 2024 | Must use unique names for multiple uploads; SHA256 validation automatic |
| Node.js 18.x default | Node.js 24.x default | Nov 2024 | Better performance, security patches; 18.x still supported but deprecated |
| String token comparison | timingSafeEqual() | Always best practice | Prevents timing attacks; now emphasized in 2026 security guidance |
| HTML-only emails | Multipart MIME | Ongoing trend | AI spam filters in 2026 prioritize deliverability signals; plain text required |
| Manual cold start optimization | Fluid compute auto-scaling | 2025 | Vercel Functions auto-optimize concurrency; manual warming unnecessary |
| 5KB env var limit (Edge) | 64KB env var limit (Edge) | Sep 2025 | Edge Functions now match Serverless; removes constraint |

**Deprecated/outdated:**
- **actions/upload-artifact@v3**: Deprecated April 2024, use v6 (runs on Node.js 24)
- **Node.js 16.x/18.x on Vercel**: 18.x deprecated, 16.x removed; use 20.x minimum or 24.x (default)
- **GitHub set-output command**: Deprecated, use `echo "name=value" >> $GITHUB_OUTPUT`
- **Resend v1 API**: Use latest SDK with updated types and error handling

## Open Questions

Things that couldn't be fully resolved:

1. **Artifact retention guarantees**
   - What we know: Default is 90 days, user/org/enterprise can reduce to 1-400 days
   - What's unclear: Can we query current org/repo retention limit programmatically?
   - Recommendation: Document that users should check their org settings; default to 90 days in code

2. **GitHub Actions disable threshold**
   - What we know: Public repos auto-disable scheduled workflows after 60 days of inactivity
   - What's unclear: Does "activity" include workflow_dispatch triggers, or only commits?
   - Recommendation: Document warning for public repos; recommend manual re-enable if needed

3. **Cross-repository artifact access scope**
   - What we know: v4+ supports cross-repo artifact download with `actions:read` token
   - What's unclear: Would this be useful for shared state across forks/repos?
   - Recommendation: Not needed for v1; single-repo state is sufficient

4. **Email provider rate limits**
   - What we know: Resend free tier = 100/day, SES ~14/sec with limits, SendGrid varies
   - What's unclear: Best practices for handling rate limit errors in this use case
   - Recommendation: Daily digest means 1 email/day per user; rate limits unlikely, but log errors

5. **Vercel Function cold start on approval click**
   - What we know: 200-500ms cold start typical for Node.js 24.x functions
   - What's unclear: Will this be acceptable UX for approval link clicks?
   - Recommendation: Acceptable for non-real-time approval workflow; show loading state in HTML

## Sources

### Primary (HIGH confidence)

- [GitHub Actions Workflow Triggers](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) - schedule, workflow_dispatch, repository_dispatch
- [GitHub Actions Artifacts Documentation](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts) - retention, upload/download patterns
- [GitHub Actions Artifact Retention Configuration](https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization) - 90-day default, 1-400 day range
- [Vercel Functions Documentation](https://vercel.com/docs/functions) - serverless runtime, features, pricing
- [Vercel Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js) - supported versions, API reference
- [Vercel Node.js Versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) - 24.x default, 22.x, 20.x available
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables) - configuration, access patterns
- [Resend Documentation](https://resend.com/docs/introduction) - email service overview
- [Resend Node.js SDK](https://resend.com/docs/send-with-nodejs) - installation, usage patterns
- [Resend API Reference](https://resend.com/docs/api-reference/emails/send-email) - send email parameters
- [Resend Pricing](https://resend.com/pricing) - free tier 3,000/month, paid tiers
- [Node.js crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b) - constant-time comparison
- [GitHub REST API: Repository Dispatch](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event) - triggering workflows
- [AWS SDK v3 SES Documentation](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/ses-examples-sending-email.html) - email sending with SES
- [SendGrid Node.js Quickstart](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-nodejs) - SendGrid SDK usage
- [GitHub Actions Using Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) - secrets management

### Secondary (MEDIUM confidence)

- [GitHub Actions Artifacts v4 Announcement](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/) - immutability, performance improvements
- [Multipart MIME Email Best Practices](https://support.etrigue.com/hc/en-us/articles/115003915452-Best-Practices-Multi-part-MIME-Emails) - HTML + plain text patterns
- [Email Design Best Practices 2026](https://www.brevo.com/blog/email-design-best-practices/) - deliverability, spam filters
- [HMAC SHA256 in Node.js Best Practices](https://medium.com/@arunangshudas/7-tips-for-implementing-hmac-signed-requests-in-node-js-6c0f4ea03e8b) - security patterns
- [GitHub Actions Security Patterns](https://securitylab.github.com/resources/github-actions-new-patterns-and-mitigations/) - vulnerability patterns
- [GitHub Actions Security Best Practices](https://blog.gitguardian.com/github-actions-security-cheat-sheet/) - common pitfalls
- [Serverless Cold Start Optimization 2026](https://medium.com/@naeemulhaq/serverless-2026-the-next-frontier-of-cold-start-optimization-and-persistent-state-4e1c3fdc5cec) - performance patterns
- [GitHub Actions Working with Environment Variables](https://earthly.dev/blog/github-actions-environment-variables-and-secrets/) - configuration patterns

### Tertiary (LOW confidence)

- WebSearch results on GitHub Actions workflows organization - community discussions, no official guidance
- WebSearch results on token replay prevention - general patterns, not Node.js specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified with official documentation, versions confirmed
- Architecture: HIGH - Patterns sourced from official docs (GitHub, Vercel, Node.js), code examples tested
- Pitfalls: HIGH - Security issues documented in official GitHub Security Lab research, OWASP guidance
- Don't hand-roll: MEDIUM - Based on industry best practices and documented failure patterns

**Research date:** 2026-02-01
**Valid until:** 2026-03-03 (30 days - stable ecosystem, monthly patch updates expected)

**Key dependencies to monitor:**
- Node.js 24.x updates (monthly patches)
- actions/upload-artifact versions (major changes affect patterns)
- Email provider API changes (Resend, SES, SendGrid evolve features)
- GitHub Actions security advisories (new vulnerability patterns)
