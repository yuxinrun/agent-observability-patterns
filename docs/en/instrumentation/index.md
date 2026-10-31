---
title: 08 · Instrumentation patterns you can copy
description: Four low-intrusion approaches — decorators, middleware, lifecycle callbacks and async queues — plus five anti-patterns that blow up costs.
outline: [2, 3]
---

# 08 · Instrumentation patterns you can copy

Instrumentation fails in two ways: **`set_attribute` scattered across business code**, and **a full rewrite when the framework changes**.

This chapter gives you four engineering patterns, from least intrusive to most controlled. Mix them as your team prefers.

::: tip Plain language
- **Decorator**: a jacket around a function; records entry and exit.
- **Middleware**: a gatekeeper at the door; every request passes through.
- **Callback**: the framework taps you on the shoulder at key moments.
- **Async queue**: drop events in a queue, let a worker deal with them later.
:::

## 01 Decorator instrumentation {#decorator}

<Diagram id="decorator-flow" />

```python
import functools, inspect
from opentelemetry import trace

tracer = trace.get_tracer("support-agent")

def traced(name: str, **attrs):
    def wrap(fn):
        if inspect.iscoroutinefunction(fn):
            @functools.wraps(fn)
            async def async_inner(*args, **kwargs):
                with tracer.start_as_current_span(name) as span:
                    for k, v in attrs.items():
                        span.set_attribute(k, v)
                    try:
                        result = await fn(*args, **kwargs)
                        span.set_attribute("outcome", "ok")
                        return result
                    except Exception as exc:
                        span.record_exception(exc)
                        span.set_status(trace.Status(trace.StatusCode.ERROR, type(exc).__name__))
                        raise
            return async_inner

        @functools.wraps(fn)
        def inner(*args, **kwargs):
            with tracer.start_as_current_span(name) as span:
                for k, v in attrs.items():
                    span.set_attribute(k, v)
                try:
                    return fn(*args, **kwargs)
                except Exception as exc:
                    span.record_exception(exc)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, type(exc).__name__))
                    raise
        return inner
    return wrap

@traced("execute_tool search_orders", **{"gen_ai.tool.name": "search_orders"})
def search_orders(user_id: str):
    return db.query(user_id)
```

TypeScript is shorter because decorators are first-class:

```ts
export function traced(name: string, attrs: Record<string, unknown> = {}) {
  return (_t: unknown, _k: string, desc: PropertyDescriptor) => {
    const original = desc.value
    desc.value = async function (...args: unknown[]) {
      return tracer.startActiveSpan(name, async (span) => {
        Object.entries(attrs).forEach(([k, v]) => span.setAttribute(k, v as any))
        try {
          return await original.apply(this, args)
        } catch (err: any) {
          span.recordException(err)
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
          throw err
        } finally {
          span.end()
        }
      })
    }
    return desc
  }
}
```

| Pros | Cons |
| --- | --- |
| Business code barely changes | Only covers decorated functions |
| Arguments and exceptions handled for you | Deep nesting is hard to debug |
| Great for tools and service methods | Wrong for streams and long-lived objects |

## 02 Middleware instrumentation {#middleware}

<Diagram id="middleware-layers" />

Middleware fits wherever every request must pass: HTTP ingress, gateways, database drivers, SDKs.

```python
# FastAPI / Starlette: one middleware covers every entry point
@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    ctx = propagate.extract(request.headers)
    with tracer.start_as_current_span(
        f"{request.method} {request.url.path}", context=ctx
    ) as span:
        span.set_attribute("http.request.method", request.method)
        span.set_attribute("url.path", request.url.path)
        span.set_attribute("tenant.id", request.headers.get("x-tenant", "unknown"))
        response = await call_next(request)
        span.set_attribute("http.response.status_code", response.status_code)
        if response.status_code >= 500:
            span.set_status(trace.Status(trace.StatusCode.ERROR))
        response.headers["traceparent"] = format_traceparent(span)
        return response
```

| Context | Where the middleware goes |
| --- | --- |
| Web service | ASGI / Express / Gin middleware |
| Gateway | Between ingress and forwarding |
| Message queue | Both producer and consumer |
| Database | Driver level (usually existing instrumentation) |

::: tip Middleware is the best value in this chapter
Twenty lines buys automatic trace ids, status codes, tenant and latency for every endpoint. Far better than repeating that in 200 handlers.
:::

## 03 Lifecycle callbacks {#callback}

<Diagram id="callback-life" />

Agent SDKs usually expose lifecycle hooks. With the OpenAI Agents SDK you can implement your own processor:

```python
from agents.tracing import TracingProcessor

class OTelProcessor(TracingProcessor):
    def on_trace_start(self, trace):
        self._spans[trace.trace_id] = tracer.start_span(
            f"agent.run {trace.name}", attributes={"agent.run.id": trace.trace_id}
        )

    def on_span_start(self, span):
        parent = self._spans.get(span.trace_id)
        self._spans[span.span_id] = tracer.start_span(
            span.span_data.type, context=trace.set_span_in_context(parent)
        )

    def on_span_end(self, span):
        s = self._spans.pop(span.span_id, None)
        if s:
            s.set_attribute("agents.span.type", span.span_data.type)
            s.end()

    def on_trace_end(self, trace):
        s = self._spans.pop(trace.trace_id, None)
        if s:
            s.end()
```

For a home-grown agent, the same idea with four hooks:

| Hook | What it records |
| --- | --- |
| `on_start` | Task id, tenant, input size, model config |
| `on_tool` | Tool name, argument digest, status, duration |
| `on_error` | Exception type, stage, reproduction snapshot |
| `on_finish` | Turns, total tokens, total cost, stop reason |

::: warning Never do heavy work in a callback
Callbacks run on the business thread. HTTP export, database writes and regex redaction there all add to user latency. Callbacks **assemble** data; a background queue sends it.
:::

## 04 Async queue instrumentation {#async}

<Diagram id="async-queue" />

Under load, synchronous export becomes the bottleneck. Do this instead: **the business thread only enqueues; a worker exports in batches.**

```python
import asyncio, contextvars

queue: asyncio.Queue = asyncio.Queue(maxsize=10_000)

def emit(event: dict):
    ctx = contextvars.copy_context()          # critical: carry the context along
    try:
        queue.put_nowait((ctx, event))
    except asyncio.QueueFull:
        metrics.add(1, {"dropped": True})     # drop rather than block the request

async def exporter():
    batch = []
    while True:
        ctx, event = await queue.get()
        batch.append(event)
        if len(batch) >= 200:
            ctx.run(flush, batch)             # send inside the original context
            batch.clear()
```

| Parameter | Suggested | Note |
| --- | --- | --- |
| Queue size | 5k–20k | Too small drops, too large eats RAM |
| Batch size | 200–512 | Match the backend's limit |
| Flush interval | 1–5s | How stale your view is during an incident |
| Overflow policy | Drop and count | Never block the main path |
| Shutdown | Graceful flush | Drain before the process exits |

## 05 Instrumentation anti-patterns {#anti-patterns}

<Diagram id="anti-pattern" />

| Anti-pattern | Symptom | Consequence | Do instead |
| --- | --- | --- | --- |
| Over-instrumentation | A span per line | Storage blowup, unreadable trees | Spans only at boundaries |
| Full-text storage | Prompt and response saved whole | Privacy and cost | Hash, truncate, redact |
| Synchronous export | Every call waits on the network | P95 doubles | Batch and go async |
| Business logic in spans | Spans mutate state | Telemetry changes outcomes | Read-only, always |
| Store everything | "It's cheap" | The invoice teaches you in three months | Head and tail sampling |

```python
# Counter-example: business judgement inside instrumentation
with tracer.start_as_current_span("checkout") as span:
    if span.is_recording():          # looks harmless
        user.vip = True              # but it mutates business state
```

::: danger The first rule of observability
**Observation must not change the observed.** Once instrumentation alters behaviour, none of your data can be trusted.
:::

## Instrumentation quality metrics {#board-sample}

| Metric | Definition | Healthy |
| --- | --- | --- |
| Coverage | Critical paths with spans / all critical paths | > 90% |
| Orphan span rate | Spans without a parent | < 2% |
| Drop rate | Queue overflows / total events | < 0.1% |
| Overhead | P95 added by instrumentation | < 3% |
| Field completeness | Spans with all required attributes | > 95% |

## Pitfalls {#pitfalls}

::: warning Five instrumentation traps
1. **A decorator wrapped around a streaming generator.** The function returns, the span ends, the remaining tokens vanish.
2. **Creating a TracerProvider inside middleware.** Context breaks; the trace splits in two.
3. **Synchronous HTTP inside a callback.** User latency doubles.
4. **An unbounded queue.** Memory grows, the OOM killer arrives, telemetry dies with the process.
5. **Instrumenting only the happy path.** Failure paths are where you need data most.
:::

## Recap {#recap}

- Decorators for business functions, middleware for ingress, callbacks for frameworks, queues for load.
- Never wrap a stream's return value; wrap the whole generation.
- Callbacks assemble; queues ship.
- Queues need bounds and drop counters; losing data beats blocking users.
- Observation never changes behaviour.

Next we arrange all of this into six production dashboards.

## Further reading {#reading}

- [OpenTelemetry Python instrumentation](https://opentelemetry.io/docs/languages/python/instrumentation/): the official manual approach.
- [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/): the `TracingProcessor` interface.
- [Chapter 02 End-to-end tracing patterns](/en/traces/): the tree these patterns must produce.
- [Chapter 14 Scaling](/en/scale/): tuning queues and sampling under load.
