/**
 * Content validation for AI-generated output
 */

import { z } from 'zod';

/** Teaser validation schema */
export const TeaserSchema = z.object({
  text: z.string()
    .min(10, 'Teaser too short')
    .max(280, 'Teaser exceeds 280 character limit'),
  hashtags: z.array(z.string())
    .min(2, 'Need at least 2 hashtags')
    .max(5, 'Maximum 5 hashtags'),
});

/**
 * Validates a teaser meets requirements
 * @returns Validated teaser or throws ZodError
 */
export function validateTeaser(data: unknown): { text: string; hashtags: string[] } {
  return TeaserSchema.parse(data);
}

/**
 * Validates digest content has required structure
 */
export function validateDigest(content: string, expectedRepos: string[]): boolean {
  // Check minimum length
  if (content.length < 100) {
    console.warn('Digest too short');
    return false;
  }

  // Check for repo headings (at least one)
  const hasHeadings = expectedRepos.some(repo =>
    content.includes(`## ${repo}`) || content.toLowerCase().includes(repo.toLowerCase())
  );

  if (!hasHeadings && expectedRepos.length > 0) {
    console.warn('Digest missing expected repository references');
    return false;
  }

  // Check for links (should have at least one)
  const hasLinks = /\[.+\]\(https?:\/\/.+\)/.test(content);
  if (!hasLinks) {
    console.warn('Digest has no commit links');
    // Don't fail, just warn - some digests may summarize without links
  }

  return true;
}
