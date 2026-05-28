# Mini Agent

M1 收官项目。完整跑一遍 LLM 应用核心组件。

## 功能

- [ ] Tool use：自定义 tool 定义 + 调用
- [ ] Structured output：JSON schema 强制输出
- [ ] Streaming：token-by-token 流式输出
- [ ] Eval：autoevals 5-10 case

## 安装

```bash
npm install
cp .env.example .env
# 编辑 .env 填入 API key
```

## 使用

```bash
npm run dev -- "你的输入"
```

## 开发

```bash
npm run dev      # 开发模式
npm run build    # 编译
npm run eval     # 跑 eval
npm test         # 测试
```

## 技术栈

- **TypeScript** + Node.js CLI
- **OpenAI SDK** (`openai` npm 包)
- **LLM 模型**: Qwen Plus (`qwen-plus`)，通过阿里云 DashScope OpenAI 兼容端点
- **Base URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **API Key**: `DASHSCOPE_API_KEY` 环境变量

## 项目结构

```
src/
  index.ts        # CLI 入口
  agent.ts        # agent loop
  tools/          # tool 定义
  output.ts       # structured output schema
  stream.ts       # streaming 处理
  eval/           # eval cases
```
