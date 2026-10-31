/**
 * 全站目录中枢：侧边栏、面包屑、首页章节地图、上下章导航都由这里生成。
 * Site catalog: single source of truth for sidebars, breadcrumbs, chapter map.
 */

export interface CatalogSection {
  /** 锚点 id，中英文页面共用 */
  id: string
  zh: string
  en: string
}

export interface CatalogItem {
  num: string
  slug: string
  zhTitle: string
  enTitle: string
  zhLead: string
  enLead: string
  zhTag: string
  enTag: string
  sections: CatalogSection[]
}

export const catalog: CatalogItem[] = [
  {
    num: '00',
    slug: 'intro',
    zhTitle: '开篇：最难监控的黑盒小朋友',
    enTitle: 'Opening: the hardest black box to watch',
    zhLead: 'Agent 为什么比传统程序难监控，以及没有可观测性时，线上会用哪四种方式惩罚你。',
    enLead: 'Why agents are harder to watch than ordinary services, and four ways production punishes you for flying blind.',
    zhTag: '零基础友好',
    enTag: 'Beginner friendly',
    sections: [
      { id: 'difference', zh: '传统监控 vs Agent 监控', en: 'Classic monitoring vs agent monitoring' },
      { id: 'disasters', zh: '没有可观测性的四类灾难', en: 'Four disasters of flying blind' },
      { id: 'four-pillars', zh: '可观测性四大支柱', en: 'The four pillars' },
      { id: 'scope', zh: '这本手册能帮你解决什么', en: 'What this handbook solves' },
      { id: 'ecosystem-link', zh: '和整套生态的接线方式', en: 'How it plugs into the ecosystem' },
    ],
  },
  {
    num: '01',
    slug: 'fundamentals',
    zhTitle: '基础概念：底层原理一次讲透',
    enTitle: 'Foundations: the mechanics, once and for all',
    zhLead: 'Trace、Span、上下文透传、OpenTelemetry 与 GenAI 语义约定，全部拆成人话。',
    enLead: 'Trace, span, context propagation, OpenTelemetry and the GenAI semantic conventions — in plain language.',
    zhTag: '概念地基',
    enTag: 'Foundations',
    sections: [
      { id: 'trace-span', zh: 'Trace、Span、TraceID 与上下文', en: 'Trace, span, trace id and context' },
      { id: 'otel', zh: 'OpenTelemetry 为什么是事实标准', en: 'Why OpenTelemetry won' },
      { id: 'genai-attrs', zh: 'GenAI 扩展属性：LLM 专属标签', en: 'GenAI attributes for LLM spans' },
      { id: 'propagation', zh: '跨服务、跨 MCP、跨 A2A 透传', en: 'Propagation across services, MCP and A2A' },
      { id: 'task-types', zh: '同步、流式、长任务、多轮循环', en: 'Sync, streaming, long jobs, loops' },
    ],
  },
  {
    num: '02',
    slug: 'traces',
    zhTitle: '全链路追踪模式（核心）',
    enTitle: 'End-to-end tracing patterns',
    zhLead: '八种追踪模式：ReAct 循环、流式分片、分层 Span、A2A、MCP、记忆、会话、错误断点。',
    enLead: 'Eight patterns: ReAct loops, streaming chunks, span layering, A2A, MCP, memory, sessions, error snapshots.',
    zhTag: '模式核心',
    enTag: 'Pattern core',
    sections: [
      { id: 'react-loop', zh: 'ReAct 循环追踪', en: 'Tracing the ReAct loop' },
      { id: 'streaming', zh: '流式输出追踪', en: 'Tracing token streams' },
      { id: 'layered-spans', zh: '分层 Span 设计', en: 'Layered span design' },
      { id: 'a2a', zh: 'A2A 跨 Agent 追踪', en: 'Tracing across agents (A2A)' },
      { id: 'mcp', zh: 'MCP 工具调用追踪', en: 'Tracing MCP tool calls' },
      { id: 'memory', zh: '记忆读写追踪', en: 'Tracing memory reads and writes' },
      { id: 'session', zh: '会话追踪', en: 'Session tracing' },
      { id: 'error-snapshot', zh: '错误断点追踪', en: 'Error snapshots' },
    ],
  },
  {
    num: '03',
    slug: 'metrics',
    zhTitle: '指标 Metrics：生产看板该统计什么',
    enTitle: 'Metrics: what a production board must show',
    zhLead: '任务、模型、工具、体验、业务五层指标，加上能直接抄的 SLO 与聚合维度。',
    enLead: 'Task, model, tool, UX and business metrics, plus copy-ready SLOs and aggregation dimensions.',
    zhTag: '带报表样例',
    enTag: 'Sample dashboards',
    sections: [
      { id: 'task', zh: '任务层指标', en: 'Task-level metrics' },
      { id: 'llm', zh: 'LLM 模型指标', en: 'Model-level metrics' },
      { id: 'tool', zh: '工具调用指标', en: 'Tool-level metrics' },
      { id: 'ux', zh: '用户体验指标', en: 'User experience metrics' },
      { id: 'business', zh: '业务指标', en: 'Business metrics' },
      { id: 'slo', zh: 'SLO 设定模板', en: 'SLO templates' },
      { id: 'aggregation', zh: '指标聚合模式', en: 'Aggregation patterns' },
    ],
  },
  {
    num: '04',
    slug: 'logs',
    zhTitle: '结构化日志与审计日志',
    enTitle: 'Structured logs and audit trails',
    zhLead: '审计字段清单、脱敏模式、采样策略，以及 ELK / Loki / ClickHouse 怎么选。',
    enLead: 'Audit fields, redaction patterns, sampling, and how to choose between ELK, Loki and ClickHouse.',
    zhTag: '合规必备',
    enTag: 'Compliance ready',
    sections: [
      { id: 'audit-vs-debug', zh: '调试日志 vs 审计日志', en: 'Debug logs vs audit logs' },
      { id: 'fields', zh: '审计日志必填字段', en: 'Required audit fields' },
      { id: 'redaction', zh: '敏感内容脱敏', en: 'Redacting sensitive content' },
      { id: 'sampling', zh: '日志采样策略', en: 'Log sampling' },
      { id: 'storage', zh: '日志持久化选型', en: 'Choosing a log store' },
    ],
  },
  {
    num: '05',
    slug: 'alerts',
    zhTitle: '告警体系：什么时候该吵醒人',
    enTitle: 'Alerting: when to wake a human',
    zhLead: 'P0-P3 分级、五类高频规则模板、降噪流水线，以及带 trace 链接的告警通知。',
    enLead: 'P0–P3 severity, five rule templates, noise reduction, and alerts that carry a trace link.',
    zhTag: '可直接抄',
    enTag: 'Copy-ready',
    sections: [
      { id: 'severity', zh: '告警分级 P0–P3', en: 'Alert severity P0–P3' },
      { id: 'rules', zh: '五类高频告警规则', en: 'Five high-frequency rules' },
      { id: 'noise', zh: '告警降噪策略', en: 'Noise reduction' },
      { id: 'context', zh: '告警附带上下文', en: 'Context in the alert' },
    ],
  },
  {
    num: '06',
    slug: 'platforms',
    zhTitle: '观测平台选型：Langfuse / Phoenix / LangSmith',
    enTitle: 'Platform selection: Langfuse, Phoenix, LangSmith',
    zhLead: '四个开源平台的定位与自托管难度，轻量自建方案，以及最小生产组合。',
    enLead: 'Positioning and self-hosting cost of four open platforms, a lightweight stack, and a minimum viable combo.',
    zhTag: '选型指南',
    enTag: 'Selection guide',
    sections: [
      { id: 'landscape', zh: '平台全景与定位', en: 'The landscape' },
      { id: 'selection', zh: '什么场景选哪个', en: 'Which one, when' },
      { id: 'lightweight', zh: '轻量自建：Tempo + OpenObserve', en: 'Lightweight self-hosting' },
      { id: 'commercial', zh: '商用方案对比', en: 'Commercial options' },
      { id: 'recommended', zh: '最小推荐生产组合', en: 'The minimum production stack' },
    ],
  },
  {
    num: '07',
    slug: 'integrations',
    zhTitle: '集成实战：接进你的技术栈',
    enTitle: 'Integration: wiring it into your stack',
    zhLead: '网关、MCP、A2A、记忆、调度框架，五个组件的埋点与链路打通方式。',
    enLead: 'Gateway, MCP, A2A, memory and orchestration: instrumentation and trace stitching for each.',
    zhTag: '生态联动',
    enTag: 'Ecosystem wiring',
    sections: [
      { id: 'gateway', zh: '接入 llm-gateway-patterns', en: 'Into llm-gateway-patterns' },
      { id: 'mcp', zh: '接入 mcp-patterns', en: 'Into mcp-patterns' },
      { id: 'a2a', zh: '接入 a2a-patterns', en: 'Into a2a-patterns' },
      { id: 'memory', zh: '接入 agent-memory-patterns', en: 'Into agent-memory-patterns' },
      { id: 'better-agent', zh: '接入 better-agent', en: 'Into better-agent' },
    ],
  },
  {
    num: '08',
    slug: 'instrumentation',
    zhTitle: '埋点工程模式：拿来就能写',
    enTitle: 'Instrumentation patterns you can copy',
    zhLead: '装饰器、中间件、生命周期回调、异步队列四种低侵入埋点，以及五种反模式。',
    enLead: 'Decorators, middleware, lifecycle callbacks, async queues — plus five anti-patterns.',
    zhTag: '重点章节',
    enTag: 'Most practical',
    sections: [
      { id: 'decorator', zh: '装饰器埋点', en: 'Decorator instrumentation' },
      { id: 'middleware', zh: '中间件埋点', en: 'Middleware instrumentation' },
      { id: 'callback', zh: '生命周期回调埋点', en: 'Lifecycle callbacks' },
      { id: 'async', zh: '异步队列埋点', en: 'Async queue instrumentation' },
      { id: 'anti-patterns', zh: '埋点反模式', en: 'Instrumentation anti-patterns' },
    ],
  },
  {
    num: '09',
    slug: 'dashboards',
    zhTitle: '看板设计：六块生产大屏',
    enTitle: 'Dashboards: six production boards',
    zhLead: '总览、失败、成本、工具、会话、循环异常，每块都给出面板定义与查询思路。',
    enLead: 'Overview, failures, cost, tools, sessions and runaway loops — panel by panel.',
    zhTag: '带图表样例',
    enTag: 'With chart samples',
    sections: [
      { id: 'overview', zh: '总览大盘', en: 'The overview board' },
      { id: 'failure', zh: '失败分析看板', en: 'Failure analysis' },
      { id: 'cost', zh: '成本分析看板', en: 'Cost analysis' },
      { id: 'tool', zh: '工具性能看板', en: 'Tool performance' },
      { id: 'session', zh: '用户会话看板', en: 'Session explorer' },
      { id: 'loop', zh: '循环异常看板', en: 'Runaway loop monitor' },
    ],
  },
  {
    num: '10',
    slug: 'evals',
    zhTitle: '评估联动：让线上 Trace 自己变聪明',
    enTitle: 'Evals: let production traces teach you',
    zhLead: '从真实链路自动抽样本、做回归与 LLM-as-judge，再到版本劣化自动发现。',
    enLead: 'Extract samples from real traces, run regressions and LLM-as-judge, and catch version regressions.',
    zhTag: '闭环',
    enTag: 'Closed loop',
    sections: [
      { id: 'extract', zh: '从 Trace 自动提取样本', en: 'Harvesting samples from traces' },
      { id: 'regression', zh: '回归测试与 LLM-as-judge', en: 'Regression and LLM-as-judge' },
      { id: 'degradation', zh: '指标劣化自动发现', en: 'Detecting degradation' },
      { id: 'closed-loop', zh: 'Trace → 标注 → 评测 → 优化', en: 'Trace → label → eval → improve' },
    ],
  },
  {
    num: '11',
    slug: 'security',
    zhTitle: '安全、隐私与合规',
    enTitle: 'Security, privacy and compliance',
    zhLead: '留存策略、脱敏、多租户隔离、访问权限与数据本地化，企业落地必看。',
    enLead: 'Retention, redaction, tenant isolation, access control and data residency.',
    zhTag: '企业必看',
    enTag: 'Enterprise must',
    sections: [
      { id: 'retention', zh: '数据留存策略', en: 'Retention policy' },
      { id: 'redaction', zh: '内容脱敏与禁止入库', en: 'What never gets stored' },
      { id: 'tenancy', zh: '多租户隔离', en: 'Multi-tenant isolation' },
      { id: 'access', zh: '访问权限模型', en: 'Access control' },
      { id: 'residency', zh: '数据本地化边界', en: 'Data residency' },
    ],
  },
  {
    num: '12',
    slug: 'pitfalls',
    zhTitle: '高频踩坑大全（血泪清单）',
    enTitle: 'The pitfalls catalog',
    zhLead: '断链、丢 span、埋点爆炸、告警麻木、隐性成本、静默错误、采样踩空。',
    enLead: 'Broken traces, lost spans, instrumentation bloat, alert fatigue, hidden cost, silent failures, bad sampling.',
    zhTag: '血泪经验',
    enTag: 'Scars included',
    sections: [
      { id: 'broken-trace', zh: 'TraceID 断链', en: 'Broken trace ids' },
      { id: 'stream-loss', zh: '流式上报丢失与错序', en: 'Lost and out-of-order spans' },
      { id: 'over-instrument', zh: '埋点太多，成本爆炸', en: 'Instrumentation bloat' },
      { id: 'alert-fatigue', zh: '告警泛滥，集体麻木', en: 'Alert fatigue' },
      { id: 'hidden-cost', zh: '只看 token 的隐性成本', en: 'The token-only blind spot' },
      { id: 'silent-wrong', zh: '静默错误与幻觉', en: 'Silent failures and hallucinations' },
      { id: 'sampling-miss', zh: '采样策略踩空', en: 'Sampling that misses the incident' },
    ],
  },
  {
    num: '13',
    slug: 'demos',
    zhTitle: '可运行 Demo 全套',
    enTitle: 'The runnable demo kit',
    zhLead: 'Python OTel、LangGraph、CrewAI、A2A、MCP、告警规则、Langfuse 一键启动。',
    enLead: 'Python OTel, LangGraph, CrewAI, A2A, MCP, alert rules and a one-command Langfuse stack.',
    zhTag: '可复制',
    enTag: 'Copy-ready',
    sections: [
      { id: 'otel-python', zh: 'Python 最简 OTel 埋点', en: 'Minimal Python OTel demo' },
      { id: 'langgraph', zh: 'LangGraph + OpenLLMetry', en: 'LangGraph with OpenLLMetry' },
      { id: 'crewai', zh: 'CrewAI + Langfuse', en: 'CrewAI with Langfuse' },
      { id: 'a2a', zh: 'A2A 跨 Agent 透传', en: 'A2A trace propagation' },
      { id: 'mcp', zh: 'MCP 工具埋点', en: 'Instrumenting MCP tools' },
      { id: 'alerts-json', zh: '告警规则与看板 JSON', en: 'Alert rules and dashboard JSON' },
      { id: 'langfuse-compose', zh: 'Langfuse docker-compose', en: 'Langfuse docker-compose' },
    ],
  },
  {
    num: '14',
    slug: 'scale',
    zhTitle: '高并发与大规模集群',
    enTitle: 'Scale: high concurrency and clusters',
    zhLead: '异步上报、四种采样、冷热分离、集群性能与存储成本控制。',
    enLead: 'Async export, four sampling strategies, hot/cold storage, cluster performance and cost control.',
    zhTag: '规模化',
    enTag: 'At scale',
    sections: [
      { id: 'async-export', zh: '异步上报与队列缓冲', en: 'Async export and buffering' },
      { id: 'sampling', zh: '头采样、尾采样、错误优先', en: 'Head, tail and error-first sampling' },
      { id: 'hot-cold', zh: '冷热数据分离', en: 'Hot and cold storage' },
      { id: 'cluster', zh: '集群下的追踪性能', en: 'Tracing performance in clusters' },
      { id: 'cost-control', zh: '存储与成本控制', en: 'Storage and cost control' },
    ],
  },
  {
    num: '15',
    slug: 'ecosystem',
    zhTitle: '生态联动：五块拼图的接缝',
    enTitle: 'Ecosystem: where the pieces meet',
    zhLead: '调度、A2A、MCP、记忆、网关，五个姊妹项目各自该上报什么、边界在哪。',
    enLead: 'Orchestration, A2A, MCP, memory and gateway: what each reports and where the boundaries are.',
    zhTag: '全站导航',
    enTag: 'Site map',
    sections: [
      { id: 'better-agent', zh: 'better-agent：调度框架埋点', en: 'better-agent: orchestration' },
      { id: 'a2a', zh: 'a2a-patterns：跨智能体边界', en: 'a2a-patterns: agent boundaries' },
      { id: 'mcp', zh: 'mcp-patterns：工具层观测', en: 'mcp-patterns: tool layer' },
      { id: 'memory', zh: 'agent-memory-patterns：记忆指标', en: 'agent-memory-patterns: memory metrics' },
      { id: 'gateway', zh: 'llm-gateway-patterns：统一计量', en: 'llm-gateway-patterns: metering' },
    ],
  },
]

export const chapterPath = (item: CatalogItem, lang: 'zh' | 'en') =>
  `${lang === 'en' ? '/en' : ''}/${item.slug}/`

export const findChapter = (slug: string) => catalog.find((c) => c.slug === slug)

/** 上一章 / 下一章，供自定义导航与首页使用 */
export const neighbors = (slug: string) => {
  const i = catalog.findIndex((c) => c.slug === slug)
  return {
    prev: i > 0 ? catalog[i - 1] : undefined,
    next: i >= 0 && i < catalog.length - 1 ? catalog[i + 1] : undefined,
  }
}
