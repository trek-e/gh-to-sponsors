/**
 * Type declarations for @tryghost/admin-api
 *
 * Minimal types needed for our Ghost plugin implementation.
 * Full Ghost API types would be more comprehensive but this covers our use case.
 */

declare module '@tryghost/admin-api' {
  interface GhostPost {
    id: string;
    url: string;
    title: string;
    html: string;
    status: 'draft' | 'published' | 'scheduled';
  }

  interface PostAddOptions {
    title: string;
    html: string;
    status: 'draft' | 'published' | 'scheduled';
    custom_excerpt?: string;
    tags?: Array<{ name: string }>;
  }

  interface GhostAdminAPIOptions {
    url: string;
    key: string;
    version: string;
  }

  interface Posts {
    add(post: PostAddOptions, options?: { source: string }): Promise<GhostPost>;
  }

  interface GhostAdminAPIInstance {
    posts: Posts;
  }

  // Callable constructor interface - supports both `new GhostAdminAPI()` and `GhostAdminAPI()`
  interface GhostAdminAPIConstructor {
    new (options: GhostAdminAPIOptions): GhostAdminAPIInstance;
    (options: GhostAdminAPIOptions): GhostAdminAPIInstance;
  }

  const GhostAdminAPI: GhostAdminAPIConstructor;

  export default GhostAdminAPI;
}
