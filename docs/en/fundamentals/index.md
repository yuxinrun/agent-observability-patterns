---
title: '01 · Foundations: the mechanics, once and for all'
description: Trace, span, trace ids, context propagation, OpenTelemetry and the GenAI semantic conventions — explained without the jargon.
outline: [2, 3]
---

# 01 · Foundations: the mechanics, once and for all

In one line: **a trace is the itinerary of one task, a span is one leg of the trip.**

Order food delivery and the platform records: order accepted, food ready, courier picked up, elevator, delivered. The whole thing is a trace; each leg is a span. If you only record "delivered", a 40-minute delay tells you nothing about whether the kitchen or the road was at fault.

Agents are identical. A single "can I still return this order" involves three model turns, two tool calls and one memory recall. **Without a trace you only see "completed".**

::: tip Plain language
- **Span**: one piece of work with a start, an end and an outcome. A line on the itinerary.
- **Trace**: every span of one task, stitched into a tree.
- **Trace id**: the order number. It is how services on different machines recognise each other.
- **Span id / parent span id**: this leg's number, and the number of the leg above it.
- **Context propagation**: carrying that order number on every hop instead of inventing a new one.
:::

## 01 Trace, span, trace id and context {#trace-span}

A real agent span tree looks like this — width is duration, indentation is parentage.

<Diagram id="span-tree" />

| Concept | Everyday analogy | Technical meaning | What you read it for |
| --- | --- | --- | --- |
| Trace | The whole order | One end-to-end task | Total time, total cost, final status |
| Span | One line on the order | One bounded operation | Its own latency, its share of the parent |
| Trace id | Order number | 32 hex chars, globally unique | Find one chain |
| Span id | Line number | 16 hex chars | Locate it in the tree |
| Parent span id | "Which line is above me" | Span id of the parent | Fix broken traces |
| Attributes | Notes column | Key/value pairs you can aggregate | Model, tokens, tool, tenant |

The minimum viable code is eight lines. Watch the word `current` in `start_as_current_span`: it attaches the new span to whatever is active. That is the whole magic of context.

```python
from opentelemetry import trace

tracer = trace.get_tracer("support-agent")

def handle(user_msg: str):
    with tracer.start_as_current_span("invoke_agent support-agent") as root:
        root.set_attribute("gen_ai.operation.name", "invoke_agent")
        root.set_attribute("gen_ai.agent.name", "support-agent")

        with tracer.start_as_current_span("chat claude-sonnet-4-5") as llm:
            llm.set_attribute("gen_ai.operation.name", "chat")
            llm.set_attribute("gen_ai.request.model", "claude-sonnet-4-5")
            # the actual model call goes here
```

::: warning A common misunderstanding
A span is not "a log with extra fields". Logs are **discrete events**; spans are **intervals with a lifecycle**. Only an interval can answer "of these 6.4 seconds, 3.2 were spent in the second turn".
:::

## 02 Why OpenTelemetry won {#otel}

Think of OTel as a **standard wall socket**. Every APM vendor used to ship its own plug; switching backends meant tearing the wall open. OTel standardises the plug: you plug in, and whatever is behind the wall — grid, generator, solar — is someone else's problem.

<Diagram id="otel-pipeline" />

It only does three things:

1. **API / SDK**: create spans, metrics and logs inside your process.
2. **OTLP**: one wire protocol (gRPC 4317 / HTTP 4318) to ship them out.
3. **Collector**: a separate process for batching, sampling, redaction and routing. Business code never learns which backend exists.

Why the agent world settled on it:

- **Vendor neutral**: Langfuse today, Datadog tomorrow, zero rewrite.
- **Semantic conventions**: `gen_ai.*` field names were agreed across vendors, so tools parse them automatically.
- **Ecosystem**: LangGraph, CrewAI, LlamaIndex and MCP SDKs all have instrumentation packages.
- **Official alignment**: Anthropic exports OTel metrics and events natively from Claude Code; the OpenAI Agents SDK ships tracing with a `TracingProcessor` you can point at any OTLP backend.

| Aspect | Home-grown telemetry | OpenTelemetry |
| --- | --- | --- |
| Time to first span | Low (who can't log) | Medium (learn the lifecycle) |
| Switching backend | Rewrite | Change one endpoint |
| Cross-service stitching | Roll your own ids | W3C headers, propagated for free |
| Field naming | Invented per team | `gen_ai.*` conventions |
| Sampling / redaction | Write it yourself | One Collector config block |

Initialisation happens once, usually at startup:

```python
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

provider = TracerProvider(
    resource=Resource.create({
        "service.name": "support-agent",
        "deployment.environment.name": "prod",
    })
)
provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint="http://collector:4318/v1/traces"))
)
trace.set_tracer_provider(provider)
```

`BatchSpanProcessor` matters: it ships asynchronously in batches, so your model call never waits for the network. Chapter 14 tunes it for high concurrency.

## 03 GenAI attributes for LLM spans {#genai-attrs}

A plain HTTP span needs `http.method` and `http.status_code`. An LLM span needs more: which model, how many tokens, and why it stopped.

<Diagram id="genai-attrs" />

| Attribute | Where | Example | Note |
| --- | --- | --- | --- |
| `gen_ai.operation.name` | All GenAI spans | `chat` / `invoke_agent` / `execute_tool` | Drives the span name |
| `gen_ai.provider.name` | Model calls | `anthropic` / `openai` / `aws.bedrock` | Was `gen_ai.system` |
| `gen_ai.request.model` | Model calls | `claude-sonnet-4-5` | What you asked for |
| `gen_ai.response.model` | Model calls | `claude-sonnet-4-5-20250929` | What actually answered |
| `gen_ai.usage.input_tokens` | Model calls | `1204` | Was `prompt_tokens` |
| `gen_ai.usage.output_tokens` | Model calls | `210` | Was `completion_tokens` |
| `gen_ai.response.finish_reasons` | Model calls | `["tool_use"]` | Tells you about truncation |
| `gen_ai.tool.name` | Tool spans | `search_orders` | Pair with `error.type` |
| `gen_ai.agent.name` | Agent spans | `support-agent` | Required in multi-agent |

Three details that bite:

- **Name spans `{operation} {model}`**, e.g. `chat claude-sonnet-4-5`. Never interpolate user input: the cardinality will wreck your backend index.
- **Always record `finish_reasons`**. `length` means you hit max_tokens — the usual reason answers stop mid-sentence.
- **Cost is not a standard field.** Multiply tokens by price and store it as a custom attribute such as `cost.usd`. Chapter 03 has the formulas.

```python
PRICE = {"input": 3.0 / 1_000_000, "output": 15.0 / 1_000_000}

def record_usage(span, usage, model="claude-sonnet-4-5"):
    cost = usage.input_tokens * PRICE["input"] + usage.output_tokens * PRICE["output"]
    span.set_attribute("gen_ai.usage.input_tokens", usage.input_tokens)
    span.set_attribute("gen_ai.usage.output_tokens", usage.output_tokens)
    span.set_attribute("cost.usd", round(cost, 6))
    return cost
```

::: danger Do not stuff the full prompt into a span
Fields like `gen_ai.prompt` are a triple threat: **high cardinality, high privacy risk, high storage cost**. Store a hash, a length, or the first 80 redacted characters. Chapters 04 and 11 cover the rules.
:::

## 04 Propagation across services, MCP and A2A {#propagation}

<Diagram id="propagation" />

There is exactly one rule: **treat `traceparent` like any other header, carry it all the way, and never invent your own id.**

```
traceparent: 00-4f9c1d2e8a7b4c6d9e0f1a2b3c4d5e6f-a12b3c4d5e6f7a8b-01
             │  │                                │                │
             │  │                                │                └─ sampled flag
             │  │                                └─ current span id (16 hex)
             │  └─ trace id (32 hex)
             └─ version
```

| Hop | How to carry it | Common failure |
| --- | --- | --- |
| Service to service | `traceparent` / `tracestate` headers | Gateway header allow-list drops it |
| MCP call | `_meta.traceparent` in request params | Server starts a fresh root span |
| A2A message | `Message.metadata` or HTTP headers | Only `taskId` is passed |
| Message queue | Message attributes / headers | Consumer never extracts, trace dies at the queue |

```python
from opentelemetry import propagate, trace

# Producer: inject the active context into headers
headers = {}
propagate.inject(headers)
requests.post("http://mcp-server/tools/search_orders", headers=headers, json=payload)

# Consumer: restore it, then spans attach to the same trace automatically
ctx = propagate.extract(request.headers)
with tracer.start_as_current_span("execute_tool search_orders", context=ctx):
    ...
```

Three causes of broken chains, ordered by frequency:

1. **Async work lost the context** (across `asyncio.create_task` or a thread pool boundary).
2. **Middleware rebuilt the context** (a second `TracerProvider`, for instance).
3. **Sampling decisions disagree** upstream and downstream.

## 05 Sync, streaming, long jobs and loops {#task-types}

<Diagram id="task-types" />

| Task shape | How to span it | Key attributes | Trap |
| --- | --- | --- | --- |
| Sync | One in, one out | duration, status | None |
| Streaming | **One span for the whole stream**, never per token | `ttft.ms`, `chunks` | A span per chunk floods the backend |
| Long job | **Span link** back to the trigger | `task.id`, `queue.wait.ms` | Forcing parentage creates a 6-hour-tall tree |
| Multi-turn loop | One `chat` span per turn, one `invoke_agent` around them | `agent.turn`, `loop.count` | Recording only the last turn |

Streaming, done right: open one span, note when the first token lands, record the error type if the stream breaks.

```python
with tracer.start_as_current_span("chat claude-sonnet-4-5") as span:
    span.set_attribute("gen_ai.operation.name", "chat")
    span.set_attribute("stream", True)
    first = None
    chunks = 0
    for chunk in stream:
        if first is None:
            first = time.perf_counter()
            span.set_attribute("ttft.ms", round((first - started) * 1000))
        chunks += 1
        yield chunk
    span.set_attribute("chunks", chunks)
```

Long jobs are the opposite: never hold one span open for six hours. Use a link so "who triggered it" and "when it actually ran" stay separate.

```python
links = [trace.Link(trigger_span.get_span_context())]
with tracer.start_as_current_span("batch_agent nightly-report", links=links):
    ...
```

## Health metrics for your telemetry {#health}

Instrumentation gets sick too. Four metrics on the pipeline itself cost far less than a week of suspicion:

| Metric | Definition | Healthy | What a spike means |
| --- | --- | --- | --- |
| Sample rate | Exported / requested | Per policy | Exporter died |
| Span completeness | Spans with a known parent | > 98% | Broken chains |
| Orphan rate | Root spans with no parent | < 2% | Propagation missing |
| Export latency P95 | Span end to storage | < 30s | Queue backlog |

## Pitfalls {#pitfalls}

::: warning Five mistakes that account for most of the pain
1. **User input as a span name.** Cardinality explosion; the backend gives up.
2. **One span per token.** Streaming alone can generate tens of millions of useless rows a day.
3. **Only instrumenting the happy path.** Call `span.record_exception()` and `set_status(ERROR)` on failure.
4. **Hard-coding the backend endpoint.** Use environment variables and a Collector.
5. **Forgetting `service.name`.** Every service becomes `unknown_service`, which is the same as no telemetry.
:::

## Recap {#recap}

- A trace is the itinerary, spans are the legs; trace id stitches services, parent span id builds the tree.
- OTel is the standard socket: SDK collects, OTLP ships, Collector processes, business code stays ignorant.
- Six GenAI attributes cover most needs: operation, provider, model, input/output tokens, finish reasons.
- Propagation is just "don't invent ids": HTTP headers, MCP `_meta`, A2A metadata.
- One span per stream, links for long jobs, one span per turn for loops.

Next we turn these mechanics into eight tracing patterns: ReAct loops, streaming chunks, layered spans, A2A, MCP, memory, sessions and error snapshots.

## Further reading {#reading}

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/): the authoritative field list.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/): the `traceparent` definition.
- [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/): built-in tracing and custom processors.
- [Chapter 02 End-to-end tracing patterns](/en/traces/): turning these mechanics into eight patterns.
