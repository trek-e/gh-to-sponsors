/**
 * State management type definitions
 */

export type PostStatus = 'pending' | 'approved' | 'skipped' | 'posted';

/**
 * @deprecated Use PlatformPostState for new code
 */
export type PlatformResult = 'success' | 'failed';

/** Detailed result for a single platform post attempt */
export interface PlatformPostState {
  status: 'success' | 'failed' | 'pending';
  postId?: string;
  postUrl?: string;
  error?: string;
  attemptedAt?: string;
}

/** Release announcement content for PostState */
export interface ReleaseAnnouncement {
  type: 'release';
  tagName: string;
  title: string;
  body: string;
  releaseUrl: string;
  downloadLinks: Array<{ name: string; url: string }>;
  isPrerelease: boolean;
  repoName: string;
}

export interface PostState {
  id: string;
  contentHash: string;
  status: PostStatus;
  platforms: Record<string, PlatformPostState>;
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
  // Release announcement (added in Phase 5)
  release?: ReleaseAnnouncement;
}

export interface DigestState {
  posts: Record<string, PostState>;
  usedTokens: string[];
  lastRun: string;
  // Cadence tracking fields (added in Phase 5)
  /** ISO date string of last meaningful activity */
  lastActivityDate?: string;
  /** Days without meaningful commits */
  consecutiveQuietDays?: number;
  /** Current active cadence mode */
  cadenceMode?: 'daily' | 'weekly' | 'auto';
}
