# gh-to-sponsors

A syndication tool for open source creators who use crowdfunding. Monitors GitHub activity, drafts digest updates and release announcements, and posts them to supporter platforms after email-based approval.

**Core value:** Creators approve one email and their supporters on every platform get updated.

## How It Works

```
1. GitHub Action runs daily (or on release)
2. System generates digest from your commits
3. You receive an email with approve/skip links
4. Click approve → all platforms get updated
```

No manual copying. No platform-hopping. No friction.

## Supported Platforms

**Supporter Platforms:**
- Patreon (coming Phase 3)
- Ghost (coming Phase 4)

**Social Platforms:**
- Bluesky (coming Phase 4)
- Mastodon (coming Phase 4)

**Explicitly Not Supported:**
- X/Twitter — platform enables fascism
- Meta (Facebook, Instagram, Threads) — same reasoning
- Ko-fi — no posting API exists

## Current Status

**Phase 1: Foundation & Approval Loop** — Complete (pending deployment)

The approval loop infrastructure is built:
- Scheduled GitHub Action for digest generation
- Secure token-based approval links (HMAC-SHA256)
- Email provider abstraction (Resend, SES, SendGrid)
- Vercel serverless endpoint for handling approvals
- State persistence via GitHub artifacts

See [Deployment Guide](.planning/phases/01-foundation-approval-loop/01-07-SUMMARY.md) to deploy and verify.

## Quick Start

### Prerequisites

- Node.js 24+
- Vercel account (free tier works)
- Email provider account (Resend recommended, free tier: 3,000/month)
- GitHub repository

### 1. Clone and Install

```bash
git clone https://github.com/trek-e/gh-to-sponsors.git
cd gh-to-sponsors
npm install
```

### 2. Generate Approval Secret

```bash
openssl rand -base64 32
```

Save this value — you'll need it for both Vercel and GitHub.

### 3. Deploy to Vercel

```bash
vercel link
vercel env add APPROVAL_SECRET    # paste your secret
vercel env add GITHUB_TOKEN       # PAT with repo scope
vercel env add GITHUB_OWNER       # your username/org
vercel env add GITHUB_REPO        # repository name
vercel --prod
```

### 4. Configure GitHub Secrets

Go to: Repository → Settings → Secrets → Actions

Add these secrets:

| Secret | Value |
|--------|-------|
| `EMAIL_API_KEY` | Your email provider API key |
| `EMAIL_FROM` | Your verified sender email |
| `APPROVAL_SECRET` | Same secret from step 2 |
| `APPROVAL_ENDPOINT_URL` | Your Vercel URL (e.g., `https://gh-to-sponsors.vercel.app`) |

### 5. Create Configuration File

```yaml
# gh-to-sponsors.config.yaml
email:
  provider: resend  # or ses, sendgrid
  apiKey: ${EMAIL_API_KEY}
  fromEmail: ${EMAIL_FROM}

approval:
  expirationHours: 24
  autoAction: none

schedule:
  cronExpression: "37 9 * * *"  # 9:37 AM UTC daily

github:
  owner: your-username
  repo: gh-to-sponsors
```

Commit and push:

```bash
git add gh-to-sponsors.config.yaml
git commit -m "chore: add configuration"
git push
```

### 6. Test

1. Go to Actions tab → "Daily Digest Check" → Run workflow
2. Check your email for approval link
3. Click approve
4. Verify "Handle Approval" workflow runs

## Configuration

### Email Providers

**Resend** (recommended):
```yaml
email:
  provider: resend
  apiKey: ${EMAIL_API_KEY}
  fromEmail: noreply@yourdomain.com
```

**AWS SES**:
```yaml
email:
  provider: ses
  region: us-east-1
  fromEmail: noreply@yourdomain.com
```

**SendGrid**:
```yaml
email:
  provider: sendgrid
  apiKey: ${EMAIL_API_KEY}
  fromEmail: noreply@yourdomain.com
```

### Approval Settings

```yaml
approval:
  expirationHours: 24    # Link expires after 24 hours
  autoAction: none       # none | auto-approve | auto-skip
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Run locally (requires environment variables)
npm run generate-digest
```

## Architecture

```
GitHub Actions (schedule-digest.yml)
    ↓
Generate digest → Send approval email
    ↓
Creator clicks approve link
    ↓
Vercel Function (/api/approve/[token])
    ↓
Verify token → Trigger repository_dispatch
    ↓
GitHub Actions (handle-approval.yml)
    ↓
Update state → Post to platforms (Phase 3+)
```

## Roadmap

- [x] **Phase 1:** Foundation & Approval Loop
- [ ] **Phase 2:** Content Generation (GitHub activity monitoring)
- [ ] **Phase 3:** First Platform Integration (Patreon)
- [ ] **Phase 4:** Multi-Platform Expansion (Ghost, Bluesky, Mastodon)
- [ ] **Phase 5:** Intelligence & Releases (adaptive scheduling)
- [ ] **Phase 6:** Extensibility (plugin documentation)

## License

MIT

## Contributing

Contributions welcome! Please read the roadmap first to understand the project direction.

This project explicitly refuses to add support for platforms that enable hate and fascism (X/Twitter, Meta platforms). PRs adding such integrations will be closed without discussion.
