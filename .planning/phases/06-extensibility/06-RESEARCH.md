# Phase 6: Extensibility - Research

**Researched:** 2026-02-14
**Domain:** TypeScript plugin documentation and community extensibility
**Confidence:** HIGH

## Summary

Phase 6 enables community-created platform plugins by documenting the existing PlatformPlugin interface, providing reference implementation examples, and establishing a plugin testing harness. The architecture is already proven with three platforms (Ghost, Bluesky, Mastodon), all using the same factory-pattern registry with lazy initialization, never-throw error handling, and retry logic.

The primary challenge is documentation, not technical architecture. The plugin interface is stable and simple (3 methods: name, isConfigured(), post()). Community adoption depends on clear documentation showing how to implement, test, and publish plugins.

**Primary recommendation:** Create comprehensive plugin development documentation with working examples, a testing harness for interface compliance validation, and a community submission process via GitHub PRs.

## Standard Stack

### Core Plugin Architecture
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.3 | Plugin interface definition | Compile-time type safety, IntelliSense support for plugin authors |
| Vitest | 2.1.8 | Plugin testing | Already project standard, supports `expectTypeOf` for interface compliance |
| Node.js | >=24.0.0 | Runtime | Project requirement, ESM modules |

### Documentation Generation
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeDoc | Latest | API reference generation | Industry standard for TypeScript API docs, generates from JSDoc comments |
| typedoc-plugin-markdown | Latest | Markdown output | GitHub-friendly documentation format |

### Supporting Tools
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.24.1 | Runtime validation for plugin config | Already in project, validates env vars and config |
| tsx | 4.19.2 | TypeScript execution | Already in project, for running plugin examples |

**Installation:**
```bash
npm install --save-dev typedoc typedoc-plugin-markdown
```

## Architecture Patterns

### Recommended Plugin Project Structure
```
gh-to-sponsors-plugin-example/
├── src/
│   ├── index.ts           # Barrel export: export { ExamplePlugin }
│   └── client.ts          # Plugin implementation
├── test/
│   └── client.test.ts     # Vitest tests using shared harness
├── package.json           # Scoped package: @gh-to-sponsors/plugin-example
├── tsconfig.json          # Extends base config
└── README.md              # Usage documentation
```

### Pattern 1: PlatformPlugin Implementation
**What:** Class implementing the PlatformPlugin interface with lazy initialization
**When to use:** Every platform plugin (required pattern)
**Example:**
```typescript
// Source: /Users/trekkie/projects/gh-to-sponsors/src/platforms/types.ts
import type { PlatformPlugin, PostResult } from '@gh-to-sponsors/core';
import type { PostState } from '@gh-to-sponsors/core';

export class ExamplePlugin implements PlatformPlugin {
  readonly name = 'example';
  private client: ExampleAPI | null = null;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly defaultOption?: string
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private getClient(): ExampleAPI {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('Example not configured');
      }
      this.client = new ExampleAPI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async post(state: PostState): Promise<PostResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Example not configured' };
    }

    try {
      const client = this.getClient();
      const response = await client.createPost({
        title: state.digest?.title,
        content: state.digest?.content,
      });

      return {
        success: true,
        platformPostId: response.id,
        platformUrl: response.url,
      };
    } catch (error) {
      // Never throw - always return PostResult
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
```

### Pattern 2: Retry Logic with Exponential Backoff
**What:** Handle rate limits (429 status) with exponential backoff + jitter
**When to use:** Any API that rate limits requests
**Example:**
```typescript
// Source: /Users/trekkie/projects/gh-to-sponsors/src/platforms/ghost/client.ts
const MAX_RETRIES = 3;
let attempt = 0;

while (attempt < MAX_RETRIES) {
  try {
    const result = await api.doSomething();
    return { success: true, platformPostId: result.id };
  } catch (error: unknown) {
    const apiError = error as { status?: number; message?: string };
    const isRateLimit = apiError?.status === 429;
    const isLastAttempt = attempt >= MAX_RETRIES - 1;

    if (isRateLimit && !isLastAttempt) {
      const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
      continue;
    }

    return { success: false, error: apiError?.message || String(error) };
  }
}
```

### Pattern 3: Factory Registration
**What:** Register plugin factory in setup module
**When to use:** For plugins bundled with core (community plugins self-register)
**Example:**
```typescript
// Source: /Users/trekkie/projects/gh-to-sponsors/src/platforms/setup.ts
import { registerPlatform } from './registry.js';
import { ExamplePlugin } from './example/index.js';

registerPlatform('example', () => {
  const apiKey = process.env.EXAMPLE_API_KEY;
  const defaultOption = process.env.EXAMPLE_DEFAULT_OPTION || 'default';
  return new ExamplePlugin(apiKey, defaultOption);
});
```

### Pattern 4: Plugin Testing with Interface Compliance
**What:** Test suite verifying PlatformPlugin interface implementation
**When to use:** Every plugin (required for submission)
**Example:**
```typescript
// Source: /Users/trekkie/projects/gh-to-sponsors/src/platforms/ghost/client.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PostState, PlatformPlugin } from '@gh-to-sponsors/core';

describe('ExamplePlugin', () => {
  describe('interface compliance', () => {
    it('implements PlatformPlugin interface', () => {
      const plugin = new ExamplePlugin('test-key');

      // Type assertion - will fail at compile time if interface not implemented
      const _: PlatformPlugin = plugin;

      expect(plugin.name).toBe('example');
      expect(typeof plugin.isConfigured).toBe('function');
      expect(typeof plugin.post).toBe('function');
    });

    it('isConfigured returns boolean', () => {
      const plugin = new ExamplePlugin('test-key');
      expect(typeof plugin.isConfigured()).toBe('boolean');
    });

    it('post returns Promise<PostResult>', async () => {
      const plugin = new ExamplePlugin('test-key');
      const result = await plugin.post(makePostState());

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('never-throw behavior', () => {
    it('does not throw on API failure', async () => {
      const plugin = new ExamplePlugin('test-key');
      // Should not throw - must return PostResult
      await expect(plugin.post(makePostState())).resolves.toBeDefined();
    });
  });
});
```

### Anti-Patterns to Avoid
- **Throwing exceptions from post():** Plugins MUST return `{ success: false, error: string }`, never throw. The executor wraps calls in try/catch as defense-in-depth, but throwing breaks the contract.
- **Eager initialization in constructor:** API clients should be initialized lazily in `getClient()` to prevent errors when credentials are missing.
- **Hardcoded configuration:** Accept credentials as constructor parameters, read from env vars in factory function, not in plugin class.
- **Missing retry logic:** Always implement retry with exponential backoff for rate-limited APIs. One 429 shouldn't fail the entire post.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API documentation generation | Custom markdown generator from types | TypeDoc + typedoc-plugin-markdown | Handles JSDoc parsing, type resolution, cross-linking, and maintains sync with code |
| Plugin interface validation | Runtime instanceof checks | TypeScript compile-time checks + Vitest `expectTypeOf` | Catches interface violations at compile time, not runtime |
| Plugin discovery | Custom registry server | npm scoped packages + keywords | Leverages npm's existing search/discovery infrastructure |
| Plugin testing harness | Ad-hoc test helpers | Shared Vitest helper with reusable test factories | Ensures consistent testing patterns across all plugins |

**Key insight:** Plugin ecosystems succeed with tooling, not custom infrastructure. Use existing npm/TypeScript tooling for discovery, validation, and documentation rather than building custom systems.

## Common Pitfalls

### Pitfall 1: Incomplete Documentation Layers
**What goes wrong:** Plugin docs provide API reference OR tutorials, not both. Developers struggle to get started or understand capabilities.
**Why it happens:** Assumption that API reference is sufficient documentation.
**How to avoid:** Follow Divio documentation system: Tutorial (learning-oriented), How-to guides (task-oriented), Reference (information-oriented), Explanation (understanding-oriented).
**Warning signs:** GitHub issues asking "how do I...?" or "what does X do?" when it's documented.

### Pitfall 2: No Plugin Template Repository
**What goes wrong:** Community plugins have inconsistent structure, testing patterns, and build configuration. Authors waste time on boilerplate.
**Why it happens:** No official starting point for plugin development.
**How to avoid:** Create GitHub template repository (`gh-to-sponsors-plugin-template`) with preconfigured tsconfig, Vitest setup, shared test harness imports, and package.json template.
**Warning signs:** Community plugins use different testing frameworks, TypeScript configs, or build tools.

### Pitfall 3: Undiscoverable Community Plugins
**What goes wrong:** Developers create plugins but community can't find them. Ecosystem appears dead.
**Why it happens:** No discovery mechanism beyond GitHub search.
**How to avoid:** Document scoped package naming convention (`@username/gh-to-sponsors-plugin-name`), required npm keywords (`gh-to-sponsors`, `plugin`, `platform-name`), and maintain community-plugins.json registry in main repo.
**Warning signs:** Multiple plugins solving same problem because authors don't know others exist.

### Pitfall 4: Interface Breaking Changes Without Versioning
**What goes wrong:** PlatformPlugin interface changes break all community plugins.
**Why it happens:** No semantic versioning strategy for plugin interface.
**How to avoid:** Version PlatformPlugin interface in type definitions, publish as separate `@gh-to-sponsors/plugin-types` package, follow semver strictly. Core can depend on interface package, community plugins depend on same package.
**Warning signs:** Community plugin PRs failing CI after core updates.

### Pitfall 5: No Plugin Validation Before Merge
**What goes wrong:** Submitted plugins don't implement interface correctly, have security issues, or lack tests.
**Why it happens:** Manual code review only, no automated validation.
**How to avoid:** Create GitHub Action workflow (`validate-plugin.yml`) that runs on PRs to community-plugins.json, validates: (1) npm package exists, (2) exports class implementing PlatformPlugin, (3) tests exist and pass, (4) has README.
**Warning signs:** Broken plugins merged into community registry.

## Code Examples

Verified patterns from existing plugins:

### Lazy Client Initialization
```typescript
// Source: /Users/trekkie/projects/gh-to-sponsors/src/platforms/bluesky/client.ts
export class BlueskyPlugin implements PlatformPlugin {
  private agent: AtpAgent | null = null;
  private authenticated = false;

  private async getAgent(): Promise<AtpAgent> {
    if (!this.agent) {
      if (!this.identifier || !this.password) {
        throw new Error('Bluesky not configured');
      }
      this.agent = new AtpAgent({ service: 'https://bsky.social' });
    }

    // Authenticate on first call only
    if (!this.authenticated) {
      await this.agent.login({
        identifier: this.identifier!,
        password: this.password!,
      });
      this.authenticated = true;
    }

    return this.agent;
  }
}
```

### Content Validation and Error Handling
```typescript
// Source: /Users/trekkie/projects/gh-to-sponsors/src/platforms/ghost/client.ts
async post(state: PostState): Promise<PostResult> {
  // Validate content exists
  if (!state.digest) {
    return { success: false, error: 'No digest content' };
  }

  // Validate configuration
  if (!this.isConfigured()) {
    return { success: false, error: 'Ghost not configured' };
  }

  const api = this.getClient();

  try {
    const post = await api.posts.add(
      {
        title: state.digest.title,
        html: state.digest.content,
        status: this.defaultStatus,
        tags: this.defaultTags.map((name) => ({ name })),
      },
      { source: 'html' }
    );

    return {
      success: true,
      platformPostId: post.id,
      platformUrl: post.url,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

### Plugin Registration Pattern
```typescript
// Source: /Users/trekkie/projects/gh-to-sponsors/src/platforms/setup.ts
import { registerPlatform } from './registry.js';
import { GhostPlugin } from './ghost/index.js';

export function setupPlatforms(): void {
  registerPlatform('ghost', () => {
    const url = process.env.GHOST_API_URL;
    const apiKey = process.env.GHOST_ADMIN_API_KEY;
    const defaultStatus = (process.env.GHOST_DEFAULT_STATUS as 'draft' | 'published') || 'draft';
    const defaultTags = process.env.GHOST_DEFAULT_TAGS?.split(',').map(t => t.trim()) || ['devlog', 'opensource'];

    return new GhostPlugin(url, apiKey, defaultTags, defaultStatus);
  });
}
```

### Testing with Mock API
```typescript
// Source: /Users/trekkie/projects/gh-to-sponsors/src/platforms/ghost/client.test.ts
vi.mock('@tryghost/admin-api', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      posts: {
        add: vi.fn(),
      },
    })),
  };
});

it('returns success with platformPostId and platformUrl on API success', async () => {
  const mockAdd = vi.fn().mockResolvedValue({
    id: 'ghost-post-id-123',
    url: 'https://blog.example.com/weekly-update/',
  });

  vi.mocked(GhostAdminAPI).mockImplementation(() => ({
    posts: { add: mockAdd },
  }) as unknown as ReturnType<typeof GhostAdminAPI>);

  const plugin = new GhostPlugin(
    'https://blog.example.com',
    'abc123:secret456'
  );
  const state = makePostState();

  const result = await plugin.post(state);

  expect(result.success).toBe(true);
  expect(result.platformPostId).toBe('ghost-post-id-123');
  expect(result.platformUrl).toBe('https://blog.example.com/weekly-update/');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom plugin loader/validator | TypeScript compile-time validation + Vitest | Stable (2024+) | Plugin interface violations caught at development time, not runtime |
| Centralized plugin registry | Distributed npm packages + keywords | npm v2+ (2015+) | No central infrastructure to maintain, leverages npm ecosystem |
| Runtime plugin discovery | Static imports with factory registration | ES Modules (2020+) | Tree-shaking works, no dynamic require() issues |
| JSDoc comments | TSDoc standard | TSDoc 1.0 (2019+) | TypeDoc understands @param, @returns, @example tags consistently |

**Deprecated/outdated:**
- CommonJS require() for plugins: Use ES module imports (project uses `"type": "module"`)
- Any/unknown in plugin return types: PostResult is fully typed interface
- Separate .d.ts declaration files: TypeScript generates from source (`"declaration": true"` in tsconfig)

## Documentation Structure

### Four Documentation Types (Divio System)

**1. Tutorial (Learning-Oriented)**
- "Your First Platform Plugin" - builds a minimal LinkedIn plugin from scratch
- Takes 15-30 minutes, step-by-step with explanations
- Covers: create plugin class, implement interface, write tests, publish to npm
- Goal: New developer has working plugin and understands the flow

**2. How-To Guides (Task-Oriented)**
- "How to handle rate limiting"
- "How to test plugins with mocked APIs"
- "How to validate complex content before posting"
- "How to support multiple authentication methods"
- Goal: Solve specific real-world problems

**3. Reference (Information-Oriented)**
- TypeDoc-generated API documentation for PlatformPlugin interface
- PostState type reference
- PostResult type reference
- Plugin lifecycle (registration → isConfigured() → post() flow)
- Goal: Look up exact method signatures and type definitions

**4. Explanation (Understanding-Oriented)**
- "Why plugins use lazy initialization"
- "Why never-throw is critical for multi-platform posting"
- "The plugin registry pattern and factory functions"
- "Error isolation with Promise.allSettled"
- Goal: Deep understanding of architectural decisions

### Recommended Documentation Files

```
docs/
├── plugins/
│   ├── tutorial-first-plugin.md       # Tutorial
│   ├── howto-rate-limiting.md         # How-to
│   ├── howto-testing.md               # How-to
│   ├── howto-authentication.md        # How-to
│   ├── reference-api.md               # Reference (TypeDoc output)
│   ├── explanation-architecture.md    # Explanation
│   └── community-submission.md        # Process guide
├── examples/
│   └── plugin-template/               # GitHub template repo
└── community-plugins.json             # Registry file
```

## Community Plugin Submission Process

### Option 1: Community Plugins Registry (Recommended)
1. **Author creates plugin** as npm package: `@username/gh-to-sponsors-plugin-linkedin`
2. **Author adds npm keywords**: `gh-to-sponsors`, `plugin`, `linkedin`
3. **Author submits PR** to main repo updating `docs/community-plugins.json`:
   ```json
   {
     "name": "@username/gh-to-sponsors-plugin-linkedin",
     "description": "LinkedIn platform plugin for gh-to-sponsors",
     "author": "username",
     "repository": "https://github.com/username/gh-to-sponsors-plugin-linkedin",
     "npmPackage": "https://www.npmjs.com/package/@username/gh-to-sponsors-plugin-linkedin"
   }
   ```
4. **CI validates plugin** (GitHub Action):
   - npm package exists and is public
   - Package exports class implementing PlatformPlugin
   - Package has tests
   - Package has README with usage instructions
5. **Maintainer reviews and merges**
6. **Plugin appears in documentation** (auto-generated list)

### Option 2: Self-Hosted Only
- Author publishes plugin to npm with keywords
- Users discover via npm search
- No central registry maintenance required
- Trade-off: harder discovery, no quality signal

**Recommendation:** Start with Option 2 (self-hosted), add Option 1 (registry) if community adoption grows.

## Plugin Testing Harness

### Shared Test Utilities

Create `@gh-to-sponsors/plugin-test-utils` package with:

```typescript
// Reusable PostState factory
export function makePostState(overrides?: Partial<PostState>): PostState {
  return {
    id: 'post-123',
    contentHash: 'hash-abc',
    status: 'approved',
    platforms: {},
    createdAt: '2026-01-01T00:00:00Z',
    digest: {
      title: 'Weekly Update',
      content: '<h2>What we shipped</h2><p>New features</p>',
      repos: ['owner/repo'],
      commitCount: 5,
      periodType: 'weekly',
      generatedAt: '2026-01-01T00:00:00Z',
    },
    teaser: {
      text: 'Check out our latest updates!',
      hashtags: ['#devlog', '#opensource'],
      characterCount: 32,
    },
    ...overrides,
  };
}

// Interface compliance test suite
export function testPlatformPluginCompliance(
  pluginFactory: () => PlatformPlugin,
  pluginName: string
) {
  describe('PlatformPlugin interface compliance', () => {
    it('has correct name property', () => {
      const plugin = pluginFactory();
      expect(plugin.name).toBe(pluginName);
    });

    it('implements isConfigured() returning boolean', () => {
      const plugin = pluginFactory();
      expect(typeof plugin.isConfigured).toBe('function');
      expect(typeof plugin.isConfigured()).toBe('boolean');
    });

    it('implements post() returning Promise<PostResult>', async () => {
      const plugin = pluginFactory();
      const result = await plugin.post(makePostState());

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        expect(result).toHaveProperty('platformPostId');
        expect(result).toHaveProperty('platformUrl');
      } else {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });

    it('does not throw from post() on error', async () => {
      const plugin = pluginFactory();
      // Should not throw - must return PostResult
      await expect(plugin.post(makePostState())).resolves.toBeDefined();
    });
  });
}
```

### Usage in Plugin Tests

```typescript
import { testPlatformPluginCompliance, makePostState } from '@gh-to-sponsors/plugin-test-utils';
import { LinkedInPlugin } from './client.js';

testPlatformPluginCompliance(
  () => new LinkedInPlugin('test-token'),
  'linkedin'
);

// Plugin-specific tests...
```

## Open Questions

1. **Should plugins be scoped to author or organization?**
   - What we know: npm supports both `@username/package` and `@org/package`
   - What's unclear: Which convention to recommend for community plugins
   - Recommendation: Author-scoped by default (`@username/gh-to-sponsors-plugin-name`), allows flexibility

2. **How to version the plugin interface independently from core?**
   - What we know: PlatformPlugin interface lives in `src/platforms/types.ts`
   - What's unclear: Should this be extracted to separate `@gh-to-sponsors/plugin-types` package?
   - Recommendation: Start with types in core, extract to separate package if interface needs to evolve independently

3. **Should plugin testing harness be required or recommended?**
   - What we know: Consistent testing patterns improve ecosystem quality
   - What's unclear: Can we enforce testing standards without discouraging contributions?
   - Recommendation: Required for community-plugins.json registry, recommended for self-hosted

## Sources

### Primary (HIGH confidence)
- Existing plugin implementations: `/Users/trekkie/projects/gh-to-sponsors/src/platforms/`
  - Ghost plugin: ghost/client.ts, ghost/client.test.ts
  - Bluesky plugin: bluesky/client.ts, bluesky/client.test.ts
  - Mastodon plugin: mastodon/client.ts, mastodon/client.test.ts
- Plugin registry: registry.ts, setup.ts, executor.ts
- Project configuration: package.json, tsconfig.json

### Secondary (MEDIUM confidence)
- [TypeDoc official documentation](https://typedoc.org/)
- [TypeDoc Plugins page](https://typedoc.org/documents/Plugins.html)
- [npm scoped packages documentation](https://docs.npmjs.com/about-scopes/)
- [Vitest testing types guide](https://vitest.dev/guide/testing-types)
- [GitHub plugin architecture with TypeScript](https://github.com/gr2m/javascript-plugin-architecture-with-typescript-definitions)
- [Backstage community plugins](https://github.com/backstage/community-plugins)

### Tertiary (LOW confidence - general patterns)
- [TypeScript best practices for large-scale applications (2026)](https://johal.in/typescript-best-practices-for-large-scale-web-applications-in-2026/)
- [Plugin testing with Pact.js](https://codersociety.com/blog/articles/contract-testing-pact)
- [API documentation best practices](https://treblle.com/blog/essential-guide-api-documentation-best-practices-tools)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tooling already in project (TypeScript, Vitest) or industry standard (TypeDoc)
- Architecture patterns: HIGH - Three working reference implementations following identical patterns
- Plugin testing harness: HIGH - Existing test patterns from ghost/client.test.ts are proven and reusable
- Documentation structure: MEDIUM - Based on industry best practices (Divio system) but untested for this specific use case
- Community submission process: MEDIUM - Pattern borrowed from established ecosystems (Backstage, Obsidian) but not yet implemented

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - stable ecosystem, slow-moving documentation/tooling domain)
