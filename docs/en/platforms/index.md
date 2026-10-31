---
title: '06 · Platform selection: Langfuse, Phoenix, LangSmith'
description: How four open platforms position themselves, what self-hosting really costs, a lightweight stack, commercial options, and the minimum viable production combo.
outline: [2, 3]
---

# 06 · Platform selection: Langfuse, Phoenix, LangSmith

Choosing a platform is like choosing a flat: **not the best one, the one you are least likely to regret.**

You will regret three things: data you cannot move, a bill that scales per request, and "that feature only works with their SDK".

::: tip Plain language
Separate two things first:
- **Instrumentation libraries** (OpenLLMetry, OpenInference, the OTel SDK) get the data out. Usually open source and replaceable.
- **Observability platforms** (Langfuse, Phoenix, LangSmith, Datadog) store and display it, and usually own the invoice.

**The durable strategy: standardised instrumentation, replaceable platform.**
:::

## 01 The landscape {#landscape}

<Diagram id="platform-matrix" />

| Platform | Position | Protocol | Self-hosting | Data sovereignty | Fits |
| --- | --- | --- | --- | --- | --- |
| **Langfuse** | LLM observability + prompts + evals | OTel / own SDK | Docker Compose, simple | Full ownership | Product teams wanting batteries |
| **OpenLLMetry** | Instrumentation library, not a platform | OTel native | N/A (it only emits) | Your backend | Teams with a backend, missing spans |
| **Phoenix** | Eval-first observability and experiments | OTel / OpenInference | Single container, easy | Full ownership | Research and eval-driven teams |
| **LangSmith** | Commercial SaaS: traces, evals, datasets | Own + OTel ingress | Enterprise only | Mostly cloud | Teams deep in LangChain |
| **Datadog / New Relic** | LLM module of a full APM | OTel / own agent | No | Cloud | Enterprises with existing contracts |

The one-line version:

- **Ship in a week**: Langfuse Cloud, or self-hosted Langfuse.
- **Avoid lock-in**: OpenLLMetry plus any OTLP backend, including Grafana Tempo.
- **Do evaluation properly**: Phoenix, or Langfuse datasets and evals.
- **One APM for the whole company**: Datadog or New Relic LLM Observability.

## 02 Which one, when {#selection}

<Diagram id="selection-flow" />

| Your situation | Recommendation | Why |
| --- | --- | --- |
| Three people, two weeks to launch | Langfuse Cloud | Zero ops; traces, prompts and evals included |
| Finance or healthcare, data cannot leave | Self-hosted Langfuse or Phoenix | Everything stays in your VPC |
| Already on Prometheus + Grafana | OpenLLMetry + Tempo + Grafana | No new platform, reuse on-call |
| Systematic evals and regressions | Phoenix | Better eval UI and experiment tracking |
| Heavy LangChain / LangGraph use | LangSmith | Deepest integration, best debugging |
| Existing Datadog contract | Datadog LLM Observability | Reuse alerts, SLOs, on-call |
| Just want to see a trace today | OpenLLMetry + Jaeger | Half a day to first waterfall |

::: warning "Open source" is not "free"
Self-hosted Langfuse and Phoenix cost no licence fee, but they do cost machines, Postgres, ClickHouse, backups, upgrades and half an engineer. That frequently exceeds the SaaS bill — unless your data genuinely cannot leave.
:::

## 03 Lightweight self-hosting {#lightweight}

If all you need is "see traces, search logs, fire alerts", a pure open-source stack does the job at a predictable cost.

<Diagram id="light-stack" />

```yaml
# docker-compose.yml (trimmed; shows the component relationships)
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    volumes: [./otel.yaml:/etc/otel.yaml]
    command: ["--config=/etc/otel.yaml"]
    ports: ["4317:4317", "4318:4318"]

  tempo:
    image: grafana/tempo:latest
    command: ["-config.file=/etc/tempo.yaml"]

  openobserve:
    image: openobserve/openobserve:latest
    environment:
      ZO_ROOT_USER_EMAIL: admin@example.com
      ZO_ROOT_USER_PASSWORD: changeme
    ports: ["5080:5080"]

  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana:latest
    ports: ["3000:3000"]
```

| Component | Job | Alternative |
| --- | --- | --- |
| OTel Collector | Receive OTLP, batch, redact, route | Vector, Fluent Bit |
| Tempo | Trace storage and query | Jaeger, ClickHouse |
| OpenObserve | Log storage and search | Loki, ELK |
| Prometheus | Metrics | VictoriaMetrics, Mimir |
| Grafana | Boards and alerts | Your own frontend |

The upside is **no per-request billing**. The downside is **no LLM-specific views** — prompt diffs, datasets, evals. You can build them in Grafana, at the cost of time.

## 04 Commercial options {#commercial}

<Diagram id="commercial-compare" />

| Dimension | Datadog LLM Observability | New Relic AI Monitoring | LangSmith |
| --- | --- | --- | --- |
| Pricing | Per span / host / custom metric | Usage-based (ingest + users) | Per trace / seat |
| Strength | Full-stack correlation, mature alerting | Deep APM integration | Best LLM-native UI |
| Weakness | Expensive; LLM semantics relatively generic | LLM features still catching up | Tightly coupled to LangChain |
| Data location | Cloud | Cloud | Cloud (self-host on enterprise) |
| Fits | Large enterprises already onboard | Teams already on New Relic | Heavy LangChain users |

What commercial tools actually sell is not storage but **integration with your existing on-call, alerting and access control**. If everyone already watches SLOs in Datadog, adding a second platform makes the company slower, not faster.

## 05 The minimum production stack {#recommended}

<Diagram id="rec-stack" />

A "no regrets" combination, and the shape used by this handbook's demos:

| Layer | Choice | Role |
| --- | --- | --- |
| Instrumentation | OTel SDK + OpenLLMetry (or OpenInference) | Emit standard `gen_ai.*` spans |
| Pipeline | OTel Collector | Batch, redact, sample, dual-write |
| Traces | Langfuse or Tempo | The waterfall humans read |
| Metrics | Prometheus / ClickHouse | Boards and alerts |
| Logs | Loki or OpenObserve | Audit and search |
| Evals | Phoenix / Langfuse datasets | Quality loop |
| Display | Grafana + platform UI | Each role sees its own view |

```yaml
# otel.yaml: feed two backends at once — ideal during a migration
exporters:
  otlphttp/langfuse:
    endpoint: https://cloud.langfuse.com/api/public/otel
    headers:
      Authorization: "Basic ${LANGFUSE_AUTH}"
  otlp/tempo:
    endpoint: tempo:4317
    tls: { insecure: true }

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, redact]
      exporters: [otlphttp/langfuse, otlp/tempo]
```

::: tip Dual-write is the best migration tool
Run both for two weeks, compare the data, then decide. Far cheaper than a one-shot switch followed by "where did all the fields go".
:::

## Selection scorecard {#board-sample}

Do not choose by vibes. Score 1–5, weight, then argue about the weights:

| Dimension | Weight | What it covers |
| --- | --- | --- |
| Data compliance | 30% | Self-hosting, residency |
| Total cost including people | 25% | Three-year TCO, not the invoice |
| Protocol openness | 20% | OTel native, exportable |
| Feature fit | 15% | Prompt management, evals |
| Time to first trace | 10% | How fast the team ships |

## Pitfalls {#pitfalls}

::: warning Five selection traps
1. **Judging by the demo.** Demo traces have three levels; yours has thirty.
2. **Ignoring export.** Discovering CSV-only export during a migration is a lock-in.
3. **Instrumenting with a vendor SDK.** Switching means rewriting every call site.
4. **Underestimating self-hosting.** ClickHouse disks grow faster than you expect.
5. **Forgetting eval cost.** LLM-as-judge often costs more than trace storage.
:::

## Recap {#recap}

- Separate instrumentation from platform: OTel in, replaceable platform out.
- Langfuse is balanced, Phoenix leans eval, OpenLLMetry only emits, LangSmith is deeply coupled.
- Lightweight self-hosting = Collector + Tempo + OpenObserve + Prometheus + Grafana.
- Commercial tools sell integration, not storage.
- Minimum stack: standard spans + dual-writing Collector + one trace UI + one metrics/alerting path.

Next we wire these pieces into your stack: gateway, MCP, A2A, memory and orchestration.

## Further reading {#reading}

- [Langfuse self-hosting](https://langfuse.com/self-hosting): Docker Compose and production notes.
- [OpenLLMetry](https://github.com/traceloop/openllmetry): OTel auto-instrumentation for LLM apps.
- [Arize Phoenix](https://github.com/Arize-ai/phoenix): local observability and evals.
- [Chapter 13 The runnable demo kit](/en/demos/): includes a one-command Langfuse stack.
