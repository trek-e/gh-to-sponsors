/**
 * Configuration type definitions
 */

import type { PlatformsConfig } from './platform.js';

export type EmailProvider = 'resend' | 'ses' | 'sendgrid';

export interface EmailConfig {
  provider: EmailProvider;
  apiKey: string;
  fromEmail: string;
  replyTo?: string;
}

export type AutoAction = 'approve' | 'skip' | 'none';

export interface ApprovalConfig {
  expirationHours: 24 | 48;
  autoAction: AutoAction;
}

export interface ScheduleConfig {
  cronExpression: string;
  timezone?: string;
}

/** Single repository configuration */
export interface RepoConfig {
  owner: string;
  repo: string;
  /** Optional display name for digest (defaults to owner/repo) */
  displayName?: string;
}

/** GitHub configuration with multi-repo support */
export interface GitHubConfig {
  repos: RepoConfig[];
}

/** Content generation configuration */
export interface ContentConfig {
  /** Minimum commits for daily digest (default: 1) */
  dailyThreshold: number;
  /** Minimum commits for weekly digest (default: 3) */
  weeklyThreshold: number;
}

/** Cadence configuration for digest scheduling */
export interface CadenceConfig {
  /** User's preferred cadence mode (default: 'auto') */
  mode: 'daily' | 'weekly' | 'auto';
  /** Day of week for weekly digests (0=Sunday, default: 1=Monday) */
  weeklyDay?: number;
  /** Days of no activity before considered "quiet period" (default: 3) */
  quietPeriodDays?: number;
  /** Minimum commits to consider "meaningful activity" (default: 1) */
  activityThreshold?: number;
}

/** Release announcement configuration */
export interface ReleaseConfig {
  /** Enable release announcements (default: true) */
  enabled: boolean;
  /** Include pre-releases in announcements (default: false) */
  includePrereleases?: boolean;
  /** Include draft releases (default: false) */
  includeDrafts?: boolean;
}

export interface Config {
  email: EmailConfig;
  approval: ApprovalConfig;
  schedule: ScheduleConfig;
  github: GitHubConfig;
  /** Content generation settings (optional, has defaults) */
  content?: ContentConfig;
  /** Platform publishing settings (optional) */
  platforms?: PlatformsConfig;
  /** Cadence settings for digest scheduling (optional, has defaults) */
  cadence?: CadenceConfig;
  /** Release announcement settings (optional, has defaults) */
  releases?: ReleaseConfig;
}
