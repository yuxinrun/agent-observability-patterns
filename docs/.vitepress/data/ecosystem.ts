/**
 * 生态矩阵：六个站点互相导流，首页、侧边栏与章节页脚共用。
 * Ecosystem matrix shared by the home page, sidebar and chapter footers.
 */

export interface EcoItem {
  key: string
  name: string
  url: string
  glyph: string
  zhRole: string
  enRole: string
  zhDesc: string
  enDesc: string
  current?: boolean
}

export const ecosystem: EcoItem[] = [
  {
    key: 'better-agent',
    name: 'better-agent',
    url: 'https://yuxinrun.github.io/better-agent/',
    glyph: 'BA',
    zhRole: 'Agent 调度核心',
    enRole: 'Agent orchestration core',
    zhDesc: '单智能体怎么造：循环、工具、上下文、评测与上线。',
    enDesc: 'How to build one great agent: loop, tools, context, evals, shipping.',
  },
  {
    key: 'a2a-patterns',
    name: 'a2a-patterns',
    url: 'https://yuxinrun.github.io/a2a-patterns/',
    glyph: 'A2A',
    zhRole: 'Agent 横向通信',
    enRole: 'Agent-to-agent messaging',
    zhDesc: '多个 Agent 怎么互相说话：发现、委派、任务、流式、安全。',
    enDesc: 'How agents talk to each other: discovery, delegation, tasks, streams, safety.',
  },
  {
    key: 'mcp-patterns',
    name: 'mcp-patterns',
    url: 'https://yuxinrun.github.io/mcp-patterns/',
    glyph: 'MCP',
    zhRole: 'Agent 工具调用',
    enRole: 'Tool calling',
    zhDesc: 'Agent 怎么用工具：Server、资源、提示、权限与工程化。',
    enDesc: 'How agents use tools: servers, resources, prompts, permissions.',
  },
  {
    key: 'agent-memory-patterns',
    name: 'agent-memory-patterns',
    url: 'https://yuxinrun.github.io/agent-memory-patterns/',
    glyph: 'MEM',
    zhRole: 'Agent 记忆体系',
    enRole: 'Agent memory',
    zhDesc: 'Agent 怎么记住事：短期上下文、长期记忆、召回与遗忘。',
    enDesc: 'How agents remember: working context, long-term memory, recall and forgetting.',
  },
  {
    key: 'llm-gateway-patterns',
    name: 'llm-gateway-patterns',
    url: 'https://yuxinrun.github.io/llm-gateway-patterns/',
    glyph: 'GW',
    zhRole: '模型流量网关',
    enRole: 'Model traffic gateway',
    zhDesc: '模型怎么被安全地调用：路由、限流、成本、审计与灰度。',
    enDesc: 'How models get called safely: routing, rate limits, cost, audit, rollouts.',
  },
  {
    key: 'agent-observability-patterns',
    name: 'agent-observability-patterns',
    url: 'https://yuxinrun.github.io/agent-observability-patterns/',
    glyph: 'OBS',
    zhRole: 'Agent 可观测性',
    enRole: 'Agent observability',
    zhDesc: 'Agent 怎么被看清：追踪、指标、日志、评估、告警与看板。',
    enDesc: 'How agents get seen: traces, metrics, logs, evals, alerts and dashboards.',
    current: true,
  },
]

export const siteMeta = {
  nameZh: 'Agent 可观测性模式手册',
  nameEn: 'Agent Observability Patterns',
  sloganZh: 'Agent 不会喊疼，你得学会给它装上心电图。',
  sloganEn: 'Agents never say ouch — so wire them an ECG.',
  taglineZh:
    '面向工程师与架构师的 Agent 可观测性工程手册：埋点、链路、指标、告警、看板，全部可复制。',
  taglineEn:
    'An engineering field guide to agent observability: instrumentation, traces, metrics, alerts and boards, all copy-ready.',
  author: '鱼心',
  authorEn: 'Yuxin',
  authorUrl: 'https://yuxin.run',
  repo: 'https://github.com/yuxinrun/agent-observability-patterns',
  license: 'MIT',
}
