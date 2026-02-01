/**
 * Email provider abstraction type definitions
 */

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  send(params: EmailParams): Promise<EmailResult>;
}
