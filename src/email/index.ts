/**
 * Email module exports
 */

export type { EmailProvider, EmailParams, EmailResult } from './provider.js';
export { createEmailProvider } from './factory.js';
export { renderApprovalEmail, type ApprovalEmailData, type EmailTemplate } from './templates.js';
