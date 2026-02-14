# Contributing a Plugin

Want to add support for a new platform? Awesome! This guide walks you through creating, testing, publishing, and registering a community plugin.

## Overview

The gh-to-sponsors plugin ecosystem works like this:

1. **You build and publish** - Create a plugin implementing the `PlatformPlugin` interface, publish to npm
2. **Users discover** - Find your plugin via npm search or the community directory
3. **Users install** - Add your plugin to their project with `npm install @you/gh-to-sponsors-plugin-platform`
4. **Users integrate** - Import and register your plugin in their setup code

**Optional:** You can register your plugin in `docs/community-plugins.json` for easier discovery, but it's not required. Publishing to npm with the right keywords is enough.

## Step 1: Create Your Plugin

### Use the Template

Start with the example template as your foundation:

```bash
# Copy the template
cp -r docs/examples/plugin-template my-platform-plugin
cd my-platform-plugin

# Update package.json with your details
```

See the [Plugin Development Tutorial](./tutorial.md) for a complete walkthrough.

### Key Requirements

Your plugin must:
- Implement the `PlatformPlugin` interface from `gh-to-sponsors/platforms/types`
- Export a class with:
  - `readonly name: string` - Platform identifier (lowercase, e.g., 'linkedin', 'dev.to')
  - `isConfigured(): boolean` - Configuration check
  - `post(state: PostState): Promise<PostResult>` - Post content to platform

See [Plugin API Reference](./reference.md) for detailed documentation.

## Step 2: Ensure Quality

Before publishing, verify your plugin meets these requirements:

### Required

- **Implements PlatformPlugin** - All interface methods present
- **All compliance tests pass** - Use `testPlatformPluginCompliance` from `gh-to-sponsors/test-utils`
- **Has README** - Usage instructions, configuration, examples
- **Never-throw pattern** - `post()` always resolves, returns errors in `PostResult`

### Recommended

- **Retry logic** - Handle rate limits with exponential backoff (see template example)
- **JSDoc comments** - Document public methods and configuration options
- **Lazy initialization** - Defer SDK instantiation until first use
- **TypeScript declarations** - Include `.d.ts` files for type safety

### Run Compliance Tests

```typescript
import { testPlatformPluginCompliance } from 'gh-to-sponsors/test-utils';
import { MyPlugin } from './my-plugin';

describe('MyPlugin', () => {
  // This runs 4 essential tests
  testPlatformPluginCompliance(
    () => new MyPlugin('config'),
    'myplatform'
  );

  // Add your platform-specific tests here
});
```

The compliance suite validates:
1. Correct `name` property
2. `isConfigured()` returns boolean
3. `post()` returns `Promise<PostResult>` with correct shape
4. `post()` never throws (always resolves)

## Step 3: Publish to npm

### Package Naming Convention

Use this format:

```
@username/gh-to-sponsors-plugin-platformname
```

Examples:
- `@alice/gh-to-sponsors-plugin-linkedin`
- `@bob/gh-to-sponsors-plugin-devto`
- `@org/gh-to-sponsors-plugin-notion`

### Required package.json Fields

```json
{
  "name": "@username/gh-to-sponsors-plugin-platformname",
  "version": "1.0.0",
  "description": "PlatformName integration for gh-to-sponsors",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": [
    "gh-to-sponsors",
    "plugin",
    "platformname"
  ],
  "peerDependencies": {
    "gh-to-sponsors": ">=0.1.0"
  }
}
```

**Important:**
- `type: "module"` - Use ES modules
- `keywords` - Must include `"gh-to-sponsors"` and `"plugin"` for discoverability
- `types` - Include TypeScript declarations
- `peerDependencies` - Declare gh-to-sponsors as peer, not regular dependency

### Publish

```bash
npm run build
npm publish --access public
```

## Step 4: Register in Community Directory (Optional)

Want your plugin featured in the community directory? Submit a PR!

### Add Entry to community-plugins.json

Edit `docs/community-plugins.json` and add your plugin:

```json
{
  "plugins": [
    {
      "name": "@username/gh-to-sponsors-plugin-platformname",
      "description": "Post updates to PlatformName",
      "author": "username",
      "repository": "https://github.com/username/gh-to-sponsors-plugin-platformname",
      "npmPackage": "https://www.npmjs.com/package/@username/gh-to-sponsors-plugin-platformname"
    }
  ]
}
```

### Submit Pull Request

1. Fork the gh-to-sponsors repository
2. Add your entry to `docs/community-plugins.json`
3. Submit PR with title: "Add [PlatformName] plugin to community directory"
4. Include in PR description:
   - Link to npm package
   - Link to GitHub repository
   - Brief description of the platform

### Maintainer Review

The maintainer will check:
- npm package exists and is accessible
- Package name follows convention
- Tests pass (verified via CI or manually)
- README exists with usage instructions
- No obvious security issues

**This is a lightweight process** - no complex CI validation, no governance committees. It's a solo-developer project, so the review is straightforward.

## Self-Hosted Option

Don't want to register in the community directory? No problem!

Just publish to npm with the correct keywords. Users can discover your plugin via:

```bash
npm search gh-to-sponsors plugin
```

They can install and use it just like registered plugins:

```bash
npm install @you/gh-to-sponsors-plugin-platform
```

## Plugin Entry Schema

For reference, here's the exact JSON schema for community-plugins.json entries:

```typescript
interface PluginEntry {
  /** npm package name (e.g., "@username/gh-to-sponsors-plugin-platform") */
  name: string;

  /** Brief description of what platform this integrates with */
  description: string;

  /** GitHub username of the plugin author */
  author: string;

  /** GitHub repository URL for the plugin source code */
  repository: string;

  /** npm package URL (e.g., "https://www.npmjs.com/package/@username/...") */
  npmPackage: string;
}
```

All fields are required strings.

## Examples

Check out the built-in plugins for reference implementations:

- **GhostPlugin** - `src/platforms/ghost/client.ts` - Full-featured blog platform
- **BlueskyPlugin** - `src/platforms/bluesky/client.ts` - Social platform with RichText
- **MastodonPlugin** - `src/platforms/mastodon/client.ts` - Federated social network

Or see the template:

- **ExamplePlugin** - `docs/examples/plugin-template/src/client.ts` - Fully commented template

## Getting Help

- Read the [Plugin Development Tutorial](./tutorial.md)
- Check the [Plugin API Reference](./reference.md)
- See [Plugin How-To Guides](./how-to.md)
- Open an issue on GitHub for questions

## Updates and Maintenance

If your plugin needs updates:
1. Publish new version to npm
2. Update community-plugins.json entry if description changes (optional)

That's it! No need to notify maintainers - users get updates via npm.
