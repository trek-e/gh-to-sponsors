/**
 * State management type definitions
 */

export type PostStatus = 'pending' | 'approved' | 'skipped' | 'posted';
export type PlatformResult = 'success' | 'failed';

export interface PostState {
  id: string;
  contentHash: string;
  status: PostStatus;
  platforms: Record<string, PlatformResult>;
  createdAt: string;
  approvedAt?: string;
  // Content fields (added in Phase 2)
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

export interface DigestState {
  posts: Record<string, PostState>;
  usedTokens: string[];
  lastRun: string;
}
