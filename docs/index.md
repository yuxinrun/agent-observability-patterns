---
layout: home
title: Agent 可观测性模式手册
titleTemplate: 把 Agent 的黑盒，变成一条能看清的链路

hero:
  name: Agent 可观测性模式手册
  text: Agent 不会喊疼，你得学会给它装上心电图。
  tagline: 从一次模型调用到跨 Agent 集群：追踪、指标、日志、评估、告警、看板。16 章、50+ 张图解、可运行 Demo 与生产血泪清单，看完就能给自己的 Agent 埋点。
  image:
    light: /hero.svg
    dark: /hero.svg
    alt: Agent 链路瀑布图与实时指标大盘
  actions:
    - theme: brand
      text: 从第 00 章开始
      link: /intro/
    - theme: alt
      text: 直接抄告警规则
      link: /alerts/
    - theme: alt
      text: 跑一个 Demo
      link: /demos/

features:
  - title: 先讲人话，再上规范
    details: 每一节都有「人话翻译」和生活化类比，零基础也能读；紧接着是 OpenTelemetry 字段与代码，工程师直接用。
  - title: 16 章，从黑盒到集群
    details: 概念、追踪、指标、日志、告警、选型、集成、埋点、看板、评估、安全、踩坑、Demo、规模化，中间不缺拼图。
  - title: 50+ 张手绘图解
    details: span 瀑布、时序图、分层图、指标样图、选型矩阵，全部手写 SVG/CSS，明暗主题与手机端都清晰。
  - title: 拿来就能跑的代码
    details: Python OTel 埋点、LangGraph + OpenLLMetry、CrewAI + Langfuse、A2A 透传、MCP 埋点、Grafana JSON。
  - title: 对齐官方标准
    details: 严格对齐 OpenTelemetry GenAI 语义约定、Anthropic 与 OpenAI 的 Agent 追踪实践，换平台不重写埋点。
  - title: 中英双语 + 明暗主题
    details: 全站一键切换语言与主题，PC、平板、手机自适应，阅读动效轻盈不打扰。
---

<div class="a-home">

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Ecosystem</div>
      <h2 class="a-section__title">五块拼图，一层胶水</h2>
      <p class="a-section__lead">单智能体、横向协作、工具调用、记忆、模型网关——可观测性不是第六块拼图，而是把它们粘起来的那层。</p>
    </div>
  </div>
  <Eco />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Chapters</div>
      <h2 class="a-section__title">16 章目录：从「它在想什么」到「怎么不炸」</h2>
      <p class="a-section__lead">建议按顺序读；已经上线的团队可以直接跳 02、05、08、12 章。</p>
    </div>
    <a class="a-section__more" href="/agent-observability-patterns/start/">阅读指南 →</a>
  </div>
  <ChapterMap />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Reading paths</div>
      <h2 class="a-section__title">三条路径，选一条走</h2>
      <p class="a-section__lead">别从头啃到尾。先解决你手上那个「它为什么又超时了」的问题。</p>
    </div>
  </div>
  <div class="a-paths">
    <div class="a-path">
      <div class="a-path__k">零基础 / 产品</div>
      <div class="a-path__t">先建立直觉</div>
      <div class="a-path__d">不写代码也能读完：知道 Agent 为什么难监控、四大支柱各管什么、看板该长什么样。</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-observability-patterns/intro/">00 开篇</a>
        <a class="a-path__step" href="/agent-observability-patterns/fundamentals/">01 概念</a>
        <a class="a-path__step" href="/agent-observability-patterns/metrics/">03 指标</a>
        <a class="a-path__step" href="/agent-observability-patterns/dashboards/">09 看板</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">开发者</div>
      <div class="a-path__t">先跑通再深挖</div>
      <div class="a-path__d">照 Demo 起一条能看的链路，再回头补分层 span、流式与异步上报的细节。</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-observability-patterns/demos/">13 Demo</a>
        <a class="a-path__step" href="/agent-observability-patterns/traces/">02 追踪</a>
        <a class="a-path__step" href="/agent-observability-patterns/instrumentation/">08 埋点</a>
        <a class="a-path__step" href="/agent-observability-patterns/pitfalls/">12 踩坑</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">架构师 / SRE</div>
      <div class="a-path__t">先定边界再落地</div>
      <div class="a-path__d">关注采样、成本、合规与告警疲劳，把观测做成平台能力而不是个人手艺。</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-observability-patterns/platforms/">06 选型</a>
        <a class="a-path__step" href="/agent-observability-patterns/alerts/">05 告警</a>
        <a class="a-path__step" href="/agent-observability-patterns/security/">11 安全</a>
        <a class="a-path__step" href="/agent-observability-patterns/scale/">14 规模</a>
      </div>
    </div>
  </div>
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Mental model</div>
      <h2 class="a-section__title">先用 14 行看懂一条 Agent 链路</h2>
      <p class="a-section__lead">真实链路有几十个字段，但骨架只有三件事：谁发起、调了什么、花了多少。</p>
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

  <p class="a-section__lead">这段 JSON 就是后面 16 章要讲的全部内容的缩影：<code>trace_id</code> 把链路串起来，<code>spans</code> 记录每一层发生了什么，<code>attributes</code> 让指标能聚合，<code>cost_usd</code> 让老板看懂。</p>
</section>

</div>

<div class="a-home-footer">
  <div class="a-home">
    <footer class="a-footer">
      <AuthorBrand />
      <div class="a-footer__row">
        <div>© 2026 鱼心 · Yuxin · MIT ｜ 与 better-agent、a2a-patterns、mcp-patterns、agent-memory-patterns、llm-gateway-patterns 共同维护</div>
        <div class="a-footer__links">
          <a href="https://yuxin.run" target="_blank" rel="noreferrer">作者主页</a>
          <a href="https://github.com/yuxinrun/agent-observability-patterns" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/agent-observability-patterns/reading/">延伸阅读</a>
          <a href="/agent-observability-patterns/glossary/">术语表</a>
          <a class="a-footer__lang" href="/agent-observability-patterns/en/">English</a>
        </div>
      </div>
    </footer>
  </div>
</div>
