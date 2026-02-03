/**
 * Configuration validation schema using Zod
 *
 * Validates user configuration files against expected structure and constraints.
 */

import { z } from 'zod';
import type { Config } from '../types/config.js';

// Email provider schema
const emailProviderSchema = z.enum(['resend', 'ses', 'sendgrid']);

// Email configuration schema
const emailConfigSchema = z.object({
  provider: emailProviderSchema,
  apiKey: z.string().min(1, 'Email API key is required'),
  fromEmail: z.string().email('Valid email address required for fromEmail'),
  replyTo: z.string().email('Valid email address required for replyTo').optional(),
});

// Approval configuration schema
const approvalConfigSchema = z.object({
  expirationHours: z.union([z.literal(24), z.literal(48)], {
    errorMap: () => ({ message: 'expirationHours must be 24 or 48' }),
  }),
  autoAction: z.enum(['approve', 'skip', 'none']),
});

// Schedule configuration schema
// Basic cron validation - checks format (5 fields with valid characters)
const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([012]?\d|3[01])) (\*|([0-9]|1[012])) (\*|([0-6]))$/;

const scheduleConfigSchema = z.object({
  cronExpression: z.string().regex(cronRegex, 'Invalid cron expression format'),
  timezone: z.string().optional(),
});

// Single repository schema
export const repoSchema = z.object({
  owner: z.string().min(1, 'GitHub owner is required'),
  repo: z.string().min(1, 'GitHub repo is required'),
  displayName: z.string().optional(),
});

// GitHub configuration schema with multi-repo support
const githubConfigSchema = z.object({
  repos: z.array(repoSchema).min(1, 'At least one repository is required'),
});

// Content generation configuration schema
export const contentConfigSchema = z.object({
  dailyThreshold: z.number().int().min(1).default(1),
  weeklyThreshold: z.number().int().min(1).default(3),
});

// Ghost platform configuration schema
// Note: apiKey comes from GHOST_ADMIN_API_KEY env var, not config file
export const ghostConfigSchema = z.object({
  enabled: z.boolean().default(true),
  url: z.string().url('Valid Ghost URL required'),
  defaultTags: z.array(z.string()).default(['devlog', 'opensource']),
  defaultStatus: z.enum(['draft', 'published']).default('draft'),
});

// Bluesky platform configuration schema
// Note: Auth credentials come from BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD env vars
export const blueskyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultLang: z.string().default('en'),
});

// Mastodon platform configuration schema
// Note: Access token comes from MASTODON_ACCESS_TOKEN env var
export const mastodonConfigSchema = z.object({
  enabled: z.boolean().default(true),
  instanceUrl: z.string().url('Valid Mastodon instance URL required'),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
});

// Platforms configuration schema
export const platformsConfigSchema = z.object({
  ghost: ghostConfigSchema.optional(),
  bluesky: blueskyConfigSchema.optional(),
  mastodon: mastodonConfigSchema.optional(),
});

// Cadence configuration schema
export const cadenceConfigSchema = z.object({
  mode: z.enum(['daily', 'weekly', 'auto']).default('auto'),
  weeklyDay: z.number().int().min(0).max(6).default(1),
  quietPeriodDays: z.number().int().min(1).default(3),
  activityThreshold: z.number().int().min(1).default(1),
});

// Release configuration schema
export const releaseConfigSchema = z.object({
  enabled: z.boolean().default(true),
  includePrereleases: z.boolean().default(false),
  includeDrafts: z.boolean().default(false),
});

// Main configuration schema
export const configSchema = z.object({
  email: emailConfigSchema,
  approval: approvalConfigSchema,
  schedule: scheduleConfigSchema,
  github: githubConfigSchema,
  content: contentConfigSchema.optional(),
  platforms: platformsConfigSchema.optional(),
  cadence: cadenceConfigSchema.optional(),
  releases: releaseConfigSchema.optional(),
});

/**
 * Validates configuration object against schema
 *
 * @param data - Raw configuration data to validate
 * @returns Validated Config object
 * @throws ZodError with descriptive validation errors if invalid
 */
export function validateConfig(data: unknown): Config {
  return configSchema.parse(data);
}
