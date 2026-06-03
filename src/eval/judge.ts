import type OpenAI from 'openai';
import type { StructuredOutput } from '../output';

export interface JudgeResult {
  name: string;
  score: number; // 1-5
  reasoning: string;
}

const JUDGE_PROMPTS: Record<string, string> = {
  accuracy: `你正在评估一个 PR 摘要的**准确性**。
给定 PR diff 和文件列表，这个摘要是否正确描述了 PR 做了什么？

评分 1-5：
1: 完全错误或无关
2: 大部分错误，只有少量正确
3: 部分正确，缺少关键细节
4: 准确，有小遗漏
5: 完全准确且完整

PR Diff：
{diff}

变更文件：
{files}

待评估的摘要：
{summary}

用 JSON 回答：{"score": <1-5>, "reasoning": "<解释>"}`,

  conciseness: `你正在评估一个 PR 摘要的**简洁性**。
摘要是否简短精炼，没有不必要的废话？

评分 1-5：
1: 极其冗长或跑题
2: 太长，有大量废话
3: 有些冗长
4: 较为简洁
5: 非常简洁清晰

待评估的摘要：
{summary}

用 JSON 回答：{"score": <1-5>, "reasoning": "<解释>"}`,

  risk_assessment: `你正在评估一个 PR 摘要的**风险等级**是否合理。
给定 PR diff 和文件列表，risk_level ({risk_level}) 是否恰当？

评分 1-5：
1: 风险等级完全错误（如破坏性变更评为 "low"）
2: 风险等级明显不对
3: 大致合理但有争议
4: 风险评估合理
5: 风险评估非常准确

PR Diff：
{diff}

变更文件：
{files}

给定的风险等级：{risk_level}

摘要：{summary}

用 JSON 回答：{"score": <1-5>, "reasoning": "<解释>"}`,
};

export async function judgeOutput(
  openaiClient: OpenAI,
  output: StructuredOutput,
  context: { diff: string; files: string }
): Promise<JudgeResult[]> {
  const results: JudgeResult[] = [];

  for (const [name, promptTemplate] of Object.entries(JUDGE_PROMPTS)) {
    const prompt = promptTemplate
      .replace('{diff}', context.diff)
      .replace('{files}', context.files)
      .replace('{summary}', output.summary)
      .replace('{risk_level}', output.risk_level);

    try {
      const response = await openaiClient.chat.completions.create({
        model: 'qwen3.7-max',
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0,
      });

      let content = response.choices[0]?.message?.content || '';
      // 去除 markdown 代码围栏
      content = content.trim();
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      let score: number;
      let reasoning: string;

      try {
        const parsed = JSON.parse(content);
        score = Math.min(5, Math.max(1, Number(parsed.score) || 1));
        reasoning = parsed.reasoning || '未提供理由';
      } catch {
        // JSON 解析失败，尝试正则提取
        const scoreMatch = content.match(/"score"\s*:\s*(\d+)/);
        const reasonMatch = content.match(/"reasoning"\s*:\s*"([\s\S]*?)"/);
        score = scoreMatch ? Math.min(5, Math.max(1, Number(scoreMatch[1]))) : 1;
        reasoning = reasonMatch ? reasonMatch[1] : `解析失败: ${content.slice(0, 200)}`;
      }

      results.push({ name, score, reasoning });
    } catch (err) {
      results.push({
        name,
        score: 1,
        reasoning: `Judge 错误: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return results;
}
