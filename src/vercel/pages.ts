/**
 * HTML response page rendering for Vercel Functions
 *
 * Generates mobile-friendly HTML pages for approval responses,
 * errors, and status views.
 */

import type { PostState } from '../types/state.js';
import type { TokenReason } from '../types/token.js';

/**
 * Base HTML template with responsive styling
 */
function baseTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      margin-top: 0;
      color: #0070f3;
      font-size: 24px;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .platforms {
      margin: 20px 0;
      padding: 15px;
      background: #f8f8f8;
      border-radius: 4px;
    }
    .platform-item {
      margin: 8px 0;
      padding: 8px;
      border-left: 3px solid #0070f3;
      padding-left: 12px;
    }
    .success {
      border-left-color: #0070f3;
    }
    .failed {
      border-left-color: #e00;
    }
    .footer {
      margin-top: 30px;
      font-size: 14px;
      color: #666;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
</body>
</html>`.trim();
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
 * Renders success page after approval/skip
 */
export function renderSuccessPage(action: 'approve' | 'skip'): string {
  const icon = action === 'approve' ? '✓' : '⊘';
  const title = action === 'approve' ? 'Approved!' : 'Skipped';
  const message = action === 'approve'
    ? 'Your digest will be posted to all configured platforms.'
    : 'This digest will not be posted. You can review the next one when it\'s ready.';

  const content = `
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p class="message">${message}</p>
    <div class="footer">
      <p>You can safely close this page. You'll receive confirmation once posting is complete.</p>
    </div>
  `;

  return baseTemplate(title, content);
}

/**
 * Renders error page for invalid/expired tokens
 */
export function renderErrorPage(reason: TokenReason): string {
  const messages: Record<TokenReason, { title: string; message: string; icon: string }> = {
    'expired': {
      title: 'Link Expired',
      message: 'This approval link has expired. Check your email for a new digest notification.',
      icon: '⏱'
    },
    'invalid-signature': {
      title: 'Invalid Link',
      message: 'This link is invalid. Please use the link from your email without modification.',
      icon: '⚠'
    },
    'already-used': {
      title: 'Already Used',
      message: 'This link has already been used. See the status below.',
      icon: 'ℹ'
    },
    'malformed': {
      title: 'Invalid Link Format',
      message: 'This link appears to be corrupted. Please use the original link from your email.',
      icon: '⚠'
    }
  };

  const config = messages[reason];

  const content = `
    <div class="icon">${config.icon}</div>
    <h1>${config.title}</h1>
    <p class="message">${config.message}</p>
    <div class="footer">
      <p>If you continue to have issues, please check that you're using the complete link from your email.</p>
    </div>
  `;

  return baseTemplate(config.title, content);
}

/**
 * Renders status page for already-approved posts
 */
export function renderStatusPage(post: PostState): string {
  const statusMessages = {
    'pending': 'This digest is pending approval.',
    'approved': 'This digest has been approved and is being posted.',
    'skipped': 'This digest was skipped.',
    'posted': 'This digest has been posted.'
  };

  const platformList = Object.entries(post.platforms).length > 0
    ? Object.entries(post.platforms)
        .map(([platform, result]) => {
          const statusClass = result.status === 'success' ? 'success' : 'failed';
          const icon = result.status === 'success' ? '✓' : '✗';
          const displayText = result.postUrl
            ? `<a href="${escapeHtml(result.postUrl)}">${result.status}</a>`
            : result.status;
          return `<div class="platform-item ${statusClass}">${icon} ${escapeHtml(platform)}: ${displayText}</div>`;
        })
        .join('\n')
    : '<p>No platform posting results yet.</p>';

  const content = `
    <div class="icon">ℹ</div>
    <h1>Digest Status</h1>
    <p class="message">${statusMessages[post.status]}</p>
    ${Object.entries(post.platforms).length > 0 ? `
      <div class="platforms">
        <strong>Platform Results:</strong>
        ${platformList}
      </div>
    ` : ''}
    <div class="footer">
      <p>
        <strong>Created:</strong> ${new Date(post.createdAt).toLocaleString()}<br>
        ${post.approvedAt ? `<strong>Approved:</strong> ${new Date(post.approvedAt).toLocaleString()}<br>` : ''}
        <strong>Status:</strong> ${post.status}
      </p>
    </div>
  `;

  return baseTemplate('Digest Status', content);
}

/**
 * Renders a simple loading page
 */
export function renderLoadingPage(): string {
  const content = `
    <div class="icon">⏳</div>
    <h1>Processing...</h1>
    <p class="message">Please wait while we process your request.</p>
  `;

  return baseTemplate('Processing', content);
}
