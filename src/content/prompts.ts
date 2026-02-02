/**
 * Prompt templates for AI content generation
 *
 * Based on CONTEXT.md decisions:
 * - Conversational/update tone: "This week I worked on..."
 * - Blog post style narrative paragraphs
 * - Include links to commits/PRs
 * - Bot commits summarized as one line
 */

import type { CommitContext } from '../types/content.js';

/**
 * Builds the digest generation prompt
 *
 * @param contexts - Prepared commit contexts for each repo
 * @param periodType - 'daily' or 'weekly'
 * @returns Prompt string for Claude
 */
export function buildDigestPrompt(
  contexts: CommitContext[],
  periodType: 'daily' | 'weekly'
): string {
  const periodLabel = periodType === 'daily' ? 'today' : 'this week';

  // Format commit context as structured YAML (research shows higher accuracy)
  const contextBlocks = contexts.map(ctx => {
    const commitLines = ctx.commits.map(c =>
      `  - [${c.type}] ${c.message.split('\n')[0]} ([${c.sha.substring(0, 7)}](${c.url}))`
    ).join('\n');

    const botNote = ctx.botCommitCount > 0
      ? `\nBot commits: ${ctx.botCommitCount} (dependency updates)`
      : '';

    return `## ${ctx.displayName}
Commits: ${ctx.commitCount}${botNote}
${commitLines}`;
  }).join('\n\n---\n\n');

  return `You are writing a personal developer newsletter update. Generate a conversational digest from these commits.

${contextBlocks}

---

REQUIREMENTS:
1. Write in first person, conversational tone: "This week I worked on..." or "Today I pushed..."
2. Create narrative paragraphs explaining the work, not bullet points
3. Group related commits into coherent themes/stories
4. Include markdown links to significant commits using the provided URLs
5. Each repository gets its own section with ## heading
6. If there were bot commits (dependency updates), mention briefly: "Also updated N dependencies"
7. Keep it engaging - you're talking to supporters who care about your work
8. Focus on the "why" and impact, not just the "what"
9. Do NOT speculate or invent features not explicitly mentioned in commit messages

OUTPUT FORMAT:
- Start with a brief intro for ${periodLabel}'s work
- Use ## headings for each repository section
- End with a brief wrap-up or what's next (if apparent from commits)
- Total length: 200-500 words

Generate the digest now:`;
}

/**
 * Builds the teaser generation prompt
 *
 * @param digestSummary - Brief summary of the digest content
 * @param repoNames - Names of repos with activity
 * @returns Prompt string for Claude
 */
export function buildTeaserPrompt(
  digestSummary: string,
  repoNames: string[]
): string {
  return `Create a social media teaser for this developer update:

DIGEST SUMMARY:
${digestSummary}

REPOSITORIES: ${repoNames.join(', ')}

REQUIREMENTS:
1. Maximum 280 characters (leave room for link)
2. Engaging hook that makes people want to read more
3. Mention the most interesting/impactful change
4. Use casual, developer-friendly tone
5. Generate 2-5 relevant hashtags (#opensource, #devlog, etc.)

OUTPUT FORMAT (JSON only, no markdown):
{
  "text": "your teaser here (280 chars max)",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}

Generate the teaser now:`;
}
