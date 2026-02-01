/**
 * Token verification using constant-time HMAC comparison
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TokenPayload, VerificationResult } from '../types/token.js';

/**
 * Verifies a token using constant-time HMAC comparison
 *
 * CRITICAL: Uses timingSafeEqual to prevent timing attacks
 *
 * @param token - Token string to verify
 * @param secret - HMAC secret key
 * @param usedTokens - Optional array of already-used jti values
 * @returns Verification result with postId/action/jti if valid, or reason if invalid
 */
export async function verifyToken(
  token: string,
  secret: string,
  usedTokens?: string[]
): Promise<VerificationResult> {
  try {
    // Parse token format: encoded.signature
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'malformed' };
    }

    const [encoded, signature] = parts;

    if (!encoded || !signature) {
      return { valid: false, reason: 'malformed' };
    }

    // Compute expected signature
    const hmac = createHmac('sha256', secret);
    hmac.update(encoded);
    const expected = hmac.digest('base64url');

    // CRITICAL: Use timingSafeEqual to prevent timing attacks
    // Convert to Buffers (timingSafeEqual requires same-length buffers)
    const signatureBuffer = Buffer.from(signature, 'base64url');
    const expectedBuffer = Buffer.from(expected, 'base64url');

    // timingSafeEqual throws if buffers have different lengths
    // This is good - different lengths = invalid signature
    try {
      if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return { valid: false, reason: 'invalid-signature' };
      }
    } catch {
      // Different buffer lengths (signature tampered)
      return { valid: false, reason: 'invalid-signature' };
    }

    // Signature valid - decode and validate payload
    const payload: TokenPayload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString()
    );

    // Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, reason: 'expired' };
    }

    // Check jti against used tokens (replay prevention)
    if (usedTokens && usedTokens.includes(payload.jti)) {
      return { valid: false, reason: 'already-used' };
    }

    // All checks passed
    return {
      valid: true,
      postId: payload.postId,
      action: payload.action,
      jti: payload.jti
    };
  } catch (error) {
    // Any parsing/decoding error = malformed token
    return { valid: false, reason: 'malformed' };
  }
}
