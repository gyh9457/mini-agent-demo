/**
 * Agent loop
 *
 * 核心循环：
 * 1. system prompt + user input → LLM
 * 2. LLM 返回 tool_call → 执行 tool → 结果回填
 * 3. 循环直到无 tool_call
 * 4. 返回 structured output
 */

export interface AgentResult {
  answer: string;
  structured?: Record<string, unknown>;
  toolCalls?: string[];
}

export async function runAgent(input: string): Promise<AgentResult> {
  // TODO: D23 实现
  // 1. 初始化 OpenAI client
  // 2. 构造 messages
  // 3. 调用 chat.completions.create
  // 4. 处理 tool_calls
  // 5. 循环直到完成

  console.log("🤖 Agent 启动...");
  console.log("⏳ 待实现 (D23)");

  return {
    answer: `[TODO] 未实现，输入: ${input}`,
  };
}
