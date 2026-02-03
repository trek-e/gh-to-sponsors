/**
 * Tests for release content generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReleasePayload } from './types.js';
import type { ReleaseAnnouncement } from '../types/state.js';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

import Anthropic from '@anthropic-ai/sdk';
import { buildReleaseAnnouncement, generateReleaseContent } from './content.js';

describe('buildReleaseAnnouncement', () => {
  const standardPayload: ReleasePayload = {
    id: 12345,
    tag_name: 'v1.2.0',
    name: 'Release 1.2.0 - New Features',
    body: '## Changelog\n\n- Added feature X\n- Fixed bug Y',
    html_url: 'https://github.com/owner/repo/releases/tag/v1.2.0',
    draft: false,
    prerelease: false,
    published_at: '2026-02-02T10:00:00Z',
    assets: [
      {
        name: 'app-v1.2.0-darwin.zip',
        browser_download_url: 'https://github.com/owner/repo/releases/download/v1.2.0/app-v1.2.0-darwin.zip',
        size: 15000000,
      },
      {
        name: 'app-v1.2.0-linux.tar.gz',
        browser_download_url: 'https://github.com/owner/repo/releases/download/v1.2.0/app-v1.2.0-linux.tar.gz',
        size: 12000000,
      },
    ],
  };

  it('standard release returns ReleaseAnnouncement with all fields', () => {
    const result = buildReleaseAnnouncement(standardPayload, 'owner/repo');

    expect(result).toEqual<ReleaseAnnouncement>({
      type: 'release',
      tagName: 'v1.2.0',
      title: 'Release 1.2.0 - New Features',
      body: '## Changelog\n\n- Added feature X\n- Fixed bug Y',
      releaseUrl: 'https://github.com/owner/repo/releases/tag/v1.2.0',
      downloadLinks: [
        { name: 'app-v1.2.0-darwin.zip', url: 'https://github.com/owner/repo/releases/download/v1.2.0/app-v1.2.0-darwin.zip' },
        { name: 'app-v1.2.0-linux.tar.gz', url: 'https://github.com/owner/repo/releases/download/v1.2.0/app-v1.2.0-linux.tar.gz' },
      ],
      isPrerelease: false,
      repoName: 'owner/repo',
    });
  });

  it('release with no assets returns empty downloadLinks array', () => {
    const noAssetsPayload: ReleasePayload = {
      ...standardPayload,
      assets: [],
    };

    const result = buildReleaseAnnouncement(noAssetsPayload, 'owner/repo');

    expect(result.downloadLinks).toEqual([]);
  });

  it('pre-release returns isPrerelease=true', () => {
    const prereleasePayload: ReleasePayload = {
      ...standardPayload,
      prerelease: true,
      tag_name: 'v1.3.0-beta.1',
    };

    const result = buildReleaseAnnouncement(prereleasePayload, 'owner/repo');

    expect(result.isPrerelease).toBe(true);
    expect(result.tagName).toBe('v1.3.0-beta.1');
  });

  it('release with null name uses tag_name as title', () => {
    const noNamePayload: ReleasePayload = {
      ...standardPayload,
      name: null,
    };

    const result = buildReleaseAnnouncement(noNamePayload, 'owner/repo');

    expect(result.title).toBe('v1.2.0');
  });

  it('release with null body returns empty string body', () => {
    const noBodyPayload: ReleasePayload = {
      ...standardPayload,
      body: null,
    };

    const result = buildReleaseAnnouncement(noBodyPayload, 'owner/repo');

    expect(result.body).toBe('');
  });
});

describe('generateReleaseContent', () => {
  const standardPayload: ReleasePayload = {
    id: 12345,
    tag_name: 'v1.2.0',
    name: 'Release 1.2.0 - New Features',
    body: '## Changelog\n\n- Added feature X\n- Fixed bug Y',
    html_url: 'https://github.com/owner/repo/releases/tag/v1.2.0',
    draft: false,
    prerelease: false,
    published_at: '2026-02-02T10:00:00Z',
    assets: [
      {
        name: 'app-v1.2.0-darwin.zip',
        browser_download_url: 'https://github.com/owner/repo/releases/download/v1.2.0/app-v1.2.0-darwin.zip',
        size: 15000000,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls AI to generate announcement post content', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '## Release Announcement\n\nExciting news! Version 1.2.0 is here with new features.' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"text": "v1.2.0 is here! New features and bug fixes.", "hashtags": ["#opensource", "#devlog", "#release"]}' }],
        usage: { input_tokens: 50, output_tokens: 30 },
      });

    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);

    await generateReleaseContent(standardPayload, 'owner/repo', 'test-api-key');

    // Should call AI twice: once for post content, once for teaser
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // First call should be for post content
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      temperature: expect.any(Number),
      max_tokens: expect.any(Number),
    });
  });

  it('returns digest-like content suitable for Ghost', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '## Release Announcement\n\nExciting news! Version 1.2.0 is here.' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"text": "v1.2.0 is here!", "hashtags": ["#release", "#opensource"]}' }],
        usage: { input_tokens: 50, output_tokens: 30 },
      });

    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);

    const result = await generateReleaseContent(standardPayload, 'owner/repo', 'test-api-key');

    expect(result.postContent).toContain('Release Announcement');
    expect(typeof result.postContent).toBe('string');
    expect(result.postContent.length).toBeGreaterThan(0);
  });

  it('returns teaser suitable for social platforms', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '## Release Announcement\n\nNew version available!' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"text": "v1.2.0 just dropped! Check out the new features.", "hashtags": ["#opensource", "#devlog", "#release"]}' }],
        usage: { input_tokens: 50, output_tokens: 30 },
      });

    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);

    const result = await generateReleaseContent(standardPayload, 'owner/repo', 'test-api-key');

    expect(result.teaser.text).toBeDefined();
    expect(result.teaser.text.length).toBeLessThanOrEqual(280);
    expect(result.teaser.hashtags).toEqual(expect.arrayContaining([expect.stringMatching(/^#/)]));
    expect(result.teaser.characterCount).toBe(result.teaser.text.length);
  });

  it('includes announcement in result for state storage', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '## Release Announcement\n\nNew version!' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"text": "New release v1.2.0 is out now!", "hashtags": ["#release", "#oss"]}' }],
        usage: { input_tokens: 50, output_tokens: 30 },
      });

    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);

    const result = await generateReleaseContent(standardPayload, 'owner/repo', 'test-api-key');

    expect(result.announcement).toEqual({
      type: 'release',
      tagName: 'v1.2.0',
      title: 'Release 1.2.0 - New Features',
      body: '## Changelog\n\n- Added feature X\n- Fixed bug Y',
      releaseUrl: 'https://github.com/owner/repo/releases/tag/v1.2.0',
      downloadLinks: [
        { name: 'app-v1.2.0-darwin.zip', url: 'https://github.com/owner/repo/releases/download/v1.2.0/app-v1.2.0-darwin.zip' },
      ],
      isPrerelease: false,
      repoName: 'owner/repo',
    });
  });

  it('tracks token usage from both AI calls', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Post content here' }],
        usage: { input_tokens: 150, output_tokens: 75 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"text": "v1.2.0 released with awesome features!", "hashtags": ["#tag1", "#tag2"]}' }],
        usage: { input_tokens: 60, output_tokens: 25 },
      });

    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);

    const result = await generateReleaseContent(standardPayload, 'owner/repo', 'test-api-key');

    expect(result.usage).toEqual({
      inputTokens: 150 + 60,
      outputTokens: 75 + 25,
    });
  });
});
