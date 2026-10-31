---
title: 13 · The runnable demo kit
description: Minimal Python OTel, LangGraph with OpenLLMetry, CrewAI with Langfuse, A2A propagation, MCP instrumentation, alert and dashboard templates, and a one-command Langfuse stack.
outline: [2, 3]
---

# 13 · The runnable demo kit

The goal is modest: **copy, paste, `python demo.py`, see a trace.**

Every demo follows three rules: standard OTel fields, support for `OTEL_EXPORTER_OTLP_ENDPOINT`, and the ability to point at a local Collector or Langfuse.

<Diagram id="demo-stack" />

::: tip Minimal setup
```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http
docker run -d --name jaeger -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```
Open `http://localhost:16686` and the trace is there.
:::

## 01 Minimal Python OTel demo {#otel-python}

A "fake agent": two model turns and one tool call. Realistic shape, zero dependencies.

<Diagram id="demo-trace" />

```python
# demo_otel.py
import os, time, random
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

provider = TracerProvider(resource=Resource.create({"service.name": "support-agent"}))
provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(
        endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318") + "/v1/traces"
    ))
)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("demo")

PRICE = {"in": 3.0 / 1e6, "out": 15.0 / 1e6}

def fake_llm(prompt, out_tokens):
    time.sleep(random.uniform(0.2, 0.6))
    return "Sure, let me check that for you.", out_tokens

def search_orders(user_id):
    time.sleep(random.uniform(0.05, 0.2))
    if random.random() < 0.1:
        raise TimeoutError("orders.search timeout")
    return [{"id": "A10293", "status": "shipped"}]

def run(task):
    with tracer.start_as_current_span("invoke_agent support-agent") as root:
        root.set_attribute("gen_ai.operation.name", "invoke_agent")
        root.set_attribute("gen_ai.agent.name", "support-agent")
        root.set_attribute("tenant.id", "acme")
        total_cost = 0.0

        with tracer.start_as_current_span("agent.turn 1") as turn:
            turn.set_attribute("agent.turn", 1)
            with tracer.start_as_current_span("chat claude-sonnet-4-5") as llm:
                text, out = fake_llm(task, 96)
                in_tok = 812
                llm.set_attribute("gen_ai.operation.name", "chat")
                llm.set_attribute("gen_ai.request.model", "claude-sonnet-4-5")
                llm.set_attribute("gen_ai.usage.input_tokens", in_tok)
                llm.set_attribute("gen_ai.usage.output_tokens", out)
                llm.set_attribute("gen_ai.response.finish_reasons", ["tool_use"])
                total_cost += in_tok * PRICE["in"] + out * PRICE["out"]

            with tracer.start_as_current_span("execute_tool search_orders") as tool:
                tool.set_attribute("gen_ai.operation.name", "execute_tool")
                tool.set_attribute("gen_ai.tool.name", "search_orders")
                try:
                    rows = search_orders("u_1")
                    tool.set_attribute("tool.result.rows", len(rows))
                except Exception as exc:
                    tool.record_exception(exc)
                    tool.set_status(trace.Status(trace.StatusCode.ERROR, type(exc).__name__))
                    tool.set_attribute("error.type", type(exc).__name__)
                    root.set_attribute("agent.stop_reason", "tool_error")
                    raise

        root.set_attribute("agent.stop_reason", "final")
        root.set_attribute("agent.turns", 1)
        root.set_attribute("cost.usd", round(total_cost, 6))
        return "Your order A10293 has shipped."

if __name__ == "__main__":
    print(run("Where is my order?"))
    provider.shutdown()   # mandatory: otherwise buffered spans may be lost
```

::: warning 90% of "the demo runs but the platform is empty" cases are this line
`provider.shutdown()` (or `force_flush()`). The script exits, the background queue has not flushed, the data is gone.
:::

## 02 LangGraph with OpenLLMetry {#langgraph}

OpenLLMetry takes over LangChain and LangGraph internals with one `Traceloop.init()`.

```bash
pip install traceloop-sdk openinference-instrumentation-langchain
pip install langgraph langchain-anthropic
export TRACELOOP_BASE_URL=http://localhost:4318
export TRACELOOP_TELEMETRY=false          # disable its own usage reporting
```

```python
# demo_langgraph.py
from traceloop.sdk import Traceloop
Traceloop.init(app_name="support-graph", disable_batch=True)

from typing import TypedDict
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-5", temperature=0)

class State(TypedDict):
    question: str
    answer: str

def answer(state: State):
    resp = llm.invoke(state["question"])
    return {"answer": resp.content}

graph = StateGraph(State)
graph.add_node("answer", answer)
graph.set_entry_point("answer")
graph.add_edge("answer", END)
app = graph.compile()

if __name__ == "__main__":
    print(app.invoke({"question": "Where is order A10293?"}))
```

OpenLLMetry emits `langchain.*` and `gen_ai.*` spans with provider, model and tokens already filled. You only add business fields:

```python
from opentelemetry import trace
trace.get_current_span().set_attribute("tenant.id", "acme")
```

## 03 CrewAI with Langfuse {#crewai}

Langfuse ships a drop-in OpenAI wrapper and an `@observe` decorator, which makes CrewAI integration short.

```bash
pip install langfuse crewai
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_HOST=http://localhost:3000
```

```python
# demo_crew.py
from langfuse import observe
from langfuse.openai import OpenAI          # drop-in replacement
from crewai import Agent, Task, Crew

client = OpenAI()

@observe(name="research-task")
def build_crew():
    researcher = Agent(
        role="Order specialist",
        goal="Look up order status from a user question",
        backstory="You know every shipping status code by heart.",
        llm="gpt-4o-mini",
    )
    task = Task(
        description="Look up order A10293 and explain the status in plain language",
        expected_output="One-sentence conclusion plus the status code",
        agent=researcher,
    )
    return Crew(agents=[researcher], tasks=[task])

if __name__ == "__main__":
    result = build_crew().kickoff()
    print(result)
```

::: tip Mixing is fine
CrewAI's own traces live in Langfuse, and an OTel collector can ingest at the same time. Join them by `trace_id`; you do not have to choose.
:::

## 04 A2A trace propagation {#a2a}

Two processes, a planner and a researcher, joined by `metadata.traceparent`.

```python
# researcher_server.py — the delegate
from fastapi import FastAPI, Request
from opentelemetry import propagate, trace

app = FastAPI()
tracer = trace.get_tracer("researcher")

@app.post("/a2a")
async def receive(request: Request):
    body = await request.json()
    ctx = propagate.extract({"traceparent": body.get("metadata", {}).get("traceparent", "")})
    with tracer.start_as_current_span("invoke_agent research-agent", context=ctx) as span:
        span.set_attribute("gen_ai.agent.name", "research-agent")
        span.set_attribute("a2a.caller", body["metadata"].get("caller.agent"))
        span.set_attribute("delegation.depth", body["metadata"].get("delegation.depth", 1))
        return {"status": "completed", "result": "A10293 shipped, arriving tomorrow."}
```

```python
# planner_client.py — the delegator
import requests
from opentelemetry import propagate, trace

tracer = trace.get_tracer("planner")

def delegate(task, depth=0):
    headers = {}
    propagate.inject(headers)
    payload = {
        "message": {"role": "user", "parts": [{"kind": "text", "text": task}]},
        "metadata": {
            "traceparent": headers["traceparent"],
            "caller.agent": "planner-agent",
            "delegation.depth": depth + 1,
        },
    }
    with tracer.start_as_current_span("a2a.send research-agent") as span:
        span.set_attribute("a2a.target_agent", "research-agent")
        return requests.post("http://localhost:8001/a2a", json=payload).json()
```

## 05 Instrumenting MCP tools {#mcp}

One span on each side; the server must `extract`, never start a new root.

```python
# mcp_server.py
from mcp.server.fastmcp import FastMCP
from opentelemetry import propagate, trace

mcp = FastMCP("orders")
tracer = trace.get_tracer("orders-mcp")

@mcp.tool()
async def search_orders(user_id: str, _meta: dict | None = None):
    ctx = propagate.extract({"traceparent": (_meta or {}).get("traceparent", "")})
    with tracer.start_as_current_span("mcp.tool search_orders", context=ctx) as span:
        span.set_attribute("mcp.server", "orders-mcp")
        span.set_attribute("mcp.tool.is_error", False)
        rows = await db.query(user_id)
        span.set_attribute("mcp.result.rows", len(rows))
        return rows

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

```python
# mcp_client.py
from mcp import ClientSession
from opentelemetry import propagate, trace

tracer = trace.get_tracer("agent")

async def call(session: ClientSession):
    headers = {}
    propagate.inject(headers)
    with tracer.start_as_current_span("execute_tool search_orders") as span:
        span.set_attribute("gen_ai.operation.name", "execute_tool")
        span.set_attribute("gen_ai.tool.name", "search_orders")
        result = await session.call_tool(
            "search_orders", {"user_id": "u_1"},
            meta={"traceparent": headers["traceparent"]},
        )
        span.set_attribute("mcp.tool.is_error", result.isError)
        return result
```

## 06 Alert rules and dashboard JSON {#alerts-json}

```yaml
# alerts.yaml — rename and use
groups:
  - name: agent-slo
    rules:
      - alert: AgentSuccessBelowSLO
        expr: |
          sum(rate(agent_tasks_total{status="completed"}[5m]))
          / sum(rate(agent_tasks_total[5m])) < 0.99
        for: 5m
        labels: { severity: P1, team: agent-platform }
        annotations:
          summary: "Agent success {{ $value | humanizePercentage }}, below the 99% SLO"
          trace: "{{ with index $labels \"sample_trace\" }}{{ . }}{{ end }}"
          runbook: "https://wiki/runbooks/agent-success"
```

```json
{
  "title": "Agent Overview",
  "panels": [
    { "type": "timeseries", "title": "Tasks / min",
      "targets": [{ "expr": "sum(rate(agent_tasks_total[5m])) * 60" }] },
    { "type": "stat", "title": "Success rate",
      "targets": [{ "expr": "sum(rate(agent_tasks_total{status=\"completed\"}[5m])) / sum(rate(agent_tasks_total[5m]))" }],
      "fieldConfig": { "defaults": { "unit": "percentunit", "thresholds": {
        "mode": "absolute", "steps": [{ "color": "red", "value": null },
        { "color": "orange", "value": 0.98 }, { "color": "green", "value": 0.99 }] } } } },
    { "type": "timeseries", "title": "Cost per task P95",
      "targets": [{ "expr": "histogram_quantile(0.95, sum by (le) (rate(agent_task_cost_bucket[15m])))" }] }
  ],
  "schemaVersion": 39,
  "refresh": "30s"
}
```

## 07 One-command self-hosted Langfuse {#langfuse-compose}

```yaml
# docker-compose.yml
services:
  langfuse:
    image: langfuse/langfuse:2
    depends_on: [db]
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/postgres
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: change-me-please
      SALT: change-me-too
      TELEMETRY_ENABLED: "false"
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
    volumes: ["langfuse-db:/var/lib/postgresql/data"]
volumes:
  langfuse-db:
```

```bash
docker compose up -d
# open http://localhost:3000, create a project, copy the keys
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000/api/public/otel
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic $(echo -n pk-lf-xxx:sk-lf-xxx | base64)"
python demo_otel.py
```

In production, replace `NEXTAUTH_SECRET` and `SALT` with random values and add ClickHouse plus object storage — raw event volume grows quickly.

## Demo acceptance table {#board-sample}

| Demo | What you should see | Common issue |
| --- | --- | --- |
| Python OTel | One root plus three children | No `shutdown()`, data lost |
| LangGraph | Nested `langchain` spans with tokens | `TRACELOOP_BASE_URL` unset |
| CrewAI | Trace and generations in Langfuse | Wrong key or host missing scheme |
| A2A | Two services, one trace | Metadata without traceparent |
| MCP | Client and server spans | Server started a new root |
| Alerts | Rules load in Prometheus | Metric names do not match |
| Langfuse | Traces on the home page | Wrong port or base path |

## Pitfalls {#pitfalls}

::: warning Five common demo blockers
1. **No flush or shutdown.** The script exits and the queue is lost.
2. **Endpoint missing `/v1/traces`.** The HTTP exporter needs the full path.
3. **`localhost` inside Docker.** In a container, localhost is the container.
4. **Langfuse host without `http://`.** The SDK fails silently.
5. **Missing model key** mistaken for broken telemetry.
:::

## Recap {#recap}

- Every demo uses standard OTel fields, so the backend is swappable.
- The minimal Python example carries the ReAct skeleton.
- LangGraph and CrewAI rely on existing instrumentation; add only business fields.
- A2A and MCP both hinge on "extract, do not create".
- Alert and dashboard templates are production-adjacent.
- Self-hosted Langfuse is fine for validation; production needs ClickHouse and object storage.

Next: scaling — how these settings change once QPS arrives.

## Further reading {#reading}

- [OpenTelemetry Python exporters](https://opentelemetry.io/docs/languages/python/exporters/): OTLP details.
- [OpenLLMetry quickstart](https://github.com/traceloop/openllmetry): supported frameworks.
- [Langfuse OTel ingestion](https://langfuse.com/docs/opentelemetry/get-started): endpoint and auth.
- [Chapter 14 Scaling](/en/scale/): turning demos into production.
