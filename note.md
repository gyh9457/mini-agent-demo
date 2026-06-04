## 学习什么
1. llm 调用，while 循环、流式处理、tools 编写及调用、重试逻辑
2. 结构化输出，zod 校验
3. eval 机制，autoevals，llm-as-judge
4. sse 流式推送、

## 一些追问问题
### @octokit/rest 是什么，为什么选这个？
github 官方库，用于调用 github api

### tool 定义是通用格式吗？
tool 作为能力扩展机制，是多模型普遍存在的。但 tool 的字段定义、调用格式、结果回填协议，不是多模型统一的。

### steamEvent 怎么定义？依据什么决定？
当前项目的服务自行设计的流式事件协议。它不是模型标准，而是由产品展示需求、消费方需求、系统抽象这些边界共同决定的。在这个项目里，实际上是把 `runAgent` 的关键阶段，抽象成前端和 cli 都容易理解的事件

### strema 的结构是什么样的？
有一定格式，但不是全行业一个 JSON 标准。

 在 OpenAI 兼容接口里，最常见结构是：
- choices[].delta.content
- choices[].delta.tool_calls
- finish_reason

### see 实现
* runAgent 产出内部事件
* 后端把事件按 data: ...\n\n 格式写成 text/event-stream 格式
* 前端用 fetch + getReader() 逐条读取并更新 UI

### eval 理解
系统化地评估一个 llm 应用是否 `持续表现正确`

llm 的作用：
* 固定一批代表性输入
* 跑一遍系统
* 观察输出是否还达标
* 防止代码没报错，但效果已经退化

为什么需要？ 因为 llm 应用最大的问题不是能不能运行，而是运行后效果是否达标。

怎么做？
- 先找 5 到 20 个典型样例
- 固定输入，保证可重复
- 跑完整应用，不只测某个函数
- 先加硬规则检查
- 再加语义质量评估
- 设通过阈值
- 每次改 prompt / model / tool / parser 后都跑一遍

eval 流程：
- 准备固定的 eval case 和 fixture 数据
- 用 MockGitHubClient 替代真实 GitHub 请求
- 调 runAgent() 跑完整 Agent 流程，拿到最终输出
- 先做规则断言
- 再做 judgeOutput() 的 LLM 评估
- 汇总判断这个 case 是 PASS 还是 FAIL

### 重新理解 llm-as-judge 是什么 为什么 怎么做
- 定义 ： LLM-as-Judge 就是让另一个模型充当评委，去评估某个模型输出的质量，比如准确性、简洁性、是否符合要求。
- 为什么需要 ：很多质量问题很难用硬规则判断，比如“摘要是否准确”“回答是否啰嗦”“风险判断是否合理”，这时可以让 Judge 模型做语义层面的评分。
- 怎么做 ：准备输入上下文和待评估输出，设计清晰的评分标准与 prompt，让 Judge 返回结构化结果，比如 score 和 reasoning ，再结合阈值判断是否通过。
- 最佳用法 ：把它当辅助评估工具，和规则断言一起用，不要把它当唯一标准。

## 测试链接
* https://github.com/ant-design/ant-design-cli/pull/138