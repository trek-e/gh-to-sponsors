/**
 * Express server for the approval endpoint
 *
 * Replaces Vercel serverless functions with a containerized server.
 * Handles approval link clicks and status page requests.
 */

import express, { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../tokens/verify.js';
import { getArtifactState, triggerPosting, triggerRetry } from '../vercel/github.js';
import { renderSuccessPage, renderErrorPage, renderStatusPage, renderRetryPage } from '../vercel/pages.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/approve/:token
 *
 * Handles approval link clicks with the following flow:
 * 1. Verify token signature and expiration
 * 2. Check if token already used (jti in usedTokens)
 * 3. Check if post already approved/skipped/posted
 * 4. Trigger repository_dispatch with jti for state update
 * 5. Return appropriate HTML page
 */
app.get('/api/approve/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;

    if (!token) {
      return res.status(400).type('html').send(renderErrorPage('malformed'));
    }

    // Get approval secret from environment
    const secret = process.env.APPROVAL_SECRET;
    if (!secret) {
      console.error('APPROVAL_SECRET environment variable not set');
      return res.status(500).type('text').send('Server configuration error');
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
        return res.status(200).type('html').send(renderErrorPage('already-used'));
      }

      return res.status(statusCode).type('html').send(renderErrorPage(verification.reason));
    }

    // Token is valid - extract payload
    const { postId, action, jti } = verification;

    // Check if post already exists and has been handled
    const post = state.posts[postId];

    // Handle retry action
    if (action === 'retry') {
      // Retry tokens should only work for approved posts that have failed platforms
      if (!post) {
        return res.status(404).type('html').send(renderErrorPage('malformed'));
      }

      // Trigger retry for the specified platforms
      await triggerRetry(postId, verification.platforms, jti);

      // Return retry success page
      return res.status(200).type('html').send(renderRetryPage(verification.platforms));
    }

    // Handle approval/skip actions
    if (post) {
      // If post is already approved, skipped, or posted, show status
      if (post.status === 'approved' || post.status === 'skipped' || post.status === 'posted') {
        return res.status(200).type('html').send(renderStatusPage(post));
      }
    }

    // Valid new approval/skip - trigger repository_dispatch
    await triggerPosting(postId, action, jti);

    // Return success page
    return res.status(200).type('html').send(renderSuccessPage(action));

  } catch (error) {
    console.error('Error processing approval:', error);
    return res.status(500).type('text').send('An error occurred processing your request');
  }
});

/**
 * GET /api/status/:postId
 *
 * Displays the current status of a specific post, including:
 * - Approval status (pending, approved, skipped, posted)
 * - Platform posting results
 * - Timestamps
 */
app.get('/api/status/:postId', async (req: Request, res: Response) => {
  try {
    const postId = req.params.postId as string;

    if (!postId) {
      return res.status(400).type('text').send('Post ID required');
    }

    // Get current state
    const state = await getArtifactState();

    // Find post
    const post = state.posts[postId];

    if (!post) {
      return res.status(404).type('text').send('Post not found');
    }

    // Render status page
    return res.status(200).type('html').send(renderStatusPage(post));

  } catch (error) {
    console.error('Error fetching status:', error);
    return res.status(500).type('text').send('An error occurred fetching post status');
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).type('text').send('Internal server error');
});

// Start server
app.listen(PORT, () => {
  console.log(`Approval server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
