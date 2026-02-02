/**
 * Token and verification type definitions
 */

export type TokenAction = 'approve' | 'skip' | 'retry';
export type TokenReason = 'expired' | 'invalid-signature' | 'already-used' | 'malformed';

/**
 * Base token payload fields shared by all token types
 */
interface BaseTokenPayload {
  postId: string;
  exp: number;
  jti: string;
}

/**
 * Approval token payload for approve/skip actions
 */
export interface ApprovalTokenPayload extends BaseTokenPayload {
  action: 'approve' | 'skip';
}

/**
 * Retry token payload for retrying failed platform posts
 */
export interface RetryTokenPayload extends BaseTokenPayload {
  action: 'retry';
  platforms: string[];  // Which platforms to retry
}

/**
 * Union type for all token payloads
 */
export type TokenPayload = ApprovalTokenPayload | RetryTokenPayload;

/**
 * Base verification result for valid tokens
 */
interface BaseValidResult {
  valid: true;
  postId: string;
  jti: string;
}

/**
 * Verification result for approval tokens
 */
interface ApprovalVerificationResult extends BaseValidResult {
  action: 'approve' | 'skip';
}

/**
 * Verification result for retry tokens
 */
interface RetryVerificationResult extends BaseValidResult {
  action: 'retry';
  platforms: string[];
}

/**
 * Verification result union type
 */
export type VerificationResult =
  | ApprovalVerificationResult
  | RetryVerificationResult
  | { valid: false; reason: TokenReason };
