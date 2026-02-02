/**
 * GitHub module exports
 */

export { fetchRecentCommits } from './fetcher.js';
export { filterAndClassifyCommits, isBotCommit, classifyCommit } from './filter.js';
export {
  aggregateMultiRepoCommits,
  filterByActivity,
  prepareCommitContexts
} from './aggregator.js';
