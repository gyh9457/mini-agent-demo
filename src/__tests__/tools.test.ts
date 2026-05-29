import { describe, it, expect, vi } from 'vitest';
import { toolDefinitions, executeTool } from '../tools/index.js';
import type { GitHubClient } from '../github.js';

function createMockClient(): GitHubClient {
  return {
    getPrDiff: vi.fn().mockResolvedValue('mock diff content'),
    getFileMeta: vi.fn().mockResolvedValue([
      { path: 'src/foo.ts', additions: 10, deletions: 2, status: 'modified' },
    ]),
    searchIssues: vi.fn().mockResolvedValue([
      { number: 42, title: 'Bug report', state: 'open' },
    ]),
  } as unknown as GitHubClient;
}

describe('toolDefinitions', () => {
  it('定义了 3 个 tool', () => {
    expect(toolDefinitions).toHaveLength(3);
  });

  it('每个 tool 有 type function 和必要字段', () => {
    for (const def of toolDefinitions) {
      expect(def.type).toBe('function');
      expect(def.function.name).toBeTruthy();
      expect(def.function.description).toBeTruthy();
      expect(def.function.parameters).toBeDefined();
    }
  });

  it('tool 名称为 fetch_pr_diff, get_file_meta, search_issues', () => {
    const names = toolDefinitions.map((d) => d.function.name);
    expect(names).toEqual(['fetch_pr_diff', 'get_file_meta', 'search_issues']);
  });
});

describe('executeTool', () => {
  it('fetch_pr_diff 调用 client.getPrDiff', async () => {
    const client = createMockClient();
    const result = await executeTool(
      'fetch_pr_diff',
      { owner: 'vercel', repo: 'next.js', pr_number: 123 },
      client
    );
    expect(client.getPrDiff).toHaveBeenCalledWith('vercel', 'next.js', 123);
    expect(result).toBe('mock diff content');
  });

  it('get_file_meta 调用 client.getFileMeta 并返回 JSON', async () => {
    const client = createMockClient();
    const result = await executeTool(
      'get_file_meta',
      { owner: 'vercel', repo: 'next.js', pr_number: 123 },
      client
    );
    expect(client.getFileMeta).toHaveBeenCalledWith('vercel', 'next.js', 123);
    const parsed = JSON.parse(result);
    expect(parsed).toEqual([
      { path: 'src/foo.ts', additions: 10, deletions: 2, status: 'modified' },
    ]);
  });

  it('search_issues 调用 client.searchIssues 并返回 JSON', async () => {
    const client = createMockClient();
    const result = await executeTool(
      'search_issues',
      { owner: 'vercel', repo: 'next.js', query: 'auth bug' },
      client
    );
    expect(client.searchIssues).toHaveBeenCalledWith('vercel', 'next.js', 'auth bug');
    const parsed = JSON.parse(result);
    expect(parsed).toEqual([{ number: 42, title: 'Bug report', state: 'open' }]);
  });

  it('未知 tool 返回错误 JSON', async () => {
    const client = createMockClient();
    const result = await executeTool('unknown_tool', {}, client);
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Unknown tool');
  });

  it('tool 抛异常时返回错误 JSON', async () => {
    const client = createMockClient();
    vi.mocked(client.getPrDiff).mockRejectedValue(new Error('API rate limit'));
    const result = await executeTool(
      'fetch_pr_diff',
      { owner: 'o', repo: 'r', pr_number: 1 },
      client
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('API rate limit');
  });
});
