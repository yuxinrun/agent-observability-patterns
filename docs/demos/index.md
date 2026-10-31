---
title: 13 · 可运行 Demo 全套
description: Python OTel、LangGraph + OpenLLMetry、CrewAI + Langfuse、A2A 透传、MCP 埋点、告警与看板 JSON、Langfuse 一键启动。
outline: [2, 3]
---

# 13 · 可运行 Demo 全套

这一章的目标很朴素：**复制、粘贴、`python demo.py`，看到链路。**

所有 Demo 都遵守三个约定：使用 OTel 标准字段、支持 `OTEL_EXPORTER_OTLP_ENDPOINT` 环境变量、可以指向本地 Collector 或 Langfuse。

<Diagram id="demo-stack" />

::: tip 运行前的最小准备
```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http
docker run -d --name jaeger -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```
打开 `http://localhost:16686` 就能看到链路。
:::

## 01 Python 最简 OTel 埋点 {#otel-python}

一个「假 Agent」：两轮模型调用 + 一次工具调用，结构真实、依赖为零。

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
    return "好的，我来帮你查一下。", out_tokens

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
        return "你的订单 A10293 已发货。"

if __name__ == "__main__":
    print(run("我的订单到哪了？"))
    provider.shutdown()   # 必须：否则 Batch 队列里的 span 可能丢
```

::: warning 90% 的「Demo 正常但平台没数据」都是这一行
`provider.shutdown()`（或 `force_flush()`）。脚本结束时进程直接退出，后台队列还没发完，数据就没了。
:::

## 02 LangGraph + OpenLLMetry {#langgraph}

OpenLLMetry 用一行 `Traceloop.init()` 接管 LangChain / LangGraph 的内部调用。

```bash
pip install traceloop-sdk openinference-instrumentation-langchain
pip install langgraph langchain-anthropic
export TRACELOOP_BASE_URL=http://localhost:4318
export TRACELOOP_TELEMETRY=false          # 关闭它自己的使用统计
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
    print(app.invoke({"question": "订单 A10293 到哪了？"}))
```

OpenLLMetry 会自动产出 `langchain.*` 与 `gen_ai.*` span，并把 provider、model、token 填好。你要补的只有业务字段（租户、会话、任务 id）：

```python
from opentelemetry import trace
trace.get_current_span().set_attribute("tenant.id", "acme")
```

## 03 CrewAI + Langfuse {#crewai}

Langfuse 提供 drop-in 的 OpenAI 包装和 `@observe` 装饰器，接 CrewAI 很省事。

```bash
pip install langfuse crewai
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_HOST=http://localhost:3000
```

```python
# demo_crew.py
from langfuse import observe
from langfuse.openai import OpenAI          # drop-in 替换
from crewai import Agent, Task, Crew

client = OpenAI()

@observe(name="research-task")
def build_crew():
    researcher = Agent(
        role="订单查询专员",
        goal="根据用户问题查询订单状态",
        backstory="你熟悉所有物流状态码。",
        llm="gpt-4o-mini",
    )
    task = Task(
        description="查询订单 A10293 的状态并给出人话解释",
        expected_output="一句话结论 + 状态码",
        agent=researcher,
    )
    return Crew(agents=[researcher], tasks=[task])

if __name__ == "__main__":
    result = build_crew().kickoff()
    print(result)
```

::: tip 混用没问题
CrewAI 自己的 trace 在 Langfuse 里看，OTel 的 collector 也可以同时收。两者用 `trace_id` 关联即可，不必二选一。
:::

## 04 A2A 跨 Agent trace 透传 {#a2a}

两个进程，一个 planner，一个 researcher，靠 `metadata.traceparent` 串成一条链。

```python
# researcher_server.py —— 被委派方
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
        return {"status": "completed", "result": "A10293 已发货，预计明天送达。"}
```

```python
# planner_client.py —— 委派方
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

## 05 MCP 工具调用埋点 {#mcp}

客户端与服务端各一个 span，服务端必须 `extract` 而不是新建 root。

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

## 06 告警规则与看板 JSON {#alerts-json}

```yaml
# alerts.yaml —— 直接改名字就能用
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
          summary: "Agent 成功率 {{ $value | humanizePercentage }}，低于 SLO 99%"
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

## 07 自托管 Langfuse 一键启动 {#langfuse-compose}

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
# 打开 http://localhost:3000，创建项目，拿 public / secret key
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000/api/public/otel
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic $(echo -n pk-lf-xxx:sk-lf-xxx | base64)"
python demo_otel.py
```

生产环境请把 `NEXTAUTH_SECRET`、`SALT` 换成随机值，并加上 ClickHouse 与对象存储（导出的原始事件量很大）。

## Demo 验收表 {#board-sample}

| Demo | 你应该看到 | 常见问题 |
| --- | --- | --- |
| Python OTel | 1 个 root + 3 个子 span | 没 `shutdown()`，数据丢失 |
| LangGraph | `langchain` 嵌套 span + token | 没设 `TRACELOOP_BASE_URL` |
| CrewAI | Langfuse 里出现 trace 与 generation | key 配错或 host 少了协议 |
| A2A | 两个服务同一条 trace | metadata 没带 traceparent |
| MCP | 客户端 / 服务端双 span | Server 新建了 root |
| 告警 | 规则能在 Prometheus 里加载 | 指标名与实际不符 |
| Langfuse | 首页出现链路 | 端口或 base path 配错 |

## 避坑清单 {#pitfalls}

::: warning 跑 Demo 的五个常见卡点
1. **忘了 flush / shutdown**。脚本跑完就退出，队列里的数据全丢。
2. **endpoint 少写 `/v1/traces`**。HTTP exporter 需要完整路径。
3. **Docker 网络里用 `localhost`**。容器内的 localhost 是容器自己。
4. **Langfuse 的 host 少了 `http://`**。SDK 会静默失败。
5. **模型 key 没配**，却以为是观测配错了。
:::

## 小结 {#recap}

- 所有 Demo 都走标准 OTel 字段，换后端不用改代码。
- Python 最小示例覆盖了 ReAct 的骨架。
- LangGraph、CrewAI 靠现成 instrumentation，补业务字段即可。
- A2A 与 MCP 的核心都是「extract 而不是新建」。
- 告警与看板模板可以直接改进生产。
- Langfuse 自托管适合快速验证，生产要补 ClickHouse 与对象存储。

下一章讲规模化：当 QPS 上来之后，这些配置要怎么调。

## 延伸阅读 {#reading}

- [OpenTelemetry Python 导出器](https://opentelemetry.io/docs/languages/python/exporters/)：OTLP 配置细节。
- [OpenLLMetry 快速开始](https://github.com/traceloop/openllmetry)：支持的框架列表。
- [Langfuse OTel 接入](https://langfuse.com/docs/opentelemetry/get-started)：endpoint 与鉴权。
- [第 14 章 高并发与规模化](/scale/)：把 Demo 变成生产。
