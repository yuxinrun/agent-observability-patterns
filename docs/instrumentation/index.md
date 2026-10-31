---
title: 08 · 埋点工程模式：拿来就能写
description: 装饰器、中间件、生命周期回调、异步队列四种低侵入埋点，以及五种让成本爆炸的反模式。
outline: [2, 3]
---

# 08 · 埋点工程模式：拿来就能写

埋点最怕两件事：**业务代码里到处是 `set_attribute`**，以及**换了框架之后全部要重写**。

这一章给四种工程模式，从「侵入最小」到「控制最强」，你可以按团队情况混搭。

::: tip 人话翻译
- **装饰器**：给函数穿件外套，进出自动记录。适合业务函数。
- **中间件**：站在大门口，所有请求都得过。适合 Web / 网关。
- **回调**：框架跑到关键节点时通知你。适合 Agent SDK。
- **异步队列**：先把事件丢进队列，后台慢慢处理。适合高并发。
:::

## 01 装饰器埋点模式 {#decorator}

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

TypeScript 版本更短，因为装饰器语法原生支持：

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

| 优点 | 缺点 |
| --- | --- |
| 业务代码几乎不改 | 只能覆盖到被装饰的函数 |
| 参数、异常自动处理 | 装饰器嵌套深了不好排查 |
| 适合工具函数、服务方法 | 不适合流式与长生命周期对象 |

## 02 中间件埋点模式 {#middleware}

<Diagram id="middleware-layers" />

中间件适合「所有请求都要经过」的位置：HTTP 入口、网关、数据库驱动、SDK。

```python
# FastAPI / Starlette：一个中间件覆盖全部入口
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

| 场景 | 中间件位置 |
| --- | --- |
| Web 服务 | ASGI / Express / Gin 中间件 |
| 网关 | 请求进入与转发之间 |
| 消息队列 | 生产与消费两端 |
| 数据库 | 驱动层（通常用现成 instrumentation） |

::: tip 中间件是最划算的投入
一个 20 行的中间件，能给所有接口自动加上 trace、状态码、租户、耗时。它比在 200 个 handler 里各写一遍靠谱得多。
:::

## 03 生命周期回调埋点 {#callback}

<Diagram id="callback-life" />

Agent SDK 通常提供生命周期钩子。以 OpenAI Agents SDK 的 tracing 为例，你可以实现自己的 processor：

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

自研 Agent 也可以用同样的思路定义四个钩子：

| 钩子 | 记录什么 |
| --- | --- |
| `on_start` | 任务 id、租户、输入长度、模型配置 |
| `on_tool` | 工具名、参数摘要、返回状态、耗时 |
| `on_error` | 异常类型、阶段、可复现快照 |
| `on_finish` | 轮次、总 token、总成本、stop_reason |

::: warning 回调里不要做重活
回调运行在业务线程上。在里面做 HTTP 上报、写数据库、跑正则脱敏，都会直接增加用户等待时间。回调只负责**组装数据**，发送交给后台队列。
:::

## 04 异步队列埋点模式 {#async}

<Diagram id="async-queue" />

高并发下，同步上报会成为瓶颈。正确做法：**业务线程只入队，独立 worker 批量导出**。

```python
import asyncio, contextvars

queue: asyncio.Queue = asyncio.Queue(maxsize=10_000)

def emit(event: dict):
    ctx = contextvars.copy_context()          # 关键：把上下文一起带走
    try:
        queue.put_nowait((ctx, event))
    except asyncio.QueueFull:
        metrics.add(1, {"dropped": True})     # 宁可丢，不要阻塞业务

async def exporter():
    batch = []
    while True:
        ctx, event = await queue.get()
        batch.append(event)
        if len(batch) >= 200:
            ctx.run(flush, batch)             # 在原始上下文里发送，trace 不断
            batch.clear()
```

| 参数 | 建议值 | 说明 |
| --- | --- | --- |
| 队列长度 | 5k~20k | 太小易丢，太大吃内存 |
| 批量大小 | 200~512 | 与导出后端的批次上限对齐 |
| 刷新间隔 | 1~5s | 影响「出事时日志多久能看到」 |
| 丢弃策略 | 满则丢，计数 | 永远不要阻塞主流程 |
| 关闭行为 | 优雅 flush | 进程退出前必须清空 |

## 05 埋点反模式 {#anti-patterns}

<Diagram id="anti-pattern" />

| 反模式 | 症状 | 后果 | 正确做法 |
| --- | --- | --- | --- |
| 过度埋点 | 每行代码一个 span | 存储爆炸、树深得没法看 | 只在边界开 span |
| 全文入库 | prompt / response 全存 | 隐私 + 成本双杀 | 存 hash + 截断 + 脱敏 |
| 同步上报 | 每次调用都等网络 | P95 直接翻倍 | 批量 + 异步 |
| 埋点写业务逻辑 | span 里做判断、改状态 | 观测影响结果 | 只读，不写 |
| 无采样全量存 | 「反正便宜」 | 三个月后账单教育你 | 头采样 + 尾采样 |

```python
# 反例：把业务判断塞进埋点
with tracer.start_as_current_span("checkout") as span:
    if span.is_recording():          # 看起来无害
        user.vip = True              # 但这里改了业务状态
```

::: danger 观测系统的第一原则
**观测不能改变被观测对象的行为。** 一旦埋点影响了业务逻辑，你看到的所有数据都不可信。
:::

## 埋点质量指标 {#board-sample}

| 指标 | 定义 | 健康线 |
| --- | --- | --- |
| 埋点覆盖率 | 有 span 的关键路径 / 全部关键路径 | > 90% |
| 孤儿 span 率 | 无父 span 占比 | < 2% |
| 上报丢弃率 | 队列满丢弃 / 总事件 | < 0.1% |
| 埋点开销 | 埋点引入的 P95 增量 | < 3% |
| 字段完整率 | 必填属性齐全的 span 占比 | > 95% |

## 避坑清单 {#pitfalls}

::: warning 埋点工程的五个坑
1. **装饰器包住了流式生成器**。函数返回了，span 就结束了，后面的 token 全丢。
2. **中间件里重新创建 TracerProvider**。上下文断掉，链路碎成两段。
3. **回调里同步发 HTTP**。用户等待时间直接翻倍。
4. **队列无上限**。内存涨到 OOM，进程被杀，观测数据一起没了。
5. **只埋成功路径**。异常路径才是你最需要数据的地方。
:::

## 小结 {#recap}

- 装饰器适合业务函数，中间件适合入口，回调适合框架，队列适合高并发。
- 流式函数不要用装饰器「包住返回值」，要包住整个生成过程。
- 回调只组装数据，发送交给队列。
- 队列必须有上限和丢弃计数，宁可丢数据也不要阻塞业务。
- 观测永远不改变业务行为。

下一章把这些数据摆成六块生产看板。

## 延伸阅读 {#reading}

- [OpenTelemetry Python instrumentation](https://opentelemetry.io/docs/languages/python/instrumentation/)：手动埋点的官方写法。
- [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/)：`TracingProcessor` 接口细节。
- [第 02 章 全链路追踪模式](/traces/)：这些模式的树该怎么长。
- [第 14 章 高并发与规模化](/scale/)：队列与采样的进阶调优。
