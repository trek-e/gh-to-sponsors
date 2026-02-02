/**
 * Content generation type definitions
 *
 * Defines types for commit data, digest content, and social teasers
 * used throughout the content generation pipeline.
 */

/** Commit type classification based on conventional commits */
export type CommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'chore'
  | 'refactor'
  | 'test'
  | 'ci'
  | 'perf'
  | 'style'
  | 'build'
  | 'revert'
  | 'bot'
  | 'other';

/** Raw commit data from GitHub API (simplified) */
export interface Commit {
  sha: string;
  message: string;
  author: string;
  email: string;
  timestamp: string;
  url: string;
}

/** Classified commit with type */
export interface ClassifiedCommit extends Commit {
  type: CommitType;
  isBot: boolean;
}

/** Prepared commit context for LLM */
export interface CommitContext {
  repo: string;
  displayName: string;
  commits: ClassifiedCommit[];
  botCommitCount: number;
  commitCount: number;
  timeRange: { start: string; end: string };
}

/** Group of commits per repository */
export interface RepoCommitGroup {
  repoName: string;
  displayName: string;
  commits: ClassifiedCommit[];
  botCommitCount: number;
}

/** Activity period result from filtering */
export interface ActivityPeriod {
  commits: ClassifiedCommit[];
  periodType: 'daily' | 'weekly' | 'none';
  hasActivity: boolean;
}

/** Generated digest content */
export interface Digest {
  title: string;
  content: string;
  repos: string[];
  commitCount: number;
  periodType: 'daily' | 'weekly';
  generatedAt: string;
}

/** Generated social teaser */
export interface Teaser {
  text: string;
  hashtags: string[];
  characterCount: number;
}

/** Complete generation result */
export interface GenerationResult {
  digest: Digest;
  teaser: Teaser;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
