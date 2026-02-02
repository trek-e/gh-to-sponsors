/**
 * Multi-repo commit aggregation and activity filtering
 */

import { Octokit } from '@octokit/rest';
import { subDays, subWeeks, startOfDay } from 'date-fns';
import type {
  RepoCommitGroup,
  ActivityPeriod,
  CommitContext
} from '../types/content.js';
import type { RepoConfig, ContentConfig } from '../types/config.js';
import { fetchRecentCommits } from './fetcher.js';
import { filterAndClassifyCommits } from './filter.js';

/** Default content thresholds */
const DEFAULT_THRESHOLDS: ContentConfig = {
  dailyThreshold: 1,
  weeklyThreshold: 3,
};

/**
 * Aggregates commits from multiple repositories
 *
 * @param octokit - Authenticated Octokit instance
 * @param repos - Array of repository configurations
 * @param daysBack - Number of days to fetch (default: 7)
 * @returns Array of RepoCommitGroup sorted by activity (most active first)
 */
export async function aggregateMultiRepoCommits(
  octokit: Octokit,
  repos: RepoConfig[],
  daysBack: number = 7
): Promise<RepoCommitGroup[]> {
  const groups: RepoCommitGroup[] = [];

  for (const repo of repos) {
    try {
      const rawCommits = await fetchRecentCommits(
        octokit,
        repo.owner,
        repo.repo,
        daysBack
      );

      const { human, botCount } = filterAndClassifyCommits(rawCommits);

      // Only include repos with activity
      if (human.length > 0 || botCount > 0) {
        groups.push({
          repoName: `${repo.owner}/${repo.repo}`,
          displayName: repo.displayName || repo.repo,
          commits: human,
          botCommitCount: botCount,
        });
      }
    } catch (error) {
      // Log but continue with other repos
      console.warn(`Failed to fetch commits for ${repo.owner}/${repo.repo}:`, error);
    }
  }

  // Sort by human commit count (most active first)
  return groups.sort((a, b) => b.commits.length - a.commits.length);
}

/**
 * Filters commits by activity period with daily/weekly fallback
 *
 * Logic from CONTEXT.md:
 * - Try daily first (last 24h), need >= dailyThreshold commits
 * - Fallback to weekly (last 7 days), need >= weeklyThreshold commits
 * - Return 'none' if neither meets threshold
 *
 * @param groups - RepoCommitGroups to filter
 * @param thresholds - Activity thresholds (optional, uses defaults)
 * @returns ActivityPeriod with filtered commits and period type
 */
export function filterByActivity(
  groups: RepoCommitGroup[],
  thresholds: ContentConfig = DEFAULT_THRESHOLDS
): ActivityPeriod {
  const now = new Date();
  const yesterday = startOfDay(subDays(now, 1));
  const lastWeek = startOfDay(subWeeks(now, 1));

  // Count total human commits across all repos
  const allCommits = groups.flatMap(g => g.commits);

  // Try daily first
  const dailyCommits = allCommits.filter(c =>
    new Date(c.timestamp) >= yesterday
  );

  if (dailyCommits.length >= thresholds.dailyThreshold) {
    return {
      commits: dailyCommits,
      periodType: 'daily',
      hasActivity: true,
    };
  }

  // Fallback to weekly
  const weeklyCommits = allCommits.filter(c =>
    new Date(c.timestamp) >= lastWeek
  );

  if (weeklyCommits.length >= thresholds.weeklyThreshold) {
    return {
      commits: weeklyCommits,
      periodType: 'weekly',
      hasActivity: true,
    };
  }

  // No meaningful activity
  return {
    commits: [],
    periodType: 'none',
    hasActivity: false,
  };
}

/**
 * Prepares commit context for LLM prompt
 *
 * @param groups - RepoCommitGroups with classified commits
 * @param periodType - 'daily' or 'weekly'
 * @returns Array of CommitContext ready for prompt building
 */
export function prepareCommitContexts(
  groups: RepoCommitGroup[],
  _periodType: 'daily' | 'weekly'
): CommitContext[] {
  return groups
    .filter(g => g.commits.length > 0)
    .map(group => {
      const timestamps = group.commits.map(c => new Date(c.timestamp).getTime());
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);

      return {
        repo: group.repoName,
        displayName: group.displayName,
        commits: group.commits,
        botCommitCount: group.botCommitCount,
        commitCount: group.commits.length,
        timeRange: {
          start: new Date(minTime).toISOString(),
          end: new Date(maxTime).toISOString(),
        },
      };
    });
}
