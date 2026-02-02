/**
 * Core type exports
 *
 * Centralizes all type definitions for clean imports throughout the codebase.
 */

// Configuration types
export type {
  EmailProvider as EmailProviderType,
  EmailConfig,
  AutoAction,
  ApprovalConfig,
  ScheduleConfig,
  GitHubConfig,
  Config,
} from './config.js';

// State management types
export type {
  PostStatus,
  PlatformResult,
  PostState,
  DigestState,
} from './state.js';

// Email types
export type {
  EmailParams,
  EmailResult,
  EmailProvider,
} from './email.js';

// Token types
export type {
  TokenAction,
  TokenReason,
  TokenPayload,
  VerificationResult,
} from './token.js';

// Content generation types
export type {
  CommitType,
  Commit,
  ClassifiedCommit,
  CommitContext,
  RepoCommitGroup,
  ActivityPeriod,
  Digest,
  Teaser,
  GenerationResult,
} from './content.js';
