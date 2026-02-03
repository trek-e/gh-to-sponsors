#!/usr/bin/env node
/**
 * Handle release announcement action
 *
 * Processes GitHub release events and sends approval email for announcement.
 * This is triggered by the handle-release workflow on release publish.
 */

import { loadConfig } from '../config/load.js';
import { loadState, saveState, createPost } from '../state/index.js';
import { generateApprovalToken } from '../tokens/index.js';
import { sendApprovalEmail } from './send-email.js';
import { createHash } from 'node:crypto';
import { generateReleaseContent, buildReleaseAnnouncement } from '../releases/index.js';
import type { ReleasePayload } from '../releases/types.js';

async function main() {
  try {
    console.log('Processing release announcement...');

    // Parse release from environment variables
    const releasePayload: ReleasePayload = {
      id: parseInt(process.env.RELEASE_ID || '0', 10),
      tag_name: process.env.RELEASE_TAG || '',
      name: process.env.RELEASE_NAME || null,
      body: process.env.RELEASE_BODY || null,
      html_url: process.env.RELEASE_URL || '',
      draft: process.env.RELEASE_DRAFT === 'true',
      prerelease: process.env.RELEASE_PRERELEASE === 'true',
      published_at: new Date().toISOString(),
      assets: JSON.parse(process.env.RELEASE_ASSETS || '[]'),
    };

    const repoName = process.env.REPO_FULL_NAME || '';

    if (!releasePayload.tag_name) {
      throw new Error('RELEASE_TAG environment variable is required');
    }

    console.log(`Release: ${releasePayload.tag_name} (${repoName})`);
    console.log(`Pre-release: ${releasePayload.prerelease}`);

    // Load config and state
    const config = await loadConfig();
    const state = await loadState();

    // Check required env vars
    const approvalSecret = process.env.APPROVAL_SECRET;
    const approvalEndpointUrl = process.env.APPROVAL_ENDPOINT_URL;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!approvalSecret || !approvalEndpointUrl || !anthropicApiKey) {
      throw new Error('Missing required environment variables');
    }

    // Generate release content using AI
    console.log('Generating release announcement content...');
    const contentResult = await generateReleaseContent(
      releasePayload,
      repoName,
      anthropicApiKey
    );

    console.log(`Generated announcement: ${contentResult.postContent.length} chars`);
    console.log(`Generated teaser: ${contentResult.teaser.text} (${contentResult.teaser.characterCount} chars)`);

    // Generate post ID from release tag (unique per release)
    const contentHash = createHash('sha256')
      .update(`${repoName}-${releasePayload.tag_name}`)
      .digest('hex')
      .substring(0, 16);

    const postId = `release-${contentHash}`;

    // Check if already processed
    if (state.posts[postId]) {
      console.log(`Release ${releasePayload.tag_name} already processed (${postId})`);
      return;
    }

    // Generate approval tokens
    const ttlHours = config.approval.expirationHours;
    const approveToken = generateApprovalToken(postId, 'approve', ttlHours, approvalSecret);
    const skipToken = generateApprovalToken(postId, 'skip', ttlHours, approvalSecret);

    const approveLink = `${approvalEndpointUrl}/api/approve/${approveToken}`;
    const skipLink = `${approvalEndpointUrl}/api/approve/${skipToken}`;

    // Send approval email (reuse existing function with release-specific content)
    await sendApprovalEmail(
      config,
      {
        summary: contentResult.postContent,
        teaser: contentResult.teaser.text,
        hashtags: contentResult.teaser.hashtags,
        itemCount: 1,  // Single release
        repos: [repoName],
        periodType: 'release',  // Special indicator
        approveLink,
        skipLink,
        expirationHours: ttlHours,
      }
    );

    console.log('Approval email sent');

    // Build release announcement for state
    const announcement = buildReleaseAnnouncement(releasePayload, repoName);

    // Update state
    const now = new Date();
    let newState = createPost(state, {
      id: postId,
      contentHash,
      status: 'pending',
      platforms: {},
      release: announcement,
      // Also store digest/teaser for platform posting
      digest: {
        title: `Release: ${releasePayload.tag_name}`,
        content: contentResult.postContent,
        repos: [repoName],
        commitCount: 0,
        periodType: 'daily' as const,  // Use 'daily' for immediate release posting
        generatedAt: now.toISOString(),
      },
      teaser: contentResult.teaser,
    });

    newState = { ...newState, lastRun: now.toISOString() };
    await saveState(newState);

    console.log('Release announcement processed successfully!');
  } catch (error) {
    console.error('Error processing release:', error);
    process.exit(1);
  }
}

main();
