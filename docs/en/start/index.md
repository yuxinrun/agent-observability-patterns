---
title: How to read this guide in 30 minutes
description: Who this handbook is for, how to navigate it, what you need to know first, and three reading paths by role.
outline: [2, 3]
---

# How to read this guide in 30 minutes

This handbook solves one very specific problem: **your agent is in production, and you cannot see it.**

It is not about making models smarter, and it does not rank models. It teaches one thing only: **how to turn a program that makes its own decisions into a chain you can inspect, measure, audit and improve.**

## Who this is for {#audience}

| Role | What you get | Start at |
| --- | --- | --- |
| Curious beginner | Intuition and analogies you can follow without writing code | 00 → 01 → 03 → 09 |
| Backend / agent developer | Copy-paste instrumentation and four engineering patterns | 13 → 02 → 08 |
| Agent platform developer | Multi-tenancy, sampling, storage and cost design | 06 → 11 → 14 |
| SaaS founder | Cost model, SLOs, alerts and boards you can align a team on | 03 → 05 → 09 |
| Ops / SRE | Alert noise reduction, sampling, capacity and incident flow | 05 → 12 → 14 |

## Before you start {#prereq}

The code chapters assume:

- Some Python (or TypeScript): you can read `with` and `async`.
- You know what an HTTP header is and what JSON looks like.
- A machine that can run Docker (for the demos).

They do not assume:

- You have read the OpenTelemetry specification.
- You have used Langfuse / Jaeger / Grafana.
- You know distributed tracing theory.

## Three reading paths {#paths}

**Path A — I just want to understand what it is doing (2 hours)**

00 Opening → 01 Foundations → 03 Metrics → 09 Dashboards. Afterwards you can hold a real conversation with engineers, and judge whether a board design is sane.

**Path B — I need to instrument something (half a day)**

13 Demos → 02 Tracing → 08 Instrumentation → 12 Pitfalls. Get one trace working from a demo, then come back for the patterns and anti-patterns.

**Path C — I own the launch (one day)**

06 Platforms → 05 Alerts → 11 Security → 14 Scale. These four decide whether this is affordable six months from now.

## The 30-minute minimum loop {#quickstart}

If you want to see something immediately, do exactly this:

```bash
# 1. Bring up a local backend
docker run -d --name jaeger -p 16686:16686 -p 4318:4318 \
  jaegertracing/all-in-one:latest

# 2. Install dependencies
pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http

# 3. Run the first demo from chapter 13
python demo_otel.py

# 4. Open http://localhost:16686
```

Once you have seen the waterfall, reread [chapter 02](/en/traces/) — it lands very differently.

## The whole map {#map}

| Block | Chapters | In one line |
| --- | --- | --- |
| Why | 00–01 | Why agents resist monitoring, and what trace/span really are |
| How to record | 02 | Eight tracing patterns decide the shape of the tree |
| How to measure | 03–04 | Metrics and logs turn a trace into numbers and evidence |
| How to shout | 05 | Alert severity and noise reduction |
| What to run | 06 | Platform selection without getting locked in |
| Where to plug in | 07 | Gateway, MCP, A2A, memory and orchestrator seams |
| How to write it | 08 | Four instrumentation patterns and five anti-patterns |
| How to look | 09–10 | Six boards and the eval loop |
| How to defend | 11–12 | Compliance boundaries and the scar list |
| How to scale | 13–14 | Runnable demos and large-cluster optimizations |
| How to connect | 15 | The seams with the other five projects |

## Conventions {#conventions}

- **Plain language**: the `tip` box in each section is the non-engineer explanation. You can skip it.
- **Note / Danger**: the first means "you might trip", the second means "you will get hurt".
- **Code blocks**: runnable, unless explicitly marked pseudo-code.
- **Metric names**: `gen_ai.*` plus a few custom prefixes (`agent.`, `tool.`, `memory.`, `cost.`).
- **Diagrams**: hand-written SVG/CSS, no screenshots, so they stay sharp at any zoom.

## What this book does not do {#not}

- It does not compare models or recommend one.
- It does not teach prompt engineering — that is better-agent's job.
- It does not quote vendor prices; it gives cost models and the arithmetic.
- It does not promise every demo runs first try — but each one lists its common blockers.

## Offline and search {#search}

- Site search handles English and Chinese keywords. Press `Cmd/Ctrl + K`.
- Every chapter expands to its sections in the sidebar.
- All external specs are collected in [Further reading](/en/reading/).

Ready? Start at [chapter 00](/en/intro/). Already fighting a fire? Go straight to [chapter 12](/en/pitfalls/).
