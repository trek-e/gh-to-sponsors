/**
 * Email templates for approval workflow
 */

export interface ApprovalEmailData {
  summary: string;
  itemCount: number;
  approveLink: string;
  skipLink: string;
  previewLink?: string;
  expirationHours: number;
}

export interface EmailTemplate {
  html: string;
  text: string;
  subject: string;
}

/**
 * Renders the approval email with both HTML and plain text versions
 */
export function renderApprovalEmail(data: ApprovalEmailData): EmailTemplate {
  const subject = `Digest ready: ${data.itemCount} item${data.itemCount === 1 ? '' : 's'} to review`;

  const html = renderHTMLEmail(data);
  const text = renderPlainTextEmail(data);

  return { html, text, subject };
}

function renderHTMLEmail(data: ApprovalEmailData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f6f8fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #24292f; line-height: 1.25;">
                Your digest is ready
              </h1>
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #57606a;">
                ${escapeHtml(data.summary)}
              </p>
            </td>
          </tr>

          <!-- Action Buttons (Top) -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <a href="${escapeHtml(data.approveLink)}"
                       style="display: inline-block; width: 100%; max-width: 280px; background-color: #0969da; color: #ffffff; text-align: center; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px; line-height: 1.5;">
                      Approve and Post
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="${escapeHtml(data.skipLink)}"
                       style="display: inline-block; width: 100%; max-width: 280px; background-color: #f6f8fa; color: #24292f; text-align: center; padding: 12px 20px; text-decoration: none; border: 1px solid #d0d7de; border-radius: 6px; font-weight: 500; font-size: 16px; line-height: 1.5;">
                      Skip This Digest
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${data.previewLink ? `
          <!-- Preview Link -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #57606a;">
                <a href="${escapeHtml(data.previewLink)}" style="color: #0969da; text-decoration: none;">Preview full content</a>
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 32px; border-top: 1px solid #d0d7de; background-color: #f6f8fa;">
              <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: #57606a;">
                <strong>⏰ This link expires in ${data.expirationHours} hours</strong>
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6e7781;">
                This email was sent from your gh-to-sponsors automation workflow. If you didn't set this up, please check your repository's Actions settings.
              </p>
            </td>
          </tr>

          <!-- Action Buttons (Bottom) -->
          <tr>
            <td style="padding: 24px 32px 32px; background-color: #ffffff;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <a href="${escapeHtml(data.approveLink)}"
                       style="display: inline-block; width: 100%; max-width: 280px; background-color: #0969da; color: #ffffff; text-align: center; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px; line-height: 1.5;">
                      Approve and Post
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="${escapeHtml(data.skipLink)}"
                       style="display: inline-block; width: 100%; max-width: 280px; background-color: #f6f8fa; color: #24292f; text-align: center; padding: 12px 20px; text-decoration: none; border: 1px solid #d0d7de; border-radius: 6px; font-weight: 500; font-size: 16px; line-height: 1.5;">
                      Skip This Digest
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderPlainTextEmail(data: ApprovalEmailData): string {
  const lines = [
    'YOUR DIGEST IS READY',
    '='.repeat(50),
    '',
    data.summary,
    '',
    'ACTIONS',
    '-------',
    '',
    `✓ Approve and post: ${data.approveLink}`,
    '',
    `✗ Skip this digest: ${data.skipLink}`,
    '',
  ];

  if (data.previewLink) {
    lines.push(
      'PREVIEW',
      '-------',
      '',
      `View full content: ${data.previewLink}`,
      ''
    );
  }

  lines.push(
    'IMPORTANT',
    '---------',
    '',
    `⏰ This link expires in ${data.expirationHours} hours`,
    '',
    'This email was sent from your gh-to-sponsors automation workflow.',
    'If you didn\'t set this up, please check your repository\'s Actions settings.',
    '',
    '='.repeat(50),
    '',
    'QUICK ACTIONS (click below)',
    '',
    `Approve: ${data.approveLink}`,
    '',
    `Skip: ${data.skipLink}`
  );

  return lines.join('\n');
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
