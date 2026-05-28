/**
 * Structured output schema
 *
 * 强制 LLM 输出符合此 schema 的 JSON
 */

export const outputSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "简短摘要",
    },
    keyPoints: {
      type: "array",
      items: { type: "string" },
      description: "关键要点",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "置信度 0-1",
    },
  },
  required: ["summary", "keyPoints", "confidence"],
  additionalProperties: false,
} as const;

export interface StructuredOutput {
  summary: string;
  keyPoints: string[];
  confidence: number;
}
