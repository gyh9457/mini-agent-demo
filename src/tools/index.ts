/**
 * Tool 定义入口
 *
 * 导出所有 tool 给 agent loop 使用
 */

export const tools = [
  // TODO: D23 添加 tool 定义
  // 示例结构:
  // {
  //   type: "function",
  //   function: {
  //     name: "get_weather",
  //     description: "获取天气",
  //     parameters: { type: "object", properties: {...}, required: [...] }
  //   }
  // }
];

export async function executeTool(name: string, args: unknown): Promise<string> {
  // TODO: D23 实现 tool 执行
  console.log(`🔧 执行 tool: ${name}`, args);
  return JSON.stringify({ error: "未实现" });
}
