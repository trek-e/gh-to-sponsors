#!/usr/bin/env node
/**
 * Generate digest action
 *
 * Generates a content digest using AI, sends approval email, and updates state.
 * This is executed by GitHub Actions on a schedule or manual trigger.
 */

import { Octokit } from '@octokit/rest';
import { loadConfig } from '../config/load.js';
import { loadState, saveState, createPost } from '../state/index.js';
import { generateApprovalToken } from '../tokens/index.js';
import { sendApprovalEmail } from './send-email.js';
import { createHash } from 'node:crypto';
import {
  aggregateMultiRepoCommits,
  filterByActivity,
  prepareCommitContexts
} from '../github/index.js';
import { generateContent } from '../content/index.js';

async function main() {
  try {
    console.log('Starting digest generation...');

    // Load configuration
    const config = await loadConfig();
    console.log('Configuration loaded');

    // Load current state
    const state = await loadState();
    console.log('State loaded');

    // Get environment variables
    const approvalSecret = process.env.APPROVAL_SECRET;
    const approvalEndpointUrl = process.env.APPROVAL_ENDPOINT_URL;
    const emailFrom = process.env.EMAIL_FROM;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const githubToken = process.env.GITHUB_TOKEN;

    if (!approvalSecret) {
      throw new Error('APPROVAL_SECRET environment variable is required');
    }
    if (!approvalEndpointUrl) {
      throw new Error('APPROVAL_ENDPOINT_URL environment variable is required');
    }
    if (!emailFrom) {
      throw new Error('EMAIL_FROM environment variable is required');
    }
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    const now = new Date();

    // Initialize Octokit
    const octokit = new Octokit({ auth: githubToken });

    // Fetch and aggregate commits from all configured repos
    console.log(`Fetching commits from ${config.github.repos.length} repo(s)...`);
    const repoGroups = await aggregateMultiRepoCommits(
      octokit,
      config.github.repos,
      7 // Look back 7 days
    );

    // Filter by activity thresholds
    const thresholds = config.content || { dailyThreshold: 1, weeklyThreshold: 3 };
    const activity = filterByActivity(repoGroups, thresholds);

    // Check if there's meaningful activity
    if (!activity.hasActivity) {
      console.log('No meaningful activity found. Skipping digest generation.');
      // Update lastRun but don't create a post
      const newState = { ...state, lastRun: now.toISOString() };
      await saveState(newState);
      return;
    }

    console.log(`Found ${activity.commits.length} commits (${activity.periodType})`);

    // Prepare context for LLM
    const contexts = prepareCommitContexts(repoGroups, activity.periodType as 'daily' | 'weekly');

    // Generate content
    console.log('Generating content with AI...');
    const result = await generateContent(contexts, activity.periodType as 'daily' | 'weekly', anthropicApiKey);

    console.log(`Generated digest: ${result.digest.content.length} chars`);
    console.log(`Generated teaser: ${result.teaser.text} (${result.teaser.characterCount} chars)`);
    console.log(`Token usage: ${result.usage.inputTokens} in, ${result.usage.outputTokens} out`);

    // Generate a content hash for the digest (used as post ID)
    const contentHash = createHash('sha256')
      .update(result.digest.content)
      .digest('hex')
      .substring(0, 16);

    const postId = `digest-${contentHash}`;

    // Check if this digest already exists
    if (state.posts[postId]) {
      console.log(`Digest ${postId} already exists with status: ${state.posts[postId].status}`);
      console.log('No action needed');
      return;
    }

    console.log(`Generated digest (Post ID: ${postId})`);

    // Generate approval tokens
    const ttlHours = config.approval.expirationHours;
    const approveToken = generateApprovalToken(postId, 'approve', ttlHours, approvalSecret);
    const skipToken = generateApprovalToken(postId, 'skip', ttlHours, approvalSecret);

    const approveLink = `${approvalEndpointUrl}/api/approve/${approveToken}`;
    const skipLink = `${approvalEndpointUrl}/api/approve/${skipToken}`;

    console.log('Generated approval tokens');
    console.log(`  - Approve: ${approveLink.substring(0, 60)}...`);
    console.log(`  - Skip: ${skipLink.substring(0, 60)}...`);

    // Send approval email
    await sendApprovalEmail(
      config,
      {
        summary: result.digest.content,
        teaser: result.teaser.text,
        hashtags: result.teaser.hashtags,
        itemCount: result.digest.commitCount,
        repos: result.digest.repos,
        periodType: result.digest.periodType,
        approveLink,
        skipLink,
        expirationHours: ttlHours
      }
    );

    console.log('Approval email sent');

    // Update state with new pending post
    let newState = createPost(state, {
      id: postId,
      contentHash,
      status: 'pending',
      platforms: {},
      // Store content for posting phase
      digest: result.digest,
      teaser: result.teaser,
    });

    // Update lastRun timestamp
    newState = {
      ...newState,
      lastRun: now.toISOString()
    };

    // Save state
    await saveState(newState);
    console.log('State saved');

    console.log('Digest generation complete!');
  } catch (error) {
    console.error('Error generating digest:', error);
    process.exit(1);
  }
}

main();
