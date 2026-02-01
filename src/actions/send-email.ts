/**
 * Email sending action
 *
 * Handles sending approval emails using the configured email provider.
 */

import type { Config } from '../types/config.js';
import { createEmailProvider } from '../email/factory.js';
import { renderApprovalEmail, type ApprovalEmailData } from '../email/templates.js';

/**
 * Send approval email to the user
 *
 * @param config - Application configuration
 * @param data - Email template data
 * @returns Promise that resolves when email is sent
 */
export async function sendApprovalEmail(
  config: Config,
  data: ApprovalEmailData
): Promise<void> {
  try {
    // Create email provider from config
    const emailProvider = createEmailProvider(config.email);

    // Render email template
    const { html, text, subject } = renderApprovalEmail(data);

    // Get recipient from environment variable
    const emailFrom = process.env.EMAIL_FROM;
    if (!emailFrom) {
      throw new Error('EMAIL_FROM environment variable is required');
    }

    // Send email to the same address (creator approves their own content)
    const result = await emailProvider.send({
      to: emailFrom,
      subject,
      html,
      text
    });

    if (!result.success) {
      throw new Error(`Email sending failed: ${result.error}`);
    }

    console.log(`Email sent successfully (Message ID: ${result.messageId})`);
  } catch (error) {
    console.error('Failed to send approval email:', error);
    throw error;
  }
}
