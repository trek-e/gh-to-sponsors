/**
 * Release-specific type definitions for GitHub release handling
 */

import type { ReleaseAnnouncement } from '../types/state.js';

/**
 * GitHub Release event payload structure
 * See: https://docs.github.com/en/webhooks/webhook-events-and-payloads#release
 */
export interface ReleasePayload {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

/**
 * Result of generating release content via AI
 */
export interface ReleaseContentResult {
  /** Announcement data for state storage */
  announcement: ReleaseAnnouncement;
  /** Full announcement content for Ghost */
  postContent: string;
  /** Social media teaser */
  teaser: {
    text: string;
    hashtags: string[];
    characterCount: number;
  };
  /** Token usage tracking */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
