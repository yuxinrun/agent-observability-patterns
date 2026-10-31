---
title: 04 · Structured logs and audit trails
description: Required audit fields, a redaction pipeline, sampling strategies, and how to choose between ELK, Loki and ClickHouse.
outline: [2, 3]
---

# 04 · Structured logs and audit trails

Traces tell you how it went, metrics tell you how bad it is, logs tell you **what actually happened** — who did what, to what, and when.

Logs are also the part of the database most likely to become a landfill. Open it three months later: 2TB of `INFO: done` with three useful errors buried inside.

::: tip Plain language
- **Debug logs** are sticky notes for engineers: write fast, delete often, may be messy.
- **Audit logs** are contracts for compliance: fixed schema, immutable, evidential.
- Mixing both in one file is the most common piece of technical debt in this space.
:::

## 01 Debug logs vs audit logs {#audit-vs-debug}

| Dimension | Debug logs | Audit logs |
| --- | --- | --- |
| Reader | Whoever wrote the code | Compliance, security, support, legal |
| Format | Semi-structured, freeform | Strict schema, required fields |
| Lifetime | 7–30 days | 180 days to 3 years (sector-dependent) |
| Mutability | May be dropped or sampled | Immutable, hash-chained or WORM |
| Content | Variables, stack, timing | Who, when, what, result, policy |
| Cost of failure | One extra coffee | Fines, lawsuits, no defence |

One agent request writes both:

```python
import logging, uuid

audit = logging.getLogger("audit")
debug = logging.getLogger("agent")

def handle_task(user, task):
    request_id = str(uuid.uuid4())
    audit.info("task.started", extra={
        "event_id": request_id,
        "actor.id": user.id_hashed,
        "actor.role": user.role,
        "action": "agent.task.start",
        "target.type": "agent",
        "target.id": "support-agent",
        "tenant.id": user.tenant,
        "trace_id": current_trace_id(),
        "policy.version": "refund-policy-v3",
    })
    debug.debug("prompt tokens=%d turn=%d", 1204, 2)
```

## 02 Required audit fields {#fields}

<Diagram id="audit-fields" />

| Field | Example | Why it is required |
| --- | --- | --- |
| `event_id` | `evt_01J8…` | Idempotency, dedupe, reconciliation |
| `occurred_at` | ISO 8601 with timezone | Time base for multi-region business |
| `actor.id` / `actor.role` | `u_9f2…` / `support` | Who did it |
| `action` | `agent.tool.call` | What was done |
| `target.type` / `target.id` | `order` / `A10293` | Who it was done to |
| `result` | `success` / `denied` | Outcome, including refusals |
| `reason` | `policy_blocked` | Why that outcome |
| `trace_id` / `span_id` | `4f9c…` | One click into the trace |
| `tenant.id` | `acme` | Isolation and billing |
| `policy.version` | `refund-policy-v3` | Which rule applied then |
| `prev_hash` | `sha256:…` | Tamper-evident chain |

::: warning Never write "the model felt" into an audit log
Audits need **verifiable facts**: which tool ran, with which redacted arguments, what status came back, under which policy. "The model judged the user probably wanted a refund" cannot be defended.
:::

Four event families always need an audit trail:

| Event | Example | Suggested retention |
| --- | --- | --- |
| Authorisation decisions | Tool call blocked by policy | 1 year |
| Money or entitlement changes | Refund, price change, coupon | 3 years (sector-dependent) |
| Sensitive data access | Address, medical record | 1–3 years |
| Human intervention | Agent takeover, forced stop | 1 year |

## 03 Redacting sensitive content {#redaction}

<Diagram id="redaction-flow" />

The rule: **redact before the data leaves the process.** Redacting at the log platform means the data already crossed the network and hit a disk.

```python
import re

PATTERNS = {
    "phone_cn": r"(?<!\d)1[3-9]\d{9}(?!\d)",
    "id_card_cn": r"(?<!\d)\d{17}[\dXx](?!\d)",
    "email": r"[\w.+-]+@[\w-]+\.[\w.]+",
    "api_key": r"(sk|ak|ghp)_[A-Za-z0-9]{16,}",
    "bank_card": r"(?<!\d)\d{16,19}(?!\d)",
}

def redact(text: str) -> str:
    for name, pattern in PATTERNS.items():
        text = re.sub(pattern, f"[REDACTED:{name}]", text)
    return text
```

| Data type | Treatment | Note |
| --- | --- | --- |
| Phone, national id | Mask or hash | Keep last four for support checks |
| Email | Hash + keep domain | `a***@example.com` |
| Keys, cookies | **Delete entirely** | Never mask a secret |
| Raw user text | Off by default | Opt-in with short retention |
| Tool responses | Truncate + redact | First 500 chars is enough to locate |

Three layers, all required:

1. **SDK**: redact inside the log formatter, so nobody has to remember.
2. **Collector**: a redaction processor as a backstop for third-party libraries.
3. **Storage**: field-level encryption plus access auditing.

## 04 Log sampling {#sampling}

<Diagram id="log-sampling" />

Log volume typically runs 5–20× trace volume. Store everything and you are funding a storage vendor's office.

| Strategy | How | Fits |
| --- | --- | --- |
| Level-based | DEBUG 1%, INFO 10%, WARN/ERROR 100% | The default start |
| Hash-based | `hash(trace_id) % 100 < 10` | Keeps a trace all-in or all-out |
| Tail-based | Buffer, flush only on error | Guarantees samples for incidents |
| Rate limit | N lines/sec per service | Survives log storms |

```python
import hashlib

def should_log(level: str, trace_id: str) -> bool:
    if level in ("WARN", "ERROR", "AUDIT"):
        return True
    bucket = int(hashlib.md5(trace_id.encode()).hexdigest()[:8], 16) % 100
    return bucket < (1 if level == "DEBUG" else 10)
```

::: tip Hash the trace id, not a random number
Random sampling produces the classic tragedy: service A logged the incident, service B did not. Modulo on `trace_id` keeps a whole chain or drops it whole.
:::

## 05 Choosing a log store {#storage}

<Diagram id="log-store" />

| Option | Strength | Weakness | Fits |
| --- | --- | --- | --- |
| ELK / OpenSearch | Strong full-text search, mature | Heavy, expensive to operate | Mid-large with an existing team |
| Loki | Cheap, native to Grafana | Weak at complex aggregation | Small-medium, label queries |
| ClickHouse | Blazing aggregation, great compression | You build the query layer | Large, unified logs + metrics |
| Object storage + DuckDB | Dirt cheap, on-demand | Not real-time | Archive, compliance |

Rules of thumb:

- **Under 50GB/day**: Loki plus object storage. Cheap and calm.
- **50–500GB/day with real analysis**: ClickHouse.
- **Compliance-driven search with an existing team**: ELK.
- **Audit logs**: a separate pipeline into WORM storage, never mixed with debug logs.

## Log health metrics {#board-sample}

| Metric | Definition | What a spike means |
| --- | --- | --- |
| Lines per request | Lines / requests | A loop or duplicate logging |
| ERROR share | errors / total | Something actually broke |
| Redaction hits | Replacements per minute | A new ungoverned data source |
| Drop rate | Sampled or rate-limited away | You will be blind during incidents |
| Audit gap | Expected events − actual | Anything above zero is a compliance issue |

## Pitfalls {#pitfalls}

::: warning Five expensive logging mistakes
1. **INFO inside a loop.** Forty tool calls per turn makes logs 100× the trace.
2. **Dumping the whole request body.** Tokens, phone numbers and addresses included.
3. **Audit and debug sharing one logger.** Change the sampler, lose the evidence.
4. **Storing messages without `trace_id`.** You cannot jump from log to trace.
5. **Local timestamps without a timezone.** Cross-region debugging becomes philosophy.
:::

## Recap {#recap}

- Debug logs are for humans, audit logs are for compliance; keep them physically separate.
- An audit record answers who, when, to what, what was done, the outcome, and the policy.
- Redact in-process, backstop at the Collector, encrypt at rest.
- Sample by hashing `trace_id`; errors and audits are never sampled.
- Choose storage by daily volume and query shape; audits go to WORM.

Next: when to wake a human, and how to keep alerts from being ignored.

## Further reading {#reading}

- [OpenTelemetry logs data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/): standard fields and severity.
- [OpenTelemetry Collector processors](https://opentelemetry.io/docs/collector/configuration/#processors): redaction, sampling and batching.
- [Chapter 05 Alerting](/en/alerts/): turning a log error into one useful page.
- [Chapter 11 Security and compliance](/en/security/): retention, isolation and data boundaries.
