---
title: '15 · Ecosystem: where the pieces meet'
description: What orchestration, A2A, MCP, memory and gateway each report, where their boundaries lie, and how to keep the contracts consistent.
outline: [2, 3]
---

# 15 · Ecosystem: where the pieces meet

This handbook is not an island. It belongs to a set of five sibling projects:

<Diagram id="eco-hub" />

- **[better-agent](https://yuxinrun.github.io/better-agent/)**: building a single agent.
- **[a2a-patterns](https://yuxinrun.github.io/a2a-patterns/)**: how agents collaborate.
- **[mcp-patterns](https://yuxinrun.github.io/mcp-patterns/)**: how agents use tools.
- **[agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/)**: how agents remember.
- **[llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/)**: how models are called safely.

Observability is not a sixth piece. It is **the shared exit of all five**.

::: tip Plain language
The five projects each do one thing; this project makes each of them legible. So every project emits telemetry at its boundaries, and this project defines the shape of that telemetry.
:::

## 01 better-agent: orchestration {#better-agent}

[better-agent](https://yuxinrun.github.io/better-agent/) is about the loop: how an agent iterates, chooses tools and budgets context. It produces the richest decision events.

| It should report | Field | Purpose |
| --- | --- | --- |
| Turns | `agent.turn`, `agent.max_turns` | Loop and cost analysis |
| Stop reason | `agent.stop_reason` | Distinguish done from exhausted |
| Tool choice | `gen_ai.tool.name`, `tool.selection.reason` | Prompt improvement |
| Context budget | `context.tokens`, `context.utilization` | Early warning on bloat |
| Delegation | `delegation.depth` | Cross-agent tracing |

It should **not** report: exact token counts (gateway owns them) or tool internals (MCP owns them).

::: warning The most duplicated field
`input_tokens`. The agent estimates it, the gateway measures it, and the dashboard shows two different numbers. Rule: **the gateway is authoritative; the agent only records an estimate when gateway data is unavailable, tagged `token.source=estimated`.**
:::

## 02 a2a-patterns: agent boundaries {#a2a}

[a2a-patterns](https://yuxinrun.github.io/a2a-patterns/) defines discovery, delegation and status reporting between agents. That is exactly where tracing boundaries live.

| It should report | Note |
| --- | --- |
| `a2a.target_agent` | Who received the work |
| `a2a.task_id` / `a2a.status` | Remote task lifecycle |
| `delegation.depth` | Cycle prevention |
| `traceparent` propagation | The only way to continue a trace |

| Boundary question | Convention |
| --- | --- |
| Peer lacks OTel | Use a span link; never fake a parent |
| Cross-company call | Share the trace id only, not internal `tracestate` |
| Long-running task | Model as task status events, not one long span |
| Delegation failure | Record it on the **delegator**; the peer may never have received it |

## 03 mcp-patterns: the tool layer {#mcp}

[mcp-patterns](https://yuxinrun.github.io/mcp-patterns/) covers exposing and calling tools safely. Tool telemetry is about **quality and authorisation**.

| It should report | Note |
| --- | --- |
| `gen_ai.tool.name`, `mcp.server` | Who provides the tool |
| `mcp.tool.is_error` | Tool-level outcome |
| `mcp.result.rows` / payload size | Source of context bloat |
| Authorisation outcome | `auth.decision=allow/deny` |
| Schema version | Tool change traceability |

Two golden metrics for tools: **call success rate** and **response size**. The first drives experience; the second drives cost.

## 04 agent-memory-patterns: memory metrics {#memory}

[agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/) covers long-term memory, recall and forgetting. Memory is the layer most likely to remain a black box.

| It should report | Healthy line |
| --- | --- |
| `memory.hit` | Share of recalls with hits > 60% |
| `similarity.max` | Too low means index or embedding trouble |
| `memory.latency.ms` | Vector search P95 < 200ms |
| `context.utilization` | < 0.8, above which models ignore the system prompt |
| `dedup.hit` | Dedupe hits, a proxy for memory hygiene |

::: tip A cross-project link worth building
Recall results go into the context, and context bloat raises gateway token cost. **Only by putting `memory.tokens` and `gen_ai.usage.input_tokens` on the same trace can you prove whether memory earns its money.**
:::

## 05 llm-gateway-patterns: metering {#gateway}

[llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/) is the single exit for models and therefore **the sole authority for metering and governance**.

| It should report | Note |
| --- | --- |
| `gen_ai.provider.name` / `request.model` / `response.model` | Routing and fallback |
| `gen_ai.usage.*` | Exact tokens |
| `cost.usd` | Computed from configured prices |
| `gateway.route` / `gateway.cache` | Decisions and caching |
| 429 / refusals | Must surface as error status |

## The cross-project field contract {#contract}

For five projects to compose one picture, they need a **field contract**. Keep it in a shared repository as the single source of truth:

| Field | Type | Producer | Consumers |
| --- | --- | --- | --- |
| `trace_id` | string | Ingress | Everyone |
| `tenant.id` | string | Gateway / ingress | Everyone |
| `session.id` | string | Agent / ingress | Observability, evals |
| `gen_ai.agent.name` | string | Orchestration | Observability |
| `gen_ai.tool.name` | string | MCP client | Observability |
| `gen_ai.usage.*` | int | Gateway | Observability, billing |
| `cost.usd` | float | Gateway | Observability, finance |
| `memory.hit` | int | Memory | Observability |
| `delegation.depth` | int | A2A | Observability |

::: danger Contracts are harder to change than code
Once a field reaches a board or an alert, renaming it costs more than changing a function. **Freeze the naming before launch, codify it in a shared schema, validate it in CI.**
:::

## One-page acceptance checklist {#board-sample}

| Check | Standard |
| --- | --- |
| Every project emits standard spans | Conforms to `gen_ai.*` |
| Five projects compose one trace | No gap from ingress to tool |
| One fact, one source | Tokens from the gateway, tool time from MCP |
| Contract validated in CI | Missing fields fail the build |
| Each project has its own board | No need to crowd the overview |
| Cross-project incidents have a joint runbook | Everyone knows who to call |

## Book recap {#recap}

Sixteen chapters, three ideas:

1. **See it**: traces record the path, metrics record the trend, logs record the evidence, evals record the quality.
2. **Afford it**: sampling, async export, tiered storage and unit economics keep cost linear with the business.
3. **Trust it**: severity, noise reduction, compliance and access control make the telemetry system itself dependable.

If you keep one sentence: **agents do not cry out in pain, so you must decide in advance which facts deserve to be recorded.**

## Next {#next}

- Hands-on: start with the [Chapter 13 demos](/en/demos/) and get one trace flowing.
- Going live: read [Chapter 08 Instrumentation](/en/instrumentation/) and [Chapter 14 Scaling](/en/scale/).
- Avoiding scars: pin the [Chapter 12](/en/pitfalls/) checklist above the board.
- Wiring the ecosystem: begin with [better-agent](https://yuxinrun.github.io/better-agent/) and follow the contract in this chapter.

## Further reading {#reading}

- [better-agent](https://yuxinrun.github.io/better-agent/): building the single agent loop.
- [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/): agent-to-agent collaboration.
- [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/): designing and governing tools.
- [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/): writing, recalling and forgetting.
- [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/): routing, throttling and metering.
