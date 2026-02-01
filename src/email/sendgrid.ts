/**
 * SendGrid email provider implementation
 */

import sgMail from '@sendgrid/mail';
import type { EmailProvider, EmailParams, EmailResult } from './provider.js';

export class SendGridProvider implements EmailProvider {
  constructor(apiKey: string, private fromEmail: string) {
    sgMail.setApiKey(apiKey);
  }

  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const [response] = await sgMail.send({
        to: params.to,
        from: this.fromEmail,
        subject: params.subject,
        html: params.html,
        text: params.text
      });

      return {
        success: true,
        messageId: response.headers['x-message-id'] as string
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
