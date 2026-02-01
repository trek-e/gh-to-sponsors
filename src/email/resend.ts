/**
 * Resend email provider implementation
 */

import { Resend } from 'resend';
import type { EmailProvider, EmailParams, EmailResult } from './provider.js';

export class ResendProvider implements EmailProvider {
  private client: Resend;

  constructor(apiKey: string, private fromEmail: string) {
    this.client = new Resend(apiKey);
  }

  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
