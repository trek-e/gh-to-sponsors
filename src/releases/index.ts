/**
 * Release content generation module
 *
 * Handles GitHub release events and generates announcement content
 * for posting to platforms.
 */

export { buildReleaseAnnouncement, generateReleaseContent } from './content.js';
export type { ReleasePayload, ReleaseContentResult } from './types.js';
