---
title: 02 · End-to-end tracing patterns
description: 'Eight production-ready tracing patterns: ReAct loops, streaming chunks, layered spans, A2A, MCP, memory, sessions and error snapshots.'
outline: [2, 3]
---

# 02 · End-to-end tracing patterns

Chapter 01 handed you bricks. This chapter builds the house.

Eight patterns for eight concrete questions: what is it thinking (ReAct), how do tokens arrive (streaming), where did the time go (layering), how do two agents connect (A2A), why is this tool slow (MCP), is memory helping (memory), what did this user do (sessions), and how do we reproduce a crash (error snapshots).

::: tip Plain language
A tracing pattern is not "more logging". It is **deciding the shape of the tree in advance**. A well-shaped tree makes debugging clicking; a badly shaped one makes it archaeology.
:::

## 01 Tracing the ReAct loop {#react-loop}

ReAct means think, act, observe, repeat. So the trace should look like a loop: one task span outside, one turn span per iteration, model and tool calls inside each turn.

<Diagram id="react-trace" />

```python
def run_agent(task: str, max_turns: int = 12):
    with tracer.start_as_current_span("invoke_agent support-agent") as root:
        root.set_attribute("gen_ai.operation.name", "invoke_agent")
        root.set_attribute("gen_ai.agent.name", "support-agent")
        root.set_attribute("agent.max_turns", max_turns)
        turns = 0
        while turns < max_turns:
            turns += 1
            with tracer.start_as_current_span(f"agent.turn {turns}") as turn:
                turn.set_attribute("agent.turn", turns)
                action = think(task, history)          # chat span inside
                if action.kind == "final":
                    root.set_attribute("agent.stop_reason", "final")
                    return action.text
                observe(action)                        # tool span inside
        root.set_attribute("agent.stop_reason", "max_turns")
        root.set_attribute("loop.exhausted", True)
        return "Sorry, I could not finish within the turn limit."
```

Three fields you cannot skip:

| Field | Why | Alert usage |
| --- | --- | --- |
| `agent.turn` | Which iteration | Mean turns drifting up = prompt regression |
| `agent.stop_reason` | Why it stopped | Rising `max_turns` = runaway loop in the making |
| `loop.count` | Consecutive calls to one tool | Anything above 3 deserves a look |

::: warning An agent without a turn limit is a subscription that renews itself
A 12-turn conversation and a 40-turn one differ by more than 3× in tokens — closer to 10×, because every turn re-feeds the history.
:::

## 02 Tracing token streams {#streaming}

Streaming breaks in predictable ways: spans that never close, disconnects nobody records, a span per token that flattens the backend.

The whole rule fits in one line: **one span per request, chunks as events, close in `finally`.**

<Diagram id="stream-trace" />

```python
async def stream_answer(prompt: str):
    with tracer.start_as_current_span("chat claude-sonnet-4-5") as span:
        span.set_attribute("gen_ai.operation.name", "chat")
        span.set_attribute("gen_ai.request.model", "claude-sonnet-4-5")
        span.set_attribute("stream", True)
        started, first, chunks = time.perf_counter(), None, 0
        try:
            async for chunk in client.messages.stream(prompt=prompt):
                if first is None:
                    first = time.perf_counter()
                    span.set_attribute("ttft.ms", round((first - started) * 1000))
                chunks += 1
                if chunks % 50 == 0:
                    span.add_event("stream.progress", {"chunks": chunks})
                yield chunk
            span.set_attribute("chunks", chunks)
            span.set_attribute("stream.completed", True)
        except (asyncio.CancelledError, GeneratorExit):
            span.set_attribute("stream.completed", False)
            span.set_attribute("client.disconnected", True)
            raise
        except Exception as exc:
            span.record_exception(exc)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(exc)))
            raise
```

| Symptom | What you got wrong | Fix |
| --- | --- | --- |
| Slow first token, fine total | No `ttft.ms` | Record when chunk one lands |
| User says "it froze", trace says success | Generator closed silently | Mark incomplete on `GeneratorExit` |
| Backend CPU pinned | One span per chunk | Use events or a counter |
| Chunk ordering scrambled | Concurrent writes to one span | Write from one coroutine, count locally |

## 03 Layered span design {#layered-spans}

Five layers, industry consensus: **task → agent turn → LLM call → tool → memory**. Each layer answers exactly one question.

<Diagram id="span-layers" />

| Layer | Span name | Answers only | Typical attributes |
| --- | --- | --- | --- |
| Task | `invoke_agent support-agent` | Did it succeed, what did it cost | `task.id`, `tenant.id`, `cost.usd` |
| Turn | `agent.turn 2` | What happened this round | `agent.turn`, `turn.intent` |
| LLM | `chat claude-sonnet-4-5` | How much did the model cost | tokens, `finish_reasons`, `ttft.ms` |
| Tool | `execute_tool search_orders` | Is the tool reliable | `gen_ai.tool.name`, `retries` |
| Memory | `memory.recall` | Did memory help | `memory.hit`, `similarity`, `top_k` |

::: tip Why one giant span fails
Because aggregation dimensions differ. Task level aggregates by tenant and agent; model level by model; tool level by tool name. Collapse them into one layer and your dashboard can only show "total duration".
:::

The opposite failure is over-layering: a span for every HTTP retry and JSON parse. The rule of thumb — **open a span only at boundaries that affect cost or user decisions**; everything else is an event.

## 04 Tracing across agents (A2A) {#a2a}

The goal is simple: the user sees one reply from the main agent, but behind it a planner delegated to a retrieval agent, which called a coding agent.

<Diagram id="a2a-trace" />

```python
# Delegator: inject context into A2A message metadata
headers = {}
propagate.inject(headers)
message = {
    "role": "user",
    "parts": [{"kind": "text", "text": subtask}],
    "metadata": {"traceparent": headers["traceparent"], "delegation.depth": depth + 1},
}
with tracer.start_as_current_span("a2a.delegate research-agent") as span:
    span.set_attribute("a2a.target_agent", "research-agent")
    span.set_attribute("delegation.depth", depth + 1)
    response = await a2a_client.send(message)

# Delegate: restore from metadata and stay in the same trace
ctx = propagate.extract({"traceparent": message["metadata"]["traceparent"]})
with tracer.start_as_current_span("invoke_agent research-agent", context=ctx):
    ...
```

| Required field | Purpose |
| --- | --- |
| `a2a.target_agent` | Who was called |
| `delegation.depth` | Delegation level; above 3 merits a look |
| `a2a.task_id` | Remote task id, for reconciliation |
| `a2a.status` | submitted / working / completed / failed |

::: danger Delegation cycles
A delegates to B, B delegates back to A. Without a depth cap and detection of an agent repeating inside one trace, the cycle will burn your quota very politely.
:::

## 05 Tracing MCP tool calls {#mcp}

MCP is special because the tool lives in **another process, possibly another company**. One call needs two spans: client (how long I waited) and server (how long I worked).

<Diagram id="mcp-trace" />

```python
# Client
with tracer.start_as_current_span("execute_tool search_orders") as span:
    span.set_attribute("gen_ai.operation.name", "execute_tool")
    span.set_attribute("gen_ai.tool.name", "search_orders")
    span.set_attribute("mcp.server", "orders-mcp")
    span.set_attribute("mcp.transport", "streamable-http")
    result = await session.call_tool("search_orders", args, meta={"traceparent": tp})

# Server
ctx = propagate.extract({k: v for k, v in meta.items() if k.startswith("trace")})
with tracer.start_as_current_span("mcp.tool search_orders", context=ctx) as span:
    span.set_attribute("mcp.tool.is_error", result.isError)
```

| Metric | Purpose |
| --- | --- |
| Client duration − server duration | Network and queueing cost |
| `mcp.tool.is_error` ratio | Tool quality |
| Consecutive failures per tool | Circuit breaking |
| Response payload size | The usual cause of context bloat |

## 06 Tracing memory reads and writes {#memory}

Memory is the most overlooked layer, and often the answer to "why is it dumber today": no recall hit, stale recall, or a context stuffed to the ceiling.

<Diagram id="memory-trace" />

| Operation | Span name | Key attributes |
| --- | --- | --- |
| Recall | `memory.recall` | `top_k`, `memory.hit`, `similarity.max`, `memory.latency.ms` |
| Write | `memory.write` | `memory.store`, `memory.tokens`, `dedup.hit` |
| Update | `memory.update` | `memory.id`, `memory.reason` |
| Inject | `memory.inject` | `injected.tokens`, `context.utilization` |

```python
with tracer.start_as_current_span("memory.recall") as span:
    hits = await store.search(query, top_k=8)
    span.set_attribute("top_k", 8)
    span.set_attribute("memory.hit", len(hits))
    span.set_attribute("similarity.max", max((h.score for h in hits), default=0))
    span.set_attribute("memory.tokens", sum(len(h.text) // 4 for h in hits))
```

::: tip An alert you can ship today
If the share of `memory.hit == 0` stays above 30% for ten minutes, one of three things happened: the index is stale, the embedding model changed, or users are genuinely asking new things. Different fixes, all worth a look.
:::

## 07 Session tracing {#session}

A session is bigger than a trace: one conversation can trigger six traces, one per task. `session.id` stitches them into a story.

<Diagram id="session-trace" />

| Field | Meaning | Note |
| --- | --- | --- |
| `session.id` | Conversation identifier | Server-generated, never trust the client |
| `gen_ai.conversation.id` | GenAI convention for the same idea | Can equal `session.id` |
| `user.id` | User identity | **Hash it**; never plain phone or email |
| `session.turn` | Turn index within the session | Powers "why does it get pricier as we chat" |

Session-level boards answer different questions than trace-level ones:

| Question | Granularity |
| --- | --- |
| Why was this task slow | trace |
| Why did this user churn | session |
| Is this whole class of task degrading | aggregated metrics |

## 08 Error snapshots {#error-snapshot}

The most expensive sentence in production is "can you reproduce it". Error snapshots make every failure carry its own reproduction kit.

<Diagram id="error-snapshot" />

```python
except Exception as exc:
    span.record_exception(exc)
    span.set_status(trace.Status(trace.StatusCode.ERROR, type(exc).__name__))
    span.set_attribute("error.type", type(exc).__name__)
    span.set_attribute("error.stage", "tool_call")
    # The minimum context needed to reproduce, redacted
    span.set_attribute("snapshot.input_hash", sha256(user_input))
    span.set_attribute("snapshot.turn", turns)
    span.set_attribute("snapshot.last_tool", action.tool_name)
    span.set_attribute("snapshot.last_output_head", redact(action.output)[:200])
    span.set_attribute("snapshot.replayable", has_enough_context())
```

| Store | Never store |
| --- | --- |
| Input hash, length, language | Raw user text (unless redacted and permitted) |
| Last tool name and status code | Full tool response bodies |
| Model, temperature, max_tokens | API keys, cookies |
| Failure stage, truncated stack | Stack frames carrying business data |

::: warning A snapshot is not a log backup
Keep only the minimum set that reproduces. Copying the production database into your observability platform is a security and cost double-kill.
:::

## Sample board {#board-sample}

| Metric | Definition | Healthy | What it tells you |
| --- | --- | --- | --- |
| Mean turns | `avg(agent.turn)` | < 4 | Prompt regression |
| TTFT P95 | `p95(ttft.ms)` | < 1.2s | The "it froze" feeling |
| Tool failure rate | `errors / calls` per tool | < 2% | Which tool drags |
| Orphan rate | share of root spans | < 2% | Propagation leaks |
| Memory hit rate | share of `hit > 0` | > 60% | Whether memory earns its keep |

## Pitfalls {#pitfalls}

::: warning Five ways tracing patterns go wrong
1. **One outer span, everything inside dark.** You wrapped a black box in a bigger black box.
2. **Streaming spans never closed.** Memory leaks plus 12-hour zombie spans.
3. **A2A with only `taskId`.** Distributed tracing degrades into separate diaries.
4. **Skewed clocks between MCP client and server.** Fix NTP before analysing latency.
5. **Errors recording only `message`.** `error.type` aggregates; a message can only be read by eye.
:::

## Recap {#recap}

- ReAct: one task span plus a turn span per iteration, always record `stop_reason`.
- Streaming: one span per request, chunks as events, record the abort path.
- Layering: five layers, one question each, never mix aggregation dimensions.
- A2A: `traceparent` in metadata, `delegation.depth` to break cycles.
- MCP: client and server spans; the gap is network plus queueing.
- Memory: recall, write and inject all deserve spans; hit rate is the headline.
- Sessions: `session.id` turns several traces into one narrative.
- Error snapshots: store the minimum reproducible context, never everything.

Next we turn these spans into numbers: task, model, tool, UX and business metrics, plus copy-ready SLOs.

## Further reading {#reading}

- [OpenTelemetry span links](https://opentelemetry.io/docs/concepts/signals/traces/#span-links): the standard way to connect async work.
- [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/): the native agent/turn/tool span model.
- [Chapter 03 Metrics](/en/metrics/): from traces to the board.
- [Chapter 12 The pitfalls catalog](/en/pitfalls/): how these patterns break in production.
