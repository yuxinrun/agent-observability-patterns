---
title: '03 · Metrics: what a production board must show'
description: Five metric layers — task, model, tool, UX and business — with cost formulas, SLO templates and aggregation dimensions.
outline: [2, 3]
---

# 03 · Metrics: what a production board must show

A trace is the medical record. Metrics are the six arrows at the top of the health report.

The record is thorough, but you will not read 3000 of them every morning. You need to know: success dropped four points, P95 latency rose 800ms, cost per task doubled. **Metrics are not about precision; they are about noticing that today is not yesterday.**

::: tip Plain language
A metric is numerator / denominator + a window + labels. Before writing one, answer three questions: **who is the numerator, who is the denominator, and how is it sliced.** If you cannot, the metric will lie to you eventually.
:::

## 01 Task-level metrics {#task}

Task metrics answer "did this job succeed". It is the layer executives and support look at first.

<Diagram id="task-metrics" />

| Metric | Definition | Denominator trap |
| --- | --- | --- |
| Completion rate | `completed / started` | Do enqueue failures count as started? Track separately |
| Failure rate | `failed / started` | User cancels are not failures |
| Cancellation rate | `cancelled / started` | High cancels usually mean "too slow" |
| Timeout rate | `timeout / started` | Split model-slow from tool-slow |
| Mean turns | `avg(agent.turn)` | Success-only averages understate it |
| Runaway rate | share of `stop_reason == max_turns` | The most expensive metric you have |

```python
from opentelemetry import metrics

meter = metrics.get_meter("support-agent")
tasks = meter.create_counter("agent.tasks", unit="1")
turns = meter.create_histogram("agent.turns", unit="1")
duration = meter.create_histogram("agent.duration", unit="ms")

def finish(task, status, turns_used, elapsed_ms):
    attrs = {"agent": "support-agent", "status": status, "tenant": task.tenant}
    tasks.add(1, attrs)
    turns.record(turns_used, attrs)
    duration.record(elapsed_ms, attrs)
```

::: warning A team with 99.7% completion is usually mislabelling failures
Define "done" precisely: did the model emit a final answer, did the tool actually succeed, did the business state really change? Completion requires all three. Anything less is a dashboard comforting itself.
:::

## 02 Model-level metrics {#llm}

Model metrics answer "where the money goes and where it drags".

<Diagram id="llm-metrics" />

| Metric | Definition | Note |
| --- | --- | --- |
| TTFT | request to first token | The core of streaming UX |
| Total duration | request to finish | Correlates with output tokens |
| tokens/s | `output_tokens / generation_time` | Detects provider throttling |
| Input / output tokens | separate counters | Input usually dominates cost |
| Cache-read tokens | `cache_read_input_tokens` | Saves 80–90% |
| Cost per call | tokens × price | Formula below |
| Refusal rate | `finish_reason == refusal` | Safety policy firing |

```
cost = input_tokens        * price_in
     + output_tokens       * price_out
     + cache_read_tokens   * price_in * 0.1
     + cache_write_tokens  * price_in * 1.25
```

Keep prices **in configuration**. A price cut, a provider swap or a caching policy is an ops action, not a release.

| Symptom | Metric to watch |
| --- | --- |
| "The typewriter stutters" | TTFT P95, tokens/s |
| Monthly bill surprise | Cost per task P95, cache hit rate |
| Truncated answers | Share of `finish_reasons == length` |
| Provider flakiness | First-token failure rate grouped by provider |

## 03 Tool-level metrics {#tool}

Tool metrics answer "which tool is dragging".

<Diagram id="tool-metrics" />

| Metric | Definition | Healthy (rule of thumb) |
| --- | --- | --- |
| Success rate | `ok / calls` | > 98% |
| Retries per call | `retries / calls` | < 0.2 |
| Latency P95 | per tool | Set per tool, never globally |
| Error mix | grouped by `error.type` | Top 3 is enough |
| Empty-result rate | share returning zero rows | High means a broken query builder |

**Labels must stay low-cardinality.** `tool.name`, `error.type`, `status` are fine; `user.id`, `query`, `order_id` are not, unless you want hundreds of thousands of new series a day.

```python
tools = meter.create_counter("tool.calls", unit="1")
latency = meter.create_histogram("tool.latency", unit="ms")

def call_tool(name: str, fn, *args):
    started = time.perf_counter()
    try:
        result = fn(*args)
        tools.add(1, {"tool": name, "status": "ok"})
        return result
    except Exception as exc:
        tools.add(1, {"tool": name, "status": "error", "error_type": type(exc).__name__})
        raise
    finally:
        latency.record((time.perf_counter() - started) * 1000, {"tool": name})
```

## 04 User experience metrics {#ux}

Good technical numbers plus angry users is the most common mismatch in agent products.

<Diagram id="ux-metrics" />

| Metric | Definition | Why it matters |
| --- | --- | --- |
| Time to first response | user send to first character | Past 2s, doubt creeps in |
| Task duration P95 | end to end | Long jobs need progress feedback |
| Cost per session | `session_cost / sessions` | Free users still cost money |
| Daily cost per user | aggregated by user | Abuse protection |
| Abandonment rate | closed mid-task / sessions | The most honest signal |

::: tip A cheap and excellent metric
**The gap between two consecutive user messages.** Under three seconds usually means the last answer missed the point and the user got impatient. No frontend instrumentation needed — server timestamps suffice.
:::

## 05 Business metrics {#business}

Business metrics answer "does this thing actually help".

<Diagram id="business-metrics" />

| Metric | How | Source |
| --- | --- | --- |
| Hallucination rate | judged wrong / sampled | Chapter 10 eval loop |
| Refusal rate | `refusal / answers` | Model finish reason |
| Human handoff rate | handoffs / sessions | Business system |
| First-contact resolution | no follow-up / sessions | Session analysis |
| Satisfaction | thumbs up / (up + down) | Frontend feedback |

::: warning Hallucination rate cannot be computed from traces alone
A trace knows what was said, not whether it was true. Hallucination requires evals or human labels. Any claim of "automatic hallucination rate from logs" is guessing with a straight face.
:::

## 06 SLO templates {#slo}

An SLO is not "as high as possible"; it is a balance between experience and cost.

<Diagram id="slo-matrix" />

| SLI | Target | Error budget (30d) | When exhausted |
| --- | --- | --- | --- |
| Task success | 99.0% | 7.2 hours unavailable | Freeze features, fix reliability |
| TTFT P95 | < 1.5s | 5% of requests may exceed | Check provider and first-hop |
| End-to-end P95 | < 20s | 5% may exceed | Check tools and turn count |
| Cost per task P95 | < $0.05 | 5% may exceed | Check prompt size and loops |
| Tool success | > 98% | 2% may fail | Find the tool owner |

**How to use the budget**: ship boldly while it is healthy; only fix bugs when it is gone. Far more effective than "everyone please be careful".

```yaml
# Pseudo-config: multi-window burn-rate alert, ~80% less noise than fixed thresholds
- alert: AgentSuccessBudgetFastBurn
  expr: sli:agent_success:ratio5m < 0.95 and sli:agent_success:ratio1h < 0.98
  for: 5m
  labels: { severity: P1 }
```

## 07 Aggregation patterns {#aggregation}

<Diagram id="agg-layers" />

The same metric should slice along at least five dimensions:

| Dimension | Typical value | Purpose |
| --- | --- | --- |
| Tenant | `tenant.id` | Billing, isolation, SaaS tiers |
| Model | `gen_ai.request.model` | Cost and quality comparison |
| Agent type | `gen_ai.agent.name` | Which product line degrades |
| Skill / tool | `gen_ai.tool.name` | Tool governance |
| Version | `deployment.version` | Release regression |

**Cardinality budget**: a time series costs roughly 1–3 KB/month. `tenant × model × agent × status` at 2000 × 6 × 12 × 4 is 576,000 series — the invoice arrives before the incident. Keep tenant-level metrics to five core SLIs and push detail into traces.

## Sample board {#board-sample}

| Panel | Metric | View |
| --- | --- | --- |
| Tasks today | `sum(agent.tasks)` | Line with day-over-day |
| Success rate | `completed / started` | Line with SLO line |
| Spend | `sum(cost.usd)` | Stacked bars by model |
| Latency | P50 / P95 / P99 | Quantile band |
| Runaway loops | `stop_reason=max_turns` | Single value + top tenants |
| Top 5 failing tools | grouped by `tool` | Horizontal bars |

## Pitfalls {#pitfalls}

::: warning Five classic metric mistakes
1. **Inconsistent denominators.** Three boards, three success rates, zero trust.
2. **Ids as labels.** Cardinality explodes, Prometheus OOMs, then you do.
3. **Averages without percentiles.** Mean 3s while P95 is 40s; users left long ago.
4. **Treating cost and tokens as the same thing.** Caching, batching and pricing break the equivalence.
5. **No version dimension.** Metrics degrade after a release and you cannot say which one.
:::

## Recap {#recap}

- Task layer for outcomes, model layer for money, tool layer for weaknesses, UX for feelings, business for value.
- Every metric must state numerator, denominator, window and labels.
- Keep pricing in configuration; a price change is not a release.
- Pair SLOs with error budgets; the budget decides ship-versus-fix.
- Budget your cardinality; ids never become labels.

Next, the most neglected and most dangerous part: logs and audit trails.

## Further reading {#reading}

- [OpenTelemetry metrics concepts](https://opentelemetry.io/docs/concepts/signals/metrics/): choosing between counters, histograms and gauges.
- [Google SRE Workbook: error budgets](https://sre.google/workbook/error-budget-policy/): making SLOs organisational.
- [Chapter 09 Dashboards](/en/dashboards/): arranging these metrics into six screens.
- [Chapter 05 Alerting](/en/alerts/): when a metric earns a human.
