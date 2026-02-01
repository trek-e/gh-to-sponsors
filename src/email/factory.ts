/**
 * Email provider factory
 */

import type { EmailConfig } from '../types/config.js';
import type { EmailProvider } from './provider.js';
import { ResendProvider } from './resend.js';
import { SESProvider } from './ses.js';
import { SendGridProvider } from './sendgrid.js';

export function createEmailProvider(config: EmailConfig): EmailProvider {
  switch (config.provider) {
    case 'resend':
      return new ResendProvider(config.apiKey, config.fromEmail);

    case 'ses':
      // SES requires region from config
      const region = (config as any).region || 'us-east-1';
      return new SESProvider(region, config.fromEmail);

    case 'sendgrid':
      return new SendGridProvider(config.apiKey, config.fromEmail);

    default:
      throw new Error(`Unknown email provider: ${config.provider}`);
  }
}
