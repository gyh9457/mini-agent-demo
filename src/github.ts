import { Octokit } from '@octokit/rest';

export interface PrInfo {
  owner: string;
  repo: string;
  prNumber: number;
}

export interface FileMeta {
  path: string;
  additions: number;
  deletions: number;
  status: string;
}

export interface IssueInfo {
  number: number;
  title: string;
  state: string;
}

export function parsePrUrl(url: string): PrInfo {
  const match = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/
  );
  if (!match) {
    throw new Error(`Invalid PR URL: ${url}`);
  }
  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10),
  };
}

export class GitHubClient {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
  }

  async getPrDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    });
    return data as unknown as string;
  }

  async getFileMeta(owner: string, repo: string, prNumber: number): Promise<FileMeta[]> {
    const { data } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data.map((file) => ({
      path: file.filename,
      additions: file.additions,
      deletions: file.deletions,
      status: file.status,
    }));
  }

  async searchIssues(owner: string, repo: string, query: string): Promise<IssueInfo[]> {
    const q = `repo:${owner}/${repo} ${query}`;
    const { data } = await this.octokit.search.issuesAndPullRequests({ q });
    return data.items.slice(0, 10).map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
    }));
  }
}
