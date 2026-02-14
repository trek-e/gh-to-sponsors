# Your First Platform Plugin

A step-by-step tutorial for building a platform plugin for gh-to-sponsors.

## What You'll Build

In this tutorial, you'll create a minimal but fully functional Telegram plugin that posts digest teasers to a Telegram channel. This plugin will:

- Implement the `PlatformPlugin` interface
- Use lazy initialization for the API client
- Follow the never-throw error handling pattern
- Include exponential backoff retry logic for rate limits
- Pass the compliance test suite

**Prerequisites:**
- Node.js >= 24
- TypeScript knowledge
- Familiarity with async/await

**Time estimate:** 15-30 minutes

## Project Setup

First, create a new directory for your plugin and initialize it:

```bash
mkdir telegram-plugin
cd telegram-plugin
npm init -y
```

Update your `package.json` to use ESM modules:

```json
{
  "name": "telegram-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

Install gh-to-sponsors as a peer dependency for type definitions:

```bash
npm install --save-dev gh-to-sponsors typescript vitest
npm install node-telegram-bot-api
```

Create a `tsconfig.json` extending the base configuration:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

## Implement the Plugin Interface

Create `src/client.ts` and start with the basic structure:

```typescript
import TelegramBot from 'node-telegram-bot-api';
import type { PlatformPlugin, PostResult } from 'gh-to-sponsors/platforms/types';
import type { PostState } from 'gh-to-sponsors/types/state';

export class TelegramPlugin implements PlatformPlugin {
  readonly name = 'telegram';

  constructor(
    private readonly botToken: string | undefined,
    private readonly chatId: string | undefined
  ) {}
}
```

### Step 1: Implement `isConfigured()`

The `isConfigured()` method checks whether the plugin has valid credentials. This prevents the plugin from being used when not properly set up.

```typescript
/**
 * Check if Telegram is properly configured with bot token and chat ID.
 *
 * @returns true when both botToken and chatId are truthy
 */
isConfigured(): boolean {
  return Boolean(this.botToken && this.chatId);
}
```

**Why:** The registry calls `isConfigured()` to filter out unconfigured plugins. This ensures `getConfiguredPlatforms()` only returns plugins ready to post.

### Step 2: Implement Lazy Initialization

Add a private client instance and a getter that creates it on demand:

```typescript
export class TelegramPlugin implements PlatformPlugin {
  readonly name = 'telegram';
  private bot: TelegramBot | null = null;

  // ... constructor and isConfigured() ...

  /**
   * Get or create the Telegram bot client.
   * Lazy initialization defers client creation until first use.
   *
   * @throws Error if not configured
   */
  private getClient(): TelegramBot {
    if (!this.bot) {
      if (!this.botToken || !this.chatId) {
        throw new Error('Telegram not configured');
      }
      this.bot = new TelegramBot(this.botToken);
    }
    return this.bot;
  }
}
```

**Why Lazy Init:** The registry creates ALL plugins on every run (via factory functions). If constructors created API connections, unconfigured platforms would fail immediately. Lazy initialization via `getClient()` defers connection until `post()` is actually called.

### Step 3: Implement the `post()` Method

Now implement the core posting logic with validation and error handling:

```typescript
/**
 * Post teaser content to Telegram.
 *
 * @param state - Post state containing teaser content
 * @returns PostResult with success status or error message
 */
async post(state: PostState): Promise<PostResult> {
  // Validate teaser content exists
  if (!state.teaser) {
    return { success: false, error: 'No teaser content' };
  }

  // Validate configuration
  if (!this.isConfigured()) {
    return { success: false, error: 'Telegram not configured' };
  }

  const bot = this.getClient();

  try {
    const message = await bot.sendMessage(
      this.chatId!,
      state.teaser.text,
      { parse_mode: 'Markdown' }
    );

    return {
      success: true,
      platformPostId: String(message.message_id),
      platformUrl: `https://t.me/${this.chatId}/${message.message_id}`,
    };
  } catch (error: unknown) {
    // Never throw - always return PostResult
    const apiError = error as { message?: string };
    return {
      success: false,
      error: apiError?.message || String(error),
    };
  }
}
```

**Why Never-Throw:** The executor uses `Promise.allSettled()` for error isolation. If a plugin throws an exception that escapes the try/catch wrapper, it could crash the entire posting flow. Returning `PostResult { success: false, error }` is the contract.

## Add Retry Logic

For production plugins, you should handle rate limits with exponential backoff. Update the `post()` method:

```typescript
/** Maximum retry attempts for rate limited requests */
const MAX_RETRIES = 3;

async post(state: PostState): Promise<PostResult> {
  // ... validation code ...

  const bot = this.getClient();
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const message = await bot.sendMessage(
        this.chatId!,
        state.teaser.text,
        { parse_mode: 'Markdown' }
      );

      return {
        success: true,
        platformPostId: String(message.message_id),
        platformUrl: `https://t.me/${this.chatId}/${message.message_id}`,
      };
    } catch (error: unknown) {
      const apiError = error as { code?: string; message?: string };
      const isRateLimit = apiError?.code === '429';
      const isLastAttempt = attempt >= MAX_RETRIES - 1;

      if (isRateLimit && !isLastAttempt) {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }

      // Return error without throwing
      return {
        success: false,
        error: apiError?.message || String(error),
      };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}
```

**Why Jitter:** Without random jitter, all failed requests retry at exactly the same time (thundering herd problem). Adding `Math.random() * 1000` spreads out the retries.

## Register the Plugin

To make your plugin available to gh-to-sponsors, you need to register it with the factory pattern. Create `src/index.ts`:

```typescript
import { registerPlatform } from 'gh-to-sponsors/platforms/registry';
import { TelegramPlugin } from './client.js';

/**
 * Register Telegram plugin with the platform registry.
 * Call this once during app initialization.
 */
export function setupTelegramPlugin(): void {
  registerPlatform('telegram', () => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    return new TelegramPlugin(botToken, chatId);
  });
}

export { TelegramPlugin };
```

**Why Factories:** The registry stores functions, not objects. This allows:
- Lazy instantiation (plugin created only when needed)
- Fresh credentials on each invocation
- No stale state between runs

In gh-to-sponsors' `src/platforms/setup.ts`, you would call:

```typescript
import { setupTelegramPlugin } from 'telegram-plugin';

export function setupPlatforms(): void {
  // ... existing platform registrations ...
  setupTelegramPlugin();
}
```

## Test Your Plugin

Create `src/client.test.ts` to verify your plugin works correctly:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TelegramPlugin } from './client.js';
import type { PostState } from 'gh-to-sponsors/types/state';

// Mock the telegram bot API
vi.mock('node-telegram-bot-api', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      sendMessage: vi.fn(),
    })),
  };
});

import TelegramBot from 'node-telegram-bot-api';

describe('TelegramPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makePostState = (overrides: Partial<PostState> = {}): PostState => ({
    id: 'post-123',
    contentHash: 'hash-abc',
    status: 'approved',
    platforms: {},
    createdAt: '2026-01-01T00:00:00Z',
    teaser: {
      text: 'Check out our latest updates!',
      hashtags: ['#devlog'],
      characterCount: 32,
    },
    ...overrides,
  });

  it('returns true when both botToken and chatId are configured', () => {
    const plugin = new TelegramPlugin('bot-token', 'chat-id');
    expect(plugin.isConfigured()).toBe(true);
  });

  it('returns false when botToken is missing', () => {
    const plugin = new TelegramPlugin(undefined, 'chat-id');
    expect(plugin.isConfigured()).toBe(false);
  });

  it('successfully posts teaser to Telegram', async () => {
    const plugin = new TelegramPlugin('bot-token', 'chat-id');
    const state = makePostState();

    const mockSendMessage = vi.fn().mockResolvedValue({
      message_id: 12345,
    });

    vi.mocked(TelegramBot).mockImplementation(() => ({
      sendMessage: mockSendMessage,
    } as any));

    const result = await plugin.post(state);

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe('12345');
    expect(mockSendMessage).toHaveBeenCalledWith(
      'chat-id',
      'Check out our latest updates!',
      { parse_mode: 'Markdown' }
    );
  });

  it('returns error when teaser is missing', async () => {
    const plugin = new TelegramPlugin('bot-token', 'chat-id');
    const state = makePostState({ teaser: undefined });

    const result = await plugin.post(state);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No teaser content');
  });
});
```

Run your tests:

```bash
npx vitest run
```

## Next Steps

Congratulations! You've built a complete platform plugin. Here's what to explore next:

1. **Read the [API Reference](./reference-api.md)** - Understand all the types and interfaces available
2. **Learn [Testing Patterns](./howto-testing.md)** - Advanced testing with mocked APIs and error scenarios
3. **Understand [Architecture Decisions](./explanation-architecture.md)** - Learn why plugins work the way they do
4. **Submit to the community** - Share your plugin with other gh-to-sponsors users

For more examples, see the existing platform plugins:
- `src/platforms/ghost/client.ts` - Long-form content publishing
- `src/platforms/bluesky/client.ts` - Social media with facet detection
- `src/platforms/mastodon/client.ts` - Federated social posting
