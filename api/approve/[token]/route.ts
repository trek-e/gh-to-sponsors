/**
 * Vercel Function: Approval endpoint
 *
 * Handles approval link clicks from digest emails.
 * Validates token, checks state, and triggers repository_dispatch.
 */

import { verifyToken } from '../../../src/tokens/verify.js';
import { getArtifactState, triggerPosting } from '../../../src/vercel/github.js';
import { renderSuccessPage, renderErrorPage, renderStatusPage } from '../../../src/vercel/pages.js';

/**
 * GET /api/approve/[token]
 *
 * Handles approval link clicks with the following flow:
 * 1. Verify token signature and expiration
 * 2. Check if token already used (jti in usedTokens)
 * 3. Check if post already approved/skipped/posted
 * 4. Trigger repository_dispatch with jti for state update
 * 5. Return appropriate HTML page
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Extract token from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const token = pathParts[pathParts.length - 1];

    if (!token) {
      return new Response(renderErrorPage('malformed'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Get approval secret from environment
    const secret = process.env.APPROVAL_SECRET;
    if (!secret) {
      console.error('APPROVAL_SECRET environment variable not set');
      return new Response('Server configuration error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Get current state to check for used tokens
    const state = await getArtifactState();

    // Verify token
    const verification = verifyToken(token, secret, state.usedTokens);

    // Handle invalid tokens
    if (!verification.valid) {
      const statusCode = verification.reason === 'expired' ? 410 : 403;

      // If already used, show status page instead of error
      if (verification.reason === 'already-used') {
        // We can't get postId from invalid token, so show generic message
        return new Response(renderErrorPage('already-used'), {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      }

      return new Response(renderErrorPage(verification.reason), {
        status: statusCode,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Token is valid - extract payload
    const { postId, action, jti } = verification;

    // Check if post already exists and has been handled
    const post = state.posts[postId];

    if (post) {
      // If post is already approved, skipped, or posted, show status
      if (post.status === 'approved' || post.status === 'skipped' || post.status === 'posted') {
        return new Response(renderStatusPage(post), {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }

    // Valid new approval/skip - trigger repository_dispatch
    // The GitHub Action will update state (add jti to usedTokens, update post status)
    await triggerPosting(postId, action, jti);

    // Return success page
    return new Response(renderSuccessPage(action), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error processing approval:', error);
    return new Response('An error occurred processing your request', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
