---
title: '07 · Integration: wiring it into your stack'
description: Gateway, MCP, A2A, memory and orchestration — where to put spans, what to report, and how to stitch the trace end to end.
outline: [2, 3]
---

# 07 · Integration: wiring it into your stack

The first six chapters were about observability itself. This one is about a more realistic problem: **your system already exists. How do you attach the plumbing?**

The good news: all five components connect the same way — **open a span at the boundary, pass `traceparent` down, attach the fields only that component knows.**

::: tip Plain language
Integration is not "install an SDK everywhere". Ask three questions per component:
1. Where is the **boundary** (what goes in, what comes out)?
2. What does it **uniquely know** that nobody else does?
3. Will it **create a new trace** on its own? That is the number one cause of broken chains.
:::

## 01 Into llm-gateway-patterns {#gateway}

The gateway is the company's only model exit, which makes it **the only place where tokens and cost can be correct**.

<Diagram id="gateway-seq" />

```python
# Gateway: one chat span per request; model-agnostic fields are filled in one place
async def chat(request):
    with tracer.start_as_current_span(f"chat {request.model}") as span:
        span.set_attribute("gen_ai.operation.name", "chat")
        span.set_attribute("gen_ai.provider.name", request.provider)
        span.set_attribute("gen_ai.request.model", request.model)
        span.set_attribute("gateway.route", request.route)      # routing decision
        span.set_attribute("gateway.cache", request.cache_hit)
        span.set_attribute("tenant.id", request.tenant)

        resp = await upstream.call(request)

        span.set_attribute("gen_ai.response.model", resp.model)
        span.set_attribute("gen_ai.usage.input_tokens", resp.usage.input)
        span.set_attribute("gen_ai.usage.output_tokens", resp.usage.output)
        span.set_attribute("gen_ai.response.finish_reasons", resp.finish_reasons)
        span.set_attribute("cost.usd", price(resp))
        return resp
```

| Gateway reports | Why only here |
| --- | --- |
| Exact token counts | Business code only sees estimates |
| Routing and fallback | Only the gateway knows which provider ran |
| Cache hits | Business code just sees "fast" |
| Rate limits and refusals | A 429 is usually swallowed upstream |
| Key / project ownership | Needed for tenant billing |

::: warning The classic gateway mistake: turning upstream failures into 200
Many gateways wrap a provider's 429 or 500 into a friendly 200 body. The upstream burns, your dashboard stays green. **Errors must survive in the status code and `error.type`.**
:::

## 02 Into mcp-patterns {#mcp}

The point of MCP integration is not "record a call"; it is **making tool execution and agent reasoning appear on the same tree**.

<Diagram id="mcp-integration" />

```python
# Client: inject context before the call
tp = inject_traceparent()
result = await session.call_tool(
    "search_orders",
    arguments={"user_id": uid},
    meta={"traceparent": tp, "tenant.id": tenant},
)

# Server: restore the context, never start a new root span
@server.tool("search_orders")
async def search_orders(user_id: str, meta: dict | None = None):
    ctx = propagate.extract({"traceparent": (meta or {}).get("traceparent", "")})
    with tracer.start_as_current_span("mcp.tool search_orders", context=ctx) as span:
        span.set_attribute("mcp.server", "orders-mcp")
        span.set_attribute("mcp.tool.is_error", False)
        rows = await db.query(...)
        span.set_attribute("mcp.result.rows", len(rows))
        return rows
```

| Layer | What it reports |
| --- | --- |
| Agent side | Which tool was chosen, and why (`tool.selection.reason`) |
| Client | Transport, wait time, retries |
| Server | Real execution time, DB time, rows returned, auth outcome |
| Platform | Tool version, schema changes |

## 03 Into a2a-patterns {#a2a}

A2A's difficulty is the **trust boundary**: the remote agent may not be yours, yet the user sees one chain.

<Diagram id="a2a-integration" />

```python
# Sender
headers, metadata = {}, {}
propagate.inject(headers)
payload = {
    "message": {"role": "user", "parts": [{"kind": "text", "text": task}]},
    "metadata": {
        "traceparent": headers["traceparent"],
        "delegation.depth": depth + 1,
        "caller.agent": "planner-agent",
    },
}
with tracer.start_as_current_span("a2a.send research-agent") as span:
    span.set_attribute("a2a.target_agent", "research-agent")
    span.set_attribute("a2a.task_id", resp.task_id)

# Receiver
ctx = propagate.extract({"traceparent": payload["metadata"]["traceparent"]})
with tracer.start_as_current_span("a2a.receive", context=ctx):
    ...
```

| Situation | Recommendation |
| --- | --- |
| Peer supports traceparent | Continue the trace, ideal |
| Peer does not | Use a **span link**; never fake a parent |
| Cross-company | Pass the trace id only, not internal `tracestate` |
| Long task | Model with task status events, not a two-hour span |

## 04 Into agent-memory-patterns {#memory}

Memory is badly undervalued in telemetry: **it is both a latency source and the reason two answers differ.**

<Diagram id="memory-integration" />

| Memory operation | Span | Required attributes |
| --- | --- | --- |
| Vector recall | `memory.recall` | `top_k`, `memory.hit`, `similarity.max`, `embed.latency.ms` |
| Keyword recall | `memory.recall.keyword` | `hits`, `index.version` |
| Rerank | `memory.rerank` | `rerank.model`, `top_n`, `score.delta` |
| Write | `memory.write` | `memory.tokens`, `dedup.hit`, `ttl.days` |
| Context injection | `memory.inject` | `injected.tokens`, `context.utilization` |

```python
with tracer.start_as_current_span("memory.recall") as span:
    t0 = time.perf_counter()
    vector = await embed(query)
    span.set_attribute("embed.latency.ms", (time.perf_counter() - t0) * 1000)
    hits = await index.search(vector, top_k=8)
    span.set_attribute("top_k", 8)
    span.set_attribute("memory.hit", len(hits))
    span.set_attribute("context.utilization", injected_tokens / window_size)
```

`context.utilization` is my favourite field: it tells you how full the window is with memory. Above 0.8, models often start ignoring the system prompt — and the trace looks perfectly healthy.

## 05 Into better-agent {#better-agent}

The orchestration framework decides when to run, how many turns, and how often to retry. It is the natural birthplace of **task-level spans**.

<Diagram id="ba-integration" />

```python
# Scheduler: record at enqueue time, link at execution time — do not force parentage
def enqueue(task):
    with tracer.start_as_current_span("scheduler.enqueue") as span:
        task.trigger_span = span.get_span_context()
        span.set_attribute("task.id", task.id)
        span.set_attribute("queue.name", "agent-default")
        queue.put(task)

def worker(task):
    links = [trace.Link(task.trigger_span)]
    with tracer.start_as_current_span(f"invoke_agent {task.agent}", links=links) as span:
        span.set_attribute("task.id", task.id)
        span.set_attribute("queue.wait.ms", task.waited_ms)
        run_agent(task)
```

| Scheduler field | Purpose |
| --- | --- |
| `task.id` | Cross-system reconciliation |
| `queue.wait.ms` | Separate "queued slowly" from "ran slowly" |
| `retry.count` | Retry amplification |
| `worker.id` | Is it one bad node or everything |
| `scheduler.policy` | Whether throttling actually applied |

## Boundaries between the five {#boundaries}

| Component | What only it knows | What it should not report |
| --- | --- | --- |
| Gateway | Tokens, cost, route, cache | User intent, tool results |
| MCP | Tool internals, DB time | Model tokens |
| A2A | Delegation, remote status | Remote internal spans |
| Memory | Hit rate, similarity, injected tokens | Final answer quality |
| Scheduler | Queueing, retries, concurrency | Single-turn reasoning |

::: tip Why clean boundaries matter
Each component reports only what it uniquely knows, so **every fact has exactly one source**. Otherwise you get the classic dashboard argument: "the gateway says 1200 tokens, the agent says 1350".
:::

## Acceptance checklist {#board-sample}

| Check | Pass criteria |
| --- | --- |
| Trace completeness | One tree from ingress to tool, no orphan spans |
| Field consistency | Tokens and cost have a single authority |
| Cross-component | A2A and MCP calls expand inside the same trace |
| Failure visibility | Tool errors and gateway 429s carry `error.type` |
| Redaction | Sample 100 spans, zero phone numbers or keys |
| Overhead | P95 added by instrumentation < 3% |

## Pitfalls {#pitfalls}

::: warning Five frequent integration errors
1. **Every component builds its own TracerProvider.** Context is not shared; the trace shatters.
2. **The MCP server treats the client span as parent and starts a root anyway.** Two trees.
3. **The gateway swallows upstream error codes.** Your alerts never fire.
4. **A2A sends internal `tracestate` across companies.** Internal service names leak.
5. **The scheduler forces parentage.** Six-hour traces that no UI will open.
:::

## Recap {#recap}

- The gateway is the sole authority for tokens and cost; it must pass errors through.
- MCP needs a span on both ends, joined by `_meta.traceparent`.
- A2A continues the trace when possible, links when not, and shares only the trace id across companies.
- Memory telemetry centres on hits, similarity and context utilisation.
- The scheduler uses links, not parentage, to avoid monster traces.
- Each component reports only its unique knowledge; one fact, one source.

Next is the most practical chapter: four instrumentation patterns and five anti-patterns.

## Further reading {#reading}

- [OpenTelemetry context propagation](https://opentelemetry.io/docs/concepts/context-propagation/): the standard semantics.
- [MCP specification](https://modelcontextprotocol.io/specification): `_meta` and transports.
- [A2A protocol](https://a2a-protocol.org/): message metadata and task states.
- [Chapter 13 The demo kit](/en/demos/): runnable A2A and MCP examples.
