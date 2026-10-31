---
title: '05 · Alerting: when to wake a human'
description: P0–P3 severity, five high-frequency rule templates, a noise-reduction pipeline, and alerts that carry a trace link.
outline: [2, 3]
---

# 05 · Alerting: when to wake a human

An alert is not "send a message when something breaks". It is **an interruption with a cost attached.**

Done well, an engineer gets up at 3am, localises the problem in twenty minutes, and the damage stays bounded. Done badly, three months later everyone has muted the channel and a genuine P0 grows mushrooms in it.

::: tip Plain language
Alerting has two failure modes: **silence when it mattered (a miss)** and **screaming when it did not (the boy who cried wolf)**. The second is worse, because it permanently destroys your ability to fix the first.
:::

## 01 Alert severity P0–P3 {#severity}

<Diagram id="severity" />

| Level | Meaning | Response | Channel | Example |
| --- | --- | --- | --- | --- |
| P0 | Core business down, money lost | Within 5 minutes | Phone + SMS + chat | Every payment agent failing |
| P1 | Major function impaired, workaround exists | Within 30 minutes | SMS + chat | Success rate below SLO |
| P2 | Localised anomaly, main flow fine | Next business day | Chat / ticket | One tool at 5% failure |
| P3 | Trend worth improving | Scheduled | Weekly digest | Mean turn count creeping up |

The deciding question is not "how bad is it" but **"is waking someone now useful"**. A crude but effective test: if the person you wake can immediately do something — roll back, throttle, shift traffic — it is P0/P1. If they can only wait for sunrise, it is P2.

```yaml
# Encode severity in the rule, not in the on-call engineer's judgement at 3am
labels:
  severity: P1
  team: agent-platform
  runbook: https://wiki/runbooks/agent-success-drop
```

## 02 Five high-frequency rules {#rules}

<Diagram id="alert-rules" />

### 1. Failure rate spike

```yaml
- alert: AgentFailureRateHigh
  expr: |
    sum(rate(agent_tasks_total{status="failed"}[5m]))
    / sum(rate(agent_tasks_total[5m])) > 0.05
  for: 5m
  labels: { severity: P1 }
```

### 2. Per-task token or cost blowout

```yaml
- alert: AgentTaskCostSpike
  expr: histogram_quantile(0.95, sum by (le) (rate(agent_task_cost_bucket[15m]))) > 0.20
  for: 10m
  labels: { severity: P1 }
```

### 3. Runaway loop (too many turns)

```yaml
- alert: AgentRunawayLoop
  expr: sum(rate(agent_tasks_total{stop_reason="max_turns"}[10m]))
        / sum(rate(agent_tasks_total[10m])) > 0.02
  for: 10m
  labels: { severity: P1 }
```

This one is worth more than the failure rate: loops usually **do not fail**, they just get expensive.

### 4. Persistent tool errors

```yaml
- alert: ToolErrorBurst
  expr: sum by (tool) (rate(tool_calls_total{status="error"}[5m])) > 0.5
  for: 5m
  labels: { severity: P2 }
```

### 5. End-to-end timeout and gateway errors

```yaml
- alert: AgentEndToEndTimeout
  expr: histogram_quantile(0.95, sum by (le) (rate(agent_duration_bucket[10m]))) > 30000
  for: 10m
  labels: { severity: P1 }
```

| Rule | Threshold | Usual false positive |
| --- | --- | --- |
| Failure rate | 5% over 5min | A batch job failing together |
| Task cost | P95 > $0.20 | One customer's giant document |
| Loop rate | 2% over 10min | A prompt change just shipped |
| Tool errors | > 0.5/s | Upstream rate limiting |
| End-to-end timeout | P95 > 30s | Provider flakiness |

## 03 Noise reduction {#noise}

<Diagram id="noise-pipe" />

| Technique | How | Effect |
| --- | --- | --- |
| Grouping | Aggregate by `alertname + tenant + tool` | 100 alerts become 3 |
| Inhibition | Mute related P2s while a P0 is firing | No cascade spam |
| Dedupe | Same fingerprint once per 30 minutes | Removes retry amplification |
| Delay | `for: 5m`, fire only if sustained | Removes jitter |
| Silence windows | Deploys, batch jobs, drills | Removes planned noise |
| Burn rate | Multi-window budget alerts | Removes chronic noise |

::: warning The real cost of an alert storm
One database hiccup can produce 400 alerts, 399 of them the same root cause. The on-call engineer scrolls for five minutes to find the first one, then spends twenty confirming they are all the same thing. Noise reduction is not polish; it is MTTR.
:::

## 04 Context in the alert {#context}

<Diagram id="alert-context" />

A good alert lets a human understand the situation **without opening a laptop**.

```text
[P1] Agent success rate below SLO
Current: 93.2% (SLO 99.0%, sustained 8m)
Impact: tenant acme dominant (62% of failures)
Top failure: tool_timeout (search_orders, 41 calls)
Sample trace: https://obs.example.com/trace/4f9c1d2e8a7b4c6d
Runbook: https://wiki/runbooks/agent-success-drop
Recent change: support-agent v2.4.1 deployed at 22:10
```

| Field | Purpose |
| --- | --- |
| Current value + SLO line | Instant severity read |
| Blast radius (tenant / version) | Decide rollout vs rollback |
| Top failure reason | Skips the first debugging round |
| **Trace link** | One click to the scene |
| Runbook | A newcomer can follow it |
| Recent changes | Where 80% of answers live |

```python
def build_alert(payload):
    trace = payload["sample_trace_id"]
    return {
        "title": f'[{payload["severity"]}] {payload["name"]}',
        "text": (
            f'Current {payload["value"]:.1%} (SLO {payload["slo"]:.1%})\n'
            f'Top tenant {payload["top_tenant"]}, {payload["share"]:.0%} of failures\n'
            f'Sample trace {OBS_URL}/trace/{trace}\n'
            f'Runbook {payload["runbook"]}'
        ),
    }
```

## Alerting health metrics {#board-sample}

| Metric | Definition | Healthy |
| --- | --- | --- |
| Alerts per week | Total volume | Under ~20 for most teams |
| Actionable rate | Share needing human action | > 70% |
| Time to acknowledge | Fired to claimed | < 5 min for P0/P1 |
| Duplicate rate | Same fingerprint repeated | < 10% |
| Silence coverage | Planned events silenced | > 90% |

## Pitfalls {#pitfalls}

::: warning Five self-destructive alerting designs
1. **One alert per metric.** Eventually everyone reads only the channel name.
2. **Static thresholds that ignore traffic.** Green by day, red all night.
3. **No trace link.** The on-call starts from zero.
4. **P0 delivered by email.** Email at 3am is not delivery.
5. **No owner.** Everyone assumes someone else will handle it.
:::

## Recap {#recap}

- Severity is "can waking someone change the outcome right now", not a feeling.
- Five rules cover most value: failure rate, cost, loops, tool errors, end-to-end timeout.
- Six noise tools: grouping, inhibition, dedupe, delay, silence, burn rate.
- Every alert carries current value, blast radius, top cause, trace link, runbook, recent changes.
- Review actionable rate weekly; useless alerts are debt with interest.

Next: platform selection — Langfuse, OpenLLMetry, Phoenix, LangSmith, and which one to actually pick.

## Further reading {#reading}

- [Prometheus alerting best practices](https://prometheus.io/docs/practices/alerting/): rule design and naming.
- [Google SRE: alerting on SLOs](https://sre.google/workbook/alerting-on-slos/): multi-window burn rates.
- [Chapter 10 Evals](/en/evals/): why some problems only surface in evaluation.
- [Chapter 12 The pitfalls catalog](/en/pitfalls/): a full case study of alert fatigue.
