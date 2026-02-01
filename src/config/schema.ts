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

// GitHub configuration schema
const githubConfigSchema = z.object({
  owner: z.string().min(1, 'GitHub owner is required'),
  repo: z.string().min(1, 'GitHub repo is required'),
});

// Main configuration schema
export const configSchema = z.object({
  email: emailConfigSchema,
  approval: approvalConfigSchema,
  schedule: scheduleConfigSchema,
  github: githubConfigSchema,
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
