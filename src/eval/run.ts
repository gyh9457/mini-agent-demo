import OpenAI from 'openai';
import 'dotenv/config';
import { runAgent } from '../agent.js';
import type { StructuredOutput } from '../output.js';
import { GitHubClient } from '../github.js';
import { evalCases } from './cases.js';
import type { EvalCase } from './cases.js';
import { runRuleAssertions } from './assertions.js';
import type { AssertionResult } from './assertions.js';
import { judgeOutput } from './judge.js';
import type { JudgeResult } from './judge.js';

interface CaseResult {
  caseId: string;
  output: StructuredOutput | null;
  ruleResults: AssertionResult[];
  judgeResults: JudgeResult[];
  passed: boolean;
  errors: string[];
}

// Mock GitHub client returning fixture data
class MockGitHubClient extends GitHubClient {
  private fixture: EvalCase['fixture'];

  constructor(fixture: EvalCase['fixture']) {
    super();
    this.fixture = fixture;
  }

  async getPrDiff(): Promise<string> {
    return this.fixture.diff;
  }

  async getFileMeta() {
    return this.fixture.files;
  }

  async searchIssues() {
    return this.fixture.issues;
  }
}

async function runSingleCase(
  evalCase: EvalCase,
  openaiClient: OpenAI
): Promise<CaseResult> {
  const errors: string[] = [];
  let output: StructuredOutput | null = null;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Case: ${evalCase.id} — ${evalCase.description}`);
  console.log(`${'='.repeat(60)}`);

  const ghClient = new MockGitHubClient(evalCase.fixture);

  try {
    const events = runAgent(evalCase.fixture.url, openaiClient, ghClient);

    for await (const event of events) {
      if (event.type === 'text') {
        process.stdout.write(event.content);
      } else if (event.type === 'tool_start') {
        console.log(`\n  🔧 ${event.name}`);
      } else if (event.type === 'tool_end') {
        console.log(`  ✓ ${event.name} 完成`);
      } else if (event.type === 'final') {
        output = event.data;
      } else if (event.type === 'error') {
        errors.push(event.message);
      }
    }
  } catch (err) {
    errors.push(`Agent 错误: ${err instanceof Error ? err.message : String(err)}`);
  }

  const ruleResults = runRuleAssertions(output);

  let judgeResults: JudgeResult[] = [];
  if (output) {
    const filesStr = evalCase.fixture.files
      .map((f) => `${f.path} (+${f.additions}/-${f.deletions})`)
      .join('\n');
    judgeResults = await judgeOutput(openaiClient, output, {
      diff: evalCase.fixture.diff,
      files: filesStr,
    });
  }

  const passed = evaluatePassFail(evalCase, output, ruleResults, judgeResults, errors);

  console.log(`\n\n📊 ${evalCase.id} 结果：`);
  if (output) {
    console.log(`  输出: ${JSON.stringify(output)}`);
  }
  for (const r of ruleResults) {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.name}: ${r.message}`);
  }
  for (const j of judgeResults) {
    console.log(`  🧠 ${j.name}: ${j.score}/5 — ${j.reasoning}`);
  }
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`  ❌ 错误: ${e}`);
    }
  }
  console.log(`\n  ${passed ? '✅ PASS' : '❌ FAIL'}`);

  return { caseId: evalCase.id, output, ruleResults, judgeResults, passed, errors };
}

function evaluatePassFail(
  evalCase: EvalCase,
  output: StructuredOutput | null,
  ruleResults: AssertionResult[],
  judgeResults: JudgeResult[],
  errors: string[]
): boolean {
  if (errors.length > 0 && !output) return false;

  const rulesPassed = ruleResults.every((r) => r.passed);
  if (!rulesPassed) return false;

  if (!output) return false;

  const ra = evalCase.ruleAssertions;

  if (ra.minFilesChanged !== undefined && output.files_changed < ra.minFilesChanged) {
    return false;
  }
  if (ra.maxFilesChanged !== undefined && output.files_changed > ra.maxFilesChanged) {
    return false;
  }

  if (ra.expectedRiskLevels && !ra.expectedRiskLevels.includes(output.risk_level)) {
    return false;
  }

  const jt = evalCase.judgeThresholds;
  for (const jr of judgeResults) {
    if (jr.name === 'accuracy' && jt.minAccuracy && jr.score < jt.minAccuracy) {
      return false;
    }
    if (jr.name === 'conciseness' && jt.minConciseness && jr.score < jt.minConciseness) {
      return false;
    }
    if (jr.name === 'risk_assessment' && jt.minRiskAssessment && jr.score < jt.minRiskAssessment) {
      return false;
    }
  }

  return true;
}

async function main() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('错误: 请设置 DASHSCOPE_API_KEY 环境变量');
    process.exit(1);
  }

  const openaiClient = new OpenAI({
    apiKey,
    baseURL: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
  });

  console.log(`🧪 运行 ${evalCases.length} 个 eval case\n`);

  const results: CaseResult[] = [];

  for (const evalCase of evalCases) {
    const result = await runSingleCase(evalCase, openaiClient);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const pct = ((passed / total) * 100).toFixed(1);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Eval 汇总`);
  console.log(`${'='.repeat(60)}`);
  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.caseId}`);
  }
  console.log(`\n  ${passed}/${total} 通过 (${pct}%)`);
}

main().catch((err) => {
  console.error('Eval 运行器错误:', err);
  process.exit(1);
});
