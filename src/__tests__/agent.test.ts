import { describe, it, expect, vi } from 'vitest';
import { runAgent } from '../agent.js';
import type { StreamEvent } from '../stream.js';
import type { GitHubClient } from '../github.js';

// --- Mock helpers ---

function createMockGitHubClient(): GitHubClient {
  return {
    getPrDiff: vi.fn().mockResolvedValue('mock diff'),
    getFileMeta: vi
      .fn()
      .mockResolvedValue([
        { path: 'foo.ts', additions: 5, deletions: 1, status: 'modified' },
      ]),
    searchIssues: vi.fn().mockResolvedValue([]),
  } as unknown as GitHubClient;
}

interface MockChunk {
  choices: Array<{
    delta: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
  }>;
}

function createMockStream(chunks: MockChunk[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

function createMockOpenAIClient(
  responses: Array<{ chunks: MockChunk[] }>
) {
  let callIndex = 0;
  return {
    chat: {
      completions: {
        create: vi.fn(async () => {
          const response = responses[callIndex++];
          return createMockStream(response.chunks);
        }),
      },
    },
  };
}

async function collectEvents(
  gen: AsyncGenerator<StreamEvent>
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

// --- Tests ---

describe('runAgent', () => {
  it('直接 JSON 响应时 yield text + final 事件', async () => {
    const jsonOutput = JSON.stringify({
      summary: '小幅修复',
      files_changed: 1,
      risk_level: 'low',
    });

    const mockClient = createMockOpenAIClient([
      {
        chunks: [
          {
            choices: [{ delta: { content: jsonOutput }, finish_reason: null }],
          },
          {
            choices: [{ delta: {}, finish_reason: 'stop' }],
          },
        ],
      },
    ]);

    const ghClient = createMockGitHubClient();
    const gen = runAgent(
      'https://github.com/test/repo/pull/1',
      mockClient as any,
      ghClient
    );
    const events = await collectEvents(gen);

    const textEvents = events.filter((e) => e.type === 'text');
    const finalEvents = events.filter((e) => e.type === 'final');

    expect(textEvents.length).toBeGreaterThan(0);
    expect(finalEvents).toHaveLength(1);
    expect(finalEvents[0]).toEqual({
      type: 'final',
      data: { summary: '小幅修复', files_changed: 1, risk_level: 'low' },
    });
  });

  it('先 tool call 再 final 响应', async () => {
    const jsonOutput = JSON.stringify({
      summary: '添加了功能 X',
      files_changed: 3,
      risk_level: 'medium',
    });

    const mockClient = createMockOpenAIClient([
      // First response: tool call
      {
        chunks: [
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'fetch_pr_diff', arguments: '' },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      function: {
                        arguments: '{"owner":"test","repo":"repo","pr_number":1}',
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [{ delta: {}, finish_reason: 'tool_calls' }],
          },
        ],
      },
      // Second response: final JSON
      {
        chunks: [
          {
            choices: [{ delta: { content: jsonOutput }, finish_reason: null }],
          },
          {
            choices: [{ delta: {}, finish_reason: 'stop' }],
          },
        ],
      },
    ]);

    const ghClient = createMockGitHubClient();
    const gen = runAgent(
      'https://github.com/test/repo/pull/1',
      mockClient as any,
      ghClient
    );
    const events = await collectEvents(gen);

    const toolStarts = events.filter((e) => e.type === 'tool_start');
    const toolEnds = events.filter((e) => e.type === 'tool_end');
    const finals = events.filter((e) => e.type === 'final');

    expect(toolStarts).toHaveLength(1);
    expect((toolStarts[0] as any).name).toBe('fetch_pr_diff');
    expect(toolEnds).toHaveLength(1);
    expect(finals).toHaveLength(1);
    expect((finals[0] as any).data.summary).toBe('添加了功能 X');
  });

  it('JSON 无效时 yield error 事件并重试', async () => {
    const badJson = '{"summary": "oops", "files_changed": "not a number", "risk_level": "low"}';
    const goodJson = JSON.stringify({
      summary: '修复了',
      files_changed: 2,
      risk_level: 'low',
    });

    const mockClient = createMockOpenAIClient([
      // First response: invalid JSON
      {
        chunks: [
          { choices: [{ delta: { content: badJson }, finish_reason: null }] },
          { choices: [{ delta: {}, finish_reason: 'stop' }] },
        ],
      },
      // Second response: valid JSON
      {
        chunks: [
          { choices: [{ delta: { content: goodJson }, finish_reason: null }] },
          { choices: [{ delta: {}, finish_reason: 'stop' }] },
        ],
      },
    ]);

    const ghClient = createMockGitHubClient();
    const gen = runAgent(
      'https://github.com/test/repo/pull/1',
      mockClient as any,
      ghClient
    );
    const events = await collectEvents(gen);

    const finals = events.filter((e) => e.type === 'final');
    expect(finals).toHaveLength(1);
    expect((finals[0] as any).data.summary).toBe('修复了');
  });

  it('tool 执行出错时优雅处理', async () => {
    const jsonOutput = JSON.stringify({
      summary: '无法获取 diff，但分析了可用内容',
      files_changed: 0,
      risk_level: 'low',
    });

    const mockClient = createMockOpenAIClient([
      // Tool call that will fail
      {
        chunks: [
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_1',
                      type: 'function',
                      function: {
                        name: 'fetch_pr_diff',
                        arguments: '{"owner":"test","repo":"repo","pr_number":1}',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          },
        ],
      },
      // Final response after error
      {
        chunks: [
          { choices: [{ delta: { content: jsonOutput }, finish_reason: null }] },
          { choices: [{ delta: {}, finish_reason: 'stop' }] },
        ],
      },
    ]);

    const ghClient = createMockGitHubClient();
    vi.mocked(ghClient.getPrDiff).mockRejectedValue(new Error('404 Not Found'));

    const gen = runAgent(
      'https://github.com/test/repo/pull/1',
      mockClient as any,
      ghClient
    );
    const events = await collectEvents(gen);

    const toolEnds = events.filter((e) => e.type === 'tool_end');
    expect(toolEnds).toHaveLength(1);
    const toolEndResult = JSON.parse((toolEnds[0] as any).result);
    expect(toolEndResult.error).toContain('404 Not Found');

    const finals = events.filter((e) => e.type === 'final');
    expect(finals).toHaveLength(1);
  });
});
