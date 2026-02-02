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

export interface Config {
  email: EmailConfig;
  approval: ApprovalConfig;
  schedule: ScheduleConfig;
  github: GitHubConfig;
  /** Content generation settings (optional, has defaults) */
  content?: ContentConfig;
  /** Platform publishing settings (optional) */
  platforms?: PlatformsConfig;
}
