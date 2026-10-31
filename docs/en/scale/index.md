---
title: '14 · Scaling: high concurrency and clusters'
description: Async export, four sampling strategies, hot/cold storage, cluster tracing performance and cost control — turning demos into systems that survive traffic.
outline: [2, 3]
---

# 14 · Scaling: high concurrency and clusters

At small scale observability is "add one line". At large scale it is **a distributed system that needs capacity planning**.

This chapter answers three questions: how not to slow the main path, how to keep the samples that matter on a fixed budget, and how to make cost grow linearly instead of exponentially.

::: tip Plain language
Capacity planning for telemetry is one multiplication:
**spans per second × average span size × retention days = your storage bill.**
Halve all three factors and the bill drops to one eighth.
:::

## 01 Async export and buffering {#async-export}

<Diagram id="async-pipeline" />

Four `BatchSpanProcessor` parameters decide the balance between performance and data loss:

| Parameter | Default | Production | Effect |
| --- | --- | --- | --- |
| `max_queue_size` | 2048 | 8192–16384 | Buffer depth; memory for stability |
| `schedule_delay_millis` | 5000 | 2000–5000 | How stale your view is during an incident |
| `max_export_batch_size` | 512 | 512–1024 | Payload size per request |
| `export_timeout_millis` | 30000 | 10000 | A stuck backend must not drag you down |

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

Memory estimate:

```
memory ≈ max_queue_size × average span size
       ≈ 16384 × 2KB ≈ 32MB       # fine
       ≈ 16384 × 50KB ≈ 800MB     # danger: something big is in the attributes
```

| Symptom | Cause | Fix |
| --- | --- | --- |
| Queue full, drops begin | Backend slower than production | More Collectors, sample harder |
| Memory keeps rising | Spans carry huge attributes | Limit attribute length, remove blobs |
| Data lost on exit | No graceful shutdown | `shutdown()` plus signal handling |
| P95 rises | Synchronous export | Confirm Batch, not Simple |

## 02 Sampling strategies {#sampling}

<Diagram id="sampling-matrix" />

| Strategy | When decided | Upside | Downside | Fits |
| --- | --- | --- | --- | --- |
| Head | At ingress | Simple, cheap | Loses error samples | High volume, cost-sensitive |
| Tail | After the trace ends | Keeps every error | Must buffer everything | Business critical |
| Error-first | After status known | Best value | Depends on correct status | The default recommendation |
| Tenant-based | At ingress | Full capture for big customers | Maintain a list | SaaS |
| Adaptive | By QPS | Automatic cost control | Complex | Very large scale |

```yaml
# Collector tail sampling: errors and slow traces kept, 5% of the rest
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

The arithmetic:

| Metric | Full capture | 5% head sampling | Tail (all errors) |
| --- | --- | --- | --- |
| Spans per day | 120M | 6M | ~9M |
| Storage per month | 6 TB | 300 GB | 450 GB |
| Incident samples | All | 5% | All |
| Debuggability | Best | Luck-based | Sufficient |

## 03 Hot and cold storage {#hot-cold}

<Diagram id="hot-cold" />

| Tier | Age | Storage | Query latency | Purpose |
| --- | --- | --- | --- | --- |
| Hot | 0–7 days | SSD / in-memory index | < 1s | Live debugging |
| Warm | 7–30 days | Standard disk | Seconds | Reviews, weekly reports |
| Cold | 30 days–13 months | Object storage | Minutes | Compliance, YoY |
| Aggregates | Forever | Time-series store | < 1s | Boards, capacity planning |

The key rule: **compute the aggregates before deleting the raw data.** Otherwise six months later you will want a year-over-year comparison and find nothing.

```sql
-- Roll raw spans into daily aggregates, then delete the detail
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

## 04 Tracing performance in clusters {#cluster}

<Diagram id="cluster-hub" />

Three cluster problems you must solve:

| Problem | Symptom | Fix |
| --- | --- | --- |
| Tail sampling needs the whole trace | After sharding, each instance sees a fragment | Route by trace id with the **loadbalancing exporter** |
| Collector as a single point | One instance dies, data dies | Per-node agent plus a gateway tier |
| Label cardinality explosion | The TSDB OOMs | Strip high-cardinality labels in the Collector |

```yaml
# Gateway: route by trace id so one tail sampler sees the whole trace
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

Rules of thumb by scale:

| Spans per day | Collector footprint | Note |
| --- | --- | --- |
| < 10M | 1–2 instances | Single point acceptable with restarts |
| 10M–100M | Agent per node + 2–3 gateways | Normal production |
| > 100M | Sharded collectors, dedicated tail samplers, Kafka buffer | Needs a dedicated team |

## 05 Storage and cost control {#cost-control}

| Lever | Savings | Cost |
| --- | --- | --- |
| Tail sampling | 70–95% | Buffering |
| Attribute truncation (≤ 1KB) | 20–40% | Minor information loss |
| Compression (zstd) | 60–80% | CPU |
| Dropping high-cardinality labels | 50%+ of index cost | Fewer query dimensions |
| Hot/cold tiering | 60–80% | Slower queries |
| Aggregates before deletion | 90%+ | No single-trace access |

```python
# Limit at the SDK: truncate any attribute over 1KB
class TruncatingSpanProcessor(SpanProcessor):
    MAX = 1024
    def on_end(self, span):
        for k, v in list(span.attributes.items()):
            if isinstance(v, str) and len(v) > self.MAX:
                span.set_attribute(k, v[: self.MAX] + "…[truncated]")
        self.next.on_end(span)
```

**Unit economics**: convert telemetry spend into "cost per task" and compare it with model spend. A reasonable target is **observability ≤ 10% of model cost**. Above that, sample harder before buying more storage.

## Scaling health metrics {#board-sample}

| Metric | Definition | Healthy |
| --- | --- | --- |
| Export queue utilisation | `queue_size / max_queue_size` | < 60% |
| Drop rate | Dropped / produced spans | < 0.1% |
| Collector CPU | Per instance | < 60% |
| Daily storage growth | GB/day | Tracks business growth |
| Telemetry cost per task | Total / tasks | < 10% of model cost |
| Tail decision latency | Actual `decision_wait` | < 15s |

## Pitfalls {#pitfalls}

::: warning Five scaling traps
1. **Tail sampling without trace-id routing.** The chain is split across instances and every decision is wrong.
2. **No memory limit on Collectors.** One traffic spike OOMs telemetry before the product.
3. **Scaling collectors but not storage.** Writes get hammered and every query times out.
4. **Hard-coded sampling rates.** Costs explode during a sale; samples are scarce the rest of the year.
5. **Deleting detail without aggregates.** Six months later, a YoY request meets silence.
:::

## Recap {#recap}

- Async export is mandatory; size the queue from memory maths, not instinct.
- Sampling serves incidents: keep errors, ratio the baseline.
- Tier storage and roll up before deleting.
- Clusters hinge on trace-id routing and a two-tier agent/gateway layout.
- Control cost at the SDK: length limits, compression, fewer high-cardinality labels.
- Track telemetry cost per task as a unit economic.

Final chapter: where the five pieces actually meet.

## Further reading {#reading}

- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/): processors and exporters.
- [Sampling concepts](https://opentelemetry.io/docs/concepts/sampling/): semantics and implementations.
- [Chapter 03 Metrics](/en/metrics/): defining cost metrics.
- [Chapter 12 The pitfalls catalog](/en/pitfalls/): real sampling failures.
