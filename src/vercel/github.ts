/**
 * GitHub API integration for Vercel Functions
 *
 * Provides functions to trigger repository_dispatch events and access
 * artifact state from GitHub Actions workflows.
 */

import { Octokit } from '@octokit/rest';
import type { DigestState } from '../types/state.js';

// Empty state used when no artifact exists yet
export const EMPTY_STATE: DigestState = {
  posts: {},
  usedTokens: [],
  lastRun: ''
};

/**
 * Triggers a repository_dispatch event to start the platform posting workflow
 *
 * @param postId - Post identifier from digest state
 * @param action - Action taken by user ('approve' or 'skip')
 * @param jti - Token jti for replay prevention (Action will mark as used)
 * @throws Error if GitHub API call fails
 */
export async function triggerPosting(
  postId: string,
  action: 'approve' | 'skip',
  jti: string
): Promise<void> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    throw new Error('Missing required environment variables: GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN');
  }

  const octokit = new Octokit({ auth: token });

  await octokit.repos.createDispatchEvent({
    owner,
    repo,
    event_type: 'approval-received',
    client_payload: {
      postId,
      action,
      jti,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Downloads and parses the digest-state artifact from GitHub Actions
 *
 * Used by Vercel Function to check if tokens are already used and
 * to get current post status.
 *
 * @returns DigestState from artifact, or EMPTY_STATE if no artifact exists
 * @throws Error if artifact download fails (but not if artifact doesn't exist)
 */
export async function getArtifactState(): Promise<DigestState> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    throw new Error('Missing required environment variables: GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN');
  }

  const octokit = new Octokit({ auth: token });

  // List artifacts with name 'digest-state'
  const { data: artifacts } = await octokit.actions.listArtifactsForRepo({
    owner,
    repo,
    name: 'digest-state'
  });

  // If no artifact exists yet, return empty state (first run)
  if (artifacts.total_count === 0 || artifacts.artifacts.length === 0) {
    return EMPTY_STATE;
  }

  // Get most recent artifact (sorted by created_at desc by default)
  const artifact = artifacts.artifacts[0];

  // Download artifact (returns zip file)
  const download = await octokit.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifact.id,
    archive_format: 'zip'
  });

  // Extract JSON from zip
  // The download.data is a Buffer containing the zip file
  const state = await extractStateFromZip(download.data as unknown as ArrayBuffer);

  return state;
}

/**
 * Extracts digest state JSON from artifact zip file
 *
 * Note: This is a simple implementation that assumes the zip contains
 * a single digest.json file. For production use, consider using a zip
 * library like 'adm-zip' or 'jszip' for more robust extraction.
 *
 * @param zipData - Zip file as ArrayBuffer
 * @returns Parsed DigestState
 */
async function extractStateFromZip(zipData: ArrayBuffer): Promise<DigestState> {
  // For now, use a simple approach with the built-in Node.js zlib
  // This works because GitHub artifact zips have a simple structure

  // Convert ArrayBuffer to Buffer
  const buffer = Buffer.from(zipData);

  // Simple zip parsing: find the JSON content
  // This is a naive implementation - in production you'd want a proper zip library
  // For the MVP, we'll assume the artifact contains digest.json directly

  // Look for the file data in the zip (skip zip headers)
  // A proper implementation would use a zip library, but for this simple case
  // we can search for the JSON structure markers
  const jsonStart = buffer.indexOf(Buffer.from('{"posts"'));

  if (jsonStart === -1) {
    // If we can't find JSON, return empty state
    return EMPTY_STATE;
  }

  // Find the end of the JSON (look for the closing brace)
  let jsonEnd = jsonStart;
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = jsonStart; i < buffer.length; i++) {
    const char = String.fromCharCode(buffer[i]);

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') braceCount++;
    if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }

  const jsonString = buffer.slice(jsonStart, jsonEnd).toString('utf-8');
  return JSON.parse(jsonString);
}

/**
 * Note: updateArtifactState is NOT implemented here
 *
 * Vercel Functions cannot upload artifacts directly to GitHub Actions.
 * Instead, the state update is included in the repository_dispatch payload
 * with the jti value, and the GitHub Action workflow will:
 * 1. Download current state artifact
 * 2. Add jti to usedTokens
 * 3. Update post status
 * 4. Upload new state artifact
 *
 * This keeps state management centralized in GitHub Actions where
 * artifacts can be uploaded.
 */
