# Example Platform Plugin Template

This is a complete, working template for creating platform plugins for [gh-to-sponsors](https://github.com/your-username/gh-to-sponsors).

## What This Is

This template demonstrates all the required patterns for implementing a `PlatformPlugin`:

- Constructor with optional configuration
- Lazy client initialization
- Never-throw error handling
- Retry logic with exponential backoff
- Content and configuration validation
- Comprehensive test coverage using the shared testing harness

## How to Use This Template

### 1. Copy the Directory

```bash
cp -r docs/examples/plugin-template my-plugin
cd my-plugin
```

### 2. Rename and Customize

Update `package.json`:
```json
{
  "name": "@yourusername/gh-to-sponsors-plugin-yourplatform",
  "version": "0.1.0",
  "description": "YourPlatform plugin for gh-to-sponsors",
  "keywords": ["gh-to-sponsors", "plugin", "yourplatform"]
}
```

### 3. Modify Key Files

Look for `// CUSTOMIZE:` comments in the code:

**src/client.ts:**
- Replace `ExampleClient` interface with your platform's SDK types
- Update constructor parameters for your platform's configuration
- Modify `getClient()` to instantiate your platform's SDK
- Customize `post()` method to transform content and call your platform's API
- Adjust retry logic for your platform's error codes

**src/client.test.ts:**
- Update import from relative path to `'gh-to-sponsors/test-utils'` when publishing
- Add platform-specific test cases
- Mock your platform's SDK if needed

**src/index.ts:**
- Update the export name if you renamed the class

### 4. Install Dependencies

```bash
npm install
```

Add your platform's SDK:
```bash
npm install your-platform-sdk
```

### 5. Run Tests

```bash
npm test
```

All tests should pass, including the compliance suite that validates your plugin implements the `PlatformPlugin` interface correctly.

### 6. Build

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Key Files to Modify

| File | Purpose | What to Change |
|------|---------|----------------|
| `src/client.ts` | Main plugin implementation | Replace mock client with real SDK, customize post() method |
| `src/client.test.ts` | Test suite | Add platform-specific tests, update imports for publishing |
| `package.json` | Package configuration | Update name, description, add SDK dependencies |
| `README.md` | Documentation | Replace this file with your platform's documentation |

## Testing Your Plugin

The template uses the shared testing harness from gh-to-sponsors:

```typescript
import { testPlatformPluginCompliance, makePostState } from 'gh-to-sponsors/test-utils';

// Validates your plugin implements PlatformPlugin correctly (4 tests)
testPlatformPluginCompliance(() => new YourPlugin('config'), 'yourplatform');
```

This ensures your plugin:
- Has the correct `name` property
- `isConfigured()` returns a boolean
- `post()` returns a `Promise<PostResult>`
- `post()` never throws (always resolves)

## Publishing Your Plugin

See [docs/plugins/community-submission.md](../../plugins/community-submission.md) for the full process:

1. Ensure all tests pass
2. Publish to npm with naming convention: `@username/gh-to-sponsors-plugin-platformname`
3. Optionally register in the community directory

## Full Tutorial

For a complete guide to plugin development, see:
- [Plugin Development Tutorial](../../plugins/tutorial.md) - Step-by-step walkthrough
- [Plugin API Reference](../../plugins/reference.md) - Detailed API documentation
- [Plugin How-To Guides](../../plugins/how-to.md) - Common tasks and patterns

## License

Your license here (same as your main project)
