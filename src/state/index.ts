/**
 * State management module
 * Re-exports all state functions for clean imports
 */

export {
  loadState,
  saveState,
  updatePostStatus,
  markTokenUsed,
  cleanExpiredTokens,
  createPost,
  updatePlatformResults,
  DEFAULT_STATE_PATH,
  EMPTY_STATE
} from './artifacts.js';
