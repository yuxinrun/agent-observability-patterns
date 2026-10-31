---
title: Further reading — primary sources and engineering practice
description: OpenTelemetry GenAI semantic conventions, Anthropic and OpenAI agent tracing docs, Langfuse / OpenLLMetry / Phoenix / LangSmith practice, plus SRE material on alerting.
outline: [2, 3]
---

# Further reading — primary sources and engineering practice

Field names and naming rules in this book follow the sources below. You do not need to read all of them, but **when something is disputed, the source wins, not this book.**

## 1. The four specs you actually need {#spec}

| Source | Why it matters | Read this part |
| --- | --- | --- |
| [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) | The official definition of `gen_ai.*` — the shared language of every backend | Attribute tables: model, usage, finish reasons |
| [GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) | How `invoke_agent` and `execute_tool` spans are named and what they carry | Span naming, status codes |
| [W3C Trace Context](https://www.w3.org/TR/trace-context/) | The `traceparent` format and restoration rules — final arbiter on broken traces | 3.2 header format, 3.3 restart rules |
| [OTLP specification](https://opentelemetry.io/docs/specs/otlp/) | Ports 4317 / 4318, batching and retry semantics | Protocol comparison, retry policy |

::: tip Plain language
These four are traffic law. You can drive without reading them, but when the crash happens — broken traces, mismatched fields, data loss on migration — the law is what everyone argues from.
:::

## 2. Vendor documentation on agent tracing {#vendor}

| Source | What it covers | What to copy |
| --- | --- | --- |
| [Anthropic · Claude Agent SDK observability](https://docs.claude.com/en/docs/agent-sdk/observability) | How the Agent SDK emits OTel telemetry, metric names and events | Official metric naming, `service.name` conventions |
| [Anthropic · Claude Code monitoring and usage](https://docs.claude.com/en/docs/claude-code/monitoring-usage) | Exporting OTel metrics and events from production | Ready-made cost and token metrics |
| [OpenAI Agents SDK · Tracing](https://openai.github.io/openai-agents-python/tracing/) | The trace/span hierarchy, built-in processors, custom processors | The `on_trace_start` / `on_span_end` callback design |
| [OpenAI Agents SDK · tracing reference](https://openai.github.io/openai-agents-python/ref/tracing/) | Processor interfaces and exporter implementations | Forwarding SDK traces to your own backend |

Both vendors agree on the hierarchy: **one agent run is the root, model calls and tool calls are children.** That is the basis for the layered span design in chapter 02.

## 3. Open-source engineering practice {#oss}

| Project | Position | Look at |
| --- | --- | --- |
| [Langfuse](https://github.com/langfuse/langfuse) | Open-source, self-hosted LLM observability | `docker-compose.yml`, the trace data model, prompt versioning |
| [OpenLLMetry](https://github.com/traceloop/openllmetry) | Auto-instrumentation by Traceloop | Per-framework instrumentors — how "no code changes" is actually achieved |
| [Phoenix](https://github.com/Arize-ai/phoenix) | Arize's open-source tracing and evals | Evaluator implementations, OpenInference mapping |
| [OpenInference](https://github.com/Arize-ai/openinference) | A second semantic convention | Diff it against OTel GenAI before migrating |
| [OpenTelemetry Collector](https://github.com/open-telemetry/opentelemetry-collector-contrib) | Collection and processing | `tailsamplingprocessor`, `attributesprocessor` config |
| [OpenTelemetry Python](https://github.com/open-telemetry/opentelemetry-python) | The SDK itself | Real behaviour of `BatchSpanProcessor` options |

## 4. Commercial platform docs {#commercial}

| Platform | Docs | Best for |
| --- | --- | --- |
| [LangSmith](https://docs.smith.langchain.com/) | Tracing, datasets, evaluators | Teams deep into LangChain |
| [Datadog LLM Observability](https://docs.datadoghq.com/llm_observability/) | LLM views joined to APM | Companies already on Datadog |
| [New Relic AI Monitoring](https://docs.newrelic.com/docs/ai-monitoring/) | Model call and cost views | Companies already on New Relic |
| [Arize AX](https://docs.arize.com/) | Evals and drift monitoring | Quality-team-led programmes |
| [Grafana Tempo](https://grafana.com/docs/tempo/latest/) | Trace backend on cheap object storage | Self-hosted, cost-first |

## 5. Alerting and SRE methodology {#sre}

| Source | Why read it |
| --- | --- |
| [Google SRE Workbook · Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) | The origin of multi-window burn rate; chapter 05 derives from it |
| [Google SRE Book · Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) | The four golden signals |
| [OpenTelemetry · Sampling](https://opentelemetry.io/docs/concepts/sampling/) | Official description of head and tail sampling |
| [Honeycomb · Observability Engineering](https://www.honeycomb.io/observability-engineering) | The argument that observability is answering unknown questions, not three dashboards |

## 6. Books {#books}

- **Observability Engineering** — Charity Majors et al. The monitoring-versus-observability distinction that chapter 00 builds on.
- **Distributed Tracing in Practice** — span, context and sampling in depth; for people who want to build the tracer.
- **Site Reliability Engineering** — SLOs, error budgets, postmortems.

## 7. The rest of this series {#series}

| Project | Relation to observability |
| --- | --- |
| [better-agent](https://github.com/yuxinrun/better-agent) | The orchestrator's turns and tool calls are where traces get dense |
| [mcp-patterns](https://github.com/yuxinrun/mcp-patterns) | Dual-side instrumentation; the boundary most likely to break a trace |
| [llm-gateway-patterns](https://github.com/yuxinrun/llm-gateway-patterns) | The gateway's metering is the single source of truth for cost |
| [a2a-patterns](https://github.com/yuxinrun/a2a-patterns) | Trace propagation and depth limits across delegations |
| [agent-memory-patterns](https://github.com/yuxinrun/agent-memory-patterns) | Memory reads and recall latency set the ceiling on context quality |

Series entry: [the ecosystem map](/en/ecosystem/). Lost in jargon? Back to the [glossary](/en/glossary/).
