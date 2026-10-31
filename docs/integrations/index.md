---
title: 07 · 集成实战：接进你的技术栈
description: 网关、MCP、A2A、记忆、调度框架，五个组件的埋点位置、上报字段与链路打通方式。
outline: [2, 3]
---

# 07 · 集成实战：接进你的技术栈

前面六章讲的是「观测本身」。这一章讲一个更现实的问题：**你的系统已经长出来了，怎么把管子接上去。**

好消息是，五个组件的接法高度相似：**在边界处开 span、把 `traceparent` 传下去、把关键业务字段挂上去。**

::: tip 人话翻译
集成不是「每个组件都装个 SDK」，而是问三个问题：
1. 这个组件的**边界**在哪（进出各是什么）？
2. 它**独有的信息**是什么（别人不知道的）？
3. 它会不会**自己造一个新的 trace**（这是断链的头号原因）？
:::

## 01 接入 llm-gateway-patterns {#gateway}

网关是全公司唯一的模型出口，所以它也是**唯一能保证 token 与成本准确的地方**。

<Diagram id="gateway-seq" />

```python
# 网关侧：一个请求一个 chat span，模型无关字段在这里统一补齐
async def chat(request):
    with tracer.start_as_current_span(f"chat {request.model}") as span:
        span.set_attribute("gen_ai.operation.name", "chat")
        span.set_attribute("gen_ai.provider.name", request.provider)
        span.set_attribute("gen_ai.request.model", request.model)
        span.set_attribute("gateway.route", request.route)      # 路由决策
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

| 网关该上报 | 为什么只能在网关做 |
| --- | --- |
| 真实 token 数 | 业务侧拿到的是估算值 |
| 路由与降级决策 | 只有网关知道走了哪个供应商 |
| 缓存命中 | 业务侧看到的是「很快返回」 |
| 限流与拒绝 | 429 在业务侧通常被吞掉 |
| 密钥 / 项目归属 | 用于租户计费 |

::: warning 网关最常见的错误：把上游错误变成 200
很多网关为了「体验友好」，把供应商的 429 / 500 包装成正常的 200 响应体。于是上游一片红，你的看板一片绿。**错误必须保留在状态码和 `error.type` 里。**
:::

## 02 接入 mcp-patterns {#mcp}

MCP 的集成重点不是「记录调用」，而是**让工具执行与 Agent 决策出现在同一棵树上**。

<Diagram id="mcp-integration" />

```python
# 客户端：调用前注入上下文
tp = inject_traceparent()
result = await session.call_tool(
    "search_orders",
    arguments={"user_id": uid},
    meta={"traceparent": tp, "tenant.id": tenant},
)

# 服务端（MCP Server）：恢复上下文，不要新建 root span
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

| 层次 | 上报内容 |
| --- | --- |
| Agent 侧 | 选了哪个工具、为什么选（`tool.selection.reason`） |
| 客户端 | 传输方式、等待耗时、重试次数 |
| 服务端 | 真实执行耗时、DB 耗时、返回行数、权限校验结果 |
| 平台侧 | 工具版本、Schema 变更 |

## 03 接入 a2a-patterns {#a2a}

A2A 的集成难点在于**信任边界**：远程 Agent 可能不属于你，但用户看到的是一条链路。

<Diagram id="a2a-integration" />

```python
# 发送方
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

# 接收方
ctx = propagate.extract({"traceparent": payload["metadata"]["traceparent"]})
with tracer.start_as_current_span("a2a.receive", context=ctx):
    ...
```

| 场景 | 建议 |
| --- | --- |
| 对方支持 traceparent | 直接续链，最理想 |
| 对方不支持 | 用 **Span Link** 关联，别伪造 parent |
| 跨公司 | 只传 trace id，不传 `tracestate` 里的内部信息 |
| 长任务 | 用 task 状态事件补齐，不要挂 2 小时的 span |

## 04 接入 agent-memory-patterns {#memory}

记忆层的观测价值被严重低估：**它既是延迟来源，也是「为什么答得不一样」的来源。**

<Diagram id="memory-integration" />

| 记忆操作 | span | 必填属性 |
| --- | --- | --- |
| 向量召回 | `memory.recall` | `top_k`、`memory.hit`、`similarity.max`、`embed.latency.ms` |
| 关键词召回 | `memory.recall.keyword` | `hits`、`index.version` |
| 重排 | `memory.rerank` | `rerank.model`、`top_n`、`score.delta` |
| 写入 | `memory.write` | `memory.tokens`、`dedup.hit`、`ttl.days` |
| 注入上下文 | `memory.inject` | `injected.tokens`、`context.utilization` |

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

`context.utilization` 是我最喜欢的一个字段：它告诉你「上下文窗口被记忆塞满了多少」。超过 0.8 时，模型往往开始忽略系统提示词——而这在 trace 里看起来一切正常。

## 05 接入 better-agent {#better-agent}

调度框架负责「什么时候跑、跑几轮、失败了重试几次」，它天然是**任务层 span 的最佳产地**。

<Diagram id="ba-integration" />

```python
# 调度器：任务入队时记录一次，执行时用 Link 关联，而不是强行做父子
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

| 调度层字段 | 用途 |
| --- | --- |
| `task.id` | 跨系统对账 |
| `queue.wait.ms` | 区分「排队慢」和「执行慢」 |
| `retry.count` | 重试放大成本 |
| `worker.id` | 定位是单机问题还是全局问题 |
| `scheduler.policy` | 限流 / 优先级策略是否生效 |

## 五个组件的边界表 {#boundaries}

| 组件 | 它独有的信息 | 不该由它上报 |
| --- | --- | --- |
| 网关 | token、成本、路由、缓存 | 用户意图、工具结果 |
| MCP | 工具执行细节、DB 耗时 | 模型 token |
| A2A | 委派关系、远程状态 | 远程内部 span 细节 |
| 记忆 | 命中率、相似度、注入量 | 最终答案质量 |
| 调度 | 排队、重试、并发 | 单轮推理细节 |

::: tip 边界清晰的好处
每个组件只上报自己独有的东西，**同一个事实只有一个来源**。否则看板上会出现「网关说 1200 token，Agent 说 1350 token」的经典争吵。
:::

## 集成后的验收清单 {#board-sample}

| 检查项 | 通过标准 |
| --- | --- |
| 链路完整 | 从入口到工具，一棵树，无孤儿 span |
| 字段一致 | token / 成本只有一个权威来源 |
| 跨组件 | A2A、MCP 调用能在同一 trace 里展开 |
| 失败可见 | 工具错误、网关 429 都有 `error.type` |
| 脱敏生效 | 抽查 100 条 span，无手机号 / 密钥 |
| 开销可控 | 埋点带来的 P95 增量 < 3% |

## 避坑清单 {#pitfalls}

::: warning 集成阶段的五个高频错误
1. **每个组件各自建 TracerProvider**。上下文不共享，链路碎成八段。
2. **MCP Server 把 client 的 span 当父级又建一个 root**。树变成两棵。
3. **网关吞掉上游错误码**。告警永远不会触发。
4. **A2A 跨公司还传内部 `tracestate`**。可能泄露内部服务名。
5. **调度层强行父子**。长任务把 trace 拉成 6 小时，前端直接打不开。
:::

## 小结 {#recap}

- 网关是 token 与成本的唯一权威来源，错误码必须透传。
- MCP 要在两端各开 span，靠 `_meta.traceparent` 串起来。
- A2A 优先续链，不支持时用 Link，跨公司只传 trace id。
- 记忆层重点记「命中、相似度、注入占比」。
- 调度层用 Link 而不是父子，避免超长 trace。
- 每个组件只上报自己独有的信息，同一事实只留一个来源。

下一章进入最实操的部分：四种埋点工程模式，以及五种反模式。

## 延伸阅读 {#reading}

- [OpenTelemetry Context Propagation](https://opentelemetry.io/docs/concepts/context-propagation/)：跨进程上下文的标准语义。
- [MCP 规范](https://modelcontextprotocol.io/specification)：`_meta` 字段与传输方式。
- [A2A 协议](https://a2a-protocol.org/)：消息 metadata 与任务状态。
- [第 13 章 Demo 全集](/demos/)：A2A 与 MCP 的可运行示例。
