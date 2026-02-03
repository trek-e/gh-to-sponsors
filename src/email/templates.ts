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
  // Phase 2 content generation fields (optional for backward compatibility)
  teaser?: string;
  hashtags?: string[];
  repos?: string[];
  periodType?: 'daily' | 'weekly' | 'release';
  // Phase 5 release announcement fields
  releaseTag?: string;
}

export interface EmailTemplate {
  html: string;
  text: string;
  subject: string;
}

/**
 * Generates subject line based on period type
 */
function getSubjectLine(data: ApprovalEmailData): string {
  const { periodType, repos, releaseTag, itemCount } = data;

  if (periodType === 'release' && releaseTag) {
    const repoName = repos && repos.length > 0 ? repos[0] : 'your project';
    return `New Release: ${releaseTag} - ${repoName}`;
  }

  if (periodType === 'daily' || periodType === 'weekly') {
    const period = periodType === 'daily' ? 'Daily' : 'Weekly';
    const repoList = repos && repos.length > 0 ? repos.join(', ') : 'your repos';
    return `${period} Update: ${repoList}`;
  }

  // Fallback for backward compatibility
  return `Digest ready: ${itemCount} item${itemCount === 1 ? '' : 's'} to review`;
}

/**
 * Renders the approval email with both HTML and plain text versions
 */
export function renderApprovalEmail(data: ApprovalEmailData): EmailTemplate {
  const subject = getSubjectLine(data);

  const html = renderHTMLEmail(data);
  const text = renderPlainTextEmail(data);

  return { html, text, subject };
}

function renderHTMLEmail(data: ApprovalEmailData): string {
  const isRelease = data.periodType === 'release';

  // Release-specific styling
  const headerBgColor = isRelease ? '#1a7f37' : '#ffffff';
  const headerTextColor = isRelease ? '#ffffff' : '#24292f';
  const headerSubtextColor = isRelease ? '#d4f8db' : '#6e7781';

  // Build header content based on type
  const headerTitle = isRelease
    ? `New Release: ${escapeHtml(data.releaseTag || 'Latest')}`
    : `Your ${data.periodType || ''} digest is ready`;

  const headerSubtitle = isRelease && data.repos && data.repos.length > 0
    ? `Release announcement for ${data.repos[0]}`
    : data.repos && data.repos.length > 0
      ? `${data.itemCount} commit${data.itemCount === 1 ? '' : 's'} from ${data.repos.join(', ')}`
      : '';

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
            <td style="padding: 32px 32px 24px; background-color: ${headerBgColor};">
              ${isRelease ? `
              <div style="display: inline-block; background-color: #ffffff; color: #1a7f37; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 12px; margin-bottom: 12px;">
                RELEASE ANNOUNCEMENT
              </div>
              ` : ''}
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: ${headerTextColor}; line-height: 1.25;">
                ${headerTitle}
              </h1>
              ${headerSubtitle ? `
              <p style="margin: 0 0 12px; font-size: 14px; color: ${headerSubtextColor};">
                ${headerSubtitle}
              </p>
              ` : ''}
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: ${isRelease ? '#d4f8db' : '#57606a'}; white-space: pre-wrap;">
                ${escapeHtml(data.summary)}
              </p>
            </td>
          </tr>

          ${data.teaser ? `
          <!-- Social Teaser Preview -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #0969da;">
                <strong style="font-size: 14px; color: #24292f;">Social Teaser:</strong>
                <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.5; color: #57606a;">${escapeHtml(data.teaser)}</p>
                ${data.hashtags && data.hashtags.length > 0 ? `<p style="color: #6c757d; margin: 8px 0 0 0; font-size: 14px;">${data.hashtags.join(' ')}</p>` : ''}
              </div>
            </td>
          </tr>
          ` : ''}

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
  const isRelease = data.periodType === 'release';

  let headerTitle: string;
  let repoInfo: string;

  if (isRelease) {
    headerTitle = `NEW RELEASE: ${data.releaseTag || 'LATEST'}`;
    repoInfo = data.repos && data.repos.length > 0
      ? `\nRelease announcement for ${data.repos[0]}\n`
      : '';
  } else {
    const periodLabel = data.periodType ? `${data.periodType.toUpperCase()} ` : '';
    headerTitle = `YOUR ${periodLabel}DIGEST IS READY`;
    repoInfo = data.repos && data.repos.length > 0
      ? `\n${data.itemCount} commit${data.itemCount === 1 ? '' : 's'} from ${data.repos.join(', ')}\n`
      : '';
  }

  const lines = [
    headerTitle,
    '='.repeat(50),
    repoInfo,
    data.summary,
    '',
  ];

  // Add teaser preview if available
  if (data.teaser) {
    lines.push(
      'SOCIAL TEASER',
      '-------------',
      '',
      data.teaser,
      ''
    );
    if (data.hashtags && data.hashtags.length > 0) {
      lines.push(data.hashtags.join(' '), '');
    }
  }

  lines.push(
    'ACTIONS',
    '-------',
    '',
    `Approve and post: ${data.approveLink}`,
    '',
    `Skip this digest: ${data.skipLink}`,
    ''
  );

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

/**
 * Platform result for failure notification
 */
export interface PlatformResult {
  name: string;
  success: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Data for failure notification email
 */
export interface FailureNotificationData {
  postTitle: string;
  successfulPlatforms: Array<{ name: string; postUrl?: string }>;
  failedPlatforms: Array<{ name: string; error: string; retryLink: string }>;
  expirationHours: number;
}

/**
 * Renders the failure notification email with both HTML and plain text versions
 */
export function renderFailureNotificationEmail(data: FailureNotificationData): EmailTemplate {
  const failedCount = data.failedPlatforms.length;
  const subject = `Posting failed: ${failedCount} platform${failedCount === 1 ? '' : 's'} need attention`;

  const html = renderFailureHTMLEmail(data);
  const text = renderFailurePlainTextEmail(data);

  return { html, text, subject };
}

function renderFailureHTMLEmail(data: FailureNotificationData): string {
  const successSection = data.successfulPlatforms.length > 0 ? `
          <!-- Successful Platforms -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <div style="background: #d4edda; padding: 16px; border-radius: 8px; border-left: 4px solid #28a745;">
                <strong style="font-size: 14px; color: #155724;">Posted Successfully:</strong>
                ${data.successfulPlatforms.map(p => `
                  <div style="margin: 8px 0 0 0; font-size: 14px; color: #155724;">
                    ${escapeHtml(p.name)}${p.postUrl ? ` - <a href="${escapeHtml(p.postUrl)}" style="color: #155724;">View Post</a>` : ''}
                  </div>
                `).join('')}
              </div>
            </td>
          </tr>` : '';

  const failedSection = `
          <!-- Failed Platforms -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <div style="background: #f8d7da; padding: 16px; border-radius: 8px; border-left: 4px solid #dc3545;">
                <strong style="font-size: 14px; color: #721c24;">Failed to Post:</strong>
                ${data.failedPlatforms.map(p => `
                  <div style="margin: 12px 0 0 0;">
                    <div style="font-size: 14px; color: #721c24; font-weight: 500;">${escapeHtml(p.name)}</div>
                    <div style="font-size: 12px; color: #856404; margin: 4px 0;">Error: ${escapeHtml(p.error)}</div>
                    <a href="${escapeHtml(p.retryLink)}"
                       style="display: inline-block; margin-top: 8px; background-color: #dc3545; color: #ffffff; text-align: center; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 14px;">
                      Retry ${escapeHtml(p.name)}
                    </a>
                  </div>
                `).join('')}
              </div>
            </td>
          </tr>`;

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
                Posting Results
              </h1>
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #57606a;">
                Your digest "${escapeHtml(data.postTitle)}" had some issues during posting.
              </p>
            </td>
          </tr>

          ${successSection}

          ${failedSection}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 32px; border-top: 1px solid #d0d7de; background-color: #f6f8fa;">
              <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: #57606a;">
                <strong>Retry links expire in ${data.expirationHours} hours</strong>
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6e7781;">
                This email was sent from your gh-to-sponsors automation workflow.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderFailurePlainTextEmail(data: FailureNotificationData): string {
  const lines = [
    'POSTING RESULTS',
    '='.repeat(50),
    '',
    `Your digest "${data.postTitle}" had some issues during posting.`,
    '',
  ];

  if (data.successfulPlatforms.length > 0) {
    lines.push(
      'POSTED SUCCESSFULLY',
      '-------------------',
      ''
    );
    for (const p of data.successfulPlatforms) {
      lines.push(`  ${p.name}${p.postUrl ? ` - ${p.postUrl}` : ''}`);
    }
    lines.push('');
  }

  lines.push(
    'FAILED TO POST',
    '--------------',
    ''
  );
  for (const p of data.failedPlatforms) {
    lines.push(`  ${p.name}`);
    lines.push(`    Error: ${p.error}`);
    lines.push(`    Retry: ${p.retryLink}`);
    lines.push('');
  }

  lines.push(
    'IMPORTANT',
    '---------',
    '',
    `Retry links expire in ${data.expirationHours} hours`,
    '',
    'This email was sent from your gh-to-sponsors automation workflow.',
    '',
    '='.repeat(50)
  );

  return lines.join('\n');
}
