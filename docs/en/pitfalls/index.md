---
title: 12 · The pitfalls catalog
description: Broken traces, lost spans, instrumentation bloat, alert fatigue, hidden loop cost, silent failures and bad sampling — seven real incidents and their fixes.
outline: [2, 3]
---

# 12 · The pitfalls catalog

No new concepts here. Only **tuition that someone else already paid**.

Every entry follows the same shape: symptom, root cause, fix, prevention. You will notice that most incidents are not "the technology was too hard" — they are "a field was missing" or "a limit was absent".

::: tip Plain language
The shared structure of every pitfall: **an assumption that holds in normal conditions fails in abnormal ones, and you have no evidence ready for the abnormal case.**
:::

## 01 Broken trace ids {#broken-trace}

<Diagram id="broken-trace" />

**Symptom**: one chain at the gateway, two chains inside the agent service, and the tool call lives in a third.

**Root cause**: context was lost at a boundary. Most often async tasks, thread pools, or "I built my own Tracer".

```python
# Wrong: the task goes to a pool, the context stays behind
executor.submit(handle, task)

# Right: carry the context with it
ctx = contextvars.copy_context()
executor.submit(ctx.run, handle, task)
```

| Step | What to check |
| --- | --- |
| 1 | Does the downstream service create a new root span (`parent_span_id` empty)? |
| 2 | Does ingress middleware call `extract`? |
| 3 | Is context passed across async boundaries? |
| 4 | Does the gateway header allow-list include `traceparent`? |

**Prevention**: a CI test that runs a minimal three-service chain and asserts exactly one trace id.

## 02 Lost and out-of-order spans {#stream-loss}

<Diagram id="stream-loss" />

**Symptom**: users report answers stopping mid-sentence, yet the board shows 100% success. Or a span ends before it starts.

**Root cause**: the generator was closed early and `with` exited normally; or several coroutines wrote the same span concurrently.

| Cause | Fix |
| --- | --- |
| Client disconnect, `GeneratorExit` swallowed | Explicitly set `stream.completed=false` in `finally` |
| Multiple threads writing one span | One span, one coroutine; counts in local variables |
| Server-side timeout | Record `stream.timeout=true` and `set_status(ERROR)` |
| Clock skew | NTP everywhere; order by sequence, not local time |

```python
finally:
    span.set_attribute("stream.completed", completed)
    if not completed:
        span.set_attribute("stream.abort_reason", abort_reason)
    span.end()
```

## 03 Instrumentation bloat {#over-instrument}

<Diagram id="cost-blow" />

**Symptom**: two weeks after launch, the observability bill exceeds the model bill.

**Root cause**: three things compounding — a span per token, full prompt storage, no sampling.

| Waste source | Typical multiplier | Fix |
| --- | --- | --- |
| One span per token | 100–1000× | One span per request plus counters |
| Full prompt and response | 20–50× | Hash, prefix, truncate |
| One span per function | 5–10× | Spans only at boundaries |
| No sampling | 1× volume but huge cardinality | 10% head sampling, 100% errors |
| High-cardinality labels | 10× index cost | Drop id-like labels |

::: warning A counter-intuitive fact
Removing 80% of spans usually does not reduce debuggability. Useful information concentrates in a handful of boundary spans; the rest is a function call diary.
:::

## 04 Alert fatigue {#alert-fatigue}

**Symptom**: 200 alerts a day in the channel; real incidents go unread.

**Root cause**: treating "the metric moved" as "a human must act". The gap between them is "is there an action".

| Stage | Action |
| --- | --- |
| One | Measure the actionable rate of every rule over a week |
| Two | Delete or demote any rule below 30% |
| Three | Convert everything to multi-window burn rates |
| Four | Make alerts create tickets with owners |

**Prevention**: hold a monthly "alert funeral": read out the rules nobody actions, then delete them.

## 05 The token-only blind spot {#hidden-cost}

<Diagram id="cost-blow" />

**Symptom**: per-call tokens look normal; the monthly bill tripled.

**Root cause**: turn inflation. Each turn re-feeds the history, so cost grows **quadratically**, not linearly.

```
turn 1:  input   800
turn 2:  input 1,600
turn 3:  input 2,800
...
turn 10: input 12,000     ← the first ten turns already exceed 60,000
```

| Metric | What it reveals |
| --- | --- |
| `agent.turn` distribution | Whether turns are inflating |
| `input_tokens / turn` | How fast the context snowballs |
| `cost.usd` by `stop_reason` | How much loops consume |
| Consecutive calls to one tool | Early runaway signal |

**Prevention**: cap every task three ways — max turns, max tokens, max cost. Any cap triggers a stop and records `stop_reason`.

## 06 Silent failures and hallucinations {#silent-wrong}

<Diagram id="silent-fail" />

**Symptom**: 99.5% success rate, rising complaints.

**Root cause**: treating "the model produced text" as "the task completed". A tool error is read as "handled", or the model invents an order.

| Detection | Catches | Cost |
| --- | --- | --- |
| Tool result assertions | Tool returned 500 but the flow continued | Low |
| Business state checks | Refund claimed, order state unchanged | Low |
| Sampled LLM-as-judge | Fabrication, off-topic answers | Medium |
| Human review | Tone, compliance, complex logic | High |

```python
# The cheapest defence: make "done" objectively verifiable
if not order_status_changed(order_id):
    span.set_attribute("task.verified", False)
    span.set_status(trace.Status(trace.StatusCode.ERROR, "state_not_changed"))
    raise TaskNotCompleted("refund claimed but order state unchanged")
```

**Prevention**: the definition of done must include an **externally verifiable fact**, not the model's own claim.

## 07 Sampling that misses the incident {#sampling-miss}

<Diagram id="sampling-miss" />

**Symptom**: the incident happened, and sampling had already discarded every relevant trace.

**Root cause**: pure random head sampling. With a 1% error rate, sampling 10% leaves you 0.1% of errors.

| Strategy | How | Fits |
| --- | --- | --- |
| Head sampling | Decide at ingress by ratio | Predictable cost, simple |
| Tail sampling | Buffer, keep errors and slow traces | Guaranteed incident samples |
| Error-first | 100% of `status=ERROR` | The best safety net |
| Key tenants | Full capture for large customers | Commercially sensitive |

```yaml
# Collector tail sampling: keep errors and slow traces, 5% of the rest
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

## Incident self-check {#board-sample}

Print this above the board and review it monthly:

| Check | Pass criteria |
| --- | --- |
| Orphan rate | < 2% |
| Orphan spans | Zero per day |
| Telemetry cost / model cost | < 10% |
| Alert actionable rate | > 70% |
| Runaway share | < 2% |
| Silent-error sampling | ≥ 50 cases per week |
| Error sample retention | 100% |

## Pitfalls {#pitfalls}

::: warning If you only remember five things
1. **Carry context across async boundaries** — the number one cause of broken chains.
2. **Close streaming spans in `finally`** and record whether they completed.
3. **Every "unbounded" needs a bound**: turns, tokens, cost, queue length.
4. **Verify success against external facts**, never the model's self-report.
5. **Never sample errors away**, or your incident review is a lottery.
:::

## Recap {#recap}

- Broken chains, lost spans and bloat are all boundary problems.
- Alert fatigue is a rule design problem, not a people problem.
- Loop cost is quadratic; caps are mandatory.
- Silent failures are only caught by evals and business checks.
- Sampling must serve incidents, not the invoice.

Next: a full runnable demo kit that turns every anti-pattern in this chapter into a working example.

## Further reading {#reading}

- [Chapter 02 End-to-end tracing patterns](/en/traces/): the correct version of everything here.
- [Chapter 05 Alerting](/en/alerts/): making alerts readable again.
- [Chapter 10 Evals](/en/evals/): the real fix for silent failures.
- [Chapter 14 Scaling](/en/scale/): advanced sampling and queue tuning.
