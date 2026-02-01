/**
 * Token and verification type definitions
 */

export type TokenAction = 'approve' | 'skip';
export type TokenReason = 'expired' | 'invalid-signature' | 'already-used' | 'malformed';

export interface TokenPayload {
  postId: string;
  action: TokenAction;
  exp: number;
  jti: string;
}

export type VerificationResult =
  | { valid: true; postId: string; action: TokenAction; jti: string }
  | { valid: false; reason: TokenReason };
