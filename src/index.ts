#!/usr/bin/env node

import OpenAI from 'openai';
import 'dotenv/config';
import { GitHubClient } from './github';
import { runAgent } from './agent';
import type { StreamEvent } from './stream';

const prUrl = process.argv.slice(2).join(' ');

if (!prUrl) {
  console.error('用法: mini-agent-demo <PR_URL>');
  console.error('示例: mini-agent-demo https://github.com/vercel/next.js/pull/12345');
  process.exit(1);
}

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) {
  console.error('错误: 请设置 DASHSCOPE_API_KEY 环境变量');
  console.error('在 .env 文件中设置或 export DASHSCOPE_API_KEY=sk-xxx');
  process.exit(1);
}

const openaiClient = new OpenAI({
  apiKey,
  baseURL: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
});

const githubClient = new GitHubClient();

console.log(`📝 PR: ${prUrl}\n`);

try {
  const events = runAgent(prUrl, openaiClient, githubClient);

  for await (const event of events) {
    handleEvent(event);
  }
} catch (err) {
  console.error('\n❌ 错误:', err instanceof Error ? err.message : err);
  process.exit(1);
}

function handleEvent(event: StreamEvent): void {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.content);
      break;
    case 'tool_start':
      console.log(`\n🔧 调用: ${event.name}(${JSON.stringify(event.args)})`);
      break;
    case 'tool_end':
      console.log(`✓ ${event.name} 完成`);
      break;
    case 'error':
      console.error(`⚠️  ${event.message}`);
      break;
    case 'final':
      console.log('\n\n✅ 结构化摘要:');
      console.log(JSON.stringify(event.data, null, 2));
      break;
  }
}
