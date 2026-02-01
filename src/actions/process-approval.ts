#!/usr/bin/env node
/**
 * Process approval action
 *
 * Processes approval/skip actions from repository_dispatch events.
 * This is executed by GitHub Actions when user clicks approval link.
 */

import { loadState, saveState, updatePostStatus, markTokenUsed } from '../state/index.js';

async function main() {
  try {
    console.log('🚀 Starting approval processing...');

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
    const state = await loadState();
    console.log('✓ State loaded');

    // Check if post exists
    if (!state.posts[postId]) {
      console.error(`❌ Post ${postId} not found in state`);
      process.exit(1);
    }

    // Check if jti already used
    if (state.usedTokens.includes(jti)) {
      console.log(`ℹ️  Token ${jti} already used - this is a duplicate request`);
      console.log('✓ No action needed');
      return;
    }

    // Update state based on action
    let newState = state;

    if (action === 'skip') {
      console.log('Marking digest as skipped...');
      newState = updatePostStatus(state, postId, 'skipped');
      console.log('✓ Digest skipped');
    } else if (action === 'approve') {
      console.log('Marking digest as approved...');
      newState = updatePostStatus(state, postId, 'approved');
      console.log('✓ Digest approved');
      console.log('ℹ️  Platform posting will occur in Phase 3+');
    } else {
      console.error(`❌ Unknown action: ${action}`);
      process.exit(1);
    }

    // Mark token as used for replay prevention
    newState = markTokenUsed(newState, jti);
    console.log('✓ Token marked as used');

    // Save updated state
    await saveState(newState);
    console.log('✓ State saved');

    console.log('✅ Approval processing complete!');
  } catch (error) {
    console.error('❌ Error processing approval:', error);
    process.exit(1);
  }
}

main();
