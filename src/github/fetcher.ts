/**
 * GitHub commit fetching with pagination and date filtering
 */

import { Octokit } from '@octokit/rest';
import { subDays, startOfDay } from 'date-fns';
import type { Commit } from '../types/content.js';

/**
 * Fetches recent commits from a GitHub repository
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param daysBack - Number of days to look back (default: 7)
 * @returns Array of Commit objects
 */
export async function fetchRecentCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  daysBack: number = 7
): Promise<Commit[]> {
  // Calculate 'since' date for API filtering
  const since = startOfDay(subDays(new Date(), daysBack)).toISOString();

  // Use paginate iterator for large result sets
  const iterator = octokit.paginate.iterator(octokit.repos.listCommits, {
    owner,
    repo,
    since,
    per_page: 100,
  });

  const commits: Commit[] = [];

  for await (const response of iterator) {
    for (const item of response.data) {
      commits.push({
        sha: item.sha.substring(0, 7),
        message: item.commit.message,
        author: item.commit.author?.name || 'Unknown',
        email: item.commit.author?.email || '',
        timestamp: item.commit.author?.date || new Date().toISOString(),
        url: item.html_url,
      });
    }

    // Safety limit: stop after 500 commits
    if (commits.length >= 500) {
      break;
    }
  }

  return commits;
}
