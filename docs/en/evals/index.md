---
title: '10 · Evals: let production traces teach you'
description: Harvest samples from real traces, run regressions and LLM-as-judge, catch version regressions, and close the trace → label → eval → improve loop.
outline: [2, 3]
---

# 10 · Evals: let production traces teach you

Metrics can say "97% success". They cannot answer the fatal question: **how much of that 97% is confidently wrong?**

That is what evals are for. And the expensive part of evaluation is never the scoring — it is **finding samples worth scoring**. Good news: you already have them.

::: tip Plain language
- **Observability** answers what happened.
- **Evals** answer whether it was right.
- **Linking them** means you do not hand-write a test set; production grows one for you.
:::

## 01 Harvesting samples from traces {#extract}

Not every trace deserves a place in the eval set. Prioritise five kinds:

| Kind | Filter | Value |
| --- | --- | --- |
| Failures | `status = ERROR` | Direct input for fixes |
| Long tail | `agent.turn > 8` or P99 latency | Efficiency and logic problems |
| Negative feedback | Thumbs down or human handoff | The most honest "wrong answer" |
| Boundaries | `finish_reason = length` | Truncation and context overflow |
| Random baseline | 1% daily | Stops you watching only anomalies |

```python
def harvest(span_rows):
    for row in span_rows:
        if not is_candidate(row):
            continue
        yield {
            "sample_id": row["trace_id"],
            "input": redact(row["user_input"]),
            "output": redact(row["final_answer"]),
            "context": {
                "turns": row["agent.turn"],
                "tools": row["tools_used"],
                "model": row["gen_ai.request.model"],
                "cost_usd": row["cost.usd"],
            },
            "label": {
                "source": "production",
                "signal": row["signal"],          # error / feedback / long_tail
                "human_label": None,
            },
        }
```

Three mandatory clean-up steps:

1. **Redact**: phone numbers, national ids, keys.
2. **Dedupe**: if one user asks the same thing ten times, keep one (hash the input).
3. **De-contextualise**: replace internal tenant ids with placeholders so the eval set does not leak your business structure.

## 02 Regression and LLM-as-judge {#regression}

<Diagram id="regression-compare" />

With samples in hand, evaluation runs in layers:

| Layer | Method | Cost | Fits |
| --- | --- | --- | --- |
| Rule assertions | Keywords, JSON schema, regex | Very low | Format, required fields, refusals |
| Semantic similarity | Embedding distance | Low | Off-topic detection |
| LLM-as-judge | Rubric scoring by a model | Medium | Accuracy, tone, completeness |
| Human review | A person reads it | High | Calibrating the judge, disputed samples |

```python
RUBRIC = """
You are a support quality reviewer. Score the answer 1-5:
5 = fully correct, complete, appropriate tone
3 = mostly correct but misses key information or sounds robotic
1 = wrong, fabricated, or off-topic
Output JSON only: {"score": int, "reason": str}
"""

def judge(sample):
    resp = llm.chat(
        system=RUBRIC,
        user=f"User question: {sample['input']}\n\nAgent answer: {sample['output']}",
        temperature=0,
    )
    result = json.loads(resp.text)
    return result["score"], result["reason"]
```

::: warning The judge lies too
LLM-as-judge has three known biases: **it prefers long answers**, **it prefers its own family's outputs**, and **it is weak on numbers and facts**. Calibrate against 200 human labels before shipping; below 80% agreement, do not gate releases on it.
:::

Regression comparison cares about change, not absolutes:

| Metric | Calculation | Decision rule |
| --- | --- | --- |
| Mean score | `mean(score)` | A drop over 0.3 needs investigation |
| Win rate | Share of samples where the new version is better | Below 45% means regression |
| Severe error rate | Share with `score <= 2` | Any increase is an incident |
| Agreement | Match rate with human labels | Used to calibrate the judge |

## 03 Detecting degradation {#degradation}

<Diagram id="degrade-matrix" />

After a release, metrics worsen in two ways: **a cliff** (same day) or **a slow rot** (over a week).

| Signal | Detection | Note |
| --- | --- | --- |
| Success cliff | 5-minute window vs previous hour | Most common, easiest to catch |
| Rising mean turns | 7-day moving average | Early sign of prompt regression |
| Rising cost per task | Grouped by version | Context bloat or loops |
| Falling eval score | 200 samples daily | The truth about quality |
| Refusal shift | Compare by version | Safety policy over-firing |

```python
def detect(version, baseline_days=7):
    cur = metrics.load(version=version, window="1d")
    base = metrics.load(version="previous", window=f"{baseline_days}d")
    alerts = []
    for name, threshold in {"success_rate": -0.02, "mean_turns": +0.3,
                            "cost_per_task": +0.15, "eval_score": -0.2}.items():
        delta = cur[name] - base[name]
        if (threshold < 0 and delta < threshold) or (threshold > 0 and delta > threshold):
            alerts.append({"metric": name, "delta": round(delta, 3)})
    return alerts
```

::: tip Make version a first-class dimension
Without a version attribute, a canary release turns observability into a guessing game. Every span should carry `deployment.version` and `prompt.version`.
:::

## 04 The closed loop {#closed-loop}

<Diagram id="eval-loop" />

A closed loop is not a slogan; it has five links that must connect:

| Link | Input | Output | Owner |
| --- | --- | --- | --- |
| Detect | Boards, alerts, feedback | Issue list | SRE / support |
| Sample | Trace store | Eval samples | Platform |
| Label | Samples + rubric | Labels | Research / humans |
| Evaluate | Old vs new version | Scores and win rate | Research |
| Improve | Eval findings | New prompt or logic | Engineering |

```python
# Turning negative feedback into a to-label sample is the best-value link in the loop
def on_user_feedback(trace_id, rating):
    if rating >= 0:
        return
    sample = harvest_one(trace_id)
    sample["label"]["signal"] = "negative_feedback"
    dataset.push("needs_review", sample)
    alerts.maybe_fire("negative_feedback_spike", trace_id)
```

A mature loop answers every week: **what did we change, how much better did it get, and what did we break?** If you cannot answer, the loop is a slide deck.

## Eval health metrics {#board-sample}

| Metric | Definition | Healthy |
| --- | --- | --- |
| Sample freshness | Share from the last 7 days | > 70% |
| Label coverage | Labelled / harvested | > 60% |
| Judge agreement | Match with human labels | > 80% |
| Regression cadence | Runs per week | ≥ 2 |
| Closure rate | Found → verified fixed | > 50% per month |

## Pitfalls {#pitfalls}

::: warning Five eval-link mistakes
1. **Only using a golden set.** The real distribution moved; your test set still lives in last year.
2. **Samples without metadata.** You cannot tell which users or models produced them.
3. **Shipping an uncalibrated judge.** The score looks stable because it is consistently biased.
4. **Evaluating without acting.** A weekly report nobody uses is not a loop.
5. **PII leaking into eval sets.** Test data spreads more casually than production data.
:::

## Recap {#recap}

- Harvest from failures, long tails, negative feedback, truncations and a random baseline.
- Clean with three steps: redact, dedupe, de-contextualise.
- Four eval layers: rules, similarity, LLM-as-judge, human review.
- Calibrate the judge against human labels; below 80% agreement it is not a gate.
- Degradation detection needs the version dimension, with different windows for cliffs and rot.
- All five links of the loop must exist, or you are just generating reports.

Next: the topic every enterprise asks about — security, privacy and compliance.

## Further reading {#reading}

- [OpenAI evals guide](https://platform.openai.com/docs/guides/evals): the basic evaluation paradigm.
- [Langfuse datasets and evals](https://langfuse.com/docs/datasets/overview): datasets and scoring in practice.
- [Chapter 09 Dashboards](/en/dashboards/): where problems are detected.
- [Chapter 11 Security and compliance](/en/security/): the privacy boundary for eval data.
