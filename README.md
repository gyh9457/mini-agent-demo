# PR 摘要 Agent

AI 驱动的 GitHub PR 摘要工具。输入 PR URL，获取结构化摘要和风险评估。

基于 TypeScript + OpenAI SDK + 通义千问 Plus（via DashScope）构建。

## 功能

- **Tool-use agent 循环**：手写 while 循环，含流式处理、tool 调度、重试逻辑
- **3 个 GitHub 工具**：fetch_pr_diff、get_file_meta、search_issues
- **结构化输出**：Zod 校验的 JSON（summary、files_changed、risk_level）
- **流式输出**：token-by-token 思考流 + tool 进度事件
- **Eval 框架**：5 个测试用例，规则断言 + LLM-as-judge 评分
- **CLI + Web**：终端 CLI + Next.js Web 壳（SSE 流式推送）

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env — 填入你的 DASHSCOPE_API_KEY

# 运行 CLI
npx tsx src/index.ts https://github.com/owner/repo/pull/123

# 运行 Web 壳
npm run web:dev
# 打开 http://localhost:3000
```

## 架构

```
src/agent.ts       — 核心 agent 循环（AsyncGenerator<StreamEvent>）
src/github.ts      — GitHub API 客户端（@octokit/rest）
src/tools/index.ts — Tool 定义 + 调度器
src/output.ts      — Zod schema 结构化输出
src/stream.ts      — StreamEvent 类型定义
src/index.ts       — CLI 入口
src/eval/          — Eval 框架（用例、断言、judge、运行器）
app/               — Next.js Web 壳（API 路由 + 前端）
```

## 脚本

| 命令              | 描述                       |
|-------------------|----------------------------|
| `npm run dev`     | 用 tsx 运行 CLI            |
| `npm run test`    | 运行 vitest 单元/集成测试  |
| `npm run eval`    | 运行 eval 套件（5 个用例） |
| `npm run web:dev` | 启动 Next.js 开发服务器    |
| `npm run build`   | TypeScript 编译            |

## 环境变量

| 变量              | 必填 | 说明                         |
|-------------------|------|------------------------------|
| DASHSCOPE_API_KEY | 是   | 阿里云 DashScope API Key     |
| GITHUB_TOKEN      | 否   | GitHub Token（访问私有 repo）|

## Eval

运行 eval 套件测试 agent 质量：

```bash
npm run eval
```

5 个用例覆盖：小 PR、中等 PR、大 PR、空 PR、prompt injection。

评分：规则断言（schema 合规、字段校验）+ LLM-as-judge（准确性、简洁性、风险评估）。

## 技术栈

- TypeScript + OpenAI SDK (`openai`)
- 通义千问 Plus（DashScope OpenAI 兼容端点）
- @octokit/rest（GitHub API）
- Zod（schema 校验）
- vitest（测试）
- Next.js（Web 壳）
