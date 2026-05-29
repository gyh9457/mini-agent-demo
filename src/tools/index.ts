import type { GitHubClient } from '../github.js';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'fetch_pr_diff',
      description:
        '获取 GitHub Pull Request 的完整 diff 文本，返回原始 diff 字符串。',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub repo 拥有者' },
          repo: { type: 'string', description: 'GitHub repo 名称' },
          pr_number: { type: 'integer', description: 'Pull request 编号' },
        },
        required: ['owner', 'repo', 'pr_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_file_meta',
      description:
        '获取 Pull Request 中变更的文件列表，包含每个文件的路径、增加行数、删除行数、状态。',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub repo 拥有者' },
          repo: { type: 'string', description: 'GitHub repo 名称' },
          pr_number: { type: 'integer', description: 'Pull request 编号' },
        },
        required: ['owner', 'repo', 'pr_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_issues',
      description:
        '在指定 repo 中按关键词搜索相关的 GitHub issue 和 PR。',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub repo 拥有者' },
          repo: { type: 'string', description: 'GitHub repo 名称' },
          query: { type: 'string', description: '搜索关键词' },
        },
        required: ['owner', 'repo', 'query'],
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  client: GitHubClient
): Promise<string> {
  try {
    switch (name) {
      case 'fetch_pr_diff': {
        const { owner, repo, pr_number } = args as {
          owner: string;
          repo: string;
          pr_number: number;
        };
        return await client.getPrDiff(owner, repo, pr_number);
      }
      case 'get_file_meta': {
        const { owner, repo, pr_number } = args as {
          owner: string;
          repo: string;
          pr_number: number;
        };
        const files = await client.getFileMeta(owner, repo, pr_number);
        return JSON.stringify(files);
      }
      case 'search_issues': {
        const { owner, repo, query } = args as {
          owner: string;
          repo: string;
          query: string;
        };
        const issues = await client.searchIssues(owner, repo, query);
        return JSON.stringify(issues);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: message });
  }
}
