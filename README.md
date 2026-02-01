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
- **Containerized approval server** (Docker)
- State persistence via GitHub artifacts

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Email provider account (Resend recommended, free tier: 3,000/month)
- GitHub repository
- Container hosting (Fly.io, Railway, Cloud Run, or any Docker host)

### 1. Clone and Configure

```bash
git clone https://github.com/trek-e/gh-to-sponsors.git
cd gh-to-sponsors
cp .env.example .env
```

### 2. Generate Approval Secret

```bash
openssl rand -base64 32
```

Add to your `.env` file along with other required values.

### 3. Build and Run Locally

```bash
# Build the container
npm run docker:build

# Run with environment variables
npm run docker:run

# Or use docker compose
npm run docker:up
```

Test the health endpoint:
```bash
curl http://localhost:3000/health
```

### 4. Deploy Container

Deploy to your preferred container platform:

**Fly.io:**
```bash
fly launch
fly secrets set APPROVAL_SECRET=your-secret
fly secrets set GITHUB_TOKEN=your-token
fly secrets set GITHUB_OWNER=your-username
fly secrets set GITHUB_REPO=gh-to-sponsors
fly deploy
```

**Railway:**
```bash
railway init
railway up
# Set environment variables in Railway dashboard
```

**Google Cloud Run:**
```bash
gcloud run deploy gh-to-sponsors \
  --source . \
  --set-env-vars "APPROVAL_SECRET=...,GITHUB_TOKEN=...,GITHUB_OWNER=...,GITHUB_REPO=..."
```

Note your deployment URL (e.g., `https://gh-to-sponsors.fly.dev`)

### 5. Configure GitHub Secrets

Go to: Repository → Settings → Secrets → Actions

Add these secrets:

| Secret | Value |
|--------|-------|
| `EMAIL_API_KEY` | Your email provider API key |
| `EMAIL_FROM` | Your verified sender email |
| `APPROVAL_SECRET` | Same secret from step 2 |
| `APPROVAL_ENDPOINT_URL` | Your container deployment URL |

### 6. Create Configuration File

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

### 7. Test

1. Go to Actions tab → "Daily Digest Check" → Run workflow
2. Check your email for approval link
3. Click approve
4. Verify "Handle Approval" workflow runs

## Container Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `APPROVAL_SECRET` | Yes | Shared secret for token signing |
| `GITHUB_TOKEN` | Yes | PAT with repo scope |
| `GITHUB_OWNER` | Yes | GitHub username or org |
| `GITHUB_REPO` | Yes | Repository name |

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Run server locally (hot reload)
npm run dev

# Or with Docker
npm run docker:dev
```

### Docker Commands

```bash
npm run docker:build   # Build image
npm run docker:run     # Run container
npm run docker:up      # Start with docker-compose
npm run docker:down    # Stop containers
npm run docker:dev     # Development mode with hot reload
```

## Architecture

```
GitHub Actions (schedule-digest.yml)
    ↓
Generate digest → Send approval email
    ↓
Creator clicks approve link
    ↓
Container Server (GET /api/approve/:token)
    ↓
Verify token → Trigger repository_dispatch
    ↓
GitHub Actions (handle-approval.yml)
    ↓
Update state → Post to platforms (Phase 3+)
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/approve/:token` | GET | Handle approval/skip clicks |
| `/api/status/:postId` | GET | View post status |

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
