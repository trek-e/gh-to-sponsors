#!/usr/bin/env node
/**
 * Generate digest action
 *
 * Generates a content digest, sends approval email, and updates state.
 * This is executed by GitHub Actions on a schedule or manual trigger.
 */

import { loadConfig } from '../config/load.js';
import { loadState, saveState, createPost } from '../state/index.js';
import { generateApprovalToken } from '../tokens/index.js';
import { sendApprovalEmail } from './send-email.js';
import { createHash } from 'node:crypto';

async function main() {
  try {
    console.log('🚀 Starting digest generation...');

    // Load configuration
    const config = await loadConfig();
    console.log('✓ Configuration loaded');

    // Load current state
    const state = await loadState();
    console.log('✓ State loaded');

    // Get environment variables
    const approvalSecret = process.env.APPROVAL_SECRET;
    const approvalEndpointUrl = process.env.APPROVAL_ENDPOINT_URL;
    const emailFrom = process.env.EMAIL_FROM;

    if (!approvalSecret) {
      throw new Error('APPROVAL_SECRET environment variable is required');
    }
    if (!approvalEndpointUrl) {
      throw new Error('APPROVAL_ENDPOINT_URL environment variable is required');
    }
    if (!emailFrom) {
      throw new Error('EMAIL_FROM environment variable is required');
    }

    // For Phase 1: Create stub digest (real content generation is Phase 2)
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Create a stub digest with placeholder content
    const stubDigest = {
      summary: `Your content digest for ${dateStr} is ready for review.`,
      itemCount: 1,
      items: [
        {
          type: 'placeholder',
          title: 'Test Digest Item',
          date: now.toISOString()
        }
      ]
    };

    // Generate a content hash for the digest (used as post ID)
    const contentHash = createHash('sha256')
      .update(JSON.stringify(stubDigest))
      .digest('hex')
      .substring(0, 16);

    const postId = `digest-${contentHash}`;

    // Check if this digest already exists
    if (state.posts[postId]) {
      console.log(`ℹ️  Digest ${postId} already exists with status: ${state.posts[postId].status}`);
      console.log('✓ No action needed');
      return;
    }

    console.log(`✓ Generated stub digest (Post ID: ${postId})`);

    // Generate approval tokens
    const ttlHours = config.approval.expirationHours;
    const approveToken = generateApprovalToken(postId, 'approve', ttlHours, approvalSecret);
    const skipToken = generateApprovalToken(postId, 'skip', ttlHours, approvalSecret);

    const approveLink = `${approvalEndpointUrl}/api/approve/${approveToken}`;
    const skipLink = `${approvalEndpointUrl}/api/approve/${skipToken}`;

    console.log('✓ Generated approval tokens');
    console.log(`  - Approve: ${approveLink.substring(0, 60)}...`);
    console.log(`  - Skip: ${skipLink.substring(0, 60)}...`);

    // Send approval email
    await sendApprovalEmail(
      config,
      {
        summary: stubDigest.summary,
        itemCount: stubDigest.itemCount,
        approveLink,
        skipLink,
        expirationHours: ttlHours
      }
    );

    console.log('✓ Approval email sent');

    // Update state with new pending post
    let newState = createPost(state, {
      id: postId,
      contentHash,
      status: 'pending',
      platforms: {}
    });

    // Update lastRun timestamp
    newState = {
      ...newState,
      lastRun: now.toISOString()
    };

    // Save state
    await saveState(newState);
    console.log('✓ State saved');

    console.log('✅ Digest generation complete!');
  } catch (error) {
    console.error('❌ Error generating digest:', error);
    process.exit(1);
  }
}

main();
