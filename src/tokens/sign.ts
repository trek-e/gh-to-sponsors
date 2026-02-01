/**
 * Token signing and generation using HMAC-SHA256
 */

import { createHmac, randomUUID } from 'node:crypto';
import type { TokenPayload } from '../types/token.js';

/**
 * Signs a token payload with HMAC-SHA256
 *
 * Token format: base64url(JSON.stringify(payload)).base64url(hmac_signature)
 *
 * @param payload - Token payload to sign
 * @param secret - HMAC secret key
 * @returns Signed token string
 */
export function signToken(payload: TokenPayload, secret: string): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString('base64url');

  const hmac = createHmac('sha256', secret);
  hmac.update(encoded);
  const signature = hmac.digest('base64url');

  return `${encoded}.${signature}`;
}

/**
 * Generates an approval token for a post
 *
 * Creates a token with:
 * - postId: The post to approve/skip
 * - action: 'approve' or 'skip'
 * - exp: Expiration timestamp (now + ttlHours)
 * - jti: Unique token ID for replay prevention
 *
 * @param postId - Post identifier
 * @param action - Action to perform ('approve' or 'skip')
 * @param ttlHours - Token time-to-live in hours
 * @param secret - HMAC secret key
 * @returns Signed token string
 */
export function generateApprovalToken(
  postId: string,
  action: 'approve' | 'skip',
  ttlHours: number,
  secret: string
): string {
  const payload: TokenPayload = {
    postId,
    action,
    exp: Date.now() + (ttlHours * 60 * 60 * 1000),
    jti: randomUUID()
  };

  return signToken(payload, secret);
}
