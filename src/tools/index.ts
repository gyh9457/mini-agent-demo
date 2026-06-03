import type { GitHubClient } from '../github';

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

// 跳过的文件模式（生成文件、锁文件、二进制）
const SKIP_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.svg$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.ico$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.eot$/,
];

// 单文件 diff 最大保留长度
const MAX_FILE_DIFF_LENGTH = 50000;
// 总 diff 最大长度
const MAX_TOTAL_DIFF_LENGTH = 800000;

function truncateDiff(diff: string): string {
  const files = diff.split(/^diff --git /m).filter(Boolean);
  const result: string[] = [];
  let totalLength = 0;
  let skippedCount = 0;

  for (const file of files) {
    const fileDiff = 'diff --git ' + file;

    // 检查是否跳过
    const firstLine = file.split('\n')[0];
    if (SKIP_PATTERNS.some((p) => p.test(firstLine))) {
      skippedCount++;
      continue;
    }

    // 截断超长文件 diff
    let content = fileDiff;
    if (fileDiff.length > MAX_FILE_DIFF_LENGTH) {
      content = fileDiff.slice(0, MAX_FILE_DIFF_LENGTH) + '\n... [truncated] ...\n';
    }

    // 检查总长度
    if (totalLength + content.length > MAX_TOTAL_DIFF_LENGTH) {
      result.push(`\n... [truncated: ${files.length - result.length - skippedCount} more files] ...`);
      break;
    }

    result.push(content);
    totalLength += content.length;
  }

  let summary = `[diff 摘要: ${files.length} 个文件`;
  if (skippedCount > 0) summary += `, 跳过 ${skippedCount} 个生成/二进制文件`;
  summary += `, 截断后 ${totalLength} 字符]\n\n`;

  return summary + result.join('');
}

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
        const diff = await client.getPrDiff(owner, repo, pr_number);
        if (diff.length > MAX_TOTAL_DIFF_LENGTH) {
          return truncateDiff(diff);
        }
        return diff;
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
