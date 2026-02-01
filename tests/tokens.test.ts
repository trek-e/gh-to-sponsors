/**
 * Token signing and verification tests
 */

import { describe, test, expect } from 'vitest';
import { signToken, generateApprovalToken } from '../src/tokens/sign.js';
import { verifyToken } from '../src/tokens/verify.js';
import type { TokenPayload } from '../src/types/token.js';

const TEST_SECRET = 'test-secret-key-for-hmac';

describe('Token Generation', () => {
  test('generateApprovalToken creates token with all required fields', () => {
    const token = generateApprovalToken('post-123', 'approve', 24, TEST_SECRET);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    // Decode and verify payload structure (without verifying signature)
    const [encoded] = token.split('.');
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());

    expect(payload.postId).toBe('post-123');
    expect(payload.action).toBe('approve');
    expect(payload.exp).toBeGreaterThan(Date.now());
    expect(payload.jti).toBeDefined();
    expect(typeof payload.jti).toBe('string');
    expect(payload.jti.length).toBeGreaterThan(0);
  });

  test('signToken + verifyToken roundtrip succeeds', async () => {
    const payload: TokenPayload = {
      postId: 'post-456',
      action: 'skip',
      exp: Date.now() + 3600000, // 1 hour
      jti: 'test-jti-123'
    };

    const token = signToken(payload, TEST_SECRET);
    const result = await verifyToken(token, TEST_SECRET);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.postId).toBe('post-456');
      expect(result.action).toBe('skip');
      expect(result.jti).toBe('test-jti-123');
    }
  });
});

describe('Token Verification', () => {
  test('expired token returns { valid: false, reason: "expired" }', async () => {
    const payload: TokenPayload = {
      postId: 'post-789',
      action: 'approve',
      exp: Date.now() - 1000, // 1 second ago
      jti: 'expired-jti'
    };

    const token = signToken(payload, TEST_SECRET);
    const result = await verifyToken(token, TEST_SECRET);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('expired');
    }
  });

  test('token with wrong secret returns { valid: false, reason: "invalid-signature" }', async () => {
    const payload: TokenPayload = {
      postId: 'post-999',
      action: 'approve',
      exp: Date.now() + 3600000,
      jti: 'wrong-secret-jti'
    };

    const token = signToken(payload, TEST_SECRET);
    const result = await verifyToken(token, 'wrong-secret');

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('invalid-signature');
    }
  });

  test('token with modified payload returns { valid: false, reason: "invalid-signature" }', async () => {
    const payload: TokenPayload = {
      postId: 'post-111',
      action: 'approve',
      exp: Date.now() + 3600000,
      jti: 'tampered-jti'
    };

    const token = signToken(payload, TEST_SECRET);

    // Tamper with the payload by changing postId
    const [encoded, signature] = token.split('.');
    const tamperedPayload = { ...payload, postId: 'hacked-post' };
    const tamperedEncoded = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
    const tamperedToken = `${tamperedEncoded}.${signature}`;

    const result = await verifyToken(tamperedToken, TEST_SECRET);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('invalid-signature');
    }
  });

  test('token with jti in usedTokens returns { valid: false, reason: "already-used" }', async () => {
    const payload: TokenPayload = {
      postId: 'post-222',
      action: 'skip',
      exp: Date.now() + 3600000,
      jti: 'used-jti-123'
    };

    const token = signToken(payload, TEST_SECRET);
    const usedTokens = ['used-jti-123', 'another-used-jti'];

    const result = await verifyToken(token, TEST_SECRET, usedTokens);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('already-used');
    }
  });

  test('garbage input returns { valid: false, reason: "malformed" }', async () => {
    const result = await verifyToken('not-a-valid-token', TEST_SECRET);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('malformed');
    }
  });

  test('empty string returns { valid: false, reason: "malformed" }', async () => {
    const result = await verifyToken('', TEST_SECRET);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('malformed');
    }
  });

  test('token without signature returns { valid: false, reason: "malformed" }', async () => {
    const payload: TokenPayload = {
      postId: 'post-333',
      action: 'approve',
      exp: Date.now() + 3600000,
      jti: 'no-sig-jti'
    };

    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tokenWithoutSignature = encoded; // No dot, no signature

    const result = await verifyToken(tokenWithoutSignature, TEST_SECRET);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('malformed');
    }
  });
});
