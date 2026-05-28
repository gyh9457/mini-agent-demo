---
title: PR 摘要 Agent 设计 Spec
type: spec
created: 2026-05-28
---

# PR 摘要 Agent 设计 Spec

M1 收官项目。完整 LLM agent (tool use + structured output + streaming + eval)。

## 目标

学习深度优先。手写 agent loop，深挖底层原理。

## 领域

GitHub PR 摘要 agent。
输入 PR URL，输出结构化摘要 (summary, files_changed, risk_level)。

## 技术栈

- 核心: TypeScript + OpenAI SDK (对接千问 DashScope)
- Web 壳: Next.js (API route + 前端)
- 测试: vitest
- Eval: autoevals (规则断言 + LLM-as-judge)

## 架构

```
[Core: 纯 TS agent loop] (src/agent.ts)
 ├─ 输入: PR URL
 ├─ 输出: AsyncGenerator<StreamEvent>
 │   (yield text / tool_start / tool_end / final_json)
 └─ 无 UI 依赖，可独立 CLI 跑

[Shell 1: CLI] (src/index.ts)
 └─ 调 Core，console.log 打印 StreamEvent

[Shell 2: Next.js Web] (app/api/... + app/page.tsx)
 ├─ API route: 调 Core，StreamEvent 转 SSE 推前端
 └─ 前端: fetch SSE，渲染思考流 + 最终 JSON 卡片
```

## 数据流

```
[CLI/Web: PR URL]
       ↓
[Agent Loop (while)]
       ↓
[OpenAI Stream API] ← (tools 定义 + messages)
       ↓
[解析 SSE chunk]
 ├─ text chunk → stdout/SSE 流式打印 (思考流)
 └─ tool_call chunk → 拼参数 → 执行 tool → tool message 回填 → 继续 loop
       ↓ (finish_reason == 'stop' 且无 tool_call)
[最终 JSON] → parse → 校验 schema → 打印/渲染
```

## 组件

1. `GitHubClient` — 封装 `@octokit/rest` 拉 PR diff / file meta / issues
2. `ToolRegistry` — 注册 3 个 tool (fetch_pr_diff, get_file_meta, search_issues)
3. `AgentLoop` — 核心 while 循环，调 OpenAI stream API，解析 chunk，执行 tool
4. `SchemaValidator` — 最终 JSON 校验 (用 Zod)

## Tool 定义

1. `fetch_pr_diff(owner, repo, pr_number)` → 返回 PR diff 文本
2. `get_file_meta(owner, repo, pr_number)` → 返回文件列表 (路径/行数/状态)
3. `search_issues(owner, repo, query)` → 返回相关 issue 列表

## Structured Output

```typescript
interface StructuredOutput {
  summary: string;
  files_changed: number;
  risk_level: "low" | "medium" | "high";
}
```

## Streaming

- 中间推理: LLM 思考过程流式输出 (text chunk)
- 最终输出: 结构化 JSON 一次性输出 (parse 后)
- Tool 执行: 打印进度 (tool_start / tool_end event)

## 错误处理

- OpenAI 429/500 / 网络超时 → 指数退避重试，最多 5 次 (带 jitter)
- Tool 执行报错 → error message 作为 tool result 回填给 LLM，让 LLM 决定下一步（不崩）
- 最终 JSON 不合规 → 捕获 Zod error，把 "格式错误: {error}" 回填给 LLM 让它重新生成（算 1 次重试），最多 5 次
- GitHub API 404/403 → 业务错误不重试，提示 "PR 不存在或无权限"，优雅退出

## Eval

混合评判 (规则断言 + LLM-as-judge)。

### 规则断言

- schema 合规
- 字段非空
- risk_level 枚举 (low/medium/high)

### LLM-as-judge

- 摘要准确性
- 摘要简洁性
- 风险判断合理性

### Case (5-10 个)

1. 小 PR (1 文件)
2. 中 PR (5 文件)
3. 大 PR (20+ 文件)
4. 空 PR (无改动)
5. 恶意 PR (diff 里塞 prompt injection)

## 测试 (vitest)

- Tool 单元测试: mock GitHub API，测 tool 返回格式
- Agent loop 集成测试: mock OpenAI API，测 while 循环 + tool 调用逻辑
- Schema 测试: 测 Zod 校验逻辑

## 里程碑

- D22: 设计文档 + 空项目脚手架 ✅
- D23: 核心 LLM 调用 + 1 个 tool
- D24: agent loop + structured output
- D25: streaming + CLI 体验
- D26: eval 5 case + README + demo gif
- D27: Next.js Web 壳 + 博客草稿
- D28: M1 复盘
