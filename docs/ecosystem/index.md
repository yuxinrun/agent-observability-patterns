---
title: 15 · 生态联动：五块拼图的接缝
description: 调度、A2A、MCP、记忆、网关五个姊妹项目各自该上报什么、边界在哪，以及如何保持一致。
outline: [2, 3]
---

# 15 · 生态联动：五块拼图的接缝

这套手册不是孤岛。它和另外五个项目组成一套完整的 Agent 工程体系：

<Diagram id="eco-hub" />

- **[better-agent](https://yuxinrun.github.io/better-agent/)**：怎么造一个单智能体。
- **[a2a-patterns](https://yuxinrun.github.io/a2a-patterns/)**：智能体之间怎么协作。
- **[mcp-patterns](https://yuxinrun.github.io/mcp-patterns/)**：智能体怎么用工具。
- **[agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/)**：智能体怎么记事。
- **[llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/)**：模型怎么被安全调用。

可观测性不是第六块拼图，而是**它们共同的出口**。

::: tip 人话翻译
五个项目各负责「做一件事」，这个项目负责「把每件事看清楚」。所以每个项目都要在关键边界吐出数据，而这个项目负责定义数据的形状。
:::

## 01 better-agent：调度框架如何接入观测 {#better-agent}

[better-agent](https://yuxinrun.github.io/better-agent/) 的核心是「一个 Agent 怎么循环、怎么选工具、怎么控制上下文」。它天然产生最丰富的决策事件。

| 它应该上报 | 字段 | 用途 |
| --- | --- | --- |
| 轮次 | `agent.turn`、`agent.max_turns` | 循环与成本分析 |
| 停止原因 | `agent.stop_reason` | 区分正常结束与耗尽 |
| 工具选择 | `gen_ai.tool.name`、`tool.selection.reason` | 提示词优化 |
| 上下文预算 | `context.tokens`、`context.utilization` | 上下文膨胀预警 |
| 委派 | `delegation.depth` | 跨 Agent 链路 |

它**不该**上报：token 精确值（网关负责）、工具内部耗时（MCP 负责）。

::: warning 最容易重复上报的字段
`input_tokens`。Agent 侧估算一次、网关侧精确一次，看板上就会出现两个数字。约定：**以网关为准，Agent 侧只在拿不到网关数据时记录估算值，并加 `token.source=estimated`。**
:::

## 02 a2a-patterns：跨智能体链路边界 {#a2a}

[a2a-patterns](https://yuxinrun.github.io/a2a-patterns/) 定义 Agent 之间怎么发现、委派、汇报状态。链路追踪的边界就在这里。

| 它应该上报 | 说明 |
| --- | --- |
| `a2a.target_agent` | 委派给谁 |
| `a2a.task_id` / `a2a.status` | 远程任务生命周期 |
| `delegation.depth` | 防环 |
| `traceparent` 透传 | 续链的唯一手段 |

| 边界问题 | 约定 |
| --- | --- |
| 对方不支持 OTel | 用 Span Link 关联，不伪造 parent |
| 跨公司调用 | 只传 trace id，不传内部 `tracestate` |
| 长任务 | 用任务状态事件，不挂长 span |
| 委派失败 | 在**委派方**记录失败，被委派方可能根本没收到 |

## 03 mcp-patterns：工具层观测 {#mcp}

[mcp-patterns](https://yuxinrun.github.io/mcp-patterns/) 讲工具怎么被安全地暴露与调用。工具层的观测重点是**质量与权限**。

| 它应该上报 | 说明 |
| --- | --- |
| `gen_ai.tool.name`、`mcp.server` | 谁提供了这个工具 |
| `mcp.tool.is_error` | 工具级成败 |
| `mcp.result.rows` / 大小 | 上下文膨胀来源 |
| 权限校验结果 | `auth.decision=allow/deny` |
| Schema 版本 | 工具变更追溯 |

工具层的两个黄金指标：**调用成功率**和**返回体大小**。前者决定体验，后者决定成本。

## 04 agent-memory-patterns：记忆层指标 {#memory}

[agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/) 关注长期记忆、召回与遗忘。记忆层最容易被当成黑盒。

| 它应该上报 | 健康线 |
| --- | --- |
| `memory.hit` | 召回条数 > 0 的比例 > 60% |
| `similarity.max` | 过低说明索引或 embedding 有问题 |
| `memory.latency.ms` | 向量检索 P95 < 200ms |
| `context.utilization` | < 0.8，否则模型开始忽略系统提示 |
| `dedup.hit` | 去重命中，反映记忆卫生 |

::: tip 一个跨项目的联动点
记忆召回的结果会进入上下文，而上下文膨胀会推高网关的 token 成本。**只有把 `memory.tokens` 和 `gen_ai.usage.input_tokens` 放在同一条 trace 里，你才能证明「记忆到底值不值这个钱」。**
:::

## 05 llm-gateway-patterns：统一计量与上报 {#gateway}

[llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/) 是模型的统一出口，也是**计量与治理的唯一权威**。

| 它应该上报 | 说明 |
| --- | --- |
| `gen_ai.provider.name` / `request.model` / `response.model` | 路由与降级 |
| `gen_ai.usage.*` | 精确 token |
| `cost.usd` | 按配置价格计算 |
| `gateway.route` / `gateway.cache` | 决策与缓存 |
| 429 / 拒绝 | 必须以错误状态上报 |

## 跨项目字段契约 {#contract}

五个项目要能拼成一张图，靠的是一份**字段契约**。建议把它放进一个共享仓，作为唯一事实来源：

| 字段 | 类型 | 产生方 | 消费方 |
| --- | --- | --- | --- |
| `trace_id` | string | 入口 | 全部 |
| `tenant.id` | string | 网关 / 入口 | 全部 |
| `session.id` | string | Agent / 入口 | 观测、评测 |
| `gen_ai.agent.name` | string | 调度 | 观测 |
| `gen_ai.tool.name` | string | MCP 客户端 | 观测 |
| `gen_ai.usage.*` | int | 网关 | 观测、计费 |
| `cost.usd` | float | 网关 | 观测、财务 |
| `memory.hit` | int | 记忆 | 观测 |
| `delegation.depth` | int | A2A | 观测 |

::: danger 契约比代码更难改
字段一旦进入看板和告警，改名的成本远高于改代码。**上线前就把命名定死，写进共享 schema，CI 里校验。**
:::

## 一页纸验收清单 {#board-sample}

| 检查项 | 标准 |
| --- | --- |
| 每个项目都能吐出标准 span | 符合 `gen_ai.*` 约定 |
| 五个项目的 trace 能拼成一条 | 入口到工具无断点 |
| 同一事实只有一个来源 | token 来自网关，工具耗时来自 MCP |
| 字段契约有 CI 校验 | 缺字段直接失败 |
| 每个项目有自己的看板 | 不必都挤在总览里 |
| 跨项目事故有联合 runbook | 知道先找谁 |

## 全书回顾 {#recap}

十六个章节，其实只讲了三件事：

1. **看清楚**：Trace 记录路径，Metrics 记录趋势，Logs 记录证据，Evals 记录质量。
2. **看得起**：采样、异步、冷热分层、成本模型，让观测成本随业务线性增长。
3. **看得住**：告警分级、降噪、合规、权限，让观测系统本身可信、可持续。

如果只带走一句话：**Agent 不会喊疼，所以你必须提前决定，哪些事实值得被记录。**

## 下一步 {#next}

- 想动手：从 [第 13 章 Demo](/demos/) 开始，先跑通一条链路。
- 想上线：读 [第 08 章 埋点工程模式](/instrumentation/) 和 [第 14 章 规模化](/scale/)。
- 想少踩坑：把 [第 12 章](/pitfalls/) 的自检表贴到看板上。
- 想串起生态：从 [better-agent](https://yuxinrun.github.io/better-agent/) 开始，按本章的契约逐项对接。

## 延伸阅读 {#reading}

- [better-agent](https://yuxinrun.github.io/better-agent/)：单智能体的构建与循环设计。
- [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/)：跨智能体协作协议与实现。
- [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/)：工具层的设计与治理。
- [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/)：记忆的写入、召回与遗忘。
- [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/)：网关的路由、限流与计量。
