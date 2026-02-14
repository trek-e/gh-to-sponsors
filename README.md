# gh-to-sponsors

A syndication tool for open source creators who use crowdfunding. Monitors GitHub activity, drafts digest updates and release announcements, and posts them to supporter platforms (Ghost) and social media (Bluesky, Mastodon) after email-based approval.

**Core value:** Creators approve one email and their supporters on every platform get updated.

## How It Works

```
1. GitHub Action runs daily (or on release)
2. System generates digest from your commits (AI-powered)
3. You receive an email with approve/skip links
4. Click approve → all platforms get updated
```

No manual copying. No platform-hopping. No friction.

## Supported Platforms

**Supporter Platforms:**
- Ghost (long-form digest posts)

**Social Platforms:**
- Bluesky (short teasers with link to full post)
- Mastodon (short teasers with link to full post)

**Explicitly Not Supported:**
- X/Twitter — platform enables fascism
- Meta (Facebook, Instagram, Threads) — same reasoning
- Ko-fi — no posting API exists

## Features

- **Daily/Weekly Digests** — AI-generated summaries of your GitHub commit activity
- **Release Announcements** — Automatic drafts when you publish a GitHub Release
- **Intelligent Scheduling** — Auto mode switches between daily and weekly based on activity
- **Multi-Platform Posting** — Ghost (full content), Bluesky + Mastodon (teasers with links)
- **Email Approval** — Review drafts from any device, approve with one click
- **Error Isolation** — One platform failing doesn't block the others
- **Retry Logic** — Exponential backoff for rate-limited APIs
- **Plugin System** — Extensible architecture for adding new platforms

## Quick Start

### Prerequisites

- Node.js >= 24.0.0
- Email provider account (Resend recommended, free tier: 3,000/month)
- GitHub repository
- Container serverless platform (Cloud Run, Fly.io, Railway) for approval endpoint

### 1. Clone and Configure

```bash
git clone https://github.com/trek-e/gh-to-sponsors.git
cd gh-to-sponsors
npm install
cp .env.example .env
```

### 2. Generate Approval Secret

```bash
openssl rand -base64 32
```

Add to your `.env` file along with other required values.

### 3. Create Configuration File

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

cadence:
  mode: auto       # daily, weekly, or auto
  weeklyDay: 1     # Monday (0=Sunday)
  quietPeriodDays: 3  # Switch to weekly after N quiet days

releases:
  enabled: true
  includePrereleases: false
  includeDrafts: false

github:
  repos:
    - owner: your-username
      repo: your-repo
```

### 4. Configure GitHub Secrets

Go to: Repository → Settings → Secrets → Actions

| Secret | Required | Description |
|--------|----------|-------------|
| `EMAIL_API_KEY` | Yes | Email provider API key |
| `EMAIL_FROM` | Yes | Verified sender email |
| `APPROVAL_SECRET` | Yes | Shared secret for token signing |
| `APPROVAL_ENDPOINT_URL` | Yes | Your container deployment URL |
| `NOTIFICATION_EMAIL` | Yes | Email to receive drafts |
| `ANTHROPIC_API_KEY` | Yes | For AI-powered content generation |
| `GHOST_API_URL` | If using Ghost | Ghost blog URL |
| `GHOST_ADMIN_API_KEY` | If using Ghost | Ghost Admin API key |
| `BLUESKY_IDENTIFIER` | If using Bluesky | e.g., `user.bsky.social` |
| `BLUESKY_APP_PASSWORD` | If using Bluesky | App password from Bluesky settings |
| `MASTODON_INSTANCE_URL` | If using Mastodon | e.g., `https://mastodon.social` |
| `MASTODON_ACCESS_TOKEN` | If using Mastodon | Access token from app creation |

### 5. Deploy Approval Endpoint

The approval endpoint runs as a serverless container — scales to zero when idle.

```bash
# Build the container
npm run docker:build

# Deploy to your platform of choice
# See deployment section below
```

### 6. Test

1. Go to Actions tab → "Daily Digest Check" → Run workflow
2. Check your email for approval link
3. Click approve
4. Verify posts appear on configured platforms

## Architecture

```
GitHub Actions (schedule-digest.yml)        GitHub Release Event
    ↓                                           ↓
Generate digest (AI) ──────────────── handle-release.yml
    ↓                                           ↓
Cadence check (daily/weekly/auto)    Generate release announcement
    ↓                                           ↓
Send approval email ←───────────────────────────┘
    ↓
Creator clicks approve link
    ↓
Serverless Container (/api/approve/:token)
    ↓
Verify token → Trigger repository_dispatch
    ↓
GitHub Actions (handle-approval.yml)
    ↓
Post to Ghost (full digest) → Get URL
    ↓
Post to Bluesky + Mastodon (teaser + Ghost URL)
    ↓
Update state → Send failure notifications if needed
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/approve/:token` | GET | Handle approval/skip clicks |
| `/api/status/:postId` | GET | View post status |

## Development

```bash
npm install          # Install dependencies
npm test             # Run tests (watch mode)
npm run test:run     # Run tests (CI mode)
npm run typecheck    # TypeScript check
npm run dev          # Run server locally (hot reload)
```

### Docker

```bash
npm run docker:build   # Build image
npm run docker:run     # Run container
npm run docker:up      # Start with docker-compose
npm run docker:down    # Stop containers
npm run docker:dev     # Development mode with hot reload
```

## Creating Plugins

gh-to-sponsors supports a plugin architecture for adding new platforms. See the [plugin documentation](docs/plugins/):

- [Tutorial: Your First Plugin](docs/plugins/tutorial-first-plugin.md) — Build a plugin from scratch
- [API Reference](docs/plugins/reference-api.md) — PlatformPlugin interface and types
- [How to Test Plugins](docs/plugins/howto-testing.md) — Testing with the compliance suite
- [Architecture Explanation](docs/plugins/explanation-architecture.md) — Why things work this way
- [Example Plugin Template](docs/examples/plugin-template/) — Copy-paste starting point
- [Community Submission](docs/plugins/community-submission.md) — How to contribute a plugin

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

### Cadence Modes

| Mode | Behavior |
|------|----------|
| `daily` | Send digest every day with activity |
| `weekly` | Send digest only on configured day |
| `auto` | Daily when active, switches to weekly after quiet period |

### Platform Configuration

Platforms are enabled by setting their environment variables. No env vars = platform skipped.

| Platform | Required Env Vars |
|----------|-------------------|
| Ghost | `GHOST_API_URL`, `GHOST_ADMIN_API_KEY` |
| Bluesky | `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD` |
| Mastodon | `MASTODON_INSTANCE_URL`, `MASTODON_ACCESS_TOKEN` |

Optional settings:
- `GHOST_DEFAULT_STATUS` — `draft` (default) or `published`
- `GHOST_DEFAULT_TAGS` — comma-separated (default: `devlog,opensource`)
- `BLUESKY_DEFAULT_LANG` — language tag (default: `en`)
- `MASTODON_VISIBILITY` — `public` (default), `unlisted`, or `private`
- `SOCIAL_LINK_TARGET` — `ghost` (default), `github`, or custom URL

## License

MIT

## Contributing

Contributions welcome! See the [plugin documentation](docs/plugins/) to add platform support.

This project explicitly refuses to add support for platforms that enable hate and fascism (X/Twitter, Meta platforms). PRs adding such integrations will be closed without discussion.
