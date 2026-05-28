/**
 * Eval 用例
 *
 * 至少 5 个 case，覆盖正常/边界/对抗场景
 */

export interface EvalCase {
  id: string;
  input: string;
  expected: {
    summaryContains?: string[];
    minKeyPoints?: number;
    minConfidence?: number;
  };
}

export const evalCases: EvalCase[] = [
  {
    id: "basic-01",
    input: "帮我分析这段代码的问题",
    expected: {
      minKeyPoints: 1,
      minConfidence: 0.5,
    },
  },
  // TODO: D26 补充更多 case
  // - 空输入
  // - 超长输入
  // - 非 ASCII 字符
  // - prompt injection
];
