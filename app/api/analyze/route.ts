import OpenAI from 'openai';
import { GitHubClient } from '@/src/github';
import { runAgent } from '@/src/agent';
import type { StreamEvent } from '@/src/stream';

export async function POST(request: Request) {
  const { prUrl } = await request.json();

  if (!prUrl || typeof prUrl !== 'string') {
    return Response.json({ error: '缺少 prUrl 参数' }, { status: 400 });
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'DASHSCOPE_API_KEY 未设置' }, { status: 500 });
  }

  const openaiClient = new OpenAI({
    apiKey,
    baseURL: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
  });

  const githubClient = new GitHubClient();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const events = runAgent(prUrl, openaiClient, githubClient);

        for await (const event of events) {
          const sseData = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        const errorEvent: StreamEvent = {
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
