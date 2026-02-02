/**
 * Commit filtering and classification functions
 *
 * Provides bot detection and conventional commit classification
 * for filtering commits before digest generation.
 */

import type { ClassifiedCommit, Commit, CommitType } from '../types/content.js';

/** Known bot name patterns (case-insensitive) */
const BOT_PATTERNS = [
  /\[bot\]$/i, // ends with [bot]
  /dependabot/i, // contains dependabot
  /renovate/i, // contains renovate
  /github-actions/i, // contains github-actions
];

/** Email pattern for GitHub bot accounts */
const BOT_EMAIL_PATTERN = /noreply\.github\.com/i;

/** Valid conventional commit types */
const COMMIT_TYPES: CommitType[] = [
  'feat',
  'fix',
  'docs',
  'chore',
  'refactor',
  'test',
  'ci',
  'perf',
  'style',
  'build',
  'revert',
];

/** Regex to match conventional commit format: type(scope): message or type: message */
const CONVENTIONAL_COMMIT_REGEX = /^(\w+)(?:\([^)]+\))?:\s/i;

/**
 * Determine if a commit was made by a bot
 *
 * Checks author name for bot patterns and email for GitHub noreply domain.
 * Uses case-insensitive matching.
 *
 * @param commit - The commit to check
 * @returns true if the commit is from a bot
 */
export function isBotCommit(commit: Commit): boolean {
  const authorLower = commit.author.toLowerCase();
  const emailLower = commit.email.toLowerCase();

  // Check author against bot patterns
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(authorLower)) {
      return true;
    }
  }

  // Check email for noreply.github.com (bot accounts)
  if (BOT_EMAIL_PATTERN.test(emailLower)) {
    return true;
  }

  return false;
}

/**
 * Classify a commit message by conventional commit type
 *
 * Extracts the type prefix from conventional commit format.
 * Handles scoped commits like feat(api): and case variations.
 * Only uses the first line of multi-line messages.
 *
 * @param message - The commit message to classify
 * @returns The commit type or 'other' if not conventional
 */
export function classifyCommit(message: string): CommitType {
  // Use only the first line
  const firstLine = message.split('\n')[0];

  // Match conventional commit format
  const match = firstLine.match(CONVENTIONAL_COMMIT_REGEX);

  if (!match) {
    return 'other';
  }

  // Extract and normalize the type
  const type = match[1].toLowerCase() as CommitType;

  // Verify it's a valid commit type
  if (COMMIT_TYPES.includes(type)) {
    return type;
  }

  return 'other';
}

/**
 * Filter and classify an array of commits
 *
 * Separates bot commits from human commits and classifies each by type.
 *
 * @param commits - Array of raw commits
 * @returns Object with classified human commits and bot commit count
 */
export function filterAndClassifyCommits(
  commits: Commit[]
): { human: ClassifiedCommit[]; botCount: number } {
  const human: ClassifiedCommit[] = [];
  let botCount = 0;

  for (const commit of commits) {
    const isBot = isBotCommit(commit);

    if (isBot) {
      botCount++;
    } else {
      const type = classifyCommit(commit.message);
      human.push({
        ...commit,
        type,
        isBot: false,
      });
    }
  }

  return { human, botCount };
}
