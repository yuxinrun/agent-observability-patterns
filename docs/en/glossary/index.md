---
title: Glossary — every piece of jargon in one place
description: Trace, span, OTLP, TTFT, SLO, burn rate, cardinality, LLM-as-judge — what each term means and which chapter uses it.
outline: [2, 3]
---

# Glossary — every piece of jargon in one place

`Cmd/Ctrl + K` works too, but this page is grouped so you can find the one word you are stuck on.

## Trace fundamentals {#trace}

| Term | Plain meaning | Chapter |
| --- | --- | --- |
| Trace | The whole story of one request, stitched into a single line | [01](/en/fundamentals/) |
| Span | One episode in that story: it starts, it ends, it has a result and a duration | [01](/en/fundamentals/) |
| TraceID | The story's ID card: 32 hex chars, shared by everything in the chain | [01](/en/fundamentals/#trace-span) |
| SpanID | Each episode's own number: 16 hex chars | [01](/en/fundamentals/#trace-span) |
| Parent SpanID | Points at "who called me" — this is what builds the tree | [01](/en/fundamentals/#trace-span) |
| Root span | The tree root, usually one task or one HTTP request | [02](/en/traces/#span-layers) |
| Context propagation | Putting traceparent into a header or message metadata so downstream continues the trace | [01](/en/fundamentals/#propagation) |
| traceparent | W3C header, format `00-<trace_id>-<span_id>-<flags>` | [01](/en/fundamentals/#propagation) |
| Span link | Not a parent-child relation but still related — for long tasks and async boundaries | [01](/en/fundamentals/#task-kinds) |
| Orphan span | A span whose parent is missing, usually a broken propagation | [12](/en/pitfalls/#broken-trace) |
| Waterfall | All spans laid out horizontally by time, so slow parts jump out | [09](/en/dashboards/#overview) |

::: tip Plain language
A trace is a film, a span is a scene, a trace ID is the film's serial number. If the sequel (downstream service) does not know the number, the audience cannot follow the plot — that is a broken trace.
:::

## OpenTelemetry ecosystem {#otel}

| Term | Plain meaning | Chapter |
| --- | --- | --- |
| OpenTelemetry (OTel) | USB-C for observability: instrument once, swap backends freely | [01](/en/fundamentals/#otel) |
| OTLP | OTel's wire protocol: gRPC on 4317, HTTP on 4318 | [01](/en/fundamentals/#otel) |
| Collector | The middleman: receive, batch, redact, sample, forward | [06](/en/platforms/#light) |
| Instrumentation | The act of deciding where to record | [08](/en/instrumentation/) |
| Auto-instrumentation | SDK hooks record HTTP/DB calls without touching business code | [08](/en/instrumentation/#middleware) |
| GenAI semantic conventions | OTel's field naming standard for LLMs, all `gen_ai.*` | [01](/en/fundamentals/#genai) |
| BatchSpanProcessor | Buffers spans before export — do not let its queue overflow | [14](/en/scale/#async) |
| Tail sampling | Collect everything, decide after the trace ends, so errors win | [14](/en/scale/#sampling) |

## Metrics and cost {#metrics}

| Term | Plain meaning | Chapter |
| --- | --- | --- |
| TTFT | Time To First Token: enter key to the first character on screen | [03](/en/metrics/#llm) |
| P95 / P99 | Sort 100 requests by duration, take the 95th / 99th | [09](/en/dashboards/#overview) |
| Input / output tokens | What you fed in / what it produced — the bill is built from these | [03](/en/metrics/#llm) |
| Cached tokens | Input tokens served from prompt cache, usually much cheaper | [03](/en/metrics/#llm) |
| Task cost | Total spend of one full task, which may include a dozen model calls | [03](/en/metrics/#task) |
| Hidden cost | Loops, retries and context bloat that never show up as a line item | [12](/en/pitfalls/#loop-cost) |
| Cardinality | How many distinct label combinations a metric explodes into | [03](/en/metrics/#aggregation) |
| SLO | The target you promise, e.g. "99% of tasks finish within 30s" | [03](/en/metrics/#slo) |
| Error budget | 100% minus the SLO: the failure you are allowed to spend | [03](/en/metrics/#slo) |
| Burn rate | How fast the budget is being spent — warns earlier than a threshold | [05](/en/alerts/#rules) |

## Evaluation and quality {#evals}

| Term | Plain meaning | Chapter |
| --- | --- | --- |
| Eval | Score the output to judge whether it is right, not just fast | [10](/en/evals/) |
| Hallucination | The task says success but the content is invented | [12](/en/pitfalls/#silent-fail) |
| LLM-as-judge | Another model grades the output: cheap, but biased | [10](/en/evals/#judge) |
| Rubric | The grading sheet that turns "good" into checkboxes | [10](/en/evals/#judge) |
| Regression test | Replay real samples before a release to catch degradation | [10](/en/evals/#regression) |
| Labeling | A human marks a trace right/wrong with a reason; the seed of evals | [10](/en/evals/#loop) |
| Loop | Trace → label → eval → change prompt/flow → look at traces again | [10](/en/evals/#loop) |

## Platforms and engineering {#platform}

| Term | Plain meaning | Chapter |
| --- | --- | --- |
| Langfuse | Open-source, self-hostable LLM observability with a friendly UI | [06](/en/platforms/#langfuse) |
| OpenLLMetry | Traceloop's auto-instrumentation: one `Traceloop.init()` | [06](/en/platforms/#openllmetry) |
| Phoenix | Arize's open-source tracer built on OpenInference, strong on evals | [06](/en/platforms/#phoenix) |
| LangSmith | LangChain's commercial platform: traces plus evals | [06](/en/platforms/#langsmith) |
| Jaeger / Tempo | Generic distributed tracing backends; the best waterfalls | [06](/en/platforms/#light) |
| MCP | Model Context Protocol: the standard way agents call tools | [02](/en/traces/#mcp-trace) |
| A2A | Agent2Agent: the protocol for delegating between agents | [02](/en/traces/#a2a-trace) |
| Redaction | Replacing phones, IDs and keys before data leaves the process | [04](/en/logs/#redaction) |
| Retention | How long data lives and when it is deleted automatically | [11](/en/security/#retention) |
| Tenant isolation | Customer A never sees customer B's traces, down to the field level | [11](/en/security/#tenant) |

## Field cheat sheet {#fields}

| Field | Meaning | Written by |
| --- | --- | --- |
| `gen_ai.operation.name` | What this step does: `chat` / `execute_tool` / `invoke_agent` | Instrumentation |
| `gen_ai.provider.name` | Which provider, e.g. `anthropic`, `openai` | Instrumentation |
| `gen_ai.request.model` | Model requested | Instrumentation |
| `gen_ai.usage.input_tokens` | Input token count | Model response |
| `gen_ai.usage.output_tokens` | Output token count | Model response |
| `gen_ai.response.finish_reasons` | Why it stopped: `stop` / `tool_use` / `length` | Model response |
| `gen_ai.tool.name` | Tool name | Tool layer |
| `gen_ai.agent.name` | Agent name | Task layer |
| `session.id` | Session ID tying multiple traces of one user together | Entry point |
| `tenant.id` | Tenant ID for isolation and grouping | Entry point |
| `cost.usd` | This span converted into money | Gateway or post-processing |
| `agent.turns` | How many turns this task took | Loop layer |
| `memory.hit` | Whether the memory read hit | Memory layer |
| `delegation.depth` | How deep the delegation chain went, to stop runaway nesting | A2A layer |

::: tip Plain language
You do not need to memorize field names. Remember three classes: **who is acting (agent/operation), what it cost (tokens/cost), how it ended (finish reasons/status)**. Boards, alerts and evals are all built on those three.
:::

## Abbreviations {#abbr}

| Short | Full | Notes |
| --- | --- | --- |
| OTel | OpenTelemetry | The vendor-neutral telemetry standard |
| OTLP | OpenTelemetry Protocol | The wire protocol, 4317 gRPC / 4318 HTTP |
| SSE | Server-Sent Events | The transport behind streaming responses |
| TTFT | Time To First Token | Perceived responsiveness |
| SLO | Service Level Objective | Internal target |
| SLA | Service Level Agreement | Contractual, usually with penalties |
| PII | Personally Identifiable Information | Redact before storage |
| RAG | Retrieval-Augmented Generation | Fetch context, then generate |
| MCP | Model Context Protocol | Tool calling standard |
| A2A | Agent to Agent | Agent delegation standard |

Missing a term? [Open an issue](https://github.com/yuxinrun/agent-observability-patterns/issues) or read the primary sources in [further reading](/en/reading/).
