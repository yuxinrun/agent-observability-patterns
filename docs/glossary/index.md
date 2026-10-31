---
title: 术语表：全书黑话速查
description: Trace、Span、OTLP、TTFT、SLO、燃烧率、基数、LLM-as-judge……一眼看懂每个词，以及它在本书哪一章出现过。
outline: [2, 3]
---

# 术语表：全书黑话速查

按 `Cmd/Ctrl + K` 也能搜，但这里做了分组：**先看你现在卡在哪个词上。**

## 链路基础 {#trace}

| 术语 | 一句话人话 | 出处 |
| --- | --- | --- |
| Trace（链路） | 一次用户请求的完整故事，从头到尾串成一条线 | [01](/fundamentals/) |
| Span（跨度） | 故事里的一段情节：有开始、有结束、有结果、有耗时 | [01](/fundamentals/) |
| TraceID | 这条故事的身份证，32 位十六进制，全链路共用同一个 | [01](/fundamentals/#trace-span) |
| SpanID | 每段情节自己的编号，16 位十六进制 | [01](/fundamentals/#trace-span) |
| Parent SpanID | 指向「谁调起了我」，靠它拼出树形结构 | [01](/fundamentals/#trace-span) |
| Root Span | 树根，通常就是一次任务或一次 HTTP 请求 | [02](/traces/#span-layers) |
| 上下文透传 | 把 traceparent 塞进 HTTP header / 消息 metadata，让下游接着记 | [01](/fundamentals/#propagation) |
| traceparent | W3C 标准头，格式 `00-<trace_id>-<span_id>-<flags>` | [01](/fundamentals/#propagation) |
| Span Link | 不是父子关系、但「有关系」——用于长任务、跨异步边界 | [01](/fundamentals/#task-kinds) |
| 孤儿 Span | 找不到父节点的 span，通常是透传断了 | [12](/pitfalls/#broken-trace) |
| 瀑布图 | 把 span 按时间横着铺开的视图，一眼看出谁慢 | [09](/dashboards/#overview) |

::: tip 人话翻译
Trace 是「一部电影」，Span 是「一场戏」，TraceID 是「这部电影的片名编号」。如果续集（下游服务）不知道片名编号，观众就串不起剧情——这就是断链。
:::

## OpenTelemetry 生态 {#otel}

| 术语 | 一句话人话 | 出处 |
| --- | --- | --- |
| OpenTelemetry（OTel） | 观测界的 USB-C 接口，埋点写一次，后端随便换 | [01](/fundamentals/#otel) |
| OTLP | OTel 的传输协议，gRPC 走 4317，HTTP 走 4318 | [01](/fundamentals/#otel) |
| Collector | 中间商：收数据、批处理、脱敏、采样、再分发 | [06](/platforms/#light) |
| Instrumentation | 埋点，也就是「在哪里加记录」这件事 | [08](/instrumentation/) |
| Auto-instrumentation | 不改业务代码，靠 SDK 钩子自动抓 HTTP/DB 调用 | [08](/instrumentation/#middleware) |
| GenAI 语义约定 | OTel 为 LLM 定义的字段命名标准，`gen_ai.*` 开头 | [01](/fundamentals/#genai) |
| BatchSpanProcessor | 攒一批再发的上报器，别让它排队排到丢数据 | [14](/scale/#async) |
| 尾采样（Tail Sampling） | 先收全量、等链路结束再决定留不留，能「错误优先」 | [14](/scale/#sampling) |

## 指标与成本 {#metrics}

| 术语 | 一句话人话 | 出处 |
| --- | --- | --- |
| TTFT | Time To First Token，用户按下回车到看见第一个字的时间 | [03](/metrics/#llm) |
| P95 / P99 | 把 100 次请求按耗时排序，第 95 / 99 名的那个值 | [09](/dashboards/#overview) |
| input / output tokens | 你喂进去的字数 / 它吐出来的字数，决定账单 | [03](/metrics/#llm) |
| 缓存命中 token | 命中 prompt cache 的输入 token，通常便宜很多 | [03](/metrics/#llm) |
| 单任务成本 | 一次完整任务（可能含十几轮 LLM）的总花费 | [03](/metrics/#task) |
| 隐性成本 | 循环、重试、上下文膨胀带来的、账单上不显眼的那部分 | [12](/pitfalls/#loop-cost) |
| 基数（Cardinality） | 一个指标被标签拆成了多少个不同组合，爆了会拖垮存储 | [03](/metrics/#aggregation) |
| SLO | 你承诺的服务目标，例如「99% 任务 30 秒内完成」 | [03](/metrics/#slo) |
| 错误预算 | 100% 减去 SLO，剩下的那部分「允许出错」的额度 | [03](/metrics/#slo) |
| 燃烧率（Burn Rate） | 错误预算被烧掉的速度，比阈值更早报警 | [05](/alerts/#rules) |

## 评测与质量 {#evals}

| 术语 | 一句话人话 | 出处 |
| --- | --- | --- |
| Eval（评估） | 给输出打分，判断「它对不对」，而不只是「它快不快」 | [10](/evals/) |
| 幻觉 | 任务显示成功，但内容是编的 | [12](/pitfalls/#silent-fail) |
| LLM-as-judge | 用另一个模型当裁判打分，便宜但会偏见 | [10](/evals/#judge) |
| Rubric | 评分细则，把「好」拆成可勾选的几条 | [10](/evals/#judge) |
| 回归测试 | 新版本上线前，用真实样本重跑一遍看有没有变差 | [10](/evals/#regression) |
| 标注 | 人工给一条 trace 打上「对/错/原因」，作为评测的种子 | [10](/evals/#loop) |
| 闭环 | Trace → 标注 → 评测 → 改 Prompt/流程 → 再看 Trace | [10](/evals/#loop) |

## 平台与工程 {#platform}

| 术语 | 一句话人话 | 出处 |
| --- | --- | --- |
| Langfuse | 开源自托管 LLM 观测平台，UI 友好，可 Docker Compose 起 | [06](/platforms/#langfuse) |
| OpenLLMetry | Traceloop 出的自动埋点库，一行 `Traceloop.init()` | [06](/platforms/#openllmetry) |
| Phoenix | Arize 开源，基于 OpenInference 语义，评测能力强 | [06](/platforms/#phoenix) |
| LangSmith | LangChain 官方商用平台，链路+评测一体 | [06](/platforms/#langsmith) |
| Jaeger / Tempo | 通用分布式追踪后端，看瀑布图最舒服 | [06](/platforms/#light) |
| MCP | Model Context Protocol，Agent 调工具的标准协议 | [02](/traces/#mcp-trace) |
| A2A | Agent2Agent，Agent 之间互相委派的协议 | [02](/traces/#a2a-trace) |
| 脱敏 | 上报前把手机号、身份证、密钥替换掉 | [04](/logs/#redaction) |
| 留存策略 | 数据放多久、什么时候自动删 | [11](/security/#retention) |
| 多租户隔离 | A 客户看不到 B 客户的链路，字段级也要管 | [11](/security/#tenant) |

## 常用字段速查 {#fields}

| 字段 | 含义 | 谁写 |
| --- | --- | --- |
| `gen_ai.operation.name` | 这一步在干什么：`chat` / `execute_tool` / `invoke_agent` | 埋点代码 |
| `gen_ai.provider.name` | 哪家模型服务，如 `anthropic`、`openai` | 埋点代码 |
| `gen_ai.request.model` | 请求的模型名 | 埋点代码 |
| `gen_ai.usage.input_tokens` | 输入 token 数 | 模型响应回填 |
| `gen_ai.usage.output_tokens` | 输出 token 数 | 模型响应回填 |
| `gen_ai.response.finish_reasons` | 为什么停：`stop` / `tool_use` / `length` | 模型响应回填 |
| `gen_ai.tool.name` | 工具名 | 工具层 |
| `gen_ai.agent.name` | Agent 名 | 任务层 |
| `session.id` | 会话 ID，把同一用户的多条 trace 串起来 | 入口 |
| `tenant.id` | 租户 ID，用于隔离和分组 | 入口 |
| `cost.usd` | 这条 span 折算成多少钱 | 网关或埋点后算 |
| `agent.turns` | 这个任务跑了几轮 | 循环层 |
| `memory.hit` | 这次记忆读取是否命中 | 记忆层 |
| `delegation.depth` | 委派了几层，防无限套娃 | A2A 层 |

::: tip 人话翻译
字段名不用背。记住三类就够：**谁在干（agent/operation）、花了多少（tokens/cost）、结果如何（finish_reasons/status）**。看板、告警、评测全靠这三类撑起来。
:::

## 缩写对照 {#abbr}

| 缩写 | 全称 | 中文 |
| --- | --- | --- |
| OTel | OpenTelemetry | 开放遥测标准 |
| OTLP | OpenTelemetry Protocol | 遥测传输协议 |
| SSE | Server-Sent Events | 服务端推送流 |
| TTFT | Time To First Token | 首字延迟 |
| SLO | Service Level Objective | 服务等级目标 |
| SLA | Service Level Agreement | 服务等级协议（带赔偿） |
| PII | Personally Identifiable Information | 个人可识别信息 |
| RAG | Retrieval-Augmented Generation | 检索增强生成 |
| MCP | Model Context Protocol | 模型上下文协议 |
| A2A | Agent to Agent | 智能体互联协议 |

找不到的词？在 [GitHub 提 issue](https://github.com/yuxinrun/agent-observability-patterns/issues)，或者直接去 [延伸阅读](/reading/) 翻规范原文。
