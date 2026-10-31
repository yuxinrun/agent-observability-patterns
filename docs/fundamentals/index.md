---
title: 01 · 基础概念：底层原理一次讲透
description: Trace、Span、TraceID、上下文透传、OpenTelemetry 与 GenAI 语义约定，一次讲成人话。
outline: [2, 3]
---

# 01 · 基础概念：底层原理一次讲透

一句话：**Trace 是一次任务的行程单，Span 是行程单上的每一段路。**

你点了一单外卖。平台会在后台记下：接单、出餐、骑手取餐、上楼、送达。整单叫 Trace，每一段叫 Span。如果只记「已送达」，骑手迟到 40 分钟你也说不清是商家慢还是路上堵。

Agent 一模一样。一次「帮我查下订单能不能退」，中间有 3 轮模型思考、2 次工具调用、1 次记忆召回。**没有 Trace，你只看见「已完成」。**

::: tip 人话翻译
- **Span**：一段有开始、有结束、有结果的工作。像行程单上的一行。
- **Trace**：同一个任务下所有 span 串起来的一棵树。像整张行程单。
- **TraceID**：这单的编号。跨服务、跨机器都靠它认亲。
- **SpanID / ParentSpanID**：这一段自己的编号，以及上一段的编号。
- **上下文透传**：把「这单的编号」一路带在请求头上，别让下一跳自己重新编一个。
:::

## 01 什么是 Trace、Span、TraceID 与上下文 {#trace-span}

一张典型的 Agent span 树长这样：宽度是耗时，缩进是父子关系。

<Diagram id="span-tree" />

| 概念 | 生活类比 | 技术含义 | 排查时看什么 |
| --- | --- | --- | --- |
| Trace | 整张外卖单 | 一次端到端任务 | 总耗时、总花费、最终状态 |
| Span | 单上的一行 | 一次有边界的操作 | 自己耗时、自己和兄弟的占比 |
| TraceID | 订单号 | 32 位十六进制，全局唯一 | 搜一条链路 |
| SpanID | 每行的行号 | 16 位十六进制 | 在树里定位 |
| ParentSpanID | 「上一行是哪行」 | 父 span 的 SpanID | 修断链 |
| Attributes | 备注栏 | 键值对，可被聚合 | 模型、token、工具名、租户 |

最小可用代码只有八行。注意 `start_as_current_span` 的「current」——它会把新 span 自动挂到当前 span 下面，这就是「上下文」的全部魔法。

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
            # 真正调用模型的地方
```

::: warning 一个常见误解
Span 不是「日志的另一种写法」。日志是**离散事件**，Span 是**有生命周期的区间**。只有区间才能回答「这 6.4 秒里，3.2 秒花在第二轮模型上」这种问题。
:::

## 02 OpenTelemetry 是什么，为什么它是事实标准 {#otel}

把 OTel 想成**国标插座**。以前每家 APM 厂商自己的插头（私有 agent、私有协议），换个后端就得把墙砸了重装。OTel 把插头标准化：你只管插，后面接电网、接发电机、接太阳能都行。

<Diagram id="otel-pipeline" />

它只做三件事：

1. **API / SDK**：在你的进程里生成 span、metric、log。
2. **OTLP**：一套传输协议（gRPC 4317 / HTTP 4318），把数据送出去。
3. **Collector**：一个独立进程，负责批处理、采样、脱敏、路由。业务代码永远不认识后端。

为什么 Agent 圈子认它？

- **厂商中立**：今天 Langfuse，明天 Datadog，埋点不用重写。
- **语义约定**：`gen_ai.*` 这套字段名是跨厂商商量出来的，工具能自动解析。
- **生态齐**：LangGraph、CrewAI、LlamaIndex、MCP SDK 都有现成的 instrumentation 包。
- **官方对齐**：Anthropic 在 Claude Code 里原生导出 OTel 指标与事件；OpenAI Agents SDK 内置 tracing，用 `TracingProcessor` 就能把 span 转发到任意 OTLP 后端。

| 对比项 | 自研埋点 | OpenTelemetry |
| --- | --- | --- |
| 上手成本 | 低（打日志谁不会） | 中（要理解 span 生命周期） |
| 换后端 | 重写 | 改一个 endpoint |
| 跨服务串联 | 自己编 ID、自己传 | W3C 标准头，自动透传 |
| 字段规范 | 各家自创 | `gen_ai.*` 语义约定 |
| 采样 / 脱敏 | 自己写 | Collector 一行配置 |

初始化只需要一次，通常放在应用启动处：

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

`BatchSpanProcessor` 是重点：它异步批量发送，不阻塞你的模型调用。第 14 章会专门讲它在高并发下的参数。

## 03 GenAI 扩展属性：LLM 专属标签 {#genai-attrs}

普通 HTTP span 只需要 `http.method`、`http.status_code`。LLM span 不够——你还得知道用的是哪个模型、烧了多少 token、为什么停下来。

<Diagram id="genai-attrs" />

| 属性 | 用在哪 | 示例值 | 备注 |
| --- | --- | --- | --- |
| `gen_ai.operation.name` | 所有 GenAI span | `chat` / `invoke_agent` / `execute_tool` | 决定 span 名字 |
| `gen_ai.provider.name` | 模型调用 | `anthropic` / `openai` / `aws.bedrock` | 旧版叫 `gen_ai.system` |
| `gen_ai.request.model` | 模型调用 | `claude-sonnet-4-5` | 请求侧模型 |
| `gen_ai.response.model` | 模型调用 | `claude-sonnet-4-5-20250929` | 实际落地的快照 |
| `gen_ai.usage.input_tokens` | 模型调用 | `1204` | 旧版叫 `prompt_tokens` |
| `gen_ai.usage.output_tokens` | 模型调用 | `210` | 旧版叫 `completion_tokens` |
| `gen_ai.response.finish_reasons` | 模型调用 | `["tool_use"]` | 判断是不是被截断 |
| `gen_ai.tool.name` | 工具 span | `search_orders` | 配合 `error.type` |
| `gen_ai.agent.name` | Agent span | `support-agent` | 多 Agent 必填 |

三个容易踩的细节：

- **span 名字用 `{operation} {model}`**，例如 `chat claude-sonnet-4-5`。不要用用户输入拼名字，高基数会把后端索引撑爆。
- **`finish_reasons` 一定要记**。`length` 表示被 max_tokens 截断，这是「答案突然断掉」的最常见原因。
- **cost 不是标准字段**。用 token 乘单价自己算，写进 `cost.usd` 这类自定义属性。第 03 章会给完整公式。

```python
PRICE = {"input": 3.0 / 1_000_000, "output": 15.0 / 1_000_000}

def record_usage(span, usage, model="claude-sonnet-4-5"):
    cost = usage.input_tokens * PRICE["input"] + usage.output_tokens * PRICE["output"]
    span.set_attribute("gen_ai.usage.input_tokens", usage.input_tokens)
    span.set_attribute("gen_ai.usage.output_tokens", usage.output_tokens)
    span.set_attribute("cost.usd", round(cost, 6))
    return cost
```

::: danger 别把 prompt 全文塞进 span
`gen_ai.prompt` 这类字段是**高基数 + 高隐私风险 + 高存储成本**的三重炸弹。存 hash、存长度、存前 80 个字符（脱敏后）都比存全文好。第 04、11 章会讲具体规范。
:::

## 04 跨服务、跨 MCP、跨 A2A 怎么传 trace_id {#propagation}

<Diagram id="propagation" />

规则只有一条：**把 `traceparent` 当成普通请求头，一路带下去，谁都别自己发明 ID。**

```
traceparent: 00-4f9c1d2e8a7b4c6d9e0f1a2b3c4d5e6f-a12b3c4d5e6f7a8b-01
             │  │                                │                │
             │  │                                │                └─ 采样标记
             │  │                                └─ 当前 span id（16 hex）
             │  └─ trace id（32 hex）
             └─ 版本
```

| 链路 | 怎么带 | 常见错误 |
| --- | --- | --- |
| HTTP 服务间 | `traceparent` / `tracestate` 请求头 | 网关转发时把 header 白名单漏了 |
| MCP 调用 | 请求参数的 `_meta.traceparent` | Server 侧新建了一个 root span |
| A2A 消息 | `Message.metadata` 或 HTTP 头 | 只传了 taskId，没传 trace 上下文 |
| 消息队列 | 写进消息属性（headers） | 消费端没有 extract，链路断在队列 |

```python
from opentelemetry import propagate, trace

# 发送方：把当前上下文注入到 header
headers = {}
propagate.inject(headers)
requests.post("http://mcp-server/tools/search_orders", headers=headers, json=payload)

# 接收方：从 header 恢复上下文，后续 span 自动挂到同一条 trace
ctx = propagate.extract(request.headers)
with tracer.start_as_current_span("execute_tool search_orders", context=ctx):
    ...
```

断链的三大原因，按出现频率排序：

1. **异步任务没有传 context**（丢在 `asyncio.create_task` 或线程池边界）。
2. **中间件重建了上下文**（比如自己 `new TracerProvider`）。
3. **采样决策不一致**（上游采了、下游没采，或反过来）。

## 05 同步、流式、长任务、多轮循环的追踪差异 {#task-types}

<Diagram id="task-types" />

| 任务类型 | span 怎么开 | 关键属性 | 坑 |
| --- | --- | --- | --- |
| 同步 | 一进一出，最简单 | 耗时、状态 | 无 |
| 流式 | **整个流一个 span**，不按 token 建 span | `ttft.ms`、`chunks` | 每片建 span → 后端被淹 |
| 长任务 | 用 **Span Link** 连回触发点 | `task.id`、`queue.wait.ms` | 强行父子 → 树长到 6 小时 |
| 多轮循环 | 每轮一个 `chat` span，外层一个 `invoke_agent` | `agent.turn`、`loop.count` | 只记最后一轮 |

流式追踪的正确姿势：一个 span 从头开到尾，首字到达时记一笔，异常中断时把 `error.type` 写上。

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

长任务则相反：不要让一个 span 挂 6 小时，用链接（Link）把「谁触发的」和「什么时候真正开始跑」分开记。

```python
links = [trace.Link(trigger_span.get_span_context())]
with tracer.start_as_current_span("batch_agent nightly-report", links=links):
    ...
```

## 链路自身的体检指标 {#health}

埋点也会生病。给自己配四个指标，比事后怀疑人生便宜得多：

| 指标 | 定义 | 健康线 | 异常含义 |
| --- | --- | --- | --- |
| 采样率 | 实际上报 / 实际请求 | 按策略 | 突降说明 exporter 挂了 |
| Span 完整率 | 有父有子的 span 占比 | > 98% | 低说明断链 |
| 断链率 | 无 parent 的 root span 占比 | < 2% | 高说明透传漏了 |
| 上报延迟 P95 | span 结束到入库 | < 30s | 高说明队列积压 |

## 避坑清单 {#pitfalls}

::: warning 这一章最容易犯的五个错
1. **用用户输入当 span 名**。高基数，后端直接跪。
2. **每个 token 建一个 span**。流式场景下一天能产出几千万条垃圾。
3. **只记成功路径**。异常时 `span.record_exception()` 和 `set_status(ERROR)` 都要写。
4. **在业务代码里硬编码后端地址**。应该走环境变量 + Collector。
5. **忘了 `service.name`**。所有服务都叫 `unknown_service`，等于没埋。
:::

## 小结 {#recap}

- Trace 是行程单，Span 是每一段路；TraceID 让跨服务认亲，ParentSpanID 让树长对。
- OTel 是国标插座：SDK 采集、OTLP 传输、Collector 加工，业务代码不认识后端。
- GenAI 属性只需记住六件套：operation、provider、model、input/output tokens、finish_reasons。
- 透传的本质是「别自己发明 ID」，HTTP 头、MCP `_meta`、A2A metadata 都能带。
- 流式一个 span，长任务用 Link，多轮每轮一个 span。

下一章进入模式核心：ReAct 循环、流式分片、分层 span、A2A、MCP、记忆、会话、错误断点，八种追踪模式逐个拆。

## 延伸阅读 {#reading}

- [OpenTelemetry 语义约定：GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/)：字段的最终解释权。
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)：`traceparent` 的官方定义。
- [OpenAI Agents SDK Tracing](https://openai.github.io/openai-agents-python/tracing/)：内置 tracing 与自定义 processor。
- [第 02 章 全链路追踪模式](/traces/)：把这一章的概念拼成八种可落地的模式。
