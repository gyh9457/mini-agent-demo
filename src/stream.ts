import type { StructuredOutput } from './output';

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; name: string; result: string }
  | { type: 'error'; message: string }
  | { type: 'final'; data: StructuredOutput };
