/**
 * Agent loop
 *
 * 核心循环：
 * 1. system prompt + user input → LLM（流式）
 * 2. 解析流 chunk：文本或 tool_call delta
 * 3. 有 tool call → 执行 tool → 回填结果 → 继续循环
 * 4. 纯文本响应 → 解析为 JSON → Zod 校验
 * 5. 校验失败 → 重试（最多 5 次）
 * 6. 全程 yield StreamEvent
 */

import type OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import type { GitHubClient } from './github';
import { parsePrUrl } from './github';
import { toolDefinitions, executeTool } from './tools/index';
import { outputSchema } from './output';
import type { StreamEvent } from './stream';

const SYSTEM_PROMPT = `你是一个 GitHub PR 审查 agent。你的职责：
1. 使用可用工具分析 Pull Request
2. 输出结构化 JSON 摘要

可用工具：
- fetch_pr_diff(owner, repo, pr_number)：获取 PR 完整 diff
- get_file_meta(owner, repo, pr_number)：获取变更文件列表及统计信息
- search_issues(owner, repo, query)：搜索相关 issue

你必须先使用工具获取信息，再生成摘要。不要猜测。

你的最终输出必须是纯 JSON（不要 markdown，不要解释），符合以下 schema：
{
  "summary": "string - PR 做了什么（1-3 句话）",
  "files_changed": "number - 变更文件数",
  "risk_level": "low | medium | high"
}

风险等级指南：
- low：小修复、typo、小重构、文档
- medium：新功能、中等重构、依赖更新
- high：破坏性变更、安全敏感代码、大规模重构、数据库迁移`;

const MAX_RETRIES = 5;

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

export async function* runAgent(
  prUrl: string,
  openaiClient: OpenAI,
  githubClient: GitHubClient
): AsyncGenerator<StreamEvent> {
  const prInfo = parsePrUrl(prUrl);

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `分析这个 Pull Request：${prUrl}\nOwner: ${prInfo.owner}, Repo: ${prInfo.repo}, PR #${prInfo.prNumber}`,
    },
  ];

  let retries = 0;

  while (retries < MAX_RETRIES) {
    let accumulatedText = '';
    const pendingToolCalls: PendingToolCall[] = [];

    const stream = await openaiClient.chat.completions.create({
      model: 'qwen3.7-max',
      messages,
      tools: toolDefinitions.map((t) => ({
        type: 'function' as const,
        function: t.function,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      // Accumulate text content
      if (delta?.content) {
        accumulatedText += delta.content;
        yield { type: 'text', content: delta.content };
      }

      // Accumulate tool call deltas
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!pendingToolCalls[idx]) {
            pendingToolCalls[idx] = {
              id: tc.id || '',
              name: tc.function?.name || '',
              arguments: '',
            };
          }
          if (tc.id) pendingToolCalls[idx].id = tc.id;
          if (tc.function?.name) pendingToolCalls[idx].name = tc.function.name;
          if (tc.function?.arguments) {
            pendingToolCalls[idx].arguments += tc.function.arguments;
          }
        }
      }
    }

    // If there are tool calls, execute them and continue loop
    if (pendingToolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: accumulatedText || null,
        tool_calls: pendingToolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      for (const tc of pendingToolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          // arguments parse failed, use empty object
        }

        yield { type: 'tool_start', name: tc.name, args };

        const result = await executeTool(tc.name, args, githubClient);

        yield { type: 'tool_end', name: tc.name, result };

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }

      continue;
    }

    // No tool calls — this should be the final JSON response
    try {
      let cleanedText = accumulatedText.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText
          .replace(/^```(?:json)?\s*\n?/, '')
          .replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(cleanedText);
      const validated = outputSchema.parse(parsed);
      yield { type: 'final', data: validated };
      return;
    } catch (err) {
      retries++;
      const errorMessage = err instanceof Error ? err.message : String(err);

      yield {
        type: 'error',
        message: `Schema 校验失败（第 ${retries}/${MAX_RETRIES} 次尝试）：${errorMessage}`,
      };

      messages.push({
        role: 'assistant',
        content: accumulatedText,
      });
      messages.push({
        role: 'user',
        content: `你的输出无效。错误：${errorMessage}\n请只输出符合所需 schema 的合法 JSON。不要 markdown，不要解释。`,
      });
    }
  }

  yield {
    type: 'error',
    message: `在 ${MAX_RETRIES} 次尝试后仍无法生成有效的结构化输出。`,
  };
}
