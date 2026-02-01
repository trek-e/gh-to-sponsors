/**
 * AWS SES email provider implementation
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { EmailProvider, EmailParams, EmailResult } from './provider.js';

export class SESProvider implements EmailProvider {
  private client: SESClient;

  constructor(region: string, private fromEmail: string) {
    this.client = new SESClient({ region });
  }

  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [params.to]
        },
        Message: {
          Subject: {
            Data: params.subject
          },
          Body: {
            Html: {
              Data: params.html
            },
            Text: {
              Data: params.text || ''
            }
          }
        }
      });

      const result = await this.client.send(command);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
