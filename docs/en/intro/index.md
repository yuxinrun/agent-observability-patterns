---
title: '00 · Opening: the hardest black box to watch'
description: Why agents are harder to monitor than classic services, four ways production punishes you for flying blind, and how the four pillars divide the work.
outline: [2, 3]
---

# 00 · Opening: the hardest black box to watch

Start with the conclusion: **an agent is not a chatty API, it is a colleague who takes a different route to work every day.** A normal service follows the map you gave it. An agent reads the weather, its mood and the traffic, decides on the spot — sometimes takes three laps — and then tells you it arrived.

Watching that colleague with a single "did it arrive" metric is not enough. You need to know which route it took, where it waited 40 minutes, why it circled, and how much fuel it burned. That is observability.

::: tip Plain language
- **Monitoring** answers "is it okay right now". A thermometer: 38.5°C means fever.
- **Observability** answers "why isn't it okay". A chart, a medical history and a lifestyle log that reach the root cause.
- **Agent observability** wires an ECG, a dashcam and a ledger onto software that makes its own decisions.
:::

## 01 Classic monitoring vs agent monitoring {#difference}

Classic services are deterministic: a request enters, calls a few functions, touches the database twice, returns JSON. Their failures are honest — timeouts, 500s, exhausted pools, all leave clear marks.

Agents are probabilistic: ask the same question twice and the first run calls a search tool while the second answers from memory. One run takes 3 seconds, the next takes nine turns. And it can hand you a beautifully fabricated answer while everything looks green.

<Diagram id="blackbox" />

| Dimension | Classic service | Agent |
| --- | --- | --- |
| Execution path | Fixed, drawable | Improvised each run |
| Failure shape | Exception, error code | Often "successful" but wrong |
| Reproducibility | Same input, same output | Same input, different output |
| Cost structure | CPU, memory, bandwidth | Tokens + turns + tools, non-linear |
| Key question | "Is it down?" | "What is it thinking, and why so expensive?" |

That is why so many first versions ship with a single `logger.info("done")`. One week later the invoice and the support tickets hold a joint seminar.

::: warning A real ratio
In a typical multi-turn agent, **the first model call is only 20–35% of total tokens**. The other 65–80% is a snowballing context, tool results pasted back in, and "let me try again". Watching only the first call is watching the tip of the iceberg.
:::

## 02 Four disasters of flying blind {#disasters}

<Diagram id="disasters" />

**One: the runaway loop.** A tool returns an empty array; the model decides to try again — 37 times. No turn ceiling, no per-task cost cap, no alert on repeated tool calls. Finance finds you the next morning.

**Two: silent failure.** A user asks whether the refund arrived. The agent politely says yes. The refund API actually returned 500, and the model read the error as "handled". HTTP 200, status completed, board fully green.

**Three: unreproducible hallucination.** A user sends a screenshot where the agent promised a 3000 refund. Your logs contain one line: task completed. No input snapshot, no context, no raw model text. You cannot even confirm it was the same user.

**Four: timeout avalanche.** A downstream tool slows by 3 seconds, the agent retries, retries fill the pool, the queue grows, more tasks time out. You have no per-stage latency, so you add machines — and it gets slower.

| Disaster | Visible loss | The real loss |
| --- | --- | --- |
| Runaway loop | 10× daily bill | The team's trust in cost control |
| Silent failure | Wrong refund or address | User trust, possibly compliance |
| Unreproducible | Two days of digging | Iteration speed |
| Timeout avalanche | Whole batch fails | SLO and reputation |

## 03 The four pillars: traces, metrics, logs, evals {#four-pillars}

<Diagram id="pillars" />

**Traces** show which steps a task took, how long each took, what arguments it used, what it errored on. The dashcam.

**Metrics** compress thousands of traces into a few numbers: success rate, P95 latency, tokens, cost per task. The dashboard.

**Logs** are structured events and audit records: who did what, to what, when. The ledger.

**Evals** sample and score quality: was the answer right? The only pillar that catches silent failure.

| Pillar | Answers | Typical tools | Cost |
| --- | --- | --- | --- |
| Traces | how did it go | Tempo, Jaeger, Langfuse | high (volume) |
| Metrics | how bad is it | Prometheus, ClickHouse | low |
| Logs | what happened | Loki, ELK, OpenObserve | medium |
| Evals | was it right | Phoenix, Langfuse, in-house | medium (model spend) |

::: tip Plain language
Think of an agent as a taxi ride:
- **Trace** is the route map — did it take a detour?
- **Metrics** is the meter — is this ride profitable?
- **Logs** is the in-car recording — usable in a dispute;
- **Evals** is the passenger rating — the only one that notices "correct route, awful ride".
:::

## 04 What this handbook solves {#scope}

This is not a guide to making models smarter. It is a guide to **seeing them clearly**. After reading you can:

1. Instrument a Python or TypeScript agent and emit spans that follow the OpenTelemetry GenAI conventions.
2. Put model calls, tool calls, memory access and cross-agent delegation into one trace.
3. Design metrics at five layers: task, model, tool, UX and business.
4. Write alerts that do not wake people for nothing, and make them carry a trace link.
5. Build six production boards: overview, failures, cost, tools, sessions, runaway loops.
6. Sample and tier storage so observability cost stays a sane share of revenue.
7. Feed production traces back into an eval set and close the loop from bug to prompt fix.

Symptom → chapter:

| Symptom | Chapter |
| --- | --- |
| "Why was this one slow?" | 02 Tracing, 03 Metrics |
| "Why did the bill double?" | 03 Metrics, 09 Boards, 12 Pitfalls |
| "It said it was done, it wasn't" | 10 Evals, 12 Pitfalls |
| "The trace breaks across services" | 02 Tracing, 12 Pitfalls |
| "Too many alerts, nobody looks" | 05 Alerts |
| "There is a phone number in the logs" | 04 Logs, 11 Security |

## 05 How it plugs into the ecosystem {#ecosystem-link}

<Diagram id="eco-hub" />

This handbook belongs to a series. Each site owns one job, and observability is the layer that holds them together:

- **[better-agent](https://yuxinrun.github.io/better-agent/)**: how one agent is built. It emits turns, tool choice and context budget.
- **[a2a-patterns](https://yuxinrun.github.io/a2a-patterns/)**: how agents talk. It emits delegation, task state and cross-agent traces.
- **[mcp-patterns](https://yuxinrun.github.io/mcp-patterns/)**: how agents use tools. It emits tool calls, permission checks and server latency.
- **[agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/)**: how agents remember. It emits recall, hit rate and injected context.
- **[llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/)**: how models are called safely. It emits routing, token metering, cost and limits.

::: info An easy thing to miss
**Observability is not a sixth system; it is the exit of every system.** If the gateway does not report tokens, the MCP server does not report tool latency, and the memory layer does not report recall hits, then even the prettiest platform shows half a picture.
:::

## Pitfall checklist {#pitfalls}

::: warning Four traps to avoid from day one
1. **Buying a platform before designing fields.** The platform only displays; wrong attributes survive any migration.
2. **Putting full prompts into span attributes.** High cardinality, privacy risk and storage blowup, all at once.
3. **Monitoring only success/failure.** Your failure rate will look like 0.3% because 99.7% of mistakes are labeled success.
4. **Showing telemetry only to SRE.** Product, research and finance each need a board, or the budget never gets approved.
:::

## Recap {#recap}

- Agents are hard to watch because their path is nondeterministic, their failures are dishonest, and their cost is non-linear.
- Without observability, production charges you four ways: loops, silent failures, unreproducible bugs, timeout avalanches.
- The pillars divide the work: traces for path, metrics for trend, logs for evidence, evals for quality.
- Observability is the shared exit of five systems, not a sixth one.

Next we lay the foundation: what a trace and a span really are, why OpenTelemetry became the default, and what those intimidating GenAI attribute names actually mean.

**[→ Next: 01 Foundations](/en/fundamentals/)**

## Further reading {#reading}

- [OpenTelemetry docs](https://opentelemetry.io/docs/): semantic conventions and SDK guides.
- [Chapter 02 Tracing patterns](/en/traces/): the eight patterns in code.
- [Chapter 12 Pitfalls](/en/pitfalls/): if you only want to read about other people's crashes.
