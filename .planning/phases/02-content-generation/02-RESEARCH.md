# Phase 2: Content Generation - Research

**Researched:** 2026-02-01
**Domain:** AI-powered content generation from GitHub commits
**Confidence:** HIGH

## Summary

Phase 2 requires building an AI-powered content generation system that transforms GitHub commit data into two formats: (1) narrative digests with conversational tone for supporter platforms, and (2) short social teasers under 300 characters. The research confirms that modern LLM APIs (specifically Anthropic's Claude via `@anthropic-ai/sdk`) paired with structured GitHub commit data from `@octokit/rest` is the standard approach for this domain in 2026.

The architecture follows a clear pattern: fetch and filter commits → structure data for AI context → generate content via LLM → format output as markdown. Critical challenges include rate limiting with exponential backoff, bot commit detection, commit classification for filtering, and validation of AI-generated content quality.

The project already uses `@octokit/rest` for GitHub API access, Zod for validation, and has an established folder structure (`src/actions/`, `src/types/`), making integration straightforward. Based on locked decisions from CONTEXT.md, the system must support multi-repo aggregation, conversational tone, bot filtering, and activity thresholds.

**Primary recommendation:** Use `@anthropic-ai/sdk` with Claude Sonnet 4.5 for text generation, `date-fns` for time-based filtering, and implement a structured data preparation layer that feeds clean commit context to the LLM with clear prompt engineering for digest vs. teaser generation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | Latest (active Jan 2026) | Claude API access for text generation | Official TypeScript SDK, full type safety, streaming support, production-ready for content generation tasks |
| @octokit/rest | 22.0.1+ (in use) | GitHub API for commit fetching | Official GitHub REST client, TypeScript support, handles pagination and rate limits |
| date-fns | 2.29.3+ | Date range filtering and manipulation | Pure functions, TypeScript-first, tree-shakeable, standard for date operations |
| zod | 3.24.1+ (in use) | Schema validation for LLM outputs | Already in project, can validate AI-generated structured data |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.19.2+ (in use) | TypeScript execution | Already in use for action scripts |
| yaml | 2.6.1+ (in use) | Config parsing | Already in use for configuration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @anthropic-ai/sdk | OpenAI SDK (`openai`) | OpenAI has newer Responses API (2025), but Claude excels at instruction-following and structured outputs for this use case |
| date-fns | Luxon or Day.js | date-fns is lighter, functional, and sufficient for time-range filtering needed here |
| Custom markdown builder | `ts-markdown` library | ts-markdown adds structure but simple string concatenation is sufficient for digest/teaser formatting |

**Installation:**
```bash
npm install @anthropic-ai/sdk date-fns
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── actions/
│   └── generate-digest.ts      # Entry point (already exists)
├── content/
│   ├── generator.ts            # AI content generation orchestrator
│   ├── prompts.ts              # Prompt templates for digest/teasers
│   ├── formatter.ts            # Markdown formatting utilities
│   └── validator.ts            # Content validation (length, quality)
├── github/
│   ├── fetcher.ts              # Commit fetching with pagination
│   ├── filter.ts               # Bot detection, commit classification
│   └── aggregator.ts           # Multi-repo grouping logic
├── types/
│   ├── content.ts              # Digest, Teaser, Commit types
│   └── index.ts                # (already exists)
└── config/
    └── schema.ts               # (already exists, extend for repos)
```

### Pattern 1: Data Preparation Pipeline
**What:** Transform raw GitHub commits into structured context for LLM prompts
**When to use:** Before any AI generation call
**Example:**
```typescript
// Structured data preparation for LLM context
interface CommitContext {
  repo: string;
  displayName: string;
  commits: Array<{
    sha: string;
    message: string;
    author: string;
    timestamp: string;
    url: string;
    type?: 'feat' | 'fix' | 'docs' | 'chore' | 'bot';
  }>;
  commitCount: number;
  timeRange: { start: string; end: string };
}

// Prepare clean, structured data
function prepareCommitContext(commits: GitHubCommit[]): CommitContext {
  return {
    repo: 'owner/repo',
    displayName: 'My Project',
    commits: commits.map(c => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0], // First line only
      author: c.commit.author.name,
      timestamp: c.commit.author.date,
      url: c.html_url,
      type: classifyCommit(c.commit.message),
    })),
    commitCount: commits.length,
    timeRange: { start: commits[0].commit.author.date, end: commits[commits.length - 1].commit.author.date },
  };
}
```

### Pattern 2: Prompt Engineering with Structured Context
**What:** Use JSON/YAML prompt styles with clear structure, not free-form text
**When to use:** When calling LLM for digest or teaser generation
**Example:**
```typescript
// Research shows JSON and YAML provide highest accuracy for structured data generation
function buildDigestPrompt(contexts: CommitContext[]): string {
  const contextYaml = contexts.map(ctx => `
Repo: ${ctx.displayName}
Commits: ${ctx.commitCount}
${ctx.commits.map(c => `  - [${c.type}] ${c.message} (${c.sha})`).join('\n')}
  `).join('\n---\n');

  return `You are writing a personal developer newsletter. Generate a conversational digest from these commits:

${contextYaml}

Requirements:
- Conversational tone: "This week I worked on..."
- Group by repository with clear sections
- Combine related commits into narrative paragraphs
- Include commit links for details
- Blog post style, not bullet points
- Meaningful summary, not raw commit messages

Format as Markdown with ## Repo headings.`;
}
```

### Pattern 3: Rate Limiting with Circuit Breaker
**What:** Exponential backoff with jitter for LLM API calls
**When to use:** All API calls to Anthropic/OpenAI
**Example:**
```typescript
// Source: Medium - Circuit Breaker for LLM with Retry and Backoff (TypeScript)
async function generateWithRetry(
  prompt: string,
  maxRetries = 3
): Promise<string> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        const jitter = Math.random() * 1000; // 0-1s random
        const delay = baseDelay + jitter;

        console.warn(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      } else {
        throw error;
      }
    }
  }

  throw new Error('Max retries exceeded');
}
```

### Pattern 4: Commit Classification for Filtering
**What:** Detect bot commits and classify by conventional commit type
**When to use:** After fetching commits, before generating content
**Example:**
```typescript
// Bot detection: check author username and email patterns
function isBotCommit(commit: GitHubCommit): boolean {
  const author = commit.commit.author.name.toLowerCase();
  const email = commit.commit.author.email.toLowerCase();

  // Bot patterns: [bot] suffix, noreply emails, known bot names
  const botPatterns = [
    /\[bot\]$/,
    /dependabot/,
    /renovate/,
    /github-actions/,
  ];

  return botPatterns.some(pattern =>
    pattern.test(author) || pattern.test(email)
  ) || email.includes('noreply.github.com');
}

// Conventional commits classification (feat, fix, docs, chore, etc.)
function classifyCommit(message: string): string {
  const firstLine = message.split('\n')[0].toLowerCase();

  // Research shows 11 common types in major open-source projects
  const types = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'ci', 'perf', 'style', 'build', 'revert'];

  for (const type of types) {
    if (firstLine.startsWith(`${type}:`) || firstLine.startsWith(`${type}(`)) {
      return type;
    }
  }

  return 'other';
}
```

### Pattern 5: Time-Based Activity Filtering
**What:** Filter commits by date range with fallback logic
**When to use:** Before content generation, to implement daily/weekly thresholds
**Example:**
```typescript
import { subDays, subWeeks, isWithinInterval, startOfDay } from 'date-fns';

interface ActivityPeriod {
  commits: GitHubCommit[];
  periodType: 'daily' | 'weekly' | 'none';
  hasActivity: boolean;
}

function filterByActivity(
  commits: GitHubCommit[],
  thresholds: { daily: number; weekly: number }
): ActivityPeriod {
  const now = new Date();
  const yesterday = startOfDay(subDays(now, 1));
  const lastWeek = startOfDay(subWeeks(now, 1));

  // Try daily first
  const dailyCommits = commits.filter(c =>
    new Date(c.commit.author.date) >= yesterday
  );

  if (dailyCommits.length >= thresholds.daily) {
    return { commits: dailyCommits, periodType: 'daily', hasActivity: true };
  }

  // Fallback to weekly
  const weeklyCommits = commits.filter(c =>
    new Date(c.commit.author.date) >= lastWeek
  );

  if (weeklyCommits.length >= thresholds.weekly) {
    return { commits: weeklyCommits, periodType: 'weekly', hasActivity: true };
  }

  // No activity
  return { commits: [], periodType: 'none', hasActivity: false };
}
```

### Anti-Patterns to Avoid
- **Sending raw commit messages to LLM:** Wastes tokens and produces low-quality output. Always structure data as JSON/YAML context.
- **Ignoring rate limits:** LLM APIs return 429 errors. Always implement exponential backoff, not simple retries.
- **Manual markdown string building:** Error-prone. Use template functions or builders for consistent formatting.
- **No validation of AI output:** LLMs can hallucinate or return malformed content. Always validate length, structure, and required sections.
- **Fetching all commit history:** Paginate carefully and filter by date first. Use `since` parameter in GitHub API to reduce data transfer.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range math & filtering | Custom date comparison logic | `date-fns` functions (`isWithinInterval`, `subDays`, `startOfDay`) | Edge cases with timezones, DST, month boundaries. date-fns is tested and handles all of them. |
| GitHub API pagination | Manual Link header parsing | `@octokit/rest` built-in pagination via `iterator()` or `paginate()` methods | GitHub uses SHA-based pagination for commits, not page numbers. Octokit handles this correctly. |
| LLM retry logic | Simple `while(attempts < 3)` loops | Exponential backoff with jitter pattern | Research shows jitter prevents thundering herd on retry. Simple loops retry too fast and get blocked. |
| Markdown escaping | Regex replace for special chars | Keep it simple with template literals, or use utility if complex | Markdown escaping is deceptively complex (nested lists, code blocks, links). For digests, template literals are sufficient. |
| Commit message parsing | Regex for conventional commits | Prefix matching with known types array | Research shows conventional commit classification is hard even for LLMs (76% F1 with fine-tuned models). Simple prefix matching is sufficient for filtering. |
| Hashtag generation | Keyword extraction algorithms | LLM-based generation (part of teaser prompt) | Modern approach is to let LLM generate contextual hashtags. Keyword extraction requires NLP libraries and produces generic results. |

**Key insight:** LLM integration looks simple (one API call) but production systems need rate limiting, structured prompts, validation, and error handling. GitHub commit data looks simple but bot detection, classification, and multi-repo aggregation have nuances. Use proven patterns.

## Common Pitfalls

### Pitfall 1: Token Cost Explosion
**What goes wrong:** Sending entire commit history or multiple API calls per digest generates thousands of tokens, making costs unsustainable.
**Why it happens:** GitHub repos can have hundreds of commits in a week. Each commit has metadata (author, timestamp, diff, files) that isn't needed for summaries.
**How to avoid:**
- Filter commits by date BEFORE fetching from GitHub (use `since` parameter)
- Strip unnecessary data (only keep message, author name, timestamp, URL)
- Aggregate related commits before sending to LLM (e.g., group by file or type)
- Use commit message first line only, not full multi-paragraph descriptions
**Warning signs:** Token counts over 1000 input tokens for a single digest, API bills growing faster than user base

### Pitfall 2: Bot Commit Noise
**What goes wrong:** Dependabot, Renovate, and GitHub Actions bots create dozens of commits that clutter digests and aren't interesting to supporters.
**Why it happens:** Bots are legitimate GitHub users. The API doesn't distinguish bot commits unless you check specific patterns.
**How to avoid:**
- Check for `[bot]` suffix in author name
- Check for `noreply.github.com` in email
- Check for known bot names (dependabot, renovate, github-actions)
- Summarize bot commits as one line: "Updated 5 dependencies"
- Don't exclude bots entirely — supporters care about maintenance
**Warning signs:** Digests dominated by "Bump X from 1.2.3 to 1.2.4" messages, loss of narrative flow

### Pitfall 3: Inconsistent Tone Across Repos
**What goes wrong:** Each repo gets a different writing style or formality level, making multi-repo digests feel disjointed.
**Why it happens:** LLMs adapt tone based on commit message style. Formal commits → formal summaries. Casual commits → casual summaries.
**How to avoid:**
- Use explicit tone instructions in prompt: "Write in conversational first-person: 'I worked on...'"
- Provide examples of desired tone in system message
- Generate all repo sections in a single LLM call (maintains consistency)
- Add "maintain consistent voice across all sections" to prompt
**Warning signs:** One repo sounds like technical docs, another like a blog post. Supporters notice tonal shifts.

### Pitfall 4: Empty Period Handling
**What goes wrong:** System generates empty digests or sends "No activity this week" emails when there's nothing to report.
**Why it happens:** Developers don't commit every day. Weekends, vacations, and planning phases have no visible GitHub activity.
**How to avoid:**
- Implement activity thresholds (daily: 1+ commit, weekly: 3+ commits)
- Fallback to longer period if shorter period has no activity (daily → weekly)
- Skip digest generation entirely if no activity meets threshold
- Store last successful digest date to avoid duplicate checking
**Warning signs:** Supporters receiving frequent "nothing to report" emails, unsubscribe rate increases during quiet periods

### Pitfall 5: LLM Hallucination in Summaries
**What goes wrong:** AI invents features, exaggerates changes, or misinterprets commit messages, leading to factually incorrect digests.
**Why it happens:** LLMs are trained to be helpful and creative. Given ambiguous commit messages, they "fill in the gaps" with plausible-sounding content.
**How to avoid:**
- Use grounding instructions: "Only describe changes explicitly stated in commit messages"
- Provide commit URLs in context so LLM knows details are verifiable
- Add validation step: check AI output doesn't mention repos/features not in input
- Use lower temperature (0.3-0.5) for factual summarization
- Include "Do not speculate or infer features not mentioned" in prompt
**Warning signs:** Supporters asking about features not actually implemented, commit links don't match summary claims

### Pitfall 6: Social Teaser Length Violations
**What goes wrong:** Generated teasers exceed 300 characters, get truncated by platforms, or cut off mid-sentence.
**Why it happens:** LLMs don't inherently understand character limits. "Under 300 characters" is a soft constraint, not a hard boundary.
**How to avoid:**
- Specify character limit in prompt: "Generate a teaser in EXACTLY 280 characters or less"
- Add validation: reject and regenerate if length > 300
- Request slightly shorter (280 chars) to leave room for added links/hashtags
- Use structured output schema with max length constraint (Zod validation)
**Warning signs:** Platform truncation showing "..." mid-sentence, missing hashtags because they were cut off

### Pitfall 7: Missing Commit Links
**What goes wrong:** Digests mention commits or PRs but don't include clickable links, frustrating supporters who want details.
**Why it happens:** LLM generates narrative text and doesn't automatically insert markdown links. Links are in context but not in output.
**How to avoid:**
- Explicitly instruct: "Include markdown links to commits using provided URLs"
- Provide commit URLs in structured format: `[abc123](https://github.com/...)`
- Validate output contains expected number of links (at least one per repo section)
- Consider post-processing to inject links if LLM omits them
**Warning signs:** User feedback asking "which commit?", supporters can't verify changes mentioned in digest

## Code Examples

Verified patterns from research sources:

### Fetching Commits with Pagination and Date Filtering
```typescript
// Source: @octokit/rest documentation + GitHub API best practices
import { Octokit } from '@octokit/rest';
import { subWeeks, startOfDay } from 'date-fns';

async function fetchRecentCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  daysBack: number
): Promise<Array<Octokit.ReposListCommitsResponseData>> {
  const since = startOfDay(subWeeks(new Date(), Math.ceil(daysBack / 7))).toISOString();

  // Use pagination iterator for large result sets
  const iterator = octokit.paginate.iterator(octokit.repos.listCommits, {
    owner,
    repo,
    since, // Filter at API level to reduce data transfer
    per_page: 100, // Max per page
  });

  const commits: any[] = [];

  for await (const response of iterator) {
    commits.push(...response.data);

    // Safety limit: stop after 500 commits even if more exist
    if (commits.length >= 500) {
      break;
    }
  }

  return commits;
}
```

### Generating Digest with Claude API
```typescript
// Source: Anthropic SDK GitHub repository
import Anthropic from '@anthropic-ai/sdk';

interface DigestResult {
  content: string;
  usage: { input_tokens: number; output_tokens: number };
}

async function generateDigest(
  contexts: CommitContext[],
  apiKey: string
): Promise<DigestResult> {
  const client = new Anthropic({ apiKey });

  const prompt = buildDigestPrompt(contexts); // From Pattern 2

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000, // Enough for multi-repo digest
    temperature: 0.4, // Lower for factual content
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract text content from response
  const content = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return {
    content,
    usage: message.usage,
  };
}
```

### Generating Social Teaser with Length Validation
```typescript
// Source: Anthropic SDK + research on structured outputs
import { z } from 'zod';

const TeaserSchema = z.object({
  text: z.string().max(280, 'Teaser must be 280 characters or less'),
  hashtags: z.array(z.string()).min(2).max(5),
});

async function generateTeaser(
  digestSummary: string,
  repoNames: string[],
  apiKey: string
): Promise<{ text: string; hashtags: string[] }> {
  const client = new Anthropic({ apiKey });

  const prompt = `Create a social media teaser (280 chars max) from this digest summary:

${digestSummary}

Repos: ${repoNames.join(', ')}

Requirements:
- Engaging hook that makes people want to read more
- 280 characters maximum (including spaces)
- Generate 2-5 relevant hashtags (#opensource, #devlog, etc.)
- Don't include hashtags in character count
- Focus on biggest/most interesting change

Format as JSON:
{
  "text": "your teaser here",
  "hashtags": ["tag1", "tag2"]
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    temperature: 0.7, // Higher for creative/engaging teasers
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content.find(block => block.type === 'text')?.text || '{}';

  // Parse and validate
  const json = JSON.parse(content);
  const validated = TeaserSchema.parse(json);

  return validated;
}
```

### Multi-Repo Aggregation with Bot Filtering
```typescript
// Source: Research on bot detection patterns + GitHub API
interface RepoCommitGroup {
  repoName: string;
  displayName: string;
  commits: GitHubCommit[];
  botCommitCount: number;
}

async function aggregateMultiRepoCommits(
  octokit: Octokit,
  repos: Array<{ owner: string; repo: string; displayName?: string }>,
  daysBack: number
): Promise<RepoCommitGroup[]> {
  const groups: RepoCommitGroup[] = [];

  for (const repo of repos) {
    const allCommits = await fetchRecentCommits(octokit, repo.owner, repo.repo, daysBack);

    // Separate bot and human commits
    const humanCommits = allCommits.filter(c => !isBotCommit(c));
    const botCommits = allCommits.filter(c => isBotCommit(c));

    // Only include repos with meaningful activity
    if (humanCommits.length > 0) {
      groups.push({
        repoName: `${repo.owner}/${repo.repo}`,
        displayName: repo.displayName || repo.repo,
        commits: humanCommits,
        botCommitCount: botCommits.length,
      });
    }
  }

  // Sort by activity level (most active first)
  return groups.sort((a, b) => b.commits.length - a.commits.length);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Template strings with commit messages | LLM-generated narrative summaries | 2023-2024 (GPT-4 era) | Summaries went from robotic bullet points to conversational narratives that supporters actually read |
| Manual hashtag lists | AI-generated contextual hashtags | 2024-2025 | Hashtags are now relevant to actual content, not generic "#coding #github" |
| OpenAI exclusive | Multi-provider (Anthropic, OpenAI, etc.) | 2024-2025 | Claude's instruction-following and cost efficiency made it viable alternative for content generation |
| Simple retry loops | Exponential backoff with jitter | Ongoing best practice | Prevents cascading failures and respects rate limits properly |
| Keyword extraction for summarization | Structured prompts with JSON/YAML context | 2025-2026 research | 40% improvement in accuracy when using structured formats vs. free-form text |

**Deprecated/outdated:**
- **OpenAI Completions API:** Replaced by Chat Completions API (2023), then Responses API (2025). Use `client.messages` pattern for chat-based models.
- **Manual Link header parsing:** Octokit now has built-in `paginate()` and `iterator()` methods. No need to parse pagination links manually.
- **Text summarization libraries (TextRank, RAKE):** Extractive summarization is obsolete for this use case. LLMs provide abstractive summaries that are far superior.

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal token budget per digest**
   - What we know: Claude Sonnet 4.5 allows up to 200K input tokens, digests typically use 500-2000 input tokens
   - What's unclear: Cost/quality tradeoff for different input sizes. Should we truncate context aggressively or send full commit history?
   - Recommendation: Start with 2000 max input tokens (roughly 20-30 commits with full context), monitor costs and quality, adjust if needed

2. **Teaser generation: single call vs. multi-call**
   - What we know: Can generate teaser in same LLM call as digest (cheaper) or separate call (more control)
   - What's unclear: Does single-call affect quality? Do teasers need different temperature/parameters?
   - Recommendation: Start with separate calls (better control over length/tone), consolidate if costs become concern

3. **Commit classification accuracy requirements**
   - What we know: Research shows even fine-tuned LLMs achieve only 76% F1 on conventional commit classification
   - What's unclear: Is simple prefix matching sufficient, or should we use LLM to classify commits?
   - Recommendation: Start with simple prefix matching (fast, cheap). If filtering quality is poor, add LLM-based classification as refinement

4. **Caching strategy for repeated LLM calls**
   - What we know: Anthropic SDK supports caching, but unclear if commit context changes enough to benefit
   - What's unclear: Do prompt system messages stay consistent enough across days/weeks to cache effectively?
   - Recommendation: Don't implement caching in initial version. Add if API costs are high and prompts are stable

## Sources

### Primary (HIGH confidence)
- [Anthropic TypeScript SDK GitHub](https://github.com/anthropics/anthropic-sdk-typescript) - Official SDK documentation, code examples
- [GitHub REST API - Using Pagination](https://docs.github.com/rest/guides/using-pagination-in-the-rest-api) - Official pagination best practices
- [date-fns Official Documentation](https://date-fns.org/) - Date filtering functions and API
- [@octokit/rest npm package](https://www.npmjs.com/package/@octokit/rest) - GitHub API client library
- [Medium: Circuit Breaker for LLM with Retry and Backoff (TypeScript)](https://medium.com/@spacholski99/circuit-breaker-for-llm-with-retry-and-backoff-anthropic-api-example-typescript-1f99a0a0cf87) - Rate limiting patterns

### Secondary (MEDIUM confidence)
- [LLM Prompt Engineering for Structured Data (2026 Research)](https://www.preprints.org/manuscript/202506.1937) - JSON/YAML prompt style comparison
- [GitHub Well-Architected: Repository Architecture Strategy](https://wellarchitected.github.com/library/architecture/recommendations/scaling-git-repositories/repository-architecture-strategy/) - Multi-repo patterns
- [IEEE: Conventional Commits Classification Research](https://ieeexplore.ieee.org/document/11029726/) - Commit type classification challenges
- [Portkey.ai: Tackling Rate Limiting for LLM Apps](https://portkey.ai/blog/tackling-rate-limiting-for-llm-apps/) - Production rate limiting strategies
- [AI Content Quality Control Guide 2026](https://koanthic.com/en/ai-content-quality-control-complete-guide-for-2026-2/) - Validation best practices

### Tertiary (LOW confidence)
- [WebSearch: Best LLMs for Summarization 2026](https://clickup.com/blog/best-llms-for-language-summarization/) - Model comparisons (not independently verified)
- [WebSearch: Social Media Character Limits 2026](https://goldentoolhub.com/social-media-character-limits-2026/) - Platform limits (subject to change)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDKs verified, libraries in active use
- Architecture: HIGH - Patterns derived from official documentation and research papers
- Pitfalls: MEDIUM-HIGH - Based on research and community experience, but some project-specific unknowns
- Code examples: HIGH - Verified against official SDK documentation

**Research date:** 2026-02-01
**Valid until:** 2026-03-15 (45 days - LLM APIs evolve quickly, revalidate if new models released)
