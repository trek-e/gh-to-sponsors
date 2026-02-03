/**
 * Release content generation for GitHub releases
 *
 * Transforms GitHub release data into announcement content suitable for
 * posting to platforms. Uses AI for generating rich announcement posts
 * and social teasers.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ReleasePayload, ReleaseContentResult } from './types.js';
import type { ReleaseAnnouncement } from '../types/state.js';
import { validateTeaser } from '../content/validator.js';

/** Default model - Claude Sonnet for balance of quality and cost */
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514';

/** Rate limit retry config */
const MAX_RETRIES = 3;

/**
 * Calls Claude API with exponential backoff retry
 */
async function callWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParams,
  retries: number = MAX_RETRIES
): Promise<Anthropic.Message> {
  let attempt = 0;

  while (attempt < retries) {
    try {
      return await client.messages.create(params) as Anthropic.Message;
    } catch (error: unknown) {
      const apiError = error as { status?: number };
      const isRateLimit = apiError?.status === 429;
      const isLastAttempt = attempt >= retries - 1;

      if (isRateLimit && !isLastAttempt) {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        console.warn(`Rate limited. Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      } else {
        throw error;
      }
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Builds a ReleaseAnnouncement from GitHub release payload
 *
 * Pure function with no AI calls. Handles edge cases:
 * - null name -> uses tag_name as title
 * - null body -> empty string
 * - no assets -> empty array
 *
 * @param payload - GitHub release event payload
 * @param repoName - Repository name (owner/repo format)
 * @returns ReleaseAnnouncement for state storage
 */
export function buildReleaseAnnouncement(
  payload: ReleasePayload,
  repoName: string
): ReleaseAnnouncement {
  return {
    type: 'release',
    tagName: payload.tag_name,
    title: payload.name ?? payload.tag_name,
    body: payload.body ?? '',
    releaseUrl: payload.html_url,
    downloadLinks: payload.assets.map(asset => ({
      name: asset.name,
      url: asset.browser_download_url,
    })),
    isPrerelease: payload.prerelease,
    repoName,
  };
}

/**
 * Builds the release announcement prompt for AI generation
 */
function buildReleasePrompt(announcement: ReleaseAnnouncement): string {
  const prereleaseNote = announcement.isPrerelease
    ? '\n\nNote: This is a PRE-RELEASE (beta/alpha). Mention this appropriately.'
    : '';

  const downloadSection = announcement.downloadLinks.length > 0
    ? `\n\nDownload Links:\n${announcement.downloadLinks.map(d => `- [${d.name}](${d.url})`).join('\n')}`
    : '';

  return `You are writing a SPECIAL RELEASE ANNOUNCEMENT for a GitHub project. This should feel special and important, not just another digest.

RELEASE DETAILS:
Repository: ${announcement.repoName}
Version: ${announcement.tagName}
Title: ${announcement.title}
Release URL: ${announcement.releaseUrl}${prereleaseNote}

Release Notes:
${announcement.body || '(No release notes provided)'}${downloadSection}

---

REQUIREMENTS:
1. Write an EXCITING announcement - releases are milestones to celebrate!
2. Start with a clear, attention-grabbing headline
3. Summarize the key changes in a narrative format
4. Include a link to the release page
5. If there are download links, mention them
6. Keep the tone celebratory but professional
7. If this is a pre-release, set appropriate expectations
8. Do NOT speculate or invent features not in the release notes

OUTPUT FORMAT:
- Use markdown formatting (## for sections)
- 150-400 words
- End with a call-to-action (try it out, report issues, etc.)

Generate the release announcement now:`;
}

/**
 * Builds the teaser prompt for social platforms
 */
function buildReleaseTeaserPrompt(announcement: ReleaseAnnouncement): string {
  const prereleaseTag = announcement.isPrerelease ? ' (pre-release)' : '';

  return `Create a social media teaser for this release announcement:

RELEASE: ${announcement.title} ${announcement.tagName}${prereleaseTag}
REPO: ${announcement.repoName}
SUMMARY: ${announcement.body?.substring(0, 300) || 'New release available'}

REQUIREMENTS:
1. Maximum 250 characters (leave room for link)
2. Celebrate the release - this is exciting news!
3. Mention the version number
4. Use casual, developer-friendly tone
5. Generate 2-4 relevant hashtags (#opensource, #release, etc.)

OUTPUT FORMAT (JSON only, no markdown):
{
  "text": "your teaser here (250 chars max)",
  "hashtags": ["#tag1", "#tag2"]
}

Generate the teaser now:`;
}

/**
 * Generates release content using AI
 *
 * Calls AI twice:
 * 1. Generate rich announcement post (for Ghost/blog)
 * 2. Generate social teaser (for Bluesky/Mastodon)
 *
 * @param payload - GitHub release event payload
 * @param repoName - Repository name (owner/repo format)
 * @param apiKey - Anthropic API key
 * @returns ReleaseContentResult with announcement, post, teaser, and usage
 */
export async function generateReleaseContent(
  payload: ReleasePayload,
  repoName: string,
  apiKey: string
): Promise<ReleaseContentResult> {
  const client = new Anthropic({ apiKey });
  const announcement = buildReleaseAnnouncement(payload, repoName);

  // Generate post content
  const postPrompt = buildReleasePrompt(announcement);
  const postMessage = await callWithRetry(client, {
    model: DEFAULT_MODEL,
    max_tokens: 1500,
    temperature: 0.5, // Slightly higher than digest for excitement
    messages: [{ role: 'user', content: postPrompt }],
  });

  const postContent = postMessage.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  // Generate teaser
  const teaserPrompt = buildReleaseTeaserPrompt(announcement);
  const teaserMessage = await callWithRetry(client, {
    model: DEFAULT_MODEL,
    max_tokens: 300,
    temperature: 0.7, // Higher for engaging social content
    messages: [{ role: 'user', content: teaserPrompt }],
  });

  const teaserRaw = teaserMessage.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Parse and validate teaser JSON
  const jsonMatch = teaserRaw.match(/\{[\s\S]*"text"[\s\S]*"hashtags"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Teaser response did not contain valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = validateTeaser(parsed);

  // Ensure hashtags have # prefix
  const hashtags = validated.hashtags.map(tag =>
    tag.startsWith('#') ? tag : `#${tag}`
  );

  return {
    announcement,
    postContent,
    teaser: {
      text: validated.text,
      hashtags,
      characterCount: validated.text.length,
    },
    usage: {
      inputTokens: postMessage.usage.input_tokens + teaserMessage.usage.input_tokens,
      outputTokens: postMessage.usage.output_tokens + teaserMessage.usage.output_tokens,
    },
  };
}
