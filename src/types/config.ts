/**
 * Configuration type definitions
 */

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

export interface GitHubConfig {
  owner: string;
  repo: string;
}

export interface Config {
  email: EmailConfig;
  approval: ApprovalConfig;
  schedule: ScheduleConfig;
  github: GitHubConfig;
}
