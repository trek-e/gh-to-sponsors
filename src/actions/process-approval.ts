#!/usr/bin/env node
/**
 * Process approval action
 *
 * Processes approval/skip actions from repository_dispatch events.
 * On approval, posts to all configured platforms.
 */

import { loadState, saveState, updatePostStatus, markTokenUsed, updatePlatformResults } from '../state/index.js';
import { getReadyPlatforms } from '../platforms/setup.js';
import { postToAllPlatforms, resultsToStateFormat, type PlatformPostResult } from '../platforms/executor.js';
import { generateRetryToken } from '../tokens/index.js';
import { createEmailProvider, renderFailureNotificationEmail, type FailureNotificationData } from '../email/index.js';
import { loadConfig } from '../config/load.js';

/**
 * Sends failure notification email with retry links for failed platforms
 */
async function sendFailureNotification(
  postId: string,
  postTitle: string,
  results: PlatformPostResult[]
): Promise<void> {
  try {
    console.log('Sending failure notification email...');

    // Get required environment variables
    const hmacSecret = process.env.HMAC_SECRET;
    const approvalUrl = process.env.APPROVAL_URL;

    if (!hmacSecret) {
      console.warn('HMAC_SECRET not set - cannot generate retry tokens');
      return;
    }

    if (!approvalUrl) {
      console.warn('APPROVAL_URL not set - cannot generate retry links');
      return;
    }

    // Load config for email provider
    const config = await loadConfig();
    const emailProvider = createEmailProvider(config.email);

    // Get notification email (fall back to fromEmail if not set)
    const notificationEmail = process.env.NOTIFICATION_EMAIL || config.email.fromEmail;

    // Default expiration hours (match approval token expiration)
    const expirationHours = config.approval.expirationHours;

    // Build failure notification data
    const successfulPlatforms = results
      .filter(r => r.success)
      .map(r => ({
        name: r.platform,
        postUrl: r.postUrl
      }));

    const failedPlatforms = results
      .filter(r => !r.success)
      .map(r => {
        // Generate retry token for this specific platform
        const retryToken = generateRetryToken(postId, [r.platform], expirationHours, hmacSecret);
        const retryLink = `${approvalUrl}/api/approve/${retryToken}`;

        return {
          name: r.platform,
          error: r.error || 'Unknown error',
          retryLink
        };
      });

    const notificationData: FailureNotificationData = {
      postTitle,
      successfulPlatforms,
      failedPlatforms,
      expirationHours
    };

    // Render and send email
    const email = renderFailureNotificationEmail(notificationData);

    const result = await emailProvider.send({
      to: notificationEmail,
      subject: email.subject,
      html: email.html,
      text: email.text
    });

    if (result.success) {
      console.log(`Failure notification sent to ${notificationEmail}`);
    } else {
      console.error(`Failed to send failure notification: ${result.error}`);
    }
  } catch (error) {
    // Don't fail the whole approval process if notification fails
    console.error('Error sending failure notification:', error);
  }
}

async function main() {
  try {
    console.log('Starting approval processing...');

    // Get payload from environment variables
    const postId = process.env.POST_ID;
    const action = process.env.ACTION;
    const jti = process.env.JTI;
    const timestamp = process.env.TIMESTAMP;

    if (!postId) {
      throw new Error('POST_ID environment variable is required');
    }
    if (!action) {
      throw new Error('ACTION environment variable is required');
    }
    if (!jti) {
      throw new Error('JTI environment variable is required');
    }

    console.log(`Processing: ${action} for post ${postId}`);
    console.log(`Token ID: ${jti}`);
    console.log(`Timestamp: ${timestamp}`);

    // Load current state
    let state = await loadState();
    console.log('State loaded');

    // Check if post exists
    const post = state.posts[postId];
    if (!post) {
      console.error(`Post ${postId} not found in state`);
      process.exit(1);
    }

    // Check if jti already used
    if (state.usedTokens.includes(jti)) {
      console.log(`Token ${jti} already used - this is a duplicate request`);
      console.log('No action needed');
      return;
    }

    // Update state based on action
    if (action === 'skip') {
      console.log('Marking digest as skipped...');
      state = updatePostStatus(state, postId, 'skipped');
      console.log('Digest skipped');
    } else if (action === 'approve') {
      console.log('Marking digest as approved...');
      state = updatePostStatus(state, postId, 'approved');

      // Post to all configured platforms
      const platforms = getReadyPlatforms();
      console.log(`Found ${platforms.length} configured platform(s): ${platforms.map(p => p.name).join(', ') || 'none'}`);

      if (platforms.length > 0) {
        console.log('Posting to platforms...');
        const summary = await postToAllPlatforms(platforms, post);

        // Update state with platform results
        const platformStates = resultsToStateFormat(summary.results);
        state = updatePlatformResults(state, postId, platformStates);

        // Log results
        if (summary.allSucceeded) {
          console.log(`Posted successfully to all ${platforms.length} platform(s)`);
          state = updatePostStatus(state, postId, 'posted');
        } else if (summary.anySucceeded) {
          console.log(`Partial success: ${summary.successfulPlatforms.join(', ')}`);
          console.log(`Failed: ${summary.failedPlatforms.join(', ')}`);
          // Keep status as 'approved' for partial success - user may want to retry failed
        } else {
          console.log(`All platforms failed: ${summary.failedPlatforms.join(', ')}`);
          // Keep status as 'approved' - user may want to retry
        }

        // Log individual results
        for (const result of summary.results) {
          if (result.success) {
            console.log(`  ${result.platform}: ${result.postUrl || 'posted'}`);
          } else {
            console.log(`  ${result.platform}: FAILED - ${result.error}`);
          }
        }

        // Send failure notification if any platforms failed
        if (summary.failedPlatforms.length > 0) {
          const postTitle = post.digest?.title || 'Digest';
          await sendFailureNotification(postId, postTitle, summary.results);
        }
      } else {
        console.log('No platforms configured - digest approved but not posted');
      }
    } else {
      console.error(`Unknown action: ${action}`);
      process.exit(1);
    }

    // Mark token as used for replay prevention
    state = markTokenUsed(state, jti);
    console.log('Token marked as used');

    // Save updated state
    await saveState(state);
    console.log('State saved');

    console.log('Approval processing complete!');
  } catch (error) {
    console.error('Error processing approval:', error);
    process.exit(1);
  }
}

main();
