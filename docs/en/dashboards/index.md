---
title: '09 · Dashboards: six production boards'
description: Overview, failures, cost, tools, sessions and runaway loops — panel definitions, query sketches and layout advice for each.
outline: [2, 3]
---

# 09 · Dashboards: six production boards

A dashboard is not "every metric drawn as a chart". It answers **the six questions six different people ask at 9am**.

An executive asks whether today is normal, an SRE asks what broke, finance asks why it costs this much, engineering asks which tool is dragging, support asks what this user went through.

::: tip Plain language
A good panel does exactly one thing: **lets someone make a decision in five seconds.** If it cannot, it is decoration.
:::

## 01 The overview board {#overview}

<Diagram id="board-overview" />

| Panel | Metric | Chart | Placement |
| --- | --- | --- | --- |
| Tasks today | `sum(agent.tasks)` | Line + day-over-day | Top left |
| Success rate | `completed / started` | Line + SLO rule | Top middle |
| Total spend | `sum(cost.usd)` | Stacked bars by model | Top right |
| Latency quantiles | P50 / P95 / P99 | Quantile band | Bottom middle |
| Runaway count | `stop_reason=max_turns` | Single value + trend | Bottom right |

Layout rule: **most important number top left, drill-down detail bottom right.** Eyes start at the top left.

```promql
# Success rate with an SLO line
sum(rate(agent_tasks_total{status="completed"}[5m]))
/ sum(rate(agent_tasks_total[5m]))

# Cost per task, P95
histogram_quantile(0.95, sum by (le) (rate(agent_task_cost_bucket[15m])))
```

::: warning Keep the overview under eight panels
Past eight, people read the first and the last. The rest is emotional support.
:::

## 02 Failure analysis {#failure}

<Diagram id="board-failure" />

| Panel | Content | Interaction |
| --- | --- | --- |
| Failure mix | Grouped by `error.type` | Click to filter |
| Failure trend | Hourly | Time brush |
| Top failing traces | Table: trace, tenant, duration, cause | Click through |
| Failure stage | Model / tool / memory / gateway | Heatmap |

```sql
-- ClickHouse: top 20 failing traces in the last hour
SELECT trace_id, tenant_id, error_type, count() AS spans, max(duration_ms) AS ms
FROM otel_spans
WHERE timestamp > now() - INTERVAL 1 HOUR AND status_code = 'ERROR'
GROUP BY trace_id, tenant_id, error_type
ORDER BY ms DESC
LIMIT 20;
```

The valuable question is not "how many failed" but **the shape of the failure**: one tool or all of them, one tenant or everyone. The shape tells you who fixes it.

## 03 Cost analysis {#cost}

<Diagram id="board-cost" />

| Panel | Dimension | Purpose |
| --- | --- | --- |
| Cost trend | Daily, stacked by model | Spot abnormal growth |
| Cost composition | Input / output / cache / tools | Find levers |
| Top tenants by cost | Table + budget line | Commercial reconciliation |
| Cost per task distribution | Histogram | Find long-tail anomalies |
| Cache savings | Cached tokens × price delta | Prove the optimisation worked |

```
total = model + tools + infrastructure
model = Σ(tokens × price)
hidden = loop_turns × per-turn context tokens × price     ← the one everyone misses
```

::: tip Every cost board needs "cost per successful task"
Total spend alone misleads: spending more may just mean more business. **Cost per successful task** measures efficiency; when that rises, you actually got more expensive.
:::

## 04 Tool performance {#tool}

<Diagram id="board-tool" />

| Panel | Metric | Chart |
| --- | --- | --- |
| Latency per tool | P50 / P95 | Horizontal bars |
| Tool failure rate | `errors / calls` | Table with colour |
| Retry amplification | `retries / calls` | Line |
| Error mix | By `error.type` | Stacked bars |
| Call volume | Hourly | Line |

This board is the **cross-team handoff point**: when `search_orders` goes from 300ms to 2s P95, you need a link you can paste to the orders team, not a sentence saying "your API got slower".

## 05 Session explorer {#session}

<Diagram id="board-session" />

| Panel | Content |
| --- | --- |
| Session list | Session id, user, turns, cost, final state |
| Session timeline | One row per trace, expandable |
| Top users by cost | Daily aggregation, abuse detection |
| Abandonment point | Which turn users leave at |
| One-click trace | Straight into the waterfall |

Session boards give support and product a shared language. Support wants "what did this user experience"; product wants "which turn do most users abandon at".

| Role | Cares about |
| --- | --- |
| Support | The full story of one session |
| Product | Abandonment rate, mean turns |
| Risk | Per-user cost anomalies |
| Engineering | Error mix within sessions |

## 06 Runaway loop monitor {#loop}

<Diagram id="board-loop" />

| Panel | Metric | Threshold |
| --- | --- | --- |
| Runaway share | `max_turns` ratio | Alert above 2% |
| Turn distribution | Histogram | A fattening tail means drift |
| Top repeated tools | Max `loop.count` | Watch above 3 |
| Runaway cost | Sum of `cost.usd` for those tasks | Separate budget |
| Top runaway tenants | Grouped by tenant | Locate the noisy customer |

```sql
-- Traces where one tool was called four or more times
SELECT trace_id, tool_name, count() AS calls, sum(duration_ms) AS ms
FROM otel_spans
WHERE name LIKE 'execute_tool%' AND timestamp > now() - INTERVAL 1 DAY
GROUP BY trace_id, tool_name
HAVING calls >= 4
ORDER BY calls DESC
LIMIT 50;
```

::: danger The most overlooked fact about loops
Runaway tasks usually end as **completed**. No failure, no error, no timeout — just the same tool called 37 times. If your board only watches failure rate, this class of incident never appears.
:::

## Universal dashboard rules {#board-sample}

| Rule | Suggestion |
| --- | --- |
| Time range | Default 24h, shortcuts for 1h and 7d |
| Timezone | One timezone, labelled |
| Colour | Red/amber/green only for thresholds |
| Units | Every axis labelled |
| Drill-down | Any aggregate links to detail |
| Empty data | Show "no data", never zero |
| Refresh | Manual plus 30s auto |

## Pitfalls {#pitfalls}

::: warning Five dashboard mistakes
1. **Thirty charts on one screen.** Nobody reads them; it is the same as none.
2. **No drill-down.** You see the anomaly and cannot enter it.
3. **Averages hiding the tail.** P95 is the user experience.
4. **Empty data rendered as zero.** Looks like "all good"; actually the metric vanished.
5. **No owner.** Six months later nobody knows why a panel exists.
:::

## Recap {#recap}

- Six boards for six questions: normal, broken, expensive, slow tool, this user, runaway.
- Every board must drill into a trace.
- Cost boards watch cost per successful task, not total spend.
- Loop monitoring deserves its own board because loops look successful.
- Keep panels under eight and render empty data honestly.

Next: turning production traces into evaluation samples and closing the loop.

## Further reading {#reading}

- [Grafana dashboard best practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/): layout and legibility.
- [Chapter 03 Metrics](/en/metrics/): the definitions behind these panels.
- [Chapter 13 Demos and templates](/en/demos/): Grafana dashboard JSON.
- [Chapter 10 Evals](/en/evals/): for the problems a board cannot see.
