import { describe, it, expect, vi } from 'vitest';
import { parsePrUrl, GitHubClient } from '../github.js';

describe('parsePrUrl', () => {
  it('解析标准 GitHub PR URL', () => {
    const result = parsePrUrl('https://github.com/vercel/next.js/pull/12345');
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js', prNumber: 12345 });
  });

  it('解析带尾斜杠的 URL', () => {
    const result = parsePrUrl('https://github.com/facebook/react/pull/100/');
    expect(result).toEqual({ owner: 'facebook', repo: 'react', prNumber: 100 });
  });

  it('无效 URL 抛异常', () => {
    expect(() => parsePrUrl('https://github.com/foo')).toThrow('Invalid PR URL');
  });

  it('非 PR URL 抛异常', () => {
    expect(() => parsePrUrl('https://github.com/foo/bar/issues/1')).toThrow('Invalid PR URL');
  });
});

describe('GitHubClient', () => {
  it('getPrDiff 返回 diff 字符串', async () => {
    const client = new GitHubClient();
    const mockGet = vi.fn().mockResolvedValue({ data: 'diff content here' });
    (client as any).octokit = { pulls: { get: mockGet, listFiles: vi.fn() }, search: { issuesAndPullRequests: vi.fn() } };

    const diff = await client.getPrDiff('owner', 'repo', 1);
    expect(diff).toBe('diff content here');
    expect(mockGet).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 1,
      mediaType: { format: 'diff' },
    });
  });

  it('getFileMeta 返回映射后的文件列表', async () => {
    const client = new GitHubClient();
    const mockListFiles = vi.fn().mockResolvedValue({
      data: [
        { filename: 'src/foo.ts', additions: 10, deletions: 2, status: 'modified' },
        { filename: 'src/bar.ts', additions: 50, deletions: 0, status: 'added' },
      ],
    });
    (client as any).octokit = { pulls: { get: vi.fn(), listFiles: mockListFiles }, search: { issuesAndPullRequests: vi.fn() } };

    const files = await client.getFileMeta('owner', 'repo', 1);
    expect(files).toEqual([
      { path: 'src/foo.ts', additions: 10, deletions: 2, status: 'modified' },
      { path: 'src/bar.ts', additions: 50, deletions: 0, status: 'added' },
    ]);
  });

  it('searchIssues 返回映射后的 issue 列表', async () => {
    const client = new GitHubClient();
    const mockSearch = vi.fn().mockResolvedValue({
      data: {
        items: [
          { number: 42, title: 'Bug in auth', state: 'open' },
          { number: 43, title: 'Fix auth', state: 'closed' },
        ],
      },
    });
    (client as any).octokit = { pulls: { get: vi.fn(), listFiles: vi.fn() }, search: { issuesAndPullRequests: mockSearch } };

    const issues = await client.searchIssues('owner', 'repo', 'auth bug');
    expect(issues).toEqual([
      { number: 42, title: 'Bug in auth', state: 'open' },
      { number: 43, title: 'Fix auth', state: 'closed' },
    ]);
    expect(mockSearch).toHaveBeenCalledWith({ q: 'repo:owner/repo auth bug' });
  });
});
