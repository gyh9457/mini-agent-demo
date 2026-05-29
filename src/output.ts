import { z } from 'zod';

/**
 * Structured output schema
 *
 * 强制 LLM 输出符合此 schema 的 JSON
 */
export const outputSchema = z
  .object({
    summary: z.string().min(1, 'summary 不能为空'),
    files_changed: z.number().int().min(0, 'files_changed 必须 >= 0'),
    risk_level: z.enum(['low', 'medium', 'high']),
  })
  .strict();

export type StructuredOutput = z.infer<typeof outputSchema>;
