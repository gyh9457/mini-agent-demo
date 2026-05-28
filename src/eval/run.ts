/**
 * Eval 运行器
 *
 * 跑所有 eval case，输出通过率
 */

import { runAgent } from "../agent.js";
import { evalCases } from "./cases.js";

async function runEval() {
  console.log(`🧪 运行 ${evalCases.length} 个 eval case\n`);

  let passed = 0;
  let failed = 0;

  for (const testCase of evalCases) {
    console.log(`▶ ${testCase.id}: ${testCase.input}`);
    try {
      const result = await runAgent(testCase.input);
      // TODO: D26 实现断言逻辑
      console.log(`  ✓ 通过\n`);
      passed++;
    } catch (err) {
      console.log(`  ✗ 失败: ${err}\n`);
      failed++;
    }
  }

  console.log(`\n📊 结果: ${passed} 通过, ${failed} 失败`);
  console.log(`通过率: ${((passed / evalCases.length) * 100).toFixed(1)}%`);
}

runEval().catch(console.error);
