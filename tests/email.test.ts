/**
 * Email functionality tests
 */

import { describe, it, expect } from 'vitest';
import { createEmailProvider } from '../src/email/factory.js';
import { renderApprovalEmail } from '../src/email/templates.js';
import { ResendProvider } from '../src/email/resend.js';
import { SESProvider } from '../src/email/ses.js';
import { SendGridProvider } from '../src/email/sendgrid.js';

describe('Email Provider Factory', () => {
  it('creates ResendProvider for resend config', () => {
    const provider = createEmailProvider({
      provider: 'resend',
      apiKey: 'test-key',
      fromEmail: 'test@example.com'
    });

    expect(provider).toBeInstanceOf(ResendProvider);
  });

  it('creates SESProvider for ses config', () => {
    const provider = createEmailProvider({
      provider: 'ses',
      apiKey: 'test-key',
      fromEmail: 'test@example.com'
    });

    expect(provider).toBeInstanceOf(SESProvider);
  });

  it('creates SendGridProvider for sendgrid config', () => {
    const provider = createEmailProvider({
      provider: 'sendgrid',
      apiKey: 'test-key',
      fromEmail: 'test@example.com'
    });

    expect(provider).toBeInstanceOf(SendGridProvider);
  });

  it('throws error for unknown provider', () => {
    expect(() => {
      createEmailProvider({
        provider: 'unknown' as any,
        apiKey: 'test-key',
        fromEmail: 'test@example.com'
      });
    }).toThrow('Unknown email provider: unknown');
  });
});

describe('Email Providers', () => {
  it('ResendProvider has send method', () => {
    const provider = new ResendProvider('test-key', 'test@example.com');
    expect(provider.send).toBeDefined();
    expect(typeof provider.send).toBe('function');
  });

  it('SESProvider has send method', () => {
    const provider = new SESProvider('us-east-1', 'test@example.com');
    expect(provider.send).toBeDefined();
    expect(typeof provider.send).toBe('function');
  });

  it('SendGridProvider has send method', () => {
    const provider = new SendGridProvider('test-key', 'test@example.com');
    expect(provider.send).toBeDefined();
    expect(typeof provider.send).toBe('function');
  });
});

describe('Approval Email Templates', () => {
  const testData = {
    summary: 'You have 3 new releases and 5 pull requests to share with your supporters.',
    itemCount: 3,
    approveLink: 'https://example.com/approve/abc123',
    skipLink: 'https://example.com/skip/abc123',
    previewLink: 'https://example.com/preview/abc123',
    expirationHours: 24
  };

  it('returns object with html, text, and subject', () => {
    const result = renderApprovalEmail(testData);

    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('subject');
    expect(typeof result.html).toBe('string');
    expect(typeof result.text).toBe('string');
    expect(typeof result.subject).toBe('string');
  });

  it('subject contains item count', () => {
    const result = renderApprovalEmail(testData);
    expect(result.subject).toContain('3');
    expect(result.subject).toMatch(/items?/i);
  });

  it('subject handles singular item count', () => {
    const singleItem = { ...testData, itemCount: 1 };
    const result = renderApprovalEmail(singleItem);
    expect(result.subject).toContain('1 item');
    expect(result.subject).not.toContain('items');
  });

  it('HTML contains approve link', () => {
    const result = renderApprovalEmail(testData);
    expect(result.html).toContain(testData.approveLink);
    expect(result.html).toContain('Approve and Post');
  });

  it('HTML contains skip link', () => {
    const result = renderApprovalEmail(testData);
    expect(result.html).toContain(testData.skipLink);
    expect(result.html).toContain('Skip');
  });

  it('HTML contains summary text', () => {
    const result = renderApprovalEmail(testData);
    expect(result.html).toContain(testData.summary);
  });

  it('HTML contains expiration hours', () => {
    const result = renderApprovalEmail(testData);
    expect(result.html).toContain('24 hours');
  });

  it('HTML contains preview link when provided', () => {
    const result = renderApprovalEmail(testData);
    expect(result.html).toContain(testData.previewLink!);
    expect(result.html).toContain('Preview full content');
  });

  it('HTML omits preview link when not provided', () => {
    const noPreview = { ...testData, previewLink: undefined };
    const result = renderApprovalEmail(noPreview);
    expect(result.html).not.toContain('Preview full content');
  });

  it('Plain text contains approve link', () => {
    const result = renderApprovalEmail(testData);
    expect(result.text).toContain(testData.approveLink);
    expect(result.text).toMatch(/approve/i);
  });

  it('Plain text contains skip link', () => {
    const result = renderApprovalEmail(testData);
    expect(result.text).toContain(testData.skipLink);
    expect(result.text).toMatch(/skip/i);
  });

  it('Plain text contains summary', () => {
    const result = renderApprovalEmail(testData);
    expect(result.text).toContain(testData.summary);
  });

  it('Plain text contains expiration hours', () => {
    const result = renderApprovalEmail(testData);
    expect(result.text).toContain('24 hours');
  });

  it('HTML escapes special characters', () => {
    const xssData = {
      ...testData,
      summary: 'Test <script>alert("xss")</script> content',
      approveLink: 'https://example.com/approve?test=1&foo=2',
      skipLink: 'https://example.com/skip?test=1&foo=2'
    };
    const result = renderApprovalEmail(xssData);

    // Script tags should be escaped
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');

    // Ampersands in URLs should be escaped
    expect(result.html).toContain('&amp;');
  });

  it('HTML has both approve and skip buttons at top', () => {
    const result = renderApprovalEmail(testData);
    const firstButtonSection = result.html.split('<!-- Footer -->')[0];
    const approveMatches = (firstButtonSection.match(/Approve and Post/g) || []).length;
    const skipMatches = (firstButtonSection.match(/Skip/g) || []).length;

    expect(approveMatches).toBeGreaterThanOrEqual(1);
    expect(skipMatches).toBeGreaterThanOrEqual(1);
  });

  it('HTML has both approve and skip buttons at bottom', () => {
    const result = renderApprovalEmail(testData);
    const bottomSection = result.html.split('<!-- Action Buttons (Bottom) -->')[1];

    expect(bottomSection).toContain('Approve and Post');
    expect(bottomSection).toContain('Skip');
    expect(bottomSection).toContain(testData.approveLink);
    expect(bottomSection).toContain(testData.skipLink);
  });

  it('Plain text has links in multiple locations', () => {
    const result = renderApprovalEmail(testData);
    const approveMatches = (result.text.match(new RegExp(testData.approveLink, 'g')) || []).length;
    const skipMatches = (result.text.match(new RegExp(testData.skipLink, 'g')) || []).length;

    // Links should appear at least twice (top actions and quick actions)
    expect(approveMatches).toBeGreaterThanOrEqual(2);
    expect(skipMatches).toBeGreaterThanOrEqual(2);
  });
});
