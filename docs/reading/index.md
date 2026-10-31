---
title: 延伸阅读：规范原文与工程资料
description: OpenTelemetry GenAI 语义约定、Anthropic 与 OpenAI 的 Agent 追踪文档、Langfuse / OpenLLMetry / Phoenix / LangSmith 工程实践，以及告警与 SRE 的经典资料。
outline: [2, 3]
---

# 延伸阅读：规范原文与工程资料

本书所有字段名、命名规则都尽量贴着下面这些原文走。你不需要全读，但**遇到争议时请以原文为准，不要以本书为准。**

## 一、必须先看的四份规范 {#spec}

| 资料 | 为什么重要 | 读哪部分 |
| --- | --- | --- |
| [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) | `gen_ai.*` 字段的官方定义，所有平台的共同语言 | 属性表：model、usage、finish reasons |
| [GenAI Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) | `invoke_agent` / `execute_tool` 这类 span 该怎么命名、带什么属性 | span 命名规则、状态码 |
| [W3C Trace Context](https://www.w3.org/TR/trace-context/) | `traceparent` 的格式与透传规则，断链问题的最终裁判 | 3.2 头格式、3.3 恢复规则 |
| [OTLP 规范](https://opentelemetry.io/docs/specs/otlp/) | 4317 / 4318 端口、批处理与重试语义 | 协议对比、重试策略 |

::: tip 人话翻译
这四份相当于「交通法规」。你可以不看就开车，但出了事故（断链、字段对不上、平台迁移丢数据）时，交警只认法规。
:::

## 二、Agent 厂商的官方追踪文档 {#vendor}

| 资料 | 覆盖内容 | 值得抄的地方 |
| --- | --- | --- |
| [Anthropic · Claude Agent SDK 可观测性](https://docs.claude.com/en/docs/agent-sdk/observability) | Claude Agent SDK 如何输出 OTel 遥测、指标名与事件 | 官方指标命名、`service.name` 约定 |
| [Anthropic · Claude Code 监控与用量](https://docs.claude.com/en/docs/claude-code/monitoring-usage) | 生产环境如何导出 OTel 指标与事件 | 成本与 token 指标的现成定义 |
| [OpenAI Agents SDK · Tracing](https://openai.github.io/openai-agents-python/tracing/) | trace / span 的层级模型、内置 processors、自定义 processor | `on_trace_start` / `on_span_end` 回调设计 |
| [OpenAI Agents SDK · 自定义 tracing processor](https://openai.github.io/openai-agents-python/ref/tracing/) | processor 接口细节与导出实现 | 如何把 SDK 的 trace 转发到自己的后端 |

两家厂商在**层级模型上高度一致**：一次 Agent 运行是根，LLM 调用与工具调用是子节点。这也是本书第 02 章分层 Span 设计的依据。

## 三、开源工程实践 {#oss}

| 项目 | 定位 | 去看什么 |
| --- | --- | --- |
| [Langfuse](https://github.com/langfuse/langfuse) | 开源自托管 LLM 观测平台 | `docker-compose.yml`、trace 数据模型、prompt 版本管理 |
| [OpenLLMetry](https://github.com/traceloop/openllmetry) | 自动埋点库（Traceloop） | 各框架的 instrumentation 实现，学习「不改业务代码」怎么做到 |
| [Phoenix](https://github.com/Arize-ai/phoenix) | Arize 开源追踪 + 评测 | 评测器实现、OpenInference 字段映射 |
| [OpenInference](https://github.com/Arize-ai/openinference) | 另一套语义约定 | 与 OTel GenAI 的差异对照，迁移时必读 |
| [OpenTelemetry Collector](https://github.com/open-telemetry/opentelemetry-collector-contrib) | 采集与处理 | `tailsamplingprocessor`、`attributesprocessor` 配置 |
| [OpenTelemetry Python](https://github.com/open-telemetry/opentelemetry-python) | SDK 实现 | `BatchSpanProcessor` 参数的真实行为 |

## 四、商用平台文档 {#commercial}

| 平台 | 文档 | 适合谁 |
| --- | --- | --- |
| [LangSmith](https://docs.smith.langchain.com/) | tracing、datasets、evaluators | 重度使用 LangChain 的团队 |
| [Datadog LLM Observability](https://docs.datadoghq.com/llm_observability/) | 与 APM 打通的 LLM 视图 | 已经在用 Datadog 的公司 |
| [New Relic AI Monitoring](https://docs.newrelic.com/docs/ai-monitoring/) | 模型调用与成本视图 | 已经在用 New Relic 的公司 |
| [Arize AX](https://docs.arize.com/) | 评测与漂移监控 | 质量团队主导的场景 |
| [Grafana Tempo](https://grafana.com/docs/tempo/latest/) | 廉价对象存储上的链路后端 | 自建、追成本极限 |

## 五、告警与 SRE 方法论 {#sre}

| 资料 | 为什么值得读 |
| --- | --- |
| [Google SRE Workbook · Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) | 多窗口燃烧率的原始出处，第 05 章的公式来自这里 |
| [Google SRE Book · Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) | 四个黄金信号（延迟/流量/错误/饱和度） |
| [OpenTelemetry · Sampling](https://opentelemetry.io/docs/concepts/sampling/) | 头采样与尾采样的官方说明 |
| [Honeycomb · Observability Engineering](https://www.honeycomb.io/observability-engineering) | 「可观测性不是三件套，是能回答未知问题」的观点来源 |

## 六、书单 {#books}

- **《Observability Engineering》** — Charity Majors 等。讲清楚「监控」和「可观测」的差别，第 00 章的思路骨架来自这里。
- **《Distributed Tracing in Practice》** — 讲透 span、上下文、采样，适合想自己实现链路系统的人。
- **《Site Reliability Engineering》** — SLO、错误预算、事后复盘的经典。

## 七、本系列其他项目 {#series}

| 项目 | 和可观测的关系 |
| --- | --- |
| [better-agent](https://github.com/yuxinrun/better-agent) | 调度框架内部的轮次与工具调用，是链路最密集的地方 |
| [mcp-patterns](https://github.com/yuxinrun/mcp-patterns) | MCP Server/Client 双端埋点，最容易断链的边界 |
| [llm-gateway-patterns](https://github.com/yuxinrun/llm-gateway-patterns) | 网关统一计量，是成本数据的唯一权威来源 |
| [a2a-patterns](https://github.com/yuxinrun/a2a-patterns) | 跨 Agent 委派时的 trace 透传与深度限制 |
| [agent-memory-patterns](https://github.com/yuxinrun/agent-memory-patterns) | 记忆读写与召回耗时，决定上下文质量上限 |

系列入口：[生态全景](/ecosystem/)。术语看不懂？回到 [术语表](/glossary/)。
