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
}

export interface DigestState {
  posts: Record<string, PostState>;
  usedTokens: string[];
  lastRun: string;
}
