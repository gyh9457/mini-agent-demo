/**
 * Streaming 处理
 *
 * 负责 token-by-token 输出 + 进度显示
 */

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onToolStart?: (toolName: string) => void;
  onToolEnd?: (toolName: string, result: string) => void;
  onDone?: () => void;
}

export function createDefaultCallbacks(): StreamCallbacks {
  return {
    onToken: (token) => process.stdout.write(token),
    onToolStart: (name) => console.log(`\n🔧 调用: ${name}`),
    onToolEnd: (name, result) => console.log(`✓ ${name} 完成`),
    onDone: () => console.log("\n"),
  };
}

// TODO: D25 实现流式处理逻辑
