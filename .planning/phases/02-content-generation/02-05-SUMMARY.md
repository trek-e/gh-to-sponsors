---
phase: 02-content-generation
plan: 05
status: complete
subsystem: actions
tags: [orchestration, integration, email]
dependency-graph:
  requires:
    - 02-03  # GitHub multi-repo aggregation
    - 02-04  # LLM content generation
  provides:
    - Full content generation pipeline in generate-digest action
    - Real digest/teaser content in approval emails
    - State storage for posting phase
  affects:
    - 03-platform-integrations  # Will read digest/teaser from state
tech-stack:
  patterns:
    - Pipeline integration (fetch -> filter -> generate -> email)
    - Graceful skip for no-activity periods
    - Content storage in state for deferred posting
key-files:
  modified:
    - src/actions/generate-digest.ts
    - src/email/templates.ts
    - src/types/state.ts
  created:
    - sponsors.yaml.example
decisions:
  - "Store digest/teaser in PostState (enables posting without regeneration)"
  - "Optional fields for backward compatibility with existing state"
  - "Show teaser in email preview (user can review before approving)"
metrics:
  duration: 2 minutes
  completed: 2026-02-02
---

# Phase 2 Plan 5: Content Generation Orchestration Summary

Wire GitHub fetching, activity filtering, and LLM generation into generate-digest action with real content in approval emails.

## What Was Built

### generate-digest.ts Integration

Replaced Phase 1 stub with complete content generation pipeline:

```typescript
// Fetch and aggregate commits from all configured repos
const repoGroups = await aggregateMultiRepoCommits(octokit, config.github.repos, 7);

// Filter by activity thresholds
const activity = filterByActivity(repoGroups, thresholds);

// Check if there's meaningful activity
if (!activity.hasActivity) {
  console.log('No meaningful activity found. Skipping digest generation.');
  await saveState({ ...state, lastRun: now.toISOString() });
  return;
}

// Generate content
const result = await generateContent(contexts, activity.periodType, anthropicApiKey);
```

### No-Activity Handling

Gracefully skips digest generation when no meaningful commits are found:
- Updates `lastRun` timestamp to prevent repeated checks
- Logs clear message explaining skip reason
- Does not create post or send email

### Email Preview Enhancement

Updated approval email templates to show teaser preview:

```html
<div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
  <strong>Social Teaser:</strong>
  <p>${teaser}</p>
  <p style="color: #6c757d;">${hashtags.join(' ')}</p>
</div>
```

Also shows:
- Commit count and repo names in header
- Period type (daily/weekly) in title

### State Storage for Posting Phase

Extended PostState to store generated content:

```typescript
interface PostState {
  // Existing fields...
  digest?: {
    title: string;
    content: string;
    repos: string[];
    commitCount: number;
    periodType: 'daily' | 'weekly';
    generatedAt: string;
  };
  teaser?: {
    text: string;
    hashtags: string[];
    characterCount: number;
  };
}
```

This enables Phase 3 platform integrations to post without regenerating content.

## Key Files

| File | Purpose |
|------|---------|
| `src/actions/generate-digest.ts` | Main action with full pipeline |
| `src/email/templates.ts` | Updated with teaser preview |
| `src/types/state.ts` | Extended PostState with content |
| `sponsors.yaml.example` | Example config with multi-repo format |

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API access for content generation |
| `GITHUB_TOKEN` | GitHub API access for commit fetching |
| `APPROVAL_SECRET` | Token signing for approval links |
| `APPROVAL_ENDPOINT_URL` | Base URL for Vercel function |
| `EMAIL_FROM` | Sender/recipient email address |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Store content in state | Posting phase can use stored content without regeneration |
| Optional digest/teaser fields | Backward compatible with existing state files |
| Teaser in email preview | User can review social content before approving |
| Content hash uses digest | Unique post ID based on actual generated content |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] `npx tsc --noEmit` passes
- [x] Action imports all required modules correctly
- [x] No-activity path logs message and exits cleanly
- [x] sponsors.yaml.example shows new repos array format
- [x] Email templates handle missing teaser gracefully
- [x] PostState includes optional digest/teaser fields

## Phase 2 Complete

With this plan, Phase 2 (Content Generation) is complete:

| Plan | Status | Description |
|------|--------|-------------|
| 02-01 | Complete | Content types and multi-repo config |
| 02-02 | Complete | Commit filtering and classification |
| 02-03 | Complete | Multi-repo aggregation and activity filtering |
| 02-04 | Complete | LLM integration with Claude |
| 02-05 | Complete | Pipeline orchestration in generate-digest |

## Next Phase Readiness

**Ready for Phase 3: Platform Integrations**

Prerequisites satisfied:
- Digest content available in PostState
- Teaser text ready for social platforms
- Hashtags array for platform-specific formatting
- Period type for context-aware messaging

Platform integrations will read from approved PostState and format for each platform.
