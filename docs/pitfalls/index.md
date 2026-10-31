---
title: 12 · 高频踩坑大全（血泪清单）
description: 断链、丢 span、埋点爆炸、告警麻木、隐性成本、静默错误、采样踩空——七个真实事故的成因与修法。
outline: [2, 3]
---

# 12 · 高频踩坑大全（血泪清单）

这一章不讲新概念，只讲**别人已经替你交过学费的事**。

每个坑都按同一个格式：症状、根因、修法、预防。看完你会发现，绝大部分事故不是「技术太难」，而是「少了一个字段」或「少了一个上限」。

::: tip 人话翻译
踩坑的共同结构：**某个假设在正常情况下成立，在异常情况下不成立，而你没有为异常情况准备证据。**
:::

## 01 TraceID 断链，跨服务接不上 {#broken-trace}

<Diagram id="broken-trace" />

**症状**：从网关进来是一条链，到了 Agent 服务变成两条，工具调用又在第三条里。

**根因**：上下文在某个边界丢了。最常见的是异步任务、线程池、以及「我自己 new 了一个 Tracer」。

```python
# 错误：任务丢进线程池，上下文留在原地
executor.submit(handle, task)

# 正确：把上下文一起搬过去
ctx = contextvars.copy_context()
executor.submit(ctx.run, handle, task)
```

| 排查步骤 | 看什么 |
| --- | --- |
| 1 | 目标服务是否产生了新的 root span（`parent_span_id` 为空） |
| 2 | 入口中间件有没有 `extract` |
| 3 | 异步边界有没有传 context |
| 4 | 网关 header 白名单是否包含 `traceparent` |

**预防**：在 CI 里跑一个「跨三个服务的最小链路」测试，断言只有一个 trace id。

## 02 流式上报丢失 span、时序错乱 {#stream-loss}

<Diagram id="stream-loss" />

**症状**：用户投诉「回答到一半断了」，但看板显示 100% 成功；或者 span 的结束时间早于开始时间。

**根因**：生成器被提前关闭，`with` 块退出时 span 正常结束；或者多个协程并发写同一个 span。

| 根因 | 修法 |
| --- | --- |
| 客户端断开，`GeneratorExit` 被吞 | 在 `finally` 里显式标记 `stream.completed=false` |
| 多线程写同一个 span | 一个 span 只在一个协程内写，计数用局部变量 |
| 服务端主动超时 | 记录 `stream.timeout=true` 并 `set_status(ERROR)` |
| 时钟漂移 | 统一 NTP，展示层用时序而非本地时间排序 |

```python
finally:
    span.set_attribute("stream.completed", completed)
    if not completed:
        span.set_attribute("stream.abort_reason", abort_reason)
    span.end()
```

## 03 埋点太多，存储和成本爆炸 {#over-instrument}

<Diagram id="cost-blow" />

**症状**：上线两周，观测账单超过模型账单。

**根因**：三件事叠加——每 token 一个 span、prompt 全文入库、无采样。

| 浪费源 | 典型放大倍数 | 修法 |
| --- | --- | --- |
| 每 token 一个 span | 100~1000× | 一个请求一个 span + 计数 |
| prompt / response 全文 | 20~50× | hash + 前缀 + 截断 |
| 每个函数一个 span | 5~10× | 只在边界开 span |
| 无采样 | 1× （但基数大） | 头采样 10% + 错误全留 |
| 高基数标签 | 10× 索引成本 | 去掉 ID 类标签 |

::: warning 一个反直觉的事实
删掉 80% 的 span，通常不会降低排查能力。因为真正有用的信息集中在少数几个边界 span 上，剩下的都是「函数调用记录」。
:::

## 04 告警泛滥，大家麻木 {#alert-fatigue}

**症状**：告警群每天 200 条，真正的事故没人看。

**根因**：把「指标变化」当成「需要人处理的事件」。两者之间差了一个「有没有动作可做」。

| 阶段 | 做法 |
| --- | --- |
| 第一步 | 统计一周内每条规则的有效率（有人处理 / 总触发） |
| 第二步 | 有效率 < 30% 的规则直接删或降级为看板 |
| 第三步 | 全部改为多窗口燃烧率，去掉瞬时抖动 |
| 第四步 | 建立「告警即工单」，每条必须有 owner |

**预防**：每月做一次「告警葬礼」，把没人理的规则念一遍然后删掉。

## 05 只看 token，不看循环带来的隐性成本 {#hidden-cost}

<Diagram id="cost-blow" />

**症状**：单次调用 token 正常，月度账单却翻了三倍。

**根因**：轮次膨胀。每一轮都要把历史重新喂一遍，成本是**平方级**增长，不是线性。

```
第 1 轮：输入 800
第 2 轮：输入 1,600
第 3 轮：输入 2,800
...
第 10 轮：输入 12,000     ← 前十轮累计已经 6 万+
```

| 指标 | 能看出什么 |
| --- | --- |
| `agent.turn` 分布 | 轮次是否在膨胀 |
| `input_tokens / turn` | 上下文滚雪球速度 |
| `cost.usd` 按 `stop_reason` 分组 | 循环任务吃掉多少钱 |
| 同工具连续调用次数 | 死循环的早期信号 |

**预防**：给每个任务设三个上限——最大轮次、最大 token、最大成本。任意一个触发就停止并记录 `stop_reason`。

## 06 静默错误与幻觉：显示成功，其实答错 {#silent-wrong}

<Diagram id="silent-fail" />

**症状**：成功率 99.5%，客诉却在增加。

**根因**：把「模型返回了文本」当成「任务完成」。工具报错被模型当成「已处理」，或者模型编了一个不存在的订单。

| 检测手段 | 能抓到什么 | 成本 |
| --- | --- | --- |
| 工具结果断言 | 工具返回 500 但流程继续 | 低 |
| 业务状态校验 | 声称退款但订单状态没变 | 低 |
| LLM-as-judge 抽样 | 编造事实、答非所问 | 中 |
| 人工抽检 | 语气、合规、复杂逻辑 | 高 |

```python
# 最便宜的一道防线：让「完成」有客观依据
if not order_status_changed(order_id):
    span.set_attribute("task.verified", False)
    span.set_status(trace.Status(trace.StatusCode.ERROR, "state_not_changed"))
    raise TaskNotCompleted("refund claimed but order state unchanged")
```

**预防**：定义「完成」时必须包含一个**外部可验证的事实**，而不是模型自己说完成了。

## 07 采样策略错误，线上故障抓不到样本 {#sampling-miss}

<Diagram id="sampling-miss" />

**症状**：故障发生了，但采样把出问题的链路全丢了。

**根因**：纯随机头采样。错误率 1% 时，采 10% 意味着你只能看到 0.1% 的错误。

| 策略 | 做法 | 适合 |
| --- | --- | --- |
| 头采样 | 入口按比例决定 | 成本可控，简单 |
| 尾采样 | 先缓冲，出错/慢则保留 | 故障必留样本 |
| 错误优先 | `status=ERROR` 100% 保留 | 最实用的兜底 |
| 关键租户 | 大客户全量 | 商业敏感 |

```yaml
# Collector 尾采样：错误与慢请求全留，其余 5%
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 10000 }
      - name: baseline
        type: probabilistic
        probabilistic: { sampling_percentage: 5 }
```

## 事故自检表 {#board-sample}

把这张表贴在看板上方，每月过一遍：

| 检查项 | 通过标准 |
| --- | --- |
| 断链率 | < 2% |
| 孤儿 span | 每日为 0 |
| 埋点成本占模型成本 | < 10% |
| 告警有效率 | > 70% |
| 循环任务占比 | < 2% |
| 静默错误抽检 | 每周 ≥ 50 条 |
| 错误样本保留率 | 100% |

## 避坑清单 {#pitfalls}

::: warning 如果只记五条
1. **异步边界一定要搬 context**，这是断链的头号原因。
2. **流式的 span 必须在 `finally` 里关**，并且记录是否完成。
3. **任何「无限」都要有上限**：轮次、token、成本、队列。
4. **成功要靠外部事实验证**，不能靠模型自述。
5. **错误样本永不采样**，否则出事时你只能看运气。
:::

## 小结 {#recap}

- 断链、丢 span、埋点爆炸，本质都是边界处理不当。
- 告警麻木不是人的问题，是规则设计的问题。
- 循环成本是平方级的，必须设上限。
- 静默错误只能用评测和业务校验抓，指标抓不到。
- 采样要为故障服务，不是为账单服务。

下一章给你一整套可运行的 Demo，把这一章的反面教材全部改成正面示范。

## 延伸阅读 {#reading}

- [第 02 章 全链路追踪模式](/traces/)：正确姿势的完整版。
- [第 05 章 告警体系](/alerts/)：怎么让告警重新有人看。
- [第 10 章 评估联动](/evals/)：静默错误的正解。
- [第 14 章 高并发与规模化](/scale/)：采样与队列的进阶配置。
