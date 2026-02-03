# Phase 5: Intelligence & Releases - Research

**Researched:** 2026-02-02
**Domain:** GitHub Releases API, Adaptive Scheduling, State Management
**Confidence:** HIGH

## Summary

Phase 5 adds two major capabilities: GitHub Releases detection for immediate announcements and intelligent cadence management for commit digests. The implementation leverages existing patterns in the codebase: @octokit/rest for API access, file-based state via artifacts, and GitHub Actions triggers.

GitHub Releases can be detected via two mechanisms: the `release` event trigger in GitHub Actions for immediate notification, or polling the REST API `/repos/{owner}/{repo}/releases` endpoint. Given the user decision that releases should trigger immediate approval emails (not wait for scheduled runs), a dedicated GitHub Actions workflow triggered by the `release` event is the correct approach.

Cadence logic requires tracking activity patterns in state. The existing `DigestState.lastRun` field provides a foundation, but additional fields are needed for quiet period detection and cadence preference storage.

**Primary recommendation:** Add a `release.yml` workflow triggered by GitHub's `release` event (types: `[published]`), with conditional filtering for pre-releases. Extend state schema to track `lastActivityDate`, `quietDayCount`, and user `cadencePreference`. Keep cadence logic in the generate-digest action with silent skips when no meaningful activity.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @octokit/rest | ^22.0.1 | GitHub API client | Already in project, typed, handles pagination |
| GitHub Actions | N/A | Workflow triggers | Native release event support |
| date-fns | ^4.1.0 | Date calculations | Already in project for time range logic |
| Zod | ^3.24.1 | Config validation | Already in project for schema validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @octokit/webhooks-types | latest | TypeScript types for webhooks | If needing strict webhook payload typing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| release event trigger | API polling in scheduled run | Polling has delay; event is immediate |
| File-based state | Database | File-based already working, no infra needed |

**Installation:**
```bash
# No new dependencies needed - all already in project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── github/
│   ├── fetcher.ts        # Existing commit fetcher
│   ├── releases.ts       # NEW: Release fetching
│   └── index.ts          # Re-exports
├── cadence/
│   ├── detector.ts       # NEW: Activity pattern detection
│   ├── types.ts          # NEW: Cadence types
│   └── index.ts          # Re-exports
├── actions/
│   ├── generate-digest.ts    # UPDATE: Add cadence logic
│   └── handle-release.ts     # NEW: Release announcement handler
└── types/
    ├── state.ts          # UPDATE: Add cadence fields
    └── config.ts         # UPDATE: Add cadence config
.github/workflows/
├── schedule-digest.yml   # UPDATE: Cadence-aware scheduling
└── handle-release.yml    # NEW: Release event trigger
```

### Pattern 1: GitHub Actions Release Event Trigger
**What:** Workflow triggered by release events, not polling
**When to use:** When immediate response to releases is needed
**Example:**
```yaml
# Source: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
name: Handle Release

on:
  release:
    types: [published]

jobs:
  announce-release:
    runs-on: ubuntu-latest
    # Skip pre-releases unless configured
    if: ${{ !github.event.release.prerelease || vars.INCLUDE_PRERELEASES == 'true' }}
    steps:
      - uses: actions/checkout@v4
      - name: Process release
        env:
          RELEASE_TAG: ${{ github.event.release.tag_name }}
          RELEASE_NAME: ${{ github.event.release.name }}
          RELEASE_BODY: ${{ github.event.release.body }}
          RELEASE_URL: ${{ github.event.release.html_url }}
          RELEASE_PRERELEASE: ${{ github.event.release.prerelease }}
          RELEASE_DRAFT: ${{ github.event.release.draft }}
        run: npm run handle-release
```

### Pattern 2: Release Object Access via github.event Context
**What:** Access release details from workflow trigger context
**When to use:** When release workflow needs release metadata
**Example:**
```typescript
// Source: GitHub Actions documentation - github.event context
interface ReleaseEventPayload {
  release: {
    id: number;
    tag_name: string;           // e.g., "v1.0.0"
    name: string | null;        // Release title
    body: string | null;        // Release notes (markdown)
    draft: boolean;
    prerelease: boolean;
    html_url: string;           // Browser URL to release
    published_at: string | null;
    assets: Array<{
      name: string;
      browser_download_url: string;
      size: number;
    }>;
  };
  repository: {
    full_name: string;
    html_url: string;
  };
}

// Access in action via environment variables set from github.event
const releaseTag = process.env.RELEASE_TAG;
const releaseName = process.env.RELEASE_NAME;
const releaseBody = process.env.RELEASE_BODY;
const releaseUrl = process.env.RELEASE_URL;
const isPrerelease = process.env.RELEASE_PRERELEASE === 'true';
```

### Pattern 3: State Extension for Cadence Tracking
**What:** Extend DigestState with activity tracking fields
**When to use:** For quiet period detection and cadence decisions
**Example:**
```typescript
// Follows existing immutable state pattern in src/state/artifacts.ts
interface DigestState {
  posts: Record<string, PostState>;
  usedTokens: string[];
  lastRun: string;
  // NEW: Cadence tracking fields
  lastActivityDate?: string;      // Last date with meaningful activity
  consecutiveQuietDays?: number;  // Days since last activity
  cadenceMode?: 'daily' | 'weekly' | 'auto';  // User preference
}

// Immutable update function (follows existing pattern)
export function updateActivityTracking(
  state: DigestState,
  hasActivity: boolean
): DigestState {
  const today = new Date().toISOString().split('T')[0];

  if (hasActivity) {
    return {
      ...state,
      lastActivityDate: today,
      consecutiveQuietDays: 0,
    };
  }

  // No activity - increment quiet days
  const quietDays = (state.consecutiveQuietDays || 0) + 1;
  return {
    ...state,
    consecutiveQuietDays: quietDays,
  };
}
```

### Pattern 4: Cadence Decision Logic
**What:** Determine whether to generate daily, weekly, or skip
**When to use:** In generate-digest action before fetching commits
**Example:**
```typescript
// Follows existing filterByActivity pattern in src/github/aggregator.ts
interface CadenceDecision {
  action: 'generate' | 'skip';
  periodType: 'daily' | 'weekly';
  reason: string;
}

function decideCadence(
  state: DigestState,
  config: CadenceConfig
): CadenceDecision {
  const quietDays = state.consecutiveQuietDays || 0;
  const mode = state.cadenceMode || config.defaultMode || 'auto';

  // User forced daily
  if (mode === 'daily') {
    return { action: 'generate', periodType: 'daily', reason: 'User preference: daily' };
  }

  // User forced weekly - only generate on day 7
  if (mode === 'weekly') {
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === config.weeklyDay || quietDays >= 7) {
      return { action: 'generate', periodType: 'weekly', reason: 'Weekly schedule' };
    }
    return { action: 'skip', periodType: 'weekly', reason: 'Not weekly day yet' };
  }

  // Auto mode: daily with fallback to weekly
  // CONTEXT.md: "first activity after extended quiet period triggers immediate digest"
  const wasQuiet = quietDays >= config.quietPeriodDays;
  if (wasQuiet) {
    // After quiet period, try immediate generation regardless of day
    return { action: 'generate', periodType: 'daily', reason: 'Activity after quiet period' };
  }

  // Normal auto mode - let filterByActivity decide
  return { action: 'generate', periodType: 'daily', reason: 'Auto mode' };
}
```

### Anti-Patterns to Avoid
- **Polling releases in scheduled run:** Use event trigger instead - polling has 5+ minute delay
- **Storing release content in state:** Generate fresh content from release data each time
- **Complex weekly scheduling logic:** Let existing filterByActivity handle daily/weekly fallback
- **Hardcoding quiet period thresholds:** Make configurable via config file

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Release webhook parsing | Custom payload parser | github.event context + env vars | GitHub Actions provides structured access |
| Date/time calculations | Manual date math | date-fns (already installed) | Handles timezones, edge cases |
| State persistence | Custom storage | Existing artifacts pattern | Already working, tested |
| API pagination | Manual cursor handling | octokit.paginate() | Handles all pagination logic |

**Key insight:** The project already has proven patterns for state management, API access, and content generation. Phase 5 extends these patterns rather than introducing new infrastructure.

## Common Pitfalls

### Pitfall 1: GITHUB_TOKEN Cannot Trigger Other Workflows
**What goes wrong:** Release created with GITHUB_TOKEN won't trigger the release workflow
**Why it happens:** GitHub prevents infinite loops by design
**How to avoid:** Only relevant if programmatically creating releases; manual UI releases work fine
**Warning signs:** release workflow never runs despite releases being published

### Pitfall 2: Draft Releases Don't Trigger Events
**What goes wrong:** Workflow doesn't run when user creates a draft release
**Why it happens:** GitHub Actions doesn't trigger for draft release events by default
**How to avoid:** Use `types: [published]` which fires when draft becomes published
**Warning signs:** release workflow only runs for some releases

### Pitfall 3: Pre-release vs Release Confusion
**What goes wrong:** Workflow runs for both pre-releases and stable releases
**Why it happens:** `published` event fires for all releases including pre-releases
**How to avoid:** Check `github.event.release.prerelease` and filter conditionally
**Warning signs:** Users receive announcements for beta/alpha releases unexpectedly

### Pitfall 4: Scheduled Workflow Delays
**What goes wrong:** Scheduled digest runs 30+ minutes late
**Why it happens:** GitHub Actions scheduled workflows can be delayed during high load
**How to avoid:** Already mitigated - workflow uses offset from hour (37 minutes)
**Warning signs:** Inconsistent timing in workflow runs

### Pitfall 5: State Race Conditions
**What goes wrong:** Release and scheduled workflows run simultaneously, corrupt state
**Why it happens:** Both workflows download/upload same artifact
**How to avoid:** Use different state keys for releases vs digests, or serialize via concurrency group
**Warning signs:** Missing posts, duplicate notifications

### Pitfall 6: Quiet Period False Positives
**What goes wrong:** System thinks it's a quiet period but user just hasn't committed yet today
**Why it happens:** Checking quietDays at wrong time of day
**How to avoid:** Only increment quietDays once per day, at end of scheduled window
**Warning signs:** "Activity after quiet period" triggers every morning

## Code Examples

Verified patterns from official sources and existing codebase:

### Fetching Releases with @octokit/rest
```typescript
// Source: https://docs.github.com/en/rest/releases/releases
// Follows existing fetchRecentCommits pattern in src/github/fetcher.ts

import { Octokit } from '@octokit/rest';

interface Release {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export async function fetchLatestRelease(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<Release | null> {
  try {
    const { data } = await octokit.rest.repos.getLatestRelease({
      owner,
      repo,
    });
    return data;
  } catch (error) {
    // 404 means no releases exist
    if ((error as { status?: number }).status === 404) {
      return null;
    }
    throw error;
  }
}

export async function fetchRecentReleases(
  octokit: Octokit,
  owner: string,
  repo: string,
  limit: number = 10
): Promise<Release[]> {
  const { data } = await octokit.rest.repos.listReleases({
    owner,
    repo,
    per_page: limit,
  });
  return data;
}
```

### Release Announcement Content Structure
```typescript
// Follows existing PostState.digest pattern in src/types/state.ts

interface ReleaseAnnouncement {
  type: 'release';  // Distinguishes from 'digest'
  tagName: string;
  title: string;
  body: string;           // Release notes
  releaseUrl: string;
  downloadLinks: Array<{
    name: string;
    url: string;
  }>;
  isPrerelease: boolean;
  repoName: string;
}

interface PostState {
  id: string;
  contentHash: string;
  status: PostStatus;
  platforms: Record<string, PlatformPostState>;
  createdAt: string;
  approvedAt?: string;
  // Existing digest fields
  digest?: { ... };
  teaser?: { ... };
  // NEW: Release fields
  release?: ReleaseAnnouncement;
}
```

### Config Extension for Cadence
```typescript
// Follows existing ContentConfig pattern in src/types/config.ts

interface CadenceConfig {
  /** User's preferred cadence mode */
  mode: 'daily' | 'weekly' | 'auto';
  /** Day of week for weekly digests (0=Sunday, 1=Monday, etc) */
  weeklyDay?: number;
  /** Days of no activity before considered "quiet period" */
  quietPeriodDays?: number;
  /** Minimum commits to consider "meaningful activity" */
  activityThreshold?: number;
  /** Include pre-releases in announcements */
  includePrereleases?: boolean;
}

// Zod schema
export const cadenceConfigSchema = z.object({
  mode: z.enum(['daily', 'weekly', 'auto']).default('auto'),
  weeklyDay: z.number().int().min(0).max(6).default(1), // Monday
  quietPeriodDays: z.number().int().min(1).default(3),
  activityThreshold: z.number().int().min(1).default(1),
  includePrereleases: z.boolean().default(false),
});
```

### GitHub Actions Workflow for Releases
```yaml
# Source: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
# File: .github/workflows/handle-release.yml

name: Handle Release

on:
  release:
    types: [published]

# Prevent concurrent runs that could corrupt state
concurrency:
  group: release-${{ github.repository }}
  cancel-in-progress: false

jobs:
  announce-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js 24
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Download current state
        uses: actions/download-artifact@v6
        with:
          name: digest-state
          path: .state
        continue-on-error: true

      - name: Process release
        env:
          # Release details from github.event context
          RELEASE_ID: ${{ github.event.release.id }}
          RELEASE_TAG: ${{ github.event.release.tag_name }}
          RELEASE_NAME: ${{ github.event.release.name }}
          RELEASE_BODY: ${{ github.event.release.body }}
          RELEASE_URL: ${{ github.event.release.html_url }}
          RELEASE_PRERELEASE: ${{ github.event.release.prerelease }}
          RELEASE_DRAFT: ${{ github.event.release.draft }}
          # Repository context
          REPO_FULL_NAME: ${{ github.repository }}
          # Existing secrets
          EMAIL_API_KEY: ${{ secrets.EMAIL_API_KEY }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          APPROVAL_SECRET: ${{ secrets.APPROVAL_SECRET }}
          APPROVAL_ENDPOINT_URL: ${{ secrets.APPROVAL_ENDPOINT_URL }}
          # Pre-release config (optional)
          INCLUDE_PRERELEASES: ${{ vars.INCLUDE_PRERELEASES || 'false' }}
        run: npm run handle-release

      - name: Upload updated state
        uses: actions/upload-artifact@v6
        with:
          name: digest-state
          path: .state/digest.json
          retention-days: 90
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling releases | Event-driven triggers | Always best | Immediate response, no delay |
| Manual cron timing | Offset from hour start | 2020+ | Reduces GitHub Actions delays |
| Single workflow multiple triggers | Separate focused workflows | Best practice | Clearer separation of concerns |

**Deprecated/outdated:**
- `actions/create-release`: Archived, use softprops/action-gh-release if creating releases
- `@actions/artifact v5`: Use v6 for Node.js 24 compatibility (already done in project)

## Open Questions

Things that couldn't be fully resolved:

1. **Meaningful Activity Threshold**
   - What we know: User decision says "Claude decides" on 1+ commits vs N commits
   - What's unclear: Optimal default threshold
   - Recommendation: Default to 1 (any human commit is meaningful), make configurable

2. **Quiet Period Duration**
   - What we know: System should fall back to weekly when daily is quiet
   - What's unclear: After how many quiet days to switch
   - Recommendation: Default to 3 days (if no activity for 3 days, switch to weekly mode)

3. **Release and Digest Timing Collision**
   - What we know: Both can run concurrently and access same state
   - What's unclear: Whether concurrency groups are sufficient
   - Recommendation: Use concurrency groups, consider separate release state file if issues arise

4. **Activity Resumption Detection**
   - What we know: CONTEXT.md says "first activity after extended quiet period triggers immediate digest"
   - What's unclear: How to detect "first activity" since we only run on schedule
   - Recommendation: Track quiet days in state; when quiet days >= threshold AND activity found, that's resumption

## Sources

### Primary (HIGH confidence)
- [GitHub REST API - Releases Documentation](https://docs.github.com/en/rest/releases/releases) - API endpoints, response schema
- [GitHub Actions - Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) - release event types, payload access
- [@octokit/rest npm](https://www.npmjs.com/package/@octokit/rest) - Node.js client usage
- Existing codebase files: src/state/artifacts.ts, src/github/aggregator.ts, src/types/state.ts

### Secondary (MEDIUM confidence)
- [GitHub Actions scheduling best practices](https://jasonet.co/posts/scheduled-actions/) - Offset timing, reliability patterns
- [GitHub community discussions](https://github.com/orgs/community/discussions/26281) - Pre-release vs release event filtering

### Tertiary (LOW confidence)
- General patterns from web search results - Cross-verified with official docs where possible

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing project dependencies, no new libraries needed
- Architecture: HIGH - Follows established patterns in codebase
- Pitfalls: HIGH - Documented in official GitHub docs and community discussions
- Cadence logic: MEDIUM - Implementation details are discretionary per CONTEXT.md

**Research date:** 2026-02-02
**Valid until:** 60 days (stable APIs, established patterns)
