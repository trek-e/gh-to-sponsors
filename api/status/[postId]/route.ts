/**
 * Vercel Function: Status endpoint
 *
 * Shows current status of a digest post.
 */

import { getArtifactState } from '../../../src/vercel/github.js';
import { renderStatusPage, renderErrorPage } from '../../../src/vercel/pages.js';

/**
 * GET /api/status/[postId]
 *
 * Displays the current status of a specific post, including:
 * - Approval status (pending, approved, skipped, posted)
 * - Platform posting results
 * - Timestamps
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Extract postId from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const postId = pathParts[pathParts.length - 1];

    if (!postId) {
      return new Response('Post ID required', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Get current state
    const state = await getArtifactState();

    // Find post
    const post = state.posts[postId];

    if (!post) {
      return new Response('Post not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Render status page
    return new Response(renderStatusPage(post), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error fetching status:', error);
    return new Response('An error occurred fetching post status', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
