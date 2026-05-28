#!/usr/bin/env node
/**
 * CLI 入口
 *
 * 用法: npm run dev -- "你的输入"
 */

import { runAgent } from "./agent.js";

const input = process.argv.slice(2).join(" ");

if (!input) {
  console.error("用法: mini-agent <输入>");
  process.exit(1);
}

console.log(`📝 输入: ${input}\n`);

try {
  const result = await runAgent(input);
  console.log("\n✅ 结果:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("❌ 错误:", err instanceof Error ? err.message : err);
  process.exit(1);
}
