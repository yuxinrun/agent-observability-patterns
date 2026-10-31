---
title: 14 · 高并发与大规模集群
description: 异步上报、四种采样、冷热分离、集群追踪性能与成本控制，把 Demo 变成能扛住流量的生产系统。
outline: [2, 3]
---

# 14 · 高并发与大规模集群

小规模时，观测是「加一行代码」；大规模时，观测是**一个需要容量规划的分布式系统**。

这一章回答三个问题：怎么不拖慢主流程、怎么在有限预算下留住关键样本、怎么让成本随业务线性增长而不是指数增长。

::: tip 人话翻译
观测系统的容量规划，只需要算一个乘法：
**每秒 span 数 × 平均 span 大小 × 保留天数 = 你的存储账单。**
三个因子各降一半，账单降到八分之一。
:::

## 01 异步上报与队列缓冲 {#async-export}

<Diagram id="async-pipeline" />

`BatchSpanProcessor` 的四个参数，决定了「性能」和「丢数据」之间的平衡：

| 参数 | 默认 | 生产建议 | 影响 |
| --- | --- | --- | --- |
| `max_queue_size` | 2048 | 8192~16384 | 缓冲多少 span，内存换稳定 |
| `schedule_delay_millis` | 5000 | 2000~5000 | 出事后多久能看到数据 |
| `max_export_batch_size` | 512 | 512~1024 | 单次请求体积 |
| `export_timeout_millis` | 30000 | 10000 | 卡住的后端不要拖死你 |

```python
from opentelemetry.sdk.trace.export import BatchSpanProcessor

provider.add_span_processor(
    BatchSpanProcessor(
        exporter,
        max_queue_size=16384,
        schedule_delay_millis=2000,
        max_export_batch_size=1024,
        export_timeout_millis=10000,
    )
)
```

内存估算：

```
内存 ≈ max_queue_size × 平均 span 大小
     ≈ 16384 × 2KB ≈ 32MB       # 可接受
     ≈ 16384 × 50KB ≈ 800MB     # 危险，说明属性里有大字段
```

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 队列满，开始丢弃 | 后端慢于生产 | 加 Collector、降采样 |
| 内存持续上涨 | span 属性太大 | 限制属性长度、去掉大字段 |
| 进程退出丢数据 | 没有优雅关闭 | `shutdown()` + 信号处理 |
| P95 变高 | 同步导出 | 确认用的是 Batch 而非 Simple |

## 02 采样策略 {#sampling}

<Diagram id="sampling-matrix" />

| 策略 | 决策时机 | 优点 | 缺点 | 适合 |
| --- | --- | --- | --- | --- |
| 头采样 | 请求入口 | 简单、省资源 | 会丢错误样本 | 高流量、成本敏感 |
| 尾采样 | 链路结束后 | 错误必留 | 需要缓冲全量 | 关键业务 |
| 错误优先 | 状态判定后 | 性价比最高 | 依赖状态正确 | 默认推荐 |
| 按租户 | 入口 | 大客户全量 | 需维护名单 | SaaS |
| 动态采样 | 按 QPS 调整 | 自动控成本 | 实现复杂 | 超大规模 |

```yaml
# Collector 尾采样：错误 + 慢请求全留，其余 5%
processors:
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 8000 }
      - name: vip
        type: string_attribute
        string_attribute: { key: tenant.tier, values: [enterprise] }
      - name: baseline
        type: probabilistic
        probabilistic: { sampling_percentage: 5 }
```

一个算账的例子：

| 指标 | 全量 | 5% 头采样 | 尾采样（错误全留） |
| --- | --- | --- | --- |
| 日 span 数 | 1.2 亿 | 600 万 | 约 900 万 |
| 存储/月 | 6 TB | 300 GB | 450 GB |
| 故障样本 | 全有 | 只有 5% | 全有 |
| 排查能力 | 最好 | 看运气 | 够用 |

## 03 冷热数据分离 {#hot-cold}

<Diagram id="hot-cold" />

| 层 | 时间 | 存储 | 查询延迟 | 用途 |
| --- | --- | --- | --- | --- |
| 热 | 0~7 天 | SSD / 内存索引 | < 1s | 线上排查 |
| 温 | 7~30 天 | 普通磁盘 | 数秒 | 复盘、周报 |
| 冷 | 30 天~13 月 | 对象存储 | 分钟级 | 合规、同比 |
| 聚合 | 永久 | 时序库 | < 1s | 看板、容量规划 |

关键原则：**删除原始数据之前，先把聚合结果算出来。** 否则你会在半年后想算同比时发现没有数据。

```sql
-- 每天凌晨把原始 span 汇总成日粒度，再删除明细
INSERT INTO agent_daily_rollup
SELECT toDate(timestamp) AS day, tenant_id, agent_name,
       count() AS tasks,
       countIf(status_code = 'ERROR') AS errors,
       quantile(0.95)(duration_ms) AS p95_ms,
       sum(cost_usd) AS cost
FROM otel_spans
WHERE timestamp >= today() - 1 AND timestamp < today()
GROUP BY day, tenant_id, agent_name;
```

## 04 集群下的追踪性能 {#cluster}

<Diagram id="cluster-hub" />

三个必须解决的集群问题：

| 问题 | 现象 | 解法 |
| --- | --- | --- |
| 尾采样需要看到完整链路 | 分片后每个实例只看到一部分 | 用 **loadbalancing exporter 按 trace_id 路由** |
| Collector 成为单点 | 一个实例挂了，数据全丢 | 每节点一个 agent + 一层 gateway |
| 标签基数爆炸 | 时序库 OOM | 在 Collector 里做 `metricstransform` 删高基数标签 |

```yaml
# 网关层：按 trace_id 路由到同一个尾采样实例
processors:
  loadbalancing:
    routing_key: traceID
    protocol:
      otlp:
        tls: { insecure: true }
    resolver:
      static:
        hostnames: [tailsampler-0:4317, tailsampler-1:4317, tailsampler-2:4317]
```

集群规模的经验值：

| 日 span 数 | Collector 规模 | 说明 |
| --- | --- | --- |
| < 1000 万 | 1~2 个实例 | 单点可接受，配好重启 |
| 1000 万~1 亿 | 每节点 agent + 2~3 gateway | 常规生产 |
| > 1 亿 | 分片 + 独立尾采样集群 + Kafka 缓冲 | 需要专门团队 |

## 05 存储与成本控制 {#cost-control}

| 手段 | 节省幅度 | 代价 |
| --- | --- | --- |
| 尾采样 | 70%~95% | 需要缓冲 |
| 属性截断（≤ 1KB） | 20%~40% | 少量信息丢失 |
| 压缩（zstd） | 60%~80% | CPU |
| 去掉高基数标签 | 50%+ 索引成本 | 查询维度减少 |
| 冷热分层 | 60%~80% | 查询变慢 |
| 聚合后删明细 | 90%+ | 无法再看单条 |

```python
# 在 SDK 侧就限制：属性超过 1KB 直接截断
class TruncatingSpanProcessor(SpanProcessor):
    MAX = 1024
    def on_end(self, span):
        for k, v in list(span.attributes.items()):
            if isinstance(v, str) and len(v) > self.MAX:
                span.set_attribute(k, v[: self.MAX] + "…[truncated]")
        self.next.on_end(span)
```

**单位经济模型**：把观测成本换算成「每个任务多少钱」，再和模型成本对比。经验目标是 **观测成本 ≤ 模型成本的 10%**。超过这个比例，先降采样，再谈扩容。

## 规模化健康指标 {#board-sample}

| 指标 | 定义 | 健康线 |
| --- | --- | --- |
| 导出队列使用率 | `queue_size / max_queue_size` | < 60% |
| 丢弃率 | 丢弃 span / 产生 span | < 0.1% |
| Collector CPU | 单实例 | < 60% |
| 存储日增 | GB/天 | 与业务增长同步 |
| 每任务观测成本 | 观测总成本 / 任务数 | < 模型成本 10% |
| 尾采样决策延迟 | `decision_wait` 实际值 | < 15s |

## 避坑清单 {#pitfalls}

::: warning 规模化阶段的五个坑
1. **尾采样和按 trace 路由没配对**。链路被拆到不同实例，采样决策全错。
2. **Collector 无内存限制**。一次流量高峰直接 OOM，观测先于业务倒下。
3. **只扩 Collector 不扩存储**。写入被打爆，查询全部超时。
4. **采样率写死**。大促期间成本失控，平时又采得太少。
5. **删了明细没留聚合**。三个月后老板要同比，你只能沉默。
:::

## 小结 {#recap}

- 异步上报是底线，队列大小要按内存算，不能拍脑袋。
- 采样为故障服务：错误必留，基线按比例。
- 冷热分层 + 先聚合后删除，兼顾成本与历史分析。
- 集群的关键是「按 trace_id 路由」与「agent + gateway 两层」。
- 成本控制从 SDK 侧开始：限长、压缩、去高基数。
- 用「每任务观测成本」做单位经济模型。

下一章是收尾：五块拼图之间的接缝到底在哪。

## 延伸阅读 {#reading}

- [OpenTelemetry Collector 扩展](https://opentelemetry.io/docs/collector/)：processor 与 exporter 组合。
- [Tail sampling 设计文档](https://opentelemetry.io/docs/concepts/sampling/)：采样语义与实现。
- [第 03 章 指标 Metrics](/metrics/)：成本指标怎么定义。
- [第 12 章 高频踩坑](/pitfalls/)：采样踩空的真实案例。
