/**
 * Email module exports
 */

export type { EmailProvider, EmailParams, EmailResult } from './provider.js';
export { createEmailProvider } from './factory.js';
export {
  renderApprovalEmail,
  renderFailureNotificationEmail,
  type ApprovalEmailData,
  type FailureNotificationData,
  type EmailTemplate
} from './templates.js';
