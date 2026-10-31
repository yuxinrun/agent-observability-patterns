---
layout: home
title: Agent Observability Patterns
titleTemplate: Turn the agent black box into a trace you can read

hero:
  name: Agent Observability Patterns
  text: Agents never cry out in pain. Wire them an ECG.
  tagline: 'From a single model call to a fleet of agents: traces, metrics, logs, evals, alerts and dashboards. 16 chapters, 50+ hand-drawn diagrams, runnable demos and production scar tissue.'
  image:
    light: /hero.svg
    dark: /hero.svg
    alt: Agent trace waterfall next to a live metrics board
  actions:
    - theme: brand
      text: Start at chapter 00
      link: /en/intro/
    - theme: alt
      text: Copy the alert rules
      link: /en/alerts/
    - theme: alt
      text: Run a demo
      link: /en/demos/

features:
  - title: Plain language first, specs second
    details: Every section opens with an analogy and a "plain language" box, then the OpenTelemetry fields and code engineers actually need.
  - title: 16 chapters, black box to cluster
    details: Concepts, tracing, metrics, logs, alerting, selection, integration, instrumentation, dashboards, evals, security, pitfalls, demos, scale.
  - title: 50+ hand-drawn diagrams
    details: Span waterfalls, sequences, layers, metric samples and selection matrices — all hand-written SVG/CSS, legible in both themes and on phones.
  - title: Code you can run today
    details: Python OTel, LangGraph with OpenLLMetry, CrewAI with Langfuse, A2A propagation, MCP instrumentation, Grafana JSON.
  - title: Aligned with the official specs
    details: OpenTelemetry GenAI semantic conventions, Anthropic and OpenAI agent tracing practice. Swap backends without rewriting spans.
  - title: Bilingual, light and dark
    details: One click to switch language or theme, responsive from desktop to phone, with motion that stays out of the way.
---

<div class="a-home">

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Ecosystem</div>
      <h2 class="a-section__title">Five pieces, one layer of glue</h2>
      <p class="a-section__lead">Single agent, collaboration, tools, memory, model gateway — observability is not a sixth piece, it is what holds them together.</p>
    </div>
  </div>
  <Eco />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Chapters</div>
      <h2 class="a-section__title">16 chapters: from "what is it thinking" to "why did it explode"</h2>
      <p class="a-section__lead">Read in order, or jump straight to 02, 05, 08 and 12 if you are already in production.</p>
    </div>
    <a class="a-section__more" href="/agent-observability-patterns/en/start/">How to read →</a>
  </div>
  <ChapterMap />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Reading paths</div>
      <h2 class="a-section__title">Three paths, pick one</h2>
      <p class="a-section__lead">Do not read cover to cover. Start with the "why is it timing out again" question you actually have.</p>
    </div>
  </div>
  <div class="a-paths">
    <div class="a-path">
      <div class="a-path__k">Beginner / product</div>
      <div class="a-path__t">Build intuition first</div>
      <div class="a-path__d">No code required: why agents are hard to monitor, what each pillar does, what a board should look like.</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-observability-patterns/en/intro/">00 Opening</a>
        <a class="a-path__step" href="/agent-observability-patterns/en/fundamentals/">01 Foundations</a>
        <a class="a-path__step" href="/agent-observability-patterns/en/metrics/">03 Metrics</a>
        <a class="a-path__step" href="/agent-observability-patterns/en/dashboards/">09 Dashboards</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">Developer</div>
      <div class="a-path__t">Make it run, then dig</div>
      <div class="a-path__d">Ship one readable trace from the demos, then return for layered spans, streaming and async export.</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-observability-patterns/en/demos/">13 Demos</a>
        <a class="a-path__step" href="/agent-observability-patterns/en/traces/">02 Tracing</a>
        <a class="a-path__step" href="/agent-observability-patterns/en/instrumentation/">08 Instrumentation</a>
        <a class="a-path__step" href="/agent-observability-patterns/en/pitfalls/">12 Pitfalls</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">Architect / SRE</div>
      <div class="a-path__t">Set boundaries first</div>
      <div class="a-path__d">Focus on sampling, cost, compliance and alert fatigue. Make observability a platform capability, not a personal craft.</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-observability-patterns/en/platforms/">06 Platforms</a>
        <a class="a-path__step" href="/agent-observability-patterns/en/alerts/">05 Alerts</a>
        <a class="a-path__step" href="/agent-observability-patterns/en/security/">11 Security</a>
        <a class="a-path__step" href="/agent-observability-patterns/en/scale/">14 Scale</a>
      </div>
    </div>
  </div>
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Mental model</div>
      <h2 class="a-section__title">One agent trace in 14 lines</h2>
      <p class="a-section__lead">A real trace has dozens of fields, but the skeleton has three facts: who started it, what was called, what it cost.</p>
    </div>
  </div>

```json
{
  "trace_id": "4f9c1d2e8a7b4c6d9e0f1a2b3c4d5e6f",
  "spans": [
    { "name": "invoke_agent support-agent", "duration_ms": 6400,
      "attributes": { "gen_ai.agent.name": "support-agent", "tenant.id": "acme",
                      "session.id": "s_8f21", "agent.turns": 3 } },
    { "name": "chat claude-sonnet-4-5", "parent": "invoke_agent",
      "attributes": { "gen_ai.usage.input_tokens": 1204,
                      "gen_ai.usage.output_tokens": 210,
                      "gen_ai.response.finish_reasons": ["tool_use"] } },
    { "name": "execute_tool search_orders", "parent": "chat",
      "attributes": { "gen_ai.tool.name": "search_orders", "tool.retries": 0 } }
  ],
  "cost_usd": 0.0109,
  "status": "completed"
}
```

  <p class="a-section__lead">That JSON is the whole book in miniature: <code>trace_id</code> stitches the chain, <code>spans</code> record what happened at each layer, <code>attributes</code> make aggregation possible, <code>cost_usd</code> makes it legible to whoever owns the budget.</p>
</section>

</div>

<div class="a-home-footer">
  <div class="a-home">
    <footer class="a-footer">
      <AuthorBrand />
      <div class="a-footer__row">
        <div>© 2026 Yuxin · MIT ｜ Maintained alongside better-agent, a2a-patterns, mcp-patterns, agent-memory-patterns and llm-gateway-patterns</div>
        <div class="a-footer__links">
          <a href="https://yuxin.run" target="_blank" rel="noreferrer">Author</a>
          <a href="https://github.com/yuxinrun/agent-observability-patterns" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/agent-observability-patterns/en/reading/">Further reading</a>
          <a href="/agent-observability-patterns/en/glossary/">Glossary</a>
          <a class="a-footer__lang" href="/agent-observability-patterns/">中文</a>
        </div>
      </div>
    </footer>
  </div>
</div>
