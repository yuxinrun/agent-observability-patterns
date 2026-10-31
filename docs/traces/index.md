---
title: 02 · 全链路追踪模式（核心）
description: 八种可直接落地的 Agent 追踪模式：ReAct 循环、流式分片、分层 span、A2A、MCP、记忆、会话、错误断点。
outline: [2, 3]
---

# 02 · 全链路追踪模式（核心）

第 01 章给了你砖头，这一章开始盖房子。

八种模式解决八个具体问题：它在想什么（ReAct）、字是怎么一个个蹦出来的（流式）、该在哪一层看耗时（分层）、两个 Agent 怎么接上（A2A）、工具为什么慢（MCP）、记忆有没有用（记忆）、同一个用户前后发生了什么（会话）、崩了怎么复现（错误断点）。

::: tip 人话翻译
追踪模式不是「多加日志」，而是**提前决定这棵树的形状**。树长对了，排查是点鼠标；树长歪了，排查是考古。
:::

## 01 ReAct 循环追踪模式 {#react-loop}

ReAct 的本质是「想一步、做一步、看结果、再想」。所以 trace 也该长成循环的样子：外层一个任务 span，里面每一轮一个 turn span，turn 里挂着模型调用和工具调用。

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
        return "抱歉，这个任务我没能在限定轮次内完成。"
```

三个必须记录的字段：

| 字段 | 为什么 | 告警用法 |
| --- | --- | --- |
| `agent.turn` | 第几轮 | 平均轮次突然上升 = 提示词退化 |
| `agent.stop_reason` | 为什么停 | `max_turns` 占比升高 = 死循环前兆 |
| `loop.count` | 同一工具连续调用次数 | > 3 就该看一眼 |

::: warning 没有轮次上限的 Agent，是一个会自动续费的订阅
一个 12 轮的对话和 40 轮的对话，token 差距不是 3 倍而是 10 倍以上——因为每轮都要把前面的历史再喂一遍。
:::

## 02 流式输出追踪模式 {#streaming}

流式最容易出错：span 开了没关、消费者断了没记录、按 token 建 span 把后端打挂。

正确姿势只有一句话：**一个请求一个 span，分片用 event 记，结束在 `finally` 里。**

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

| 现象 | 埋点没做对的地方 | 修法 |
| --- | --- | --- |
| 首字很慢但总耗时正常 | 没记 `ttft.ms` | 首片到达时打点 |
| 用户说「卡住了」，链路显示成功 | 生成器被关闭，span 正常结束 | `finally` / `GeneratorExit` 里标未完成 |
| 后端 CPU 打满 | 每片一个 span | 改成 event 或纯计数 |
| 分片顺序乱了 | 多线程并发写同一 span | span 只在单协程内写，计数用本地变量 |

## 03 分层 Span 设计模式 {#layered-spans}

五层结构是行业共识：**任务层 → Agent 轮次层 → LLM 调用层 → 工具层 → 记忆层**。每一层只回答一个问题，别混。

<Diagram id="span-layers" />

| 层 | span 名 | 只回答 | 典型属性 |
| --- | --- | --- | --- |
| 任务 | `invoke_agent support-agent` | 这单成不成、多贵 | `task.id`、`tenant.id`、`cost.usd` |
| 轮次 | `agent.turn 2` | 这一轮在干嘛 | `agent.turn`、`turn.intent` |
| LLM | `chat claude-sonnet-4-5` | 模型花了多少 | tokens、`finish_reasons`、`ttft.ms` |
| 工具 | `execute_tool search_orders` | 工具靠不靠谱 | `gen_ai.tool.name`、`retries` |
| 记忆 | `memory.recall` | 记忆有没有帮上忙 | `memory.hit`、`similarity`、`top_k` |

::: tip 为什么不能「一个大 span 记完」
因为聚合维度不同。任务层要按租户、按 Agent 聚合；LLM 层要按模型聚合；工具层要按工具名聚合。全塞在一层，看板上就只能做「总耗时」一个图。
:::

一个常见错误是层级过深：给每次 HTTP 重试、每个 JSON 解析都开 span。经验法则是——**能影响用户决策或成本的边界才开 span**，其余用 event。

## 04 A2A 跨 Agent 分布式追踪 {#a2a}

A2A 的追踪目标很朴素：用户只看到「主 Agent 回复了」，但背后可能是「规划 Agent 委派给检索 Agent，检索 Agent 又调了代码 Agent」。

<Diagram id="a2a-trace" />

```python
# 委派方：把上下文注入到 A2A 消息 metadata
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

# 被委派方：从 metadata 恢复，继续同一条 trace
ctx = propagate.extract({"traceparent": message["metadata"]["traceparent"]})
with tracer.start_as_current_span("invoke_agent research-agent", context=ctx):
    ...
```

| 必填字段 | 作用 |
| --- | --- |
| `a2a.target_agent` | 谁被调用了 |
| `delegation.depth` | 第几层委派，> 3 要警惕 |
| `a2a.task_id` | 远程任务 id，用于对账 |
| `a2a.status` | submitted / working / completed / failed |

::: danger 委派环
A 委派给 B，B 又委派回 A。没有 `delegation.depth` 上限和「同 trace 内 agent 重复出现」检测，这个环会优雅地烧掉你的额度。
:::

## 05 MCP 工具调用追踪 {#mcp}

MCP 的特殊之处：工具跑在**另一个进程甚至另一家公司**。所以一次调用要有两个 span——客户端一个（我等了多久），服务端一个（我干了多久）。

<Diagram id="mcp-trace" />

```python
# 客户端
with tracer.start_as_current_span("execute_tool search_orders") as span:
    span.set_attribute("gen_ai.operation.name", "execute_tool")
    span.set_attribute("gen_ai.tool.name", "search_orders")
    span.set_attribute("mcp.server", "orders-mcp")
    span.set_attribute("mcp.transport", "streamable-http")
    result = await session.call_tool("search_orders", args, meta={"traceparent": tp})

# 服务端
ctx = propagate.extract({k: v for k, v in meta.items() if k.startswith("trace")})
with tracer.start_as_current_span("mcp.tool search_orders", context=ctx) as span:
    span.set_attribute("mcp.tool.is_error", result.isError)
```

| 指标 | 用途 |
| --- | --- |
| 客户端耗时 − 服务端耗时 | 网络与排队成本 |
| `mcp.tool.is_error` 比例 | 工具质量 |
| 同一工具连续失败次数 | 触发熔断 |
| 工具返回体大小 | 上下文膨胀的元凶 |

## 06 记忆读写追踪模式 {#memory}

记忆层最容易被忽略，却常常是「为什么这次回答变笨了」的答案：召回没命中、召回了过期信息、上下文塞爆。

<Diagram id="memory-trace" />

| 操作 | span 名 | 关键属性 |
| --- | --- | --- |
| 召回 | `memory.recall` | `top_k`、`memory.hit`、`similarity.max`、`memory.latency.ms` |
| 写入 | `memory.write` | `memory.store`、`memory.tokens`、`dedup.hit` |
| 更新 | `memory.update` | `memory.id`、`memory.reason` |
| 注入 | `memory.inject` | `injected.tokens`、`context.utilization` |

```python
with tracer.start_as_current_span("memory.recall") as span:
    hits = await store.search(query, top_k=8)
    span.set_attribute("top_k", 8)
    span.set_attribute("memory.hit", len(hits))
    span.set_attribute("similarity.max", max((h.score for h in hits), default=0))
    span.set_attribute("memory.tokens", sum(len(h.text) // 4 for h in hits))
```

::: tip 一个直接能用的告警
`memory.hit == 0` 的比例连续 10 分钟超过 30%，基本可以断定：索引没更新、embedding 模型换了、或者用户真的在问新东西。三种原因的处理方式完全不同，但都值得看一眼。
:::

## 07 会话追踪模式 {#session}

会话是比 trace 更大的单位：一个用户在一次对话里可能触发 6 条 trace（每条是一次任务）。要把它们串起来，靠 `session.id`。

<Diagram id="session-trace" />

| 字段 | 说明 | 注意 |
| --- | --- | --- |
| `session.id` | 会话唯一标识 | 由服务端生成，别用客户端传的裸值 |
| `gen_ai.conversation.id` | GenAI 语义约定里的会话 id | 可与 `session.id` 同值 |
| `user.id` | 用户标识 | **必须哈希**，禁止明文手机号/邮箱 |
| `session.turn` | 会话内第几轮 | 用于分析「越聊越贵」 |

会话级看板回答的问题和 trace 级完全不同：

| 问题 | 需要的粒度 |
| --- | --- |
| 这次任务为什么慢 | trace |
| 这个用户为什么流失 | session |
| 这类问题整体在恶化吗 | 指标聚合 |

## 08 错误断点追踪模式 {#error-snapshot}

线上排查最贵的一句话是「能复现吗」。错误断点模式的目标：**让每次失败都自带一份可复现的快照。**

<Diagram id="error-snapshot" />

```python
except Exception as exc:
    span.record_exception(exc)
    span.set_status(trace.Status(trace.StatusCode.ERROR, type(exc).__name__))
    span.set_attribute("error.type", type(exc).__name__)
    span.set_attribute("error.stage", "tool_call")
    # 可以复现的最小上下文，注意脱敏
    span.set_attribute("snapshot.input_hash", sha256(user_input))
    span.set_attribute("snapshot.turn", turns)
    span.set_attribute("snapshot.last_tool", action.tool_name)
    span.set_attribute("snapshot.last_output_head", redact(action.output)[:200])
    span.set_attribute("snapshot.replayable", has_enough_context())
```

| 该存 | 不该存 |
| --- | --- |
| 输入 hash、长度、语言 | 用户原文（除非已脱敏且授权） |
| 最后一轮的工具名与状态码 | 完整工具返回体 |
| 模型名、温度、max_tokens | API Key、Cookie |
| 失败阶段、异常栈（截断） | 全量堆栈里带业务数据的变量 |

::: warning 快照不是日志备份
只存「复现必需的最小集合」。存太多，等于把生产数据库复制到观测平台，安全和成本双杀。
:::

## 指标看板样例 {#board-sample}

| 指标 | 计算方式 | 健康线 | 它告诉你 |
| --- | --- | --- | --- |
| 平均轮次 | `avg(agent.turn)` | < 4 | 提示词是否在退化 |
| 首字延迟 P95 | `p95(ttft.ms)` | < 1.2s | 用户感知的「卡」 |
| 工具失败率 | `errors / calls` by tool | < 2% | 哪个工具在拖后腿 |
| 断链率 | root span 占比 | < 2% | 透传有没有漏 |
| 记忆命中率 | `hit > 0` 占比 | > 60% | 记忆有没有白存 |

## 避坑清单 {#pitfalls}

::: warning 追踪模式里最容易做错的五件事
1. **只在外层开 span，里面全黑**。等于给黑盒套了个更大的黑盒。
2. **流式 span 忘了关**。内存泄漏 + 后端出现 12 小时的僵尸 span。
3. **A2A 只传 taskId 不传 traceparent**。分布式追踪直接降级成「各自记录」。
4. **MCP 客户端和服务端时间对不上**。先对时（NTP），再谈耗时分析。
5. **错误只记 message 不记类型**。`error.type` 才能聚合，message 只能肉眼读。
:::

## 小结 {#recap}

- ReAct：外层任务 span + 每轮 turn span，记得记 `stop_reason`。
- 流式：一个请求一个 span，分片用 event，关闭路径也要记录。
- 分层：五层各回答一个问题，别把聚合维度混在一起。
- A2A：`traceparent` 放进 metadata，加 `delegation.depth` 防环。
- MCP：客户端 + 服务端双 span，差值就是网络与排队。
- 记忆：召回、写入、注入都要有 span，命中率是核心指标。
- 会话：`session.id` 把多条 trace 串成一个故事。
- 错误断点：存复现必需的最小上下文，别存全量。

下一章把这些 span 变成数字：任务、模型、工具、体验、业务五层指标，以及能直接抄的 SLO。

## 延伸阅读 {#reading}

- [OpenTelemetry Span Links](https://opentelemetry.io/docs/concepts/signals/traces/#span-links)：跨异步任务连接的标准做法。
- [OpenAI Agents SDK：tracing 与 spans](https://openai.github.io/openai-agents-python/tracing/)：agent / turn / tool 的原生 span 模型。
- [第 03 章 指标 Metrics](/metrics/)：从链路到看板的第一步。
- [第 12 章 高频踩坑](/pitfalls/)：这些模式在线上会怎么坏掉。
