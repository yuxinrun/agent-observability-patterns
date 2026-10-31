---
title: 11 · Security, privacy and compliance
description: Retention, minimisation, tenant isolation, access control and data residency — the five boundaries every enterprise needs.
outline: [2, 3]
---

# 11 · Security, privacy and compliance

An observability platform is **the most dangerous data warehouse in the company**: it holds what users said, what models answered, what tools received, and the names of internal services.

One misconfiguration turns it from a debugging tool into a breach report.

::: tip Plain language
Compliance is not "more documents". It answers five questions:
1. How long do we keep it? (retention)
2. What do we keep? (minimisation)
3. Who can look? (access)
4. Where does it live? (residency)
5. How do we prove it? (audit)
:::

## 01 Retention policy {#retention}

<Diagram id="retention-life" />

| Data type | Suggested retention | Rationale |
| --- | --- | --- |
| Raw traces with attributes | 15–30 days | Enough to debug, affordable |
| Aggregated metrics | 13 months | Year-over-year, capacity planning |
| Audit logs | 1–3 years | Regulatory (sector-dependent) |
| Eval samples (redacted) | 6–12 months | Regression comparison |
| Raw content containing PII | Avoid; if unavoidable ≤ 7 days | Highest risk |
| Error snapshots | 30–90 days | Reproduction window |

```python
# Tiered clean-up: drop payload, downsample, delete, roll up
RULES = [
    {"age": "7d",  "action": "drop_payload",   "match": {"has_pii": True}},
    {"age": "30d", "action": "downsample",     "keep": 0.1},
    {"age": "90d", "action": "delete_traces"},
    {"age": "13mo","action": "rollup_to_daily"},
]
```

Retention belongs in code, not in a wiki. Wikis expire; cron jobs do not.

## 02 What never gets stored {#redaction}

Start with the absolute no-list:

| Type | Treatment |
| --- | --- |
| API keys / tokens / cookies | Never stored; deleted in the logger |
| Full prompt / full answer | Off by default; hash and prefix only |
| Raw tool responses | Truncate plus a field allow-list |
| National id / bank card | Mask or hash, never plaintext |
| Audio / image files | Store a reference, not the content |

A workable data classification:

| Level | Examples | Storage | Access |
| --- | --- | --- | --- |
| L1 Public | Model name, duration | Anywhere | Everyone |
| L2 Internal | Service names, routes, error codes | Internal platform | Engineering |
| L3 Sensitive | User id, order id | Encrypted fields | On request |
| L4 Critical | Conversation text, identity numbers | Not stored, or strongly encrypted | Two-person approval |

::: warning Hashing is not magic
A phone number has eleven digits; its hash space is brute-forceable. For low-entropy fields use **salted hashing or HMAC**, with the salt stored separately.
:::

## 03 Multi-tenant isolation {#tenancy}

<Diagram id="tenant-matrix" />

Three levels, with rising cost and strength:

| Level | Approach | Isolation | Cost |
| --- | --- | --- | --- |
| Row | `tenant.id` on every record, enforced at query time | Weak (depends on code) | Low |
| Table/partition | One table or partition per tenant | Medium | Medium |
| Instance | Separate database or cluster | Strong | High |

```sql
-- The classic row-level failure: a missing WHERE
SELECT * FROM otel_spans
WHERE tenant_id = {tenant}         -- injected server-side, never from the client
  AND timestamp > now() - INTERVAL 1 DAY;
```

| Must be isolated | Why |
| --- | --- |
| Trace data | Contains business arguments |
| Metric labels | Tenant dimensions reveal volume |
| Eval samples | Mixing tenants is data leakage |
| Exports | Export files escape control fastest |
| Encryption keys | Large customers may demand their own KMS key |

## 04 Access control {#access}

<Diagram id="access-matrix" />

| Role | Aggregates | Trace list | Trace detail | Raw content | Export |
| --- | --- | --- | --- | --- | --- |
| Executive | Yes | Yes | No | No | Summary |
| Product | Yes | Yes | Yes (redacted) | No | Limited |
| Engineering | Yes | Yes | Yes | On request | Limited |
| Support | Current tenant | Yes | Yes (redacted) | No | No |
| Security audit | Yes | Yes | Yes | Yes (approved) | Yes (logged) |
| External vendor | No | No | Separate environment | No | No |

Three hard rules:

1. **Viewing detail is itself logged.** Who looked at which trace is audit data.
2. **Exports require approval.** Most data leaks begin with a CSV.
3. **Permissions follow the tenant.** Support must not see another customer's chain.

## 05 Data residency {#residency}

<Diagram id="residency-compare" />

| Option | Where data lives | Upside | Risk |
| --- | --- | --- | --- |
| Fully self-hosted | Your data centre or VPC | Total control | Ops cost |
| Regional SaaS | A chosen region | Low effort | Verify sub-processors |
| Global SaaS | Vendor decides | Cheapest | Cross-border exposure |
| Hybrid | Sensitive fields local, metrics cloud | Balanced | Architectural complexity |

::: danger Three overlooked cross-border paths
1. **CDN and static assets**: irrelevant at first glance, yet they log IPs and user agents.
2. **Vendor support access**: a support engineer reading your data — is that a transfer?
3. **Backups and disaster recovery**: primary in-country, backups abroad, still a transfer.
:::

Ask every vendor three questions: which region stores the data, who can access it, and how quickly deletion requests take effect.

## Compliance health metrics {#board-sample}

| Metric | Definition | Healthy |
| --- | --- | --- |
| PII hits | Redaction rule triggers | Trending down |
| Over-retained data | Records past their window | Zero |
| Anomalous access | Off-hours or bulk queries | Zero (alert) |
| Export approval rate | Approved / total exports | 100% |
| Deletion latency | Request to completion | Under the statutory limit |

## Pitfalls {#pitfalls}

::: warning Five compliance failures
1. **Retention only in documentation.** Nobody runs it, so data is kept forever.
2. **Production data in test environments.** The most common and least defensible leak.
3. **Permissions set to "everyone can read".** Convenience becomes an incident.
4. **Redacting logs but not trace attributes.** `db.statement` can contain a phone number.
5. **Backups outside the compliance scope.** You deleted the primary; the copy lives on.
:::

## Recap {#recap}

- Retention by tier: traces short, aggregates long, audits per regulation.
- Minimise: keys, raw text and identity numbers never enter the observability store.
- Isolation has three levels; row-level is cheapest and most code-dependent.
- Access is role × tenant, with logging on detail views and exports.
- Residency includes CDNs, vendor support access and backups.
- Compliance metrics must prove you actually execute the policy.

Next is the most cathartic chapter in the book: the production scar tissue catalogue.

## Further reading {#reading}

- [OpenTelemetry security](https://opentelemetry.io/docs/security/): hardening the collection path.
- [GDPR data minimisation](https://gdpr-info.eu/art-5-gdpr/): the legal basis for retention and minimisation.
- [Chapter 04 Logs and audit](/en/logs/): field-level redaction in practice.
- [Chapter 12 The pitfalls catalog](/en/pitfalls/): real compliance incidents.
