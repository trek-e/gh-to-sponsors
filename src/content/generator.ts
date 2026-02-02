/**
 * AI content generation using Anthropic Claude
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  CommitContext,
  Teaser,
  GenerationResult
} from '../types/content.js';
import { buildDigestPrompt, buildTeaserPrompt } from './prompts.js';
import { validateTeaser, validateDigest } from './validator.js';

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
        // Exponential backoff with jitter (from RESEARCH.md)
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
 * Generates digest content from commit contexts
 */
export async function generateDigest(
  contexts: CommitContext[],
  periodType: 'daily' | 'weekly',
  apiKey: string
): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }> {
  const client = new Anthropic({ apiKey });
  const prompt = buildDigestPrompt(contexts, periodType);

  const message = await callWithRetry(client, {
    model: DEFAULT_MODEL,
    max_tokens: 2000,
    temperature: 0.4, // Lower for factual content (from RESEARCH.md)
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text content
  const content = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  // Validate (warn but don't fail)
  const repoNames = contexts.map(c => c.displayName);
  validateDigest(content, repoNames);

  return {
    content,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}

/**
 * Generates social teaser from digest
 */
export async function generateTeaser(
  digestContent: string,
  repoNames: string[],
  apiKey: string
): Promise<{ teaser: Teaser; usage: { inputTokens: number; outputTokens: number } }> {
  const client = new Anthropic({ apiKey });

  // Create brief summary for teaser prompt (first 500 chars of digest)
  const summary = digestContent.substring(0, 500);
  const prompt = buildTeaserPrompt(summary, repoNames);

  const message = await callWithRetry(client, {
    model: DEFAULT_MODEL,
    max_tokens: 500,
    temperature: 0.7, // Higher for creative/engaging teasers
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract and parse JSON
  const rawContent = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Find JSON in response (may have surrounding text)
  const jsonMatch = rawContent.match(/\{[\s\S]*"text"[\s\S]*"hashtags"[\s\S]*\}/);
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
    teaser: {
      text: validated.text,
      hashtags,
      characterCount: validated.text.length,
    },
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}

/**
 * Generates complete content (digest + teaser) from commit contexts
 *
 * @param contexts - Prepared commit contexts
 * @param periodType - 'daily' or 'weekly'
 * @param apiKey - Anthropic API key
 * @returns GenerationResult with digest, teaser, and token usage
 */
export async function generateContent(
  contexts: CommitContext[],
  periodType: 'daily' | 'weekly',
  apiKey: string
): Promise<GenerationResult> {
  // Generate digest first
  const digestResult = await generateDigest(contexts, periodType, apiKey);

  // Generate teaser from digest
  const repoNames = contexts.map(c => c.displayName);
  const teaserResult = await generateTeaser(digestResult.content, repoNames, apiKey);

  // Build complete result
  const now = new Date().toISOString();
  const totalCommits = contexts.reduce((sum, c) => sum + c.commitCount, 0);

  return {
    digest: {
      title: `${periodType === 'daily' ? 'Daily' : 'Weekly'} Update`,
      content: digestResult.content,
      repos: repoNames,
      commitCount: totalCommits,
      periodType,
      generatedAt: now,
    },
    teaser: teaserResult.teaser,
    usage: {
      inputTokens: digestResult.usage.inputTokens + teaserResult.usage.inputTokens,
      outputTokens: digestResult.usage.outputTokens + teaserResult.usage.outputTokens,
    },
  };
}
