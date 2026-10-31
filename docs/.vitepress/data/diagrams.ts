/**
 * 全站手写图解数据：中英双语只写一份，组件按当前语言渲染。
 * All hand-drawn diagrams, bilingual, single source.
 */

export type Tone = 'accent' | 'coral' | 'blue' | 'lime' | 'muted'

export interface FlowNode {
  t: string
  s?: string
  tone?: Tone
}

export type DiagramSpec =
  | {
      kind: 'flow'
      caption: { zh: string; en: string }
      zh: { nodes: FlowNode[]; edges?: string[]; dir?: 'h' | 'v' }
      en: { nodes: FlowNode[]; edges?: string[]; dir?: 'h' | 'v' }
    }
  | {
      kind: 'layers'
      caption: { zh: string; en: string }
      zh: { layers: { t: string; items: string[]; tone?: Tone; note?: string }[] }
      en: { layers: { t: string; items: string[]; tone?: Tone; note?: string }[] }
    }
  | {
      kind: 'sequence'
      caption: { zh: string; en: string }
      zh: { actors: string[]; steps: { from: number; to: number; t: string; dashed?: boolean }[] }
      en: { actors: string[]; steps: { from: number; to: number; t: string; dashed?: boolean }[] }
    }
  | {
      kind: 'lifecycle'
      caption: { zh: string; en: string }
      zh: { states: { t: string; s: string; tone?: Tone }[]; note?: string }
      en: { states: { t: string; s: string; tone?: Tone }[]; note?: string }
    }
  | {
      kind: 'compare'
      caption: { zh: string; en: string }
      zh: { left: { title: string; sub: string; points: string[] }; right: { title: string; sub: string; points: string[] }; axis?: string }
      en: { left: { title: string; sub: string; points: string[] }; right: { title: string; sub: string; points: string[] }; axis?: string }
    }
  | {
      kind: 'hub'
      caption: { zh: string; en: string }
      zh: { center: string; nodes: string[]; mode?: 'star' | 'broadcast' | 'cycle'; note?: string }
      en: { center: string; nodes: string[]; mode?: 'star' | 'broadcast' | 'cycle'; note?: string }
    }
  | {
      kind: 'matrix'
      caption: { zh: string; en: string }
      zh: { head: string[]; rows: string[][]; highlight?: number[] }
      en: { head: string[]; rows: string[][]; highlight?: number[] }
    }
  | {
      kind: 'tree'
      caption: { zh: string; en: string }
      zh: { spans: SpanRow[]; note?: string }
      en: { spans: SpanRow[]; note?: string }
    }
  | {
      kind: 'bars'
      caption: { zh: string; en: string }
      zh: { items: BarItem[]; unit?: string; note?: string }
      en: { items: BarItem[]; unit?: string; note?: string }
    }

/** 一条 span：lvl 控制缩进，w 是相对耗时条宽度（0-100），dur 是展示值 */
export interface SpanRow {
  t: string
  s?: string
  lvl: number
  dur: string
  w: number
  tone?: Tone
}

export interface BarItem {
  t: string
  v: number
  s?: string
  tone?: Tone
}

export const diagrams: Record<string, DiagramSpec> = {
  /* ---------------- 00 开篇 ---------------- */
  blackbox: {
    kind: 'compare',
    caption: {
      zh: '传统服务错了会喊疼；Agent 错了会礼貌地编一个看起来很对的答案。',
      en: 'A broken service screams. A broken agent politely invents a plausible answer.',
    },
    zh: {
      left: {
        title: '传统服务',
        sub: '请求 → 处理 → 响应',
        points: ['路径确定，出错就抛异常', '延迟、错误率能直接量', '日志里能拼出完整调用栈', '回归测试用固定输入输出'],
      },
      right: {
        title: 'Agent',
        sub: '目标 → 循环 → 判断 → 行动',
        points: ['路径由模型现编，每次都不一样', '「成功」可能是自信的幻觉', '失败常常不抛异常，只是话变奇怪', '同样输入，两次结果不同'],
      },
      axis: '一个可复现，一个会临场发挥',
    },
    en: {
      left: {
        title: 'Classic service',
        sub: 'request → process → response',
        points: ['Deterministic path, throws on error', 'Latency and error rate are directly measurable', 'Logs rebuild a clean call stack', 'Tests use fixed inputs and outputs'],
      },
      right: {
        title: 'Agent',
        sub: 'goal → loop → judge → act',
        points: ['Path is improvised every run', '"Success" may be a confident hallucination', 'Failures rarely throw, they just get weird', 'Same input, different output'],
      },
      axis: 'One reproduces, the other improvises',
    },
  },
  disasters: {
    kind: 'matrix',
    caption: {
      zh: '没有可观测性的 Agent 系统，通常不是「挂了」，而是「悄悄烧钱」。',
      en: 'An unobserved agent system rarely goes down; it quietly burns money.',
    },
    zh: {
      head: ['灾难', '线上表现', '根因', '缺哪根支柱'],
      rows: [
        ['循环炸成本', '一个任务调用 400 次模型，账单翻十倍', '没有轮次与成本上限', 'Metrics'],
        ['静默失败', '任务状态成功，输出答非所问', '只看 HTTP 200，不看质量', 'Evals'],
        ['无法复现', '用户说「它刚才乱说」，但你没有上下文', '没存 trace 与输入快照', 'Traces'],
        ['超时雪崩', '排队越来越长，最后整批超时', '没有分阶段耗时指标', 'Traces + Metrics'],
      ],
      highlight: [0, 1],
    },
    en: {
      head: ['Disaster', 'Symptom', 'Root cause', 'Missing pillar'],
      rows: [
        ['Runaway loop', '400 model calls for one task, 10× bill', 'No iteration or cost ceiling', 'Metrics'],
        ['Silent failure', 'Status success, answer nonsense', 'Checking HTTP 200, not quality', 'Evals'],
        ['Unreproducible', 'User says it went crazy, no context saved', 'No trace or input snapshot', 'Traces'],
        ['Timeout avalanche', 'Queue grows, batch times out', 'No per-stage latency', 'Traces + Metrics'],
      ],
      highlight: [0, 1],
    },
  },
  pillars: {
    kind: 'layers',
    caption: {
      zh: '四大支柱分工：链路回答「怎么走的」，指标回答「有多糟」，日志回答「当时发生了什么」，评估回答「对不对」。',
      en: 'Four pillars: traces say how, metrics say how bad, logs say what happened, evals say whether it was right.',
    },
    zh: {
      layers: [
        { t: 'Traces 链路', items: ['一轮对话经过哪些 span', '每层耗时、入参、出参、错误'], tone: 'accent', note: '怎么走的' },
        { t: 'Metrics 指标', items: ['成功率、P95、token、成本', '按模型 / 工具 / 租户聚合'], tone: 'blue', note: '有多糟' },
        { t: 'Logs 日志', items: ['结构化事件与审计记录', '谁在什么时候做了什么'], tone: 'lime', note: '发生了什么' },
        { t: 'Evals 评估', items: ['离线集 + 线上抽样的质量分', '幻觉率、拒答率、人工介入率'], tone: 'coral', note: '对不对' },
      ],
    },
    en: {
      layers: [
        { t: 'Traces', items: ['Which spans a turn touched', 'Latency, input, output, errors per hop'], tone: 'accent', note: 'how' },
        { t: 'Metrics', items: ['Success rate, P95, tokens, cost', 'Aggregated by model, tool, tenant'], tone: 'blue', note: 'how bad' },
        { t: 'Logs', items: ['Structured events and audit records', 'Who did what, and when'], tone: 'lime', note: 'what happened' },
        { t: 'Evals', items: ['Offline suites plus sampled online scoring', 'Hallucination, refusal, human handoff'], tone: 'coral', note: 'was it right' },
      ],
    },
  },

  /* ---------------- 01 基础 ---------------- */
  'span-tree': {
    kind: 'tree',
    caption: {
      zh: '一次问答的 span 树：宽度是耗时，缩进是父子关系。看懂这张图，就看懂了 80% 的排查。',
      en: 'One turn as a span tree: width is duration, indentation is parentage. Read this and you can debug most incidents.',
    },
    zh: {
      spans: [
        { t: 'POST /chat  ·  invoke_agent support-agent', s: 'trace_id=4f9c…, tenant=acme', lvl: 0, dur: '6.4s', w: 100, tone: 'accent' },
        { t: 'chat claude-sonnet-4.5  ·  第 1 轮', s: 'in=812 tok, out=96 tok, $0.0041', lvl: 1, dur: '2.1s', w: 33, tone: 'blue' },
        { t: 'execute_tool search_orders', s: 'orders.search, 200 OK', lvl: 2, dur: '420ms', w: 7, tone: 'lime' },
        { t: 'chat claude-sonnet-4.5  ·  第 2 轮', s: 'in=1,204 tok, out=210 tok, $0.0068', lvl: 1, dur: '3.2s', w: 50, tone: 'blue' },
        { t: 'memory.recall', s: '命中 3 条，相似度 0.82', lvl: 2, dur: '180ms', w: 3, tone: 'muted' },
        { t: 'chat claude-sonnet-4.5  ·  第 3 轮', s: 'out=48 tok, finish=stop', lvl: 1, dur: '680ms', w: 11, tone: 'blue' },
      ],
      note: '看三件事：最宽的子树（性能）、failed 的 span（错误）、轮次条数（成本）。',
    },
    en: {
      spans: [
        { t: 'POST /chat · invoke_agent support-agent', s: 'trace_id=4f9c…, tenant=acme', lvl: 0, dur: '6.4s', w: 100, tone: 'accent' },
        { t: 'chat claude-sonnet-4.5 · turn 1', s: 'in=812 tok, out=96 tok, $0.0041', lvl: 1, dur: '2.1s', w: 33, tone: 'blue' },
        { t: 'execute_tool search_orders', s: 'orders.search, 200 OK', lvl: 2, dur: '420ms', w: 7, tone: 'lime' },
        { t: 'chat claude-sonnet-4.5 · turn 2', s: 'in=1,204 tok, out=210 tok, $0.0068', lvl: 1, dur: '3.2s', w: 50, tone: 'blue' },
        { t: 'memory.recall', s: '3 hits, similarity 0.82', lvl: 2, dur: '180ms', w: 3, tone: 'muted' },
        { t: 'chat claude-sonnet-4.5 · turn 3', s: 'out=48 tok, finish=stop', lvl: 1, dur: '680ms', w: 11, tone: 'blue' },
      ],
      note: 'Read three things: the widest subtree (latency), failed spans (errors), number of turns (cost).',
    },
  },
  'otel-pipeline': {
    kind: 'flow',
    caption: {
      zh: 'OTel 只做三件事：采集、搬运、导出。业务代码只认识 SDK，后端换了不用改一行业务。',
      en: 'OTel does three things: collect, ship, export. Your code knows only the SDK; swap backends without touching business logic.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '你的 Agent', s: 'OTel SDK + 自动埋点', tone: 'accent' },
        { t: 'Collector', s: '批处理、采样、脱敏、路由', tone: 'blue' },
        { t: '后端', s: 'Tempo / Langfuse / Datadog', tone: 'lime' },
      ],
      edges: ['OTLP (gRPC 4317 / HTTP 4318)', '按 trace 分流'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Your agent', s: 'OTel SDK + auto-instrumentation', tone: 'accent' },
        { t: 'Collector', s: 'batching, sampling, redaction, routing', tone: 'blue' },
        { t: 'Backend', s: 'Tempo / Langfuse / Datadog', tone: 'lime' },
      ],
      edges: ['OTLP (gRPC 4317 / HTTP 4318)', 'routed by trace'],
    },
  },
  'genai-attrs': {
    kind: 'matrix',
    caption: {
      zh: 'GenAI 语义约定把「模型、token、工具」变成标准字段，换平台不用重写埋点。',
      en: 'The GenAI conventions standardize model, token and tool fields so your instrumentation survives a platform swap.',
    },
    zh: {
      head: ['属性', '用在哪', '示例值', '备注'],
      rows: [
        ['gen_ai.operation.name', '所有 GenAI span', 'chat / invoke_agent / execute_tool', '决定 span 名字'],
        ['gen_ai.provider.name', '模型调用', 'anthropic / openai / aws.bedrock', '旧版叫 gen_ai.system'],
        ['gen_ai.request.model', '模型调用', 'claude-sonnet-4-5', '请求侧的模型名'],
        ['gen_ai.usage.input_tokens', '模型调用', '1204', '旧版叫 gen_ai.usage.prompt_tokens'],
        ['gen_ai.usage.output_tokens', '模型调用', '210', '旧版叫 …completion_tokens'],
        ['gen_ai.tool.name', '工具 span', 'search_orders', '失败时配 error.type'],
        ['gen_ai.agent.name', 'Agent span', 'support-agent', '多 Agent 系统必填'],
      ],
      highlight: [0],
    },
    en: {
      head: ['Attribute', 'Where', 'Example', 'Note'],
      rows: [
        ['gen_ai.operation.name', 'All GenAI spans', 'chat / invoke_agent / execute_tool', 'Drives the span name'],
        ['gen_ai.provider.name', 'Model calls', 'anthropic / openai / aws.bedrock', 'Was gen_ai.system'],
        ['gen_ai.request.model', 'Model calls', 'claude-sonnet-4-5', 'Model on the request side'],
        ['gen_ai.usage.input_tokens', 'Model calls', '1204', 'Was …prompt_tokens'],
        ['gen_ai.usage.output_tokens', 'Model calls', '210', 'Was …completion_tokens'],
        ['gen_ai.tool.name', 'Tool spans', 'search_orders', 'Pair with error.type'],
        ['gen_ai.agent.name', 'Agent spans', 'support-agent', 'Required in multi-agent'],
      ],
      highlight: [0],
    },
  },
  propagation: {
    kind: 'sequence',
    caption: {
      zh: '上下文透传只有一条规则：把 traceparent 当请求头一路带下去，谁都别自己发明 ID。',
      en: 'One rule for propagation: carry traceparent like any header, and never invent your own ids.',
    },
    zh: {
      actors: ['前端 / SDK', '网关', 'Agent 服务', 'MCP Server'],
      steps: [
        { from: 1, to: 2, t: 'traceparent: 00-4f9c…-a12b…-01' },
        { from: 2, to: 3, t: '透传 + 新建 server span' },
        { from: 3, to: 3, t: 'LLM 调用：子 span（同 trace）' },
        { from: 3, to: 4, t: 'tools/call 带 traceparent' },
        { from: 4, to: 3, t: '结果 + 自己的 span，回填同一 trace' },
      ],
    },
    en: {
      actors: ['Client / SDK', 'Gateway', 'Agent service', 'MCP server'],
      steps: [
        { from: 1, to: 2, t: 'traceparent: 00-4f9c…-a12b…-01' },
        { from: 2, to: 3, t: 'pass through + start server span' },
        { from: 3, to: 3, t: 'LLM calls: child spans, same trace' },
        { from: 3, to: 4, t: 'tools/call with traceparent' },
        { from: 4, to: 3, t: 'result + own span in the same trace' },
      ],
    },
  },
  'task-types': {
    kind: 'matrix',
    caption: {
      zh: '四种任务形态，埋点重点完全不同：别用同步请求的套路去追一个跑 20 分钟的活。',
      en: 'Four task shapes need four instrumentation styles: never trace a 20-minute job like a sync request.',
    },
    zh: {
      head: ['任务形态', 'span 结构', '关键指标', '最大的坑'],
      rows: [
        ['同步单轮', '1 个 agent span + 1 个 chat span', 'P95、错误率', '把 prompt 全文写进属性'],
        ['流式 SSE', '1 个长 span + 分片事件', 'TTFT、tokens/s', '连接断开后 span 永不结束'],
        ['长任务', '任务根 span + 心跳事件', '阶段耗时、排队时长', '进程重启丢 trace'],
        ['多轮循环', '每轮一个子 span + 循环计数', '轮次、累计成本', '没有上限，死循环'],
      ],
      highlight: [1, 3],
    },
    en: {
      head: ['Shape', 'Span structure', 'Key metrics', 'Worst trap'],
      rows: [
        ['Sync single turn', '1 agent span + 1 chat span', 'P95, error rate', 'Prompt text in attributes'],
        ['Streaming SSE', '1 long span + chunk events', 'TTFT, tokens/s', 'Span never ends on disconnect'],
        ['Long job', 'Root span + heartbeat events', 'Stage latency, queue time', 'Restart loses the trace'],
        ['Multi-turn loop', 'One child span per turn + counter', 'Turns, cumulative cost', 'No ceiling, infinite loop'],
      ],
      highlight: [1, 3],
    },
  },

  /* ---------------- 02 追踪模式 ---------------- */
  'react-trace': {
    kind: 'tree',
    caption: {
      zh: 'ReAct 循环的每个「想法—行动—观察」都应该是一组可数的 span，否则你不知道它绕了几圈。',
      en: 'Every thought-act-observe step should be a countable span group, or you cannot tell how many laps it ran.',
    },
    zh: {
      spans: [
        { t: 'invoke_agent research-agent', s: 'max_iterations=12, actual=5', lvl: 0, dur: '18.2s', w: 100, tone: 'accent' },
        { t: 'iteration 1', s: 'plan: 先查订单再算退款', lvl: 1, dur: '3.0s', w: 17, tone: 'muted' },
        { t: 'chat · 第 1 轮', s: 'tool_calls=1', lvl: 2, dur: '2.6s', w: 14, tone: 'blue' },
        { t: 'execute_tool get_order', s: 'orders.get, 200', lvl: 2, dur: '320ms', w: 2, tone: 'lime' },
        { t: 'iteration 2', s: 'plan: 计算退款金额', lvl: 1, dur: '4.4s', w: 24, tone: 'muted' },
        { t: 'chat · 第 2 轮', s: 'tool_calls=1', lvl: 2, dur: '4.1s', w: 22, tone: 'blue' },
        { t: 'execute_tool refund_quote', s: 'pay.refund.quote, 500 → 重试 1 次', lvl: 2, dur: '2.0s', w: 11, tone: 'coral' },
        { t: 'iteration 3', s: 'finish_reason=stop', lvl: 1, dur: '1.2s', w: 7, tone: 'muted' },
      ],
      note: '关键属性：iteration、tool_calls、finish_reason。三个字段就能画出「轮次分布」和「空转率」。',
    },
    en: {
      spans: [
        { t: 'invoke_agent research-agent', s: 'max_iterations=12, actual=5', lvl: 0, dur: '18.2s', w: 100, tone: 'accent' },
        { t: 'iteration 1', s: 'plan: fetch order, then refund', lvl: 1, dur: '3.0s', w: 17, tone: 'muted' },
        { t: 'chat · turn 1', s: 'tool_calls=1', lvl: 2, dur: '2.6s', w: 14, tone: 'blue' },
        { t: 'execute_tool get_order', s: 'orders.get, 200', lvl: 2, dur: '320ms', w: 2, tone: 'lime' },
        { t: 'iteration 2', s: 'plan: compute refund', lvl: 1, dur: '4.4s', w: 24, tone: 'muted' },
        { t: 'chat · turn 2', s: 'tool_calls=1', lvl: 2, dur: '4.1s', w: 22, tone: 'blue' },
        { t: 'execute_tool refund_quote', s: 'pay.refund.quote, 500 → retried once', lvl: 2, dur: '2.0s', w: 11, tone: 'coral' },
        { t: 'iteration 3', s: 'finish_reason=stop', lvl: 1, dur: '1.2s', w: 7, tone: 'muted' },
      ],
      note: 'Key attributes: iteration, tool_calls, finish_reason. Three fields give you turn distribution and idle-rate.',
    },
  },
  'stream-trace': {
    kind: 'sequence',
    caption: {
      zh: '流式埋点的核心：一个 span 管住整条流，分片只发事件；连接断了也要强制结束 span。',
      en: 'The point of streaming instrumentation: one span per stream, chunks become events, and a dropped connection must still close the span.',
    },
    zh: {
      actors: ['客户端', 'Agent 服务', 'OTel Exporter'],
      steps: [
        { from: 1, to: 2, t: 'POST /chat/stream（W3C traceparent）' },
        { from: 2, to: 2, t: 'start span: chat stream，记录 start_time' },
        { from: 2, to: 1, t: 'chunk#1 … chunk#N（顺带记录 TTFT）' },
        { from: 2, to: 3, t: 'batch: 首字事件 + token 计数 + 结束属性', dashed: true },
        { from: 1, to: 2, t: '客户端断开（或超时）' },
        { from: 2, to: 3, t: '强制 end span，标记 cancelled=true', dashed: true },
      ],
    },
    en: {
      actors: ['Client', 'Agent service', 'OTel exporter'],
      steps: [
        { from: 1, to: 2, t: 'POST /chat/stream (W3C traceparent)' },
        { from: 2, to: 2, t: 'start span: chat stream, note start_time' },
        { from: 2, to: 1, t: 'chunk#1 … chunk#N (record TTFT)' },
        { from: 2, to: 3, t: 'batch: first-token event, token count, end attrs', dashed: true },
        { from: 1, to: 2, t: 'client disconnects (or times out)' },
        { from: 2, to: 3, t: 'force end span, set cancelled=true', dashed: true },
      ],
    },
  },
  'span-layers': {
    kind: 'layers',
    caption: {
      zh: '五层 span：越往上越像业务，越往下越像基础设施。排查时从上层定位，到下层取证。',
      en: 'Five layers: the top looks like business, the bottom looks like infrastructure. Locate above, gather evidence below.',
    },
    zh: {
      layers: [
        { t: '任务层 task', items: ['用户目标、租户、会话、SLA 标签'], tone: 'accent', note: '一个任务' },
        { t: 'Agent 轮次 agent.turn', items: ['iteration、规划摘要、finish_reason'], tone: 'coral', note: '一轮思考' },
        { t: 'LLM 调用 chat', items: ['模型、token、TTFT、stop reason'], tone: 'blue', note: '一次推理' },
        { t: '工具调用 execute_tool', items: ['工具名、参数摘要、重试、错误类型'], tone: 'lime', note: '一次行动' },
        { t: '记忆读写 memory', items: ['recall / write、命中数、相似度、耗时'], tone: 'muted', note: '一次回忆' },
      ],
    },
    en: {
      layers: [
        { t: 'Task', items: ['User goal, tenant, session, SLA tags'], tone: 'accent', note: 'one job' },
        { t: 'Agent turn', items: ['iteration, plan summary, finish_reason'], tone: 'coral', note: 'one thought' },
        { t: 'LLM call', items: ['Model, tokens, TTFT, stop reason'], tone: 'blue', note: 'one inference' },
        { t: 'Tool call', items: ['Tool name, argument digest, retries, error type'], tone: 'lime', note: 'one action' },
        { t: 'Memory', items: ['recall / write, hits, similarity, latency'], tone: 'muted', note: 'one recollection' },
      ],
    },
  },
  'a2a-trace': {
    kind: 'sequence',
    caption: {
      zh: 'A2A 跨 Agent 追踪：任务委派不是新 trace，而是同一 trace 上的一次远程调用。',
      en: 'A2A tracing: delegation is not a new trace, it is a remote call on the same trace.',
    },
    zh: {
      actors: ['编排 Agent', 'A2A Server', '下游 Agent'],
      steps: [
        { from: 1, to: 2, t: 'message/send + traceparent + task_id' },
        { from: 2, to: 3, t: 'task 子 span，继续带 traceparent' },
        { from: 3, to: 3, t: '执行：LLM + 工具（同 trace 更深一层）' },
        { from: 3, to: 2, t: 'artifact + token 用量' },
        { from: 2, to: 1, t: 'status-update: completed，附 trace_id' },
      ],
    },
    en: {
      actors: ['Orchestrator', 'A2A server', 'Downstream agent'],
      steps: [
        { from: 1, to: 2, t: 'message/send + traceparent + task_id' },
        { from: 2, to: 3, t: 'task child span, still traceparent' },
        { from: 3, to: 3, t: 'work: LLM + tools (deeper, same trace)' },
        { from: 3, to: 2, t: 'artifact + token usage' },
        { from: 2, to: 1, t: 'status-update: completed with trace_id' },
      ],
    },
  },
  'mcp-trace': {
    kind: 'flow',
    caption: {
      zh: 'MCP 追踪要把「客户端看到的调用」和「服务端真正干的事」接成一条线。',
      en: 'MCP tracing stitches what the client saw to what the server actually did.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'Agent', s: 'client span: execute_tool', tone: 'accent' },
        { t: 'MCP Client', s: '注入 traceparent 到 params._meta', tone: 'blue' },
        { t: 'MCP Server', s: 'server span: tools/call', tone: 'lime' },
        { t: '真实系统', s: 'DB / HTTP span（可选）', tone: 'muted' },
      ],
      edges: ['tools/call', 'JSON-RPC', '实际查询'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Agent', s: 'client span: execute_tool', tone: 'accent' },
        { t: 'MCP client', s: 'inject traceparent into params._meta', tone: 'blue' },
        { t: 'MCP server', s: 'server span: tools/call', tone: 'lime' },
        { t: 'Real system', s: 'DB / HTTP span (optional)', tone: 'muted' },
      ],
      edges: ['tools/call', 'JSON-RPC', 'actual query'],
    },
  },
  'memory-trace': {
    kind: 'flow',
    caption: {
      zh: '记忆读写要单独打 span：它能解释「为什么它突然记得 / 忘了某件事」。',
      en: 'Memory needs its own spans: that is how you explain why it suddenly remembered — or forgot.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'memory.recall', s: 'query 摘要、top_k、命中数、相似度', tone: 'accent' },
        { t: 'context.build', s: '注入 token 数、丢弃条数', tone: 'blue' },
        { t: 'LLM 调用', s: 'prompt 里哪几段来自记忆', tone: 'lime' },
        { t: 'memory.write', s: '写入条数、去重、耗时', tone: 'coral' },
      ],
      edges: ['读', '拼装', '写回'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'memory.recall', s: 'query digest, top_k, hits, similarity', tone: 'accent' },
        { t: 'context.build', s: 'tokens injected, items dropped', tone: 'blue' },
        { t: 'LLM call', s: 'which prompt blocks came from memory', tone: 'lime' },
        { t: 'memory.write', s: 'items written, dedupe, latency', tone: 'coral' },
      ],
      edges: ['read', 'assemble', 'write back'],
    },
  },
  'session-trace': {
    kind: 'hub',
    caption: {
      zh: '会话是一根绳子，把散落的 trace 串成一串：查「这个用户到底经历了什么」靠它。',
      en: 'A session is the rope that ties loose traces together — it answers what this user actually experienced.',
    },
    zh: {
      center: 'session_id = s_8f21',
      nodes: ['trace #1 询价', 'trace #2 改地址', 'trace #3 退款', 'trace #4 投诉'],
      mode: 'cycle',
      note: '每条 trace 记 gen_ai.conversation.id；UI 上按时间轴展开，一键跳到最慢/最贵的那条。',
    },
    en: {
      center: 'session_id = s_8f21',
      nodes: ['trace #1 ask price', 'trace #2 new address', 'trace #3 refund', 'trace #4 complaint'],
      mode: 'cycle',
      note: 'Every trace carries gen_ai.conversation.id; the UI unfolds them on a timeline and links the slowest and priciest.',
    },
  },
  'error-snapshot': {
    kind: 'flow',
    caption: {
      zh: '错误断点：失败那一刻把「输入、上下文、工具返回、模型原话」打包存下来，才有资格谈复现。',
      en: 'An error snapshot freezes input, context, tool output and raw model text at the moment of failure — that is what makes reproduction possible.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'span 标记 error', s: 'error.type / message / stack', tone: 'coral' },
        { t: '冻结快照', s: '输入 hash、上下文摘要、工具响应', tone: 'accent' },
        { t: '脱敏后落盘', s: 'PII 替换，保留结构与长度', tone: 'blue' },
        { t: '生成回归用例', s: '可直接回放的 JSON', tone: 'lime' },
      ],
      edges: ['捕获', '清洗', '复用'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Mark span as error', s: 'error.type / message / stack', tone: 'coral' },
        { t: 'Freeze snapshot', s: 'input hash, context digest, tool responses', tone: 'accent' },
        { t: 'Redact and store', s: 'PII swapped, structure kept', tone: 'blue' },
        { t: 'Emit regression case', s: 'replayable JSON', tone: 'lime' },
      ],
      edges: ['capture', 'clean', 'reuse'],
    },
  },

  /* ---------------- 03 指标 ---------------- */
  'task-metrics': {
    kind: 'matrix',
    caption: {
      zh: '任务层指标是给老板和 on-call 看的：一眼判断「今天能不能下班」。',
      en: 'Task metrics are for managers and on-call: one glance decides whether anyone sleeps tonight.',
    },
    zh: {
      head: ['指标', '定义', '告警阈值示例', '怎么取'],
      rows: [
        ['任务成功率', 'completed / 总任务', '< 97% 持续 10 分钟', '根 span 状态'],
        ['任务失败率', 'failed / 总任务', '> 3% 或同比翻倍', '根 span status'],
        ['取消率', 'cancelled / 总任务', '> 8% 说明体验差', 'cancelled 属性'],
        ['平均轮次', 'Σ iteration / 成功任务', '> 6 轮要看规划质量', 'iteration 计数'],
        ['超时率', '超过 SLA 的任务占比', '> 1%', '根 span 时长'],
        ['排队时长', 'submit → working 的时间', 'P95 > 5s', '状态时间戳'],
      ],
      highlight: [0, 1],
    },
    en: {
      head: ['Metric', 'Definition', 'Example threshold', 'Source'],
      rows: [
        ['Success rate', 'completed / total', '< 97% for 10 min', 'root span status'],
        ['Failure rate', 'failed / total', '> 3% or doubled', 'root span status'],
        ['Cancel rate', 'cancelled / total', '> 8% means poor UX', 'cancelled attribute'],
        ['Avg turns', 'Σ iteration / successes', '> 6 hints at planning issues', 'iteration counter'],
        ['Timeout rate', 'tasks over SLA', '> 1%', 'root span duration'],
        ['Queue time', 'submit → working', 'P95 > 5s', 'state timestamps'],
      ],
      highlight: [0, 1],
    },
  },
  'llm-metrics': {
    kind: 'bars',
    caption: {
      zh: '同一批请求的 TTFT 分布：均值骗人，P95 才是用户真正感受到的「卡不卡」。',
      en: 'TTFT across one batch: the mean lies; P95 is what users actually feel.',
    },
    zh: {
      unit: 'ms',
      items: [
        { t: 'P50', v: 620, s: '体感顺畅', tone: 'lime' },
        { t: 'P90', v: 1480, s: '开始皱眉', tone: 'accent' },
        { t: 'P95', v: 2100, s: 'SLO 红线', tone: 'coral' },
        { t: 'P99', v: 4300, s: '投诉来源', tone: 'coral' },
        { t: '均值', v: 890, s: '看起来很美好', tone: 'muted' },
      ],
      note: '把 TTFT 与总耗时分开看：TTFT 差是模型/网络，总耗时差往往是轮次与工具。',
    },
    en: {
      unit: 'ms',
      items: [
        { t: 'P50', v: 620, s: 'feels fine', tone: 'lime' },
        { t: 'P90', v: 1480, s: 'eyebrows rise', tone: 'accent' },
        { t: 'P95', v: 2100, s: 'SLO line', tone: 'coral' },
        { t: 'P99', v: 4300, s: 'ticket source', tone: 'coral' },
        { t: 'Mean', v: 890, s: 'looks lovely', tone: 'muted' },
      ],
      note: 'Split TTFT from total: TTFT points at model or network, total points at turns and tools.',
    },
  },
  'tool-metrics': {
    kind: 'bars',
    caption: {
      zh: '工具耗时排行：如果搜索工具比模型还慢，优化 prompt 是白费力气。',
      en: 'Tool latency ranking: if search is slower than the model, prompt tuning is wasted effort.',
    },
    zh: {
      unit: 'ms · P95',
      items: [
        { t: 'search_docs', v: 2380, s: '外部 API，无缓存', tone: 'coral' },
        { t: 'get_order', v: 640, s: '内部 RPC', tone: 'accent' },
        { t: 'refund_quote', v: 410, s: '偶尔重试', tone: 'accent' },
        { t: 'send_email', v: 220, s: '异步队列', tone: 'lime' },
        { t: 'kb_lookup', v: 90, s: '本地缓存', tone: 'lime' },
      ],
      note: '同时看失败率：慢但稳可以加缓存，快但常挂必须先修正确性。',
    },
    en: {
      unit: 'ms · P95',
      items: [
        { t: 'search_docs', v: 2380, s: 'external API, no cache', tone: 'coral' },
        { t: 'get_order', v: 640, s: 'internal RPC', tone: 'accent' },
        { t: 'refund_quote', v: 410, s: 'occasional retry', tone: 'accent' },
        { t: 'send_email', v: 220, s: 'async queue', tone: 'lime' },
        { t: 'kb_lookup', v: 90, s: 'local cache', tone: 'lime' },
      ],
      note: 'Read failure rate too: slow but stable wants caching, fast but flaky wants a fix.',
    },
  },
  'ux-metrics': {
    kind: 'matrix',
    caption: {
      zh: '体验指标别只写「用户满意」：要能被埋点测出来，才叫指标。',
      en: 'Never ship "user satisfaction" as a metric: if instrumentation cannot measure it, it is a wish.',
    },
    zh: {
      head: ['指标', '口径', '目标', '数据来源'],
      rows: [
        ['等待时长', '首字延迟 + 总时长', 'P95 < 8s', 'trace span'],
        ['会话成本', '单会话累计 token 成本', 'P95 < $0.12', 'gen_ai.usage.*'],
        ['单用户日成本', '按 user_id 聚合', '硬上限 $2', '指标聚合'],
        ['追问次数', '同一会话内用户重复提问', '< 1.3 次', '会话事件'],
        ['放弃率', '任务未完成即离开', '< 5%', '前端 + 会话'],
      ],
    },
    en: {
      head: ['Metric', 'Definition', 'Target', 'Source'],
      rows: [
        ['Wait time', 'TTFT + total', 'P95 < 8s', 'trace spans'],
        ['Session cost', 'cumulative token cost per session', 'P95 < $0.12', 'gen_ai.usage.*'],
        ['Daily cost per user', 'aggregated by user_id', 'hard cap $2', 'metrics'],
        ['Re-ask rate', 'repeated asks in one session', '< 1.3', 'session events'],
        ['Abandon rate', 'left before completion', '< 5%', 'frontend + session'],
      ],
    },
  },
  'business-metrics': {
    kind: 'matrix',
    caption: {
      zh: '业务指标是「可观测性」和「老板」之间的翻译层，缺了它，观测永远拿不到预算。',
      en: 'Business metrics translate observability into budget language; without them the funding disappears.',
    },
    zh: {
      head: ['指标', '怎么定义', '看板位置', '常见误区'],
      rows: [
        ['幻觉发生率', '抽检判定不实的占比', '质量看板', '只靠用户点踩，样本严重偏斜'],
        ['拒答率', '明确拒绝回答的占比', '质量看板', '把「我不知道」也算成功'],
        ['人工介入率', '转人工 / 总任务', '体验看板', '只统计显式转人工'],
        ['一次解决率', '无需二次联系', '业务看板', '与任务成功率混为一谈'],
      ],
      highlight: [0],
    },
    en: {
      head: ['Metric', 'Definition', 'Board', 'Common mistake'],
      rows: [
        ['Hallucination rate', 'sampled answers judged wrong', 'Quality', 'Only thumbs-down: heavily skewed'],
        ['Refusal rate', 'explicit refusals', 'Quality', 'Counting "I don\'t know" as success'],
        ['Human handoff', 'escalations / total', 'UX', 'Only counting explicit escalations'],
        ['First-contact resolution', 'no second contact needed', 'Business', 'Confused with task success'],
      ],
      highlight: [0],
    },
  },
  'slo-matrix': {
    kind: 'matrix',
    caption: {
      zh: 'SLO 不要一次定十个：先定三条，跑一个月再调，比写在 PPT 上靠谱。',
      en: 'Do not set ten SLOs at once: start with three, run a month, then tune. Slides are not evidence.',
    },
    zh: {
      head: ['SLO', '指标口径', '目标', '错误预算'],
      rows: [
        ['可用性', '成功任务 / 总任务', '99.5% / 30 天', '每月 3.6 小时不可用'],
        ['响应性', 'TTFT P95', '< 2.5s', '超过即消耗预算'],
        ['成本', '单任务平均成本', '< $0.05', '超 20% 触发复盘'],
        ['质量', '抽检合格率', '> 92%', '连续 3 天低于目标即冻结发布'],
      ],
      highlight: [0],
    },
    en: {
      head: ['SLO', 'Definition', 'Target', 'Error budget'],
      rows: [
        ['Availability', 'success / total', '99.5% / 30d', '3.6h per month'],
        ['Responsiveness', 'TTFT P95', '< 2.5s', 'spend budget when exceeded'],
        ['Cost', 'avg cost per task', '< $0.05', '20% over triggers review'],
        ['Quality', 'sampled pass rate', '> 92%', '3 days below freezes releases'],
      ],
      highlight: [0],
    },
  },
  'agg-layers': {
    kind: 'layers',
    caption: {
      zh: '同一份数据，四个切面：租户看账单，模型看选型，Agent 看质量，技能看优化。',
      en: 'One dataset, four slices: tenants for billing, models for selection, agents for quality, skills for tuning.',
    },
    zh: {
      layers: [
        { t: 'by tenant', items: ['成本、配额、SLO 违约'], tone: 'accent', note: '账单' },
        { t: 'by model', items: ['token 结构、TTFT、拒答率'], tone: 'blue', note: '选型' },
        { t: 'by agent', items: ['成功率、轮次分布、工具偏好'], tone: 'coral', note: '质量' },
        { t: 'by skill / tool', items: ['调用次数、失败率、P95'], tone: 'lime', note: '优化' },
      ],
    },
    en: {
      layers: [
        { t: 'by tenant', items: ['cost, quota, SLO breaches'], tone: 'accent', note: 'billing' },
        { t: 'by model', items: ['token mix, TTFT, refusal rate'], tone: 'blue', note: 'selection' },
        { t: 'by agent', items: ['success, turn spread, tool mix'], tone: 'coral', note: 'quality' },
        { t: 'by skill / tool', items: ['calls, failure rate, P95'], tone: 'lime', note: 'tuning' },
      ],
    },
  },

  /* ---------------- 04 日志 ---------------- */
  'audit-fields': {
    kind: 'matrix',
    caption: {
      zh: '审计日志的最小可用字段：出了事能回答「谁、何时、对谁、做了什么、结果如何」。',
      en: 'The minimum audit fields answer who, when, on whose behalf, what, and with what result.',
    },
    zh: {
      head: ['字段', '示例', '为什么必须', '是否可空'],
      rows: [
        ['event_id', 'evt_01J9…', '幂等与去重', '否'],
        ['occurred_at', '2026-10-31T09:12:03Z', '排序与追责', '否'],
        ['actor', 'user:u_812 / agent:support', '谁发起的', '否'],
        ['on_behalf_of', 'user:u_812', '委派链', '可（无人委派时）'],
        ['tenant_id', 'acme', '隔离与账单', '否'],
        ['action', 'tool.call / memory.write', '做了什么', '否'],
        ['resource', 'orders:88213', '对什么做的', '否'],
        ['outcome', 'success / denied / error', '结果', '否'],
        ['trace_id', '4f9c…', '串起链路', '否'],
      ],
      highlight: [6, 7],
    },
    en: {
      head: ['Field', 'Example', 'Why', 'Nullable'],
      rows: [
        ['event_id', 'evt_01J9…', 'idempotency, dedupe', 'no'],
        ['occurred_at', '2026-10-31T09:12:03Z', 'ordering, accountability', 'no'],
        ['actor', 'user:u_812 / agent:support', 'who started it', 'no'],
        ['on_behalf_of', 'user:u_812', 'delegation chain', 'yes (no mandate)'],
        ['tenant_id', 'acme', 'isolation and billing', 'no'],
        ['action', 'tool.call / memory.write', 'what happened', 'no'],
        ['resource', 'orders:88213', 'on what', 'no'],
        ['outcome', 'success / denied / error', 'result', 'no'],
        ['trace_id', '4f9c…', 'join to the trace', 'no'],
      ],
      highlight: [6, 7],
    },
  },
  'redaction-flow': {
    kind: 'flow',
    caption: {
      zh: '脱敏要发生在「采集进程内」，不能等到了日志平台才做——那时的数据已经离开你的边界了。',
      en: 'Redact inside the collecting process, not in the log platform — by then the data already left your boundary.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '原始事件', s: '手机号、身份证、密钥', tone: 'coral' },
        { t: '规则匹配', s: '正则 + 字段白名单 + 长度限制', tone: 'accent' },
        { t: '替换与哈希', s: '+86138****1234、sha256 前缀', tone: 'blue' },
        { t: '结构化落盘', s: '保留结构，不保留原文', tone: 'lime' },
      ],
      edges: ['采集即处理', '不可逆', '可审计'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Raw event', s: 'phone, ID numbers, keys', tone: 'coral' },
        { t: 'Rule match', s: 'regex + field allowlist + length caps', tone: 'accent' },
        { t: 'Swap and hash', s: '+86138****1234, sha256 prefix', tone: 'blue' },
        { t: 'Structured store', s: 'keep shape, drop the text', tone: 'lime' },
      ],
      edges: ['redact at source', 'irreversible', 'auditable'],
    },
  },
  'log-sampling': {
    kind: 'flow',
    caption: {
      zh: '日志采样要分层：错误与审计全留，调试信息按比例留，幻觉样本留结构不留全文。',
      en: 'Tiered log sampling: keep all errors and audits, sample debug lines, keep structure (not text) for hallucination cases.',
    },
    zh: {
      dir: 'v',
      nodes: [
        { t: '全量入口', s: '所有结构化事件', tone: 'accent' },
        { t: '分级路由', s: 'audit / error → 100%；info → 10%', tone: 'blue' },
        { t: '去重合并', s: '同 trace 同事件只留一条', tone: 'lime' },
        { t: '冷存归档', s: '压缩 + TTL + 对象存储', tone: 'muted' },
      ],
      edges: ['按类型', '按 trace', '按时间'],
    },
    en: {
      dir: 'v',
      nodes: [
        { t: 'All events', s: 'every structured event', tone: 'accent' },
        { t: 'Route by class', s: 'audit / error → 100%, info → 10%', tone: 'blue' },
        { t: 'Dedupe', s: 'one row per trace + event', tone: 'lime' },
        { t: 'Cold archive', s: 'compress + TTL + object store', tone: 'muted' },
      ],
      edges: ['by class', 'by trace', 'by age'],
    },
  },
  'log-store': {
    kind: 'matrix',
    caption: {
      zh: '日志选型没有银弹：先看查询习惯，再看成本，最后才看名气。',
      en: 'No silver bullet: check query habits, then cost, then hype.',
    },
    zh: {
      head: ['方案', '擅长', '成本', '运维难度', '适合'],
      rows: [
        ['ELK', '全文检索、生态成熟', '高（存储与内存）', '高', '已有 ES 团队'],
        ['Loki', '按标签低成本聚合', '低', '中', 'K8s + Grafana 栈'],
        ['ClickHouse', '高吞吐分析、聚合快', '中', '中高', '自建指标/日志一体'],
        ['对象存储 + Parquet', '超低价长期留档', '极低', '低', '审计归档'],
      ],
      highlight: [1],
    },
    en: {
      head: ['Option', 'Strength', 'Cost', 'Ops effort', 'Fits'],
      rows: [
        ['ELK', 'full-text search, mature', 'high (disk + RAM)', 'high', 'teams already on ES'],
        ['Loki', 'cheap label-based aggregation', 'low', 'medium', 'K8s + Grafana'],
        ['ClickHouse', 'high-throughput analytics', 'medium', 'medium-high', 'self-hosted metrics + logs'],
        ['Object store + Parquet', 'dirt-cheap long term', 'very low', 'low', 'audit archive'],
      ],
     highlight: [1],
    },
  },

  /* ---------------- 05 告警 ---------------- */
  severity: {
    kind: 'lifecycle',
    caption: {
      zh: '分级不是排场：P0 叫醒人，P3 进周报。分错的代价是「狼来了」。',
      en: 'Severity is not ceremony: P0 wakes someone, P3 lands in a weekly report. Mislabel and the boy who cried wolf wins.',
    },
    zh: {
      states: [
        { t: 'P0 致命', s: '全部任务失败 / 数据泄露 / 越权', tone: 'coral' },
        { t: 'P1 严重', s: '失败率 > 10%、成本 3 倍、关键工具全挂', tone: 'accent' },
        { t: 'P2 观察', s: '单租户异常、延迟劣化、重试上升', tone: 'blue' },
        { t: 'P3 优化', s: '轮次偏多、缓存命中下降、日志异常', tone: 'lime' },
      ],
      note: '只有 P0/P1 允许打电话；P2 发群消息；P3 进周报，不进手机。',
    },
    en: {
      states: [
        { t: 'P0 fatal', s: 'all tasks fail / data leak / privilege abuse', tone: 'coral' },
        { t: 'P1 severe', s: 'failures > 10%, 3× cost, key tools down', tone: 'accent' },
        { t: 'P2 watch', s: 'single tenant, latency drift, retries up', tone: 'blue' },
        { t: 'P3 tune', s: 'extra turns, cache hit drop, log anomalies', tone: 'lime' },
      ],
      note: 'Only P0/P1 may phone a human; P2 goes to chat; P3 waits for the weekly report.',
    },
  },
  'alert-rules': {
    kind: 'matrix',
    caption: {
      zh: '五条规则能覆盖 80% 的真实事故，剩下的 20% 往往需要业务自定义。',
      en: 'Five rules cover 80% of real incidents; the rest need business-specific logic.',
    },
    zh: {
      head: ['规则', '触发条件（示例）', '级别', '通知对象'],
      rows: [
        ['任务失败率飙升', '10 分钟内失败率 > 5% 且样本 > 50', 'P1', 'on-call + 业务群'],
        ['单任务成本超标', '单 trace 成本 > $0.50 或 token > 200k', 'P2', 'Agent 负责人'],
        ['无限循环', 'iteration > 15 或同工具连续调用 > 8', 'P1', 'on-call'],
        ['工具持续报错', '单工具 5 分钟错误率 > 20%', 'P2', '工具 owner'],
        ['链路超时', 'P95 延迟 > SLA 2 倍持续 15 分钟', 'P1', 'on-call + 平台'],
      ],
      highlight: [2],
    },
    en: {
      head: ['Rule', 'Trigger (example)', 'Level', 'Notify'],
      rows: [
        ['Failure spike', 'failure > 5% over 10 min, n > 50', 'P1', 'on-call + business chat'],
        ['Cost blowup', 'trace cost > $0.50 or tokens > 200k', 'P2', 'agent owner'],
        ['Runaway loop', 'iteration > 15 or same tool 8× in a row', 'P1', 'on-call'],
        ['Tool errors', 'one tool > 20% errors for 5 min', 'P2', 'tool owner'],
        ['Latency breach', 'P95 > 2× SLA for 15 min', 'P1', 'on-call + platform'],
      ],
      highlight: [2],
    },
  },
  'noise-pipe': {
    kind: 'flow',
    caption: {
      zh: '降噪是条流水线：去重、聚合、抑制、分级，最后才轮到「发不发」。',
      en: 'Noise reduction is a pipeline: dedupe, group, inhibit, classify — only then decide whether to page.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '原始告警', s: '每条指标越界都发', tone: 'coral' },
        { t: '去重 + 聚合', s: '按指纹合并，5 分钟窗口', tone: 'accent' },
        { t: '抑制规则', s: '上游挂了就别报下游', tone: 'blue' },
        { t: '分级路由', s: 'P0 电话，P1 群，P2 工单', tone: 'lime' },
      ],
      edges: ['fingerprint', 'inhibit', 'route'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Raw alerts', s: 'every threshold crossing pages', tone: 'coral' },
        { t: 'Dedupe + group', s: 'by fingerprint, 5-minute window', tone: 'accent' },
        { t: 'Inhibition', s: 'if upstream is down, stay quiet', tone: 'blue' },
        { t: 'Route by severity', s: 'P0 phone, P1 chat, P2 ticket', tone: 'lime' },
      ],
      edges: ['fingerprint', 'inhibit', 'route'],
    },
  },
  'alert-context': {
    kind: 'flow',
    caption: {
      zh: '一条好告警 = 结论 + 证据 + 入口。只写「失败率上升」的告警，等于给人加班。',
      en: 'A good alert is conclusion + evidence + a door in. "Failure rate up" is just unpaid overtime.',
    },
    zh: {
      dir: 'v',
      nodes: [
        { t: '结论', s: '「退款 Agent 失败率 12%，持续 8 分钟」', tone: 'coral' },
        { t: '证据', s: 'Top 失败 trace、错误类型分布、影响租户', tone: 'accent' },
        { t: '入口', s: 'trace 链接、看板链接、Runbook 链接', tone: 'blue' },
        { t: '动作', s: '一键静默 / 认领 / 升级', tone: 'lime' },
      ],
      edges: ['是什么', '凭什么', '去哪儿'],
    },
    en: {
      dir: 'v',
      nodes: [
        { t: 'Conclusion', s: '"refund agent at 12% failures for 8 min"', tone: 'coral' },
        { t: 'Evidence', s: 'top failing traces, error mix, affected tenants', tone: 'accent' },
        { t: 'Doors', s: 'trace link, board link, runbook link', tone: 'blue' },
        { t: 'Actions', s: 'silence, claim, escalate', tone: 'lime' },
      ],
      edges: ['what', 'why', 'where'],
    },
  },

  /* ---------------- 06 平台 ---------------- */
  'platform-matrix': {
    kind: 'matrix',
    caption: {
      zh: '四个开源平台不是竞品，而是四种「你更在意什么」：LLM 细节、框架覆盖、本地实验、生态绑定。',
      en: 'These four are not rivals; they encode priorities: LLM detail, framework coverage, local experiments, ecosystem lock-in.',
    },
    zh: {
      head: ['平台', '定位', '自托管', '强项', '弱项'],
      rows: [
        ['Langfuse', 'LLM 可观测 + 提示管理', '简单（compose）', '会话、成本、评测闭环', '超大规模需自己调'],
        ['OpenLLMetry', 'OTel 自动埋点库', '不适用（是 SDK）', 'LangChain/LlamaIndex 覆盖广', '需自带后端'],
        ['Phoenix', '本地实验 + 评估', '很简单（单进程）', 'RAG / 评测 / 数据集', '生产多租户弱'],
        ['LangSmith', 'SaaS 全链路', '企业版私有化', '与 LangChain 深度整合', '数据出境与费用'],
      ],
      highlight: [0],
    },
    en: {
      head: ['Platform', 'Role', 'Self-host', 'Strength', 'Weakness'],
      rows: [
        ['Langfuse', 'LLM observability + prompts', 'easy (compose)', 'sessions, cost, eval loop', 'tuning at huge scale'],
        ['OpenLLMetry', 'OTel auto-instrumentation', 'n/a (it is an SDK)', 'wide LangChain/LlamaIndex coverage', 'bring your own backend'],
        ['Phoenix', 'local experiments + evals', 'trivial (single process)', 'RAG, evals, datasets', 'weak multi-tenant'],
        ['LangSmith', 'SaaS end-to-end', 'enterprise self-host', 'deep LangChain integration', 'residency and price'],
      ],
      highlight: [0],
    },
  },
  'selection-flow': {
    kind: 'flow',
    caption: {
      zh: '选型先问三个问题：数据能不能出境、团队有没有 OTel 经验、要不要一体化评测。',
      en: 'Three questions first: may data leave, does the team know OTel, and do you need evals in the same tool?',
    },
    zh: {
      dir: 'v',
      nodes: [
        { t: '数据必须留在内网？', s: '是 → Langfuse / Phoenix / Tempo', tone: 'accent' },
        { t: '已有 OTel + Grafana？', s: '是 → 只补 SDK，不换平台', tone: 'blue' },
        { t: '重度 LangChain？', s: '是 → LangSmith 或 OpenLLMetry', tone: 'lime' },
        { t: '要一体化评测闭环？', s: '是 → Langfuse / Phoenix', tone: 'coral' },
      ],
      edges: ['合规', '复用', '生态', '闭环'],
    },
    en: {
      dir: 'v',
      nodes: [
        { t: 'Data must stay inside?', s: 'yes → Langfuse / Phoenix / Tempo', tone: 'accent' },
        { t: 'Already on OTel + Grafana?', s: 'yes → add SDKs, keep the platform', tone: 'blue' },
        { t: 'Heavy LangChain user?', s: 'yes → LangSmith or OpenLLMetry', tone: 'lime' },
        { t: 'Need one eval loop?', s: 'yes → Langfuse / Phoenix', tone: 'coral' },
      ],
      edges: ['compliance', 'reuse', 'ecosystem', 'loop'],
    },
  },
  'light-stack': {
    kind: 'layers',
    caption: {
      zh: '轻量自建：Collector 收口，Tempo 存链路，OpenObserve 管日志与指标，Grafana 出图。',
      en: 'A light self-hosted stack: Collector in front, Tempo for traces, OpenObserve for logs and metrics, Grafana on top.',
    },
    zh: {
      layers: [
        { t: '接入', items: ['OTel SDK / 自动埋点 / 网关统一上报'], tone: 'accent', note: '一层收口' },
        { t: '处理', items: ['batch、tail sampling、脱敏、租户路由'], tone: 'blue', note: 'Collector' },
        { t: '存储', items: ['Tempo（trace）、OpenObserve（log/metric）、S3 归档'], tone: 'lime', note: '分而治之' },
        { t: '展示', items: ['Grafana 大盘 + 告警 + trace 跳转'], tone: 'coral', note: '一屏收尾' },
      ],
    },
    en: {
      layers: [
        { t: 'Ingest', items: ['OTel SDK, auto-instrumentation, gateway export'], tone: 'accent', note: 'one door' },
        { t: 'Process', items: ['batching, tail sampling, redaction, tenant routing'], tone: 'blue', note: 'Collector' },
        { t: 'Store', items: ['Tempo (traces), OpenObserve (logs/metrics), S3 archive'], tone: 'lime', note: 'split by job' },
        { t: 'Visualize', items: ['Grafana boards, alerts, trace links'], tone: 'coral', note: 'one screen' },
      ],
    },
  },
  'commercial-compare': {
    kind: 'compare',
    caption: {
      zh: '商用平台买的是「不用自己养存储」，代价是数据边界与按量账单。',
      en: 'Commercial tools sell you not running storage; you pay with data boundaries and per-GB bills.',
    },
    zh: {
      left: {
        title: '自托管',
        sub: 'Langfuse / Tempo / OpenObserve',
        points: ['数据不出内网，合规最稳', '人力成本前高后低', '容量与采样完全可控', '升级、备份要自己管'],
      },
      right: {
        title: '商用 SaaS',
        sub: 'Datadog / New Relic / LangSmith',
        points: ['开箱即用，面板成熟', '按量计费，trace 量一大就贵', '跨云关联做得好', '数据出境与厂商锁定'],
      },
      axis: '省人还是省心',
    },
    en: {
      left: {
        title: 'Self-hosted',
        sub: 'Langfuse / Tempo / OpenObserve',
        points: ['Data never leaves your VPC', 'High setup cost, low marginal cost', 'Full control of volume and sampling', 'You own upgrades and backups'],
      },
      right: {
        title: 'Commercial SaaS',
        sub: 'Datadog / New Relic / LangSmith',
        points: ['Works on day one, mature panels', 'Usage pricing punishes trace volume', 'Great cross-cloud correlation', 'Residency and vendor lock-in'],
      },
      axis: 'people vs peace of mind',
    },
  },
  'rec-stack': {
    kind: 'layers',
    caption: {
      zh: '最小生产组合：一个 Collector、一个链路后端、一个日志后端、一个看板、一个告警通道，先跑起来。',
      en: 'The minimum production combo: one collector, one trace backend, one log backend, one board, one alert channel.',
    },
    zh: {
      layers: [
        { t: '埋点', items: ['OpenLLMetry 自动埋点 + 自研 agent span'], tone: 'accent' },
        { t: '管道', items: ['OTel Collector（batch + tail sampling + 脱敏）'], tone: 'blue' },
        { t: '存储', items: ['Langfuse（LLM 视角）+ ClickHouse/Loki（日志）'], tone: 'lime' },
        { t: '运营', items: ['Grafana 六块看板 + 5 条告警 + Runbook'], tone: 'coral' },
      ],
    },
    en: {
      layers: [
        { t: 'Instrument', items: ['OpenLLMetry auto-instrumentation + custom agent spans'], tone: 'accent' },
        { t: 'Pipeline', items: ['OTel Collector (batch, tail sampling, redaction)'], tone: 'blue' },
        { t: 'Store', items: ['Langfuse (LLM view) + ClickHouse/Loki (logs)'], tone: 'lime' },
        { t: 'Operate', items: ['six Grafana boards, five alerts, one runbook'], tone: 'coral' },
      ],
    },
  },

  /* ---------------- 07 集成 ---------------- */
  'gateway-seq': {
    kind: 'sequence',
    caption: {
      zh: '网关是天然的收口点：一次调用同时拿到模型、token、成本与租户，业务侧几乎不用改。',
      en: 'The gateway is a natural choke point: one call yields model, tokens, cost and tenant with almost no app change.',
    },
    zh: {
      actors: ['Agent', 'LLM Gateway', '模型供应商'],
      steps: [
        { from: 1, to: 2, t: 'POST /v1/messages + traceparent' },
        { from: 2, to: 2, t: '建 span：gateway.chat，记录租户与路由' },
        { from: 2, to: 3, t: '转发（可能换模型 / 重试）' },
        { from: 3, to: 2, t: 'usage: input/output tokens' },
        { from: 2, to: 1, t: '响应 + 成本属性回填' },
      ],
    },
    en: {
      actors: ['Agent', 'LLM gateway', 'Provider'],
      steps: [
        { from: 1, to: 2, t: 'POST /v1/messages + traceparent' },
        { from: 2, to: 2, t: 'start span: gateway.chat with tenant and route' },
        { from: 2, to: 3, t: 'forward (maybe swap model or retry)' },
        { from: 3, to: 2, t: 'usage: input/output tokens' },
        { from: 2, to: 1, t: 'response with cost attributes filled in' },
      ],
    },
  },
  'mcp-integration': {
    kind: 'flow',
    caption: {
      zh: 'MCP 集成只需要两件事：把 traceparent 塞进请求元数据，服务端从元数据里取出来继续用。',
      en: 'MCP integration needs two things: put traceparent in request metadata, and read it back on the server.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'Agent 侧', s: 'execute_tool span + 注入 _meta', tone: 'accent' },
        { t: '传输', s: 'stdio / HTTP，header 或 _meta', tone: 'blue' },
        { t: 'Server 侧', s: 'extract → context.attach()', tone: 'lime' },
        { t: '工具实现', s: '真实查询，子 span 同 trace', tone: 'muted' },
      ],
      edges: ['注入', '传递', '续接'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Agent side', s: 'execute_tool span + inject _meta', tone: 'accent' },
        { t: 'Transport', s: 'stdio / HTTP header or _meta', tone: 'blue' },
        { t: 'Server side', s: 'extract → context.attach()', tone: 'lime' },
        { t: 'Tool code', s: 'real query, child span, same trace', tone: 'muted' },
      ],
      edges: ['inject', 'carry', 'resume'],
    },
  },
  'a2a-integration': {
    kind: 'sequence',
    caption: {
      zh: 'A2A 的链路边界：跨公司时可以「链接式」关联（共享 trace_id），不必强行父子。',
      en: 'A2A boundaries: across companies, link traces by shared trace_id instead of forcing parentage.',
    },
    zh: {
      actors: ['编排 Agent（我方）', '伙伴 Agent（他方）', '双方看板'],
      steps: [
        { from: 1, to: 2, t: 'message/send + traceparent（或仅 trace_id 链接）' },
        { from: 2, to: 2, t: '他方按自己的策略采样' },
        { from: 2, to: 1, t: 'artifact + 他方 trace_id（可选）' },
        { from: 1, to: 3, t: '我方 span 记录 link，而非 parent', dashed: true },
        { from: 2, to: 3, t: '他方 trace 独立可见（不共享内容）', dashed: true },
      ],
    },
    en: {
      actors: ['Our orchestrator', 'Partner agent', 'Both boards'],
      steps: [
        { from: 1, to: 2, t: 'message/send + traceparent (or trace_id link)' },
        { from: 2, to: 2, t: 'partner samples by its own policy' },
        { from: 2, to: 1, t: 'artifact + optional partner trace_id' },
        { from: 1, to: 3, t: 'record a span link, not a parent', dashed: true },
        { from: 2, to: 3, t: 'partner trace stays separate', dashed: true },
      ],
    },
  },
  'memory-integration': {
    kind: 'flow',
    caption: {
      zh: '记忆层要上报「读到了什么、丢掉了什么」，否则你永远解释不清上下文为什么变成那样。',
      en: 'The memory layer must report what was recalled and what was dropped, or you cannot explain the final context.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'recall 请求', s: 'query、top_k、过滤条件', tone: 'accent' },
        { t: '向量检索', s: '候选数、相似度分布', tone: 'blue' },
        { t: '装配上下文', s: '注入 token、裁剪条数', tone: 'lime' },
        { t: '写回', s: '新记忆、去重、TTL', tone: 'coral' },
      ],
      edges: ['读', '选', '写'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'recall request', s: 'query, top_k, filters', tone: 'accent' },
        { t: 'Vector search', s: 'candidates, similarity spread', tone: 'blue' },
        { t: 'Build context', s: 'tokens injected, items trimmed', tone: 'lime' },
        { t: 'Write back', s: 'new items, dedupe, TTL', tone: 'coral' },
      ],
      edges: ['read', 'select', 'write'],
    },
  },
  'ba-integration': {
    kind: 'layers',
    caption: {
      zh: '调度框架的埋点位置：任务入口、循环、工具、收尾，四个钩子就够。',
      en: 'Four hooks in the orchestration framework are enough: task entry, loop, tools, and wrap-up.',
    },
    zh: {
      layers: [
        { t: '任务入口', items: ['生成 trace_id、写 tenant / session / user'], tone: 'accent', note: 'root span' },
        { t: '循环体', items: ['每轮 iteration span，累计 token 与成本'], tone: 'coral', note: 'per turn' },
        { t: '工具与模型', items: ['execute_tool / chat span，交给自动埋点'], tone: 'blue', note: 'auto' },
        { t: '收尾', items: ['写终态、错误快照、评测抽样标记'], tone: 'lime', note: 'end' },
      ],
    },
    en: {
      layers: [
        { t: 'Task entry', items: ['create trace_id, record tenant / session / user'], tone: 'accent', note: 'root span' },
        { t: 'Loop body', items: ['one iteration span per turn, accumulate tokens and cost'], tone: 'coral', note: 'per turn' },
        { t: 'Tools and models', items: ['execute_tool / chat spans from auto-instrumentation'], tone: 'blue', note: 'auto' },
        { t: 'Wrap-up', items: ['final status, error snapshot, eval sampling flag'], tone: 'lime', note: 'end' },
      ],
    },
  },

  /* ---------------- 08 埋点 ---------------- */
  'decorator-flow': {
    kind: 'flow',
    caption: {
      zh: '装饰器埋点的全部魔法：进函数前开 span，出函数时补属性，异常时记错误再抛出。',
      en: 'The whole trick of a tracing decorator: open a span on entry, attach attributes on exit, record then re-raise on error.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '调用方', s: '发起任务', tone: 'muted' },
        { t: '@traced 包装', s: '取上下文 / 建 span', tone: 'accent' },
        { t: '业务函数', s: '原样执行，零侵入', tone: 'blue' },
        { t: 'finally', s: '写耗时、状态、错误', tone: 'lime' },
      ],
      edges: ['进入', '执行', '退出'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Caller', s: 'starts a task', tone: 'muted' },
        { t: '@traced wrapper', s: 'read context / start span', tone: 'accent' },
        { t: 'Business code', s: 'runs untouched', tone: 'blue' },
        { t: 'finally', s: 'duration, status, error', tone: 'lime' },
      ],
      edges: ['enter', 'run', 'exit'],
    },
  },
  'middleware-layers': {
    kind: 'layers',
    caption: {
      zh: '把观测放进中间件：HTTP、模型客户端、工具客户端三层，业务代码完全无感。',
      en: 'Observability as middleware: HTTP, model client and tool client — business code stays unaware.',
    },
    zh: {
      layers: [
        { t: 'HTTP 中间件', items: ['解析 traceparent、生成 server span、记录状态码'], tone: 'accent' },
        { t: '模型客户端包装', items: ['自动记录模型、token、TTFT、stop reason'], tone: 'blue' },
        { t: '工具客户端包装', items: ['记录工具名、重试、错误类型'], tone: 'lime' },
        { t: '业务代码', items: ['只写业务，不写埋点'], tone: 'muted' },
      ],
    },
    en: {
      layers: [
        { t: 'HTTP middleware', items: ['parse traceparent, start server span, record status'], tone: 'accent' },
        { t: 'Model client wrapper', items: ['auto-record model, tokens, TTFT, stop reason'], tone: 'blue' },
        { t: 'Tool client wrapper', items: ['record tool name, retries, error type'], tone: 'lime' },
        { t: 'Business code', items: ['business only, no tracing'], tone: 'muted' },
      ],
    },
  },
  'callback-life': {
    kind: 'lifecycle',
    caption: {
      zh: '生命周期回调把「什么时候该记什么」变成框架约定，团队不用各写一套。',
      en: 'Lifecycle callbacks turn when-to-record-what into a framework contract, so teams stop inventing their own.',
    },
    zh: {
      states: [
        { t: 'on_start', s: '建根 span、写租户与会话', tone: 'accent' },
        { t: 'on_llm', s: '每轮模型调用：token、TTFT', tone: 'blue' },
        { t: 'on_tool', s: '工具调用：名称、耗时、错误', tone: 'lime' },
        { t: 'on_error', s: '错误快照 + 标记失败', tone: 'coral' },
        { t: 'on_finish', s: '终态、成本、评测抽样', tone: 'accent' },
      ],
      note: '回调里只做「记录」，不做「业务决策」，否则观测会改变系统行为。',
    },
    en: {
      states: [
        { t: 'on_start', s: 'root span, tenant and session', tone: 'accent' },
        { t: 'on_llm', s: 'per call: tokens, TTFT', tone: 'blue' },
        { t: 'on_tool', s: 'name, latency, error', tone: 'lime' },
        { t: 'on_error', s: 'snapshot + mark failed', tone: 'coral' },
        { t: 'on_finish', s: 'status, cost, eval sampling', tone: 'accent' },
      ],
      note: 'Callbacks record, never decide. Observability must not change behavior.',
    },
  },
  'async-queue': {
    kind: 'flow',
    caption: {
      zh: '异步 Agent 的追踪：入队时把上下文序列化进消息，出队时恢复，否则链路必断。',
      en: 'Async agents: serialize context into the message on enqueue, restore on dequeue, or the trace dies.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'API', s: '建 trace，投递消息', tone: 'accent' },
        { t: '队列', s: '消息体带 traceparent + 预算', tone: 'blue' },
        { t: 'Worker', s: '恢复上下文，继续子 span', tone: 'lime' },
        { t: '收尾', s: '回写状态与成本', tone: 'coral' },
      ],
      edges: ['enqueue', 'dequeue', 'complete'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'API', s: 'start trace, publish message', tone: 'accent' },
        { t: 'Queue', s: 'payload carries traceparent + budget', tone: 'blue' },
        { t: 'Worker', s: 'restore context, continue spans', tone: 'lime' },
        { t: 'Wrap-up', s: 'write status and cost', tone: 'coral' },
      ],
      edges: ['enqueue', 'dequeue', 'complete'],
    },
  },
  'anti-pattern': {
    kind: 'compare',
    caption: {
      zh: '埋点的两种极端：什么都不记，和把所有东西都记下来。第二个更贵。',
      en: 'Two extremes: record nothing, or record everything. The second costs more.',
    },
    zh: {
      left: {
        title: '该记的',
        sub: '结构化、可聚合、带 ID',
        points: ['span 名、耗时、状态码', '模型、token、成本', '工具名、重试、错误类型', '租户 / 会话 / 版本标签'],
      },
      right: {
        title: '不该记的',
        sub: '高基数、原文、敏感',
        points: ['每条 prompt 全文入库', '用户手机号、身份证、密钥', '把 user_id 当 span 名', '每个函数都开 span'],
      },
      axis: '观测的第一原则是成本可控',
    },
    en: {
      left: {
        title: 'Record this',
        sub: 'structured, aggregatable, keyed',
        points: ['span name, latency, status', 'model, tokens, cost', 'tool name, retries, error type', 'tenant / session / version tags'],
      },
      right: {
        title: 'Never record',
        sub: 'high cardinality, raw text, sensitive',
        points: ['full prompt text per call', 'phone numbers, IDs, keys', 'user_id as a span name', 'a span per function'],
      },
      axis: 'Rule one of observability: keep the bill bounded',
    },
  },

  /* ---------------- 09 看板 ---------------- */
  'board-overview': {
    kind: 'bars',
    caption: {
      zh: '总览大盘的四块核心面板：先看绝对量，再看变化率，最后看异常租户。',
      en: 'Four panels on the overview: absolute volume, then rate of change, then the odd tenant.',
    },
    zh: {
      unit: '任务 / 小时',
      items: [
        { t: '询价', v: 1240, s: '成功率 99.2%', tone: 'lime' },
        { t: '改址', v: 680, s: '成功率 98.4%', tone: 'accent' },
        { t: '退款', v: 420, s: '成功率 94.1%', tone: 'coral' },
        { t: '投诉', v: 96, s: '成功率 97.9%', tone: 'blue' },
        { t: '其它', v: 180, s: '成功率 99.6%', tone: 'muted' },
      ],
      note: '退款任务量不大但失败率高，它才是今天最该看的那个数字。',
    },
    en: {
      unit: 'tasks / hour',
      items: [
        { t: 'Pricing', v: 1240, s: '99.2% success', tone: 'lime' },
        { t: 'Address', v: 680, s: '98.4% success', tone: 'accent' },
        { t: 'Refund', v: 420, s: '94.1% success', tone: 'coral' },
        { t: 'Complaint', v: 96, s: '97.9% success', tone: 'blue' },
        { t: 'Other', v: 180, s: '99.6% success', tone: 'muted' },
      ],
      note: 'Refunds are low volume but high failure — that is the number for today.',
    },
  },
  'board-failure': {
    kind: 'bars',
    caption: {
      zh: '失败原因分布：先修最大的柱子，别从「最有技术含量」的 bug 开始。',
      en: 'Failure reasons: fix the tallest bar, not the most intellectually interesting bug.',
    },
    zh: {
      unit: '失败任务数 / 天',
      items: [
        { t: '工具超时', v: 148, s: 'search_docs 为主', tone: 'coral' },
        { t: '模型限流', v: 96, s: '早高峰集中', tone: 'coral' },
        { t: '参数校验失败', v: 54, s: '工具 schema 变更', tone: 'accent' },
        { t: '上下文超长', v: 31, s: '长会话', tone: 'blue' },
        { t: '未知异常', v: 12, s: '需要补埋点', tone: 'muted' },
      ],
      note: '「未知异常」必须被压到接近 0：它就是埋点缺口，不是正常分类。',
    },
    en: {
      unit: 'failed tasks / day',
      items: [
        { t: 'Tool timeout', v: 148, s: 'mostly search_docs', tone: 'coral' },
        { t: 'Model rate limit', v: 96, s: 'morning peak', tone: 'coral' },
        { t: 'Schema validation', v: 54, s: 'tool schema changed', tone: 'accent' },
        { t: 'Context overflow', v: 31, s: 'long sessions', tone: 'blue' },
        { t: 'Unknown', v: 12, s: 'instrumentation gap', tone: 'muted' },
      ],
      note: 'Drive "unknown" to near zero: it is a gap in instrumentation, not a category.',
    },
  },
  'board-cost': {
    kind: 'matrix',
    caption: {
      zh: '成本看板按「模型 × 任务类型」拆开：贵的未必是模型，可能是轮次和上下文。',
      en: 'Split cost by model and task type: the bill may come from turns and context, not the model.',
    },
    zh: {
      head: ['任务类型', '主力模型', '单任务成本', 'token 结构'],
      rows: [
        ['询价', 'Haiku 4.5', '$0.004', 'in 82% / out 18%'],
        ['改址', 'Sonnet 4.5', '$0.021', 'in 74% / out 26%'],
        ['退款', 'Sonnet 4.5', '$0.068', 'in 61% / out 39%'],
        ['投诉', 'Opus 4.1', '$0.240', 'in 55% / out 45%'],
      ],
      highlight: [3],
    },
    en: {
      head: ['Task type', 'Main model', 'Cost per task', 'Token mix'],
      rows: [
        ['Pricing', 'Haiku 4.5', '$0.004', 'in 82% / out 18%'],
        ['Address', 'Sonnet 4.5', '$0.021', 'in 74% / out 26%'],
        ['Refund', 'Sonnet 4.5', '$0.068', 'in 61% / out 39%'],
        ['Complaint', 'Opus 4.1', '$0.240', 'in 55% / out 45%'],
      ],
      highlight: [3],
    },
  },
  'board-tool': {
    kind: 'bars',
    caption: {
      zh: '工具看板要成对看：耗时排行和失败排行放在一起，才知道该加缓存还是该修接口。',
      en: 'Read tool latency and tool failures side by side: only then do you know whether to cache or to fix.',
    },
    zh: {
      unit: '失败次数 / 天',
      items: [
        { t: 'search_docs', v: 186, s: 'P95 2.4s', tone: 'coral' },
        { t: 'refund_quote', v: 42, s: 'P95 410ms', tone: 'accent' },
        { t: 'get_order', v: 18, s: 'P95 640ms', tone: 'lime' },
        { t: 'send_email', v: 6, s: 'P95 220ms', tone: 'lime' },
      ],
    },
    en: {
      unit: 'failures / day',
      items: [
        { t: 'search_docs', v: 186, s: 'P95 2.4s', tone: 'coral' },
        { t: 'refund_quote', v: 42, s: 'P95 410ms', tone: 'accent' },
        { t: 'get_order', v: 18, s: 'P95 640ms', tone: 'lime' },
        { t: 'send_email', v: 6, s: 'P95 220ms', tone: 'lime' },
      ],
    },
  },
  'board-session': {
    kind: 'flow',
    caption: {
      zh: '会话看板是「用户视角」的入口：从一条投诉，直接打开它经历的全部链路。',
      en: 'The session board is the user-side door: from one complaint straight into every trace it touched.',
    },
    zh: {
      dir: 'v',
      nodes: [
        { t: '搜索会话', s: '按 user / session / 订单号', tone: 'accent' },
        { t: '时间轴', s: '每次交互一条 trace，标红失败', tone: 'blue' },
        { t: '单条展开', s: 'span 瀑布、工具参数、模型原话', tone: 'lime' },
        { t: '动作', s: '复制 trace 链接 / 加入评测集', tone: 'coral' },
      ],
      edges: ['定位', '还原', '取证'],
    },
    en: {
      dir: 'v',
      nodes: [
        { t: 'Find session', s: 'by user / session / order id', tone: 'accent' },
        { t: 'Timeline', s: 'one trace per interaction, failures in red', tone: 'blue' },
        { t: 'Expand', s: 'span waterfall, tool args, raw text', tone: 'lime' },
        { t: 'Act', s: 'copy trace link / add to eval set', tone: 'coral' },
      ],
      edges: ['locate', 'rebuild', 'evidence'],
    },
  },
  'board-loop': {
    kind: 'bars',
    caption: {
      zh: '循环异常看板：把「轮次分布」画出来，尾巴突然变长就说明它开始绕圈了。',
      en: 'Runaway loop board: plot the turn distribution; when the tail grows, it started circling.',
    },
    zh: {
      unit: '任务数 / 天',
      items: [
        { t: '1–3 轮', v: 1820, s: '健康区间', tone: 'lime' },
        { t: '4–6 轮', v: 640, s: '正常', tone: 'accent' },
        { t: '7–10 轮', v: 128, s: '要关注', tone: 'blue' },
        { t: '11–15 轮', v: 34, s: '疑似绕圈', tone: 'coral' },
        { t: '> 15 轮', v: 9, s: '已触发上限告警', tone: 'coral' },
      ],
      note: '再加一条面板：同一工具连续调用 > 8 次的 trace 列表，通常一眼就能看出问题。',
    },
    en: {
      unit: 'tasks / day',
      items: [
        { t: '1–3 turns', v: 1820, s: 'healthy', tone: 'lime' },
        { t: '4–6 turns', v: 640, s: 'normal', tone: 'accent' },
        { t: '7–10 turns', v: 128, s: 'watch', tone: 'blue' },
        { t: '11–15 turns', v: 34, s: 'suspicious', tone: 'coral' },
        { t: '> 15 turns', v: 9, s: 'ceiling alert fired', tone: 'coral' },
      ],
      note: 'Add one more: traces where the same tool ran 8× in a row — the cause is usually obvious.',
    },
  },

  /* ---------------- 10 评估 ---------------- */
  'eval-loop': {
    kind: 'hub',
    caption: {
      zh: '观测闭环：Trace 产生样本，样本产生评测，评测改 Prompt，Prompt 再产生新的 Trace。',
      en: 'The loop: traces yield samples, samples yield evals, evals change prompts, prompts yield new traces.',
    },
    zh: {
      center: '生产 Trace',
      nodes: ['失败样本池', '人工标注', '离线评测集', 'Prompt / 逻辑改动'],
      mode: 'cycle',
      note: '闭环的关键不是工具，而是「谁负责每周看一次失败池」。',
    },
    en: {
      center: 'Production traces',
      nodes: ['Failure pool', 'Human labels', 'Offline eval set', 'Prompt / logic change'],
      mode: 'cycle',
      note: 'The loop is not a tool: it is one person who opens the failure pool weekly.',
    },
  },
  'sample-flow': {
    kind: 'flow',
    caption: {
      zh: '抽样要「有偏」：失败、慢、贵、用户点踩的样本必须优先进入评测集。',
      en: 'Sample with bias on purpose: failures, slow and expensive traces, and thumbs-down must enter the eval set first.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '线上 Trace', s: '全量流入', tone: 'accent' },
        { t: '触发规则', s: '失败 / 超时 / 差评 / 高成本', tone: 'coral' },
        { t: '脱敏快照', s: '输入、上下文、输出', tone: 'blue' },
        { t: '评测集', s: '去重 + 打标签 + 版本', tone: 'lime' },
      ],
      edges: ['筛选', '冻结', '沉淀'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Live traces', s: 'all traffic', tone: 'accent' },
        { t: 'Trigger rules', s: 'failure / timeout / thumbs-down / cost', tone: 'coral' },
        { t: 'Redacted snapshot', s: 'input, context, output', tone: 'blue' },
        { t: 'Eval set', s: 'dedupe, label, version', tone: 'lime' },
      ],
      edges: ['filter', 'freeze', 'keep'],
    },
  },
  'regression-compare': {
    kind: 'compare',
    caption: {
      zh: '回归对比别看总体均分：要看「本来对的变错」的那部分，它才是回归。',
      en: 'Do not compare averages: look at cases that used to pass and now fail. That is a regression.',
    },
    zh: {
      left: {
        title: '改进',
        sub: '之前错，现在对',
        points: ['共 18 例', '主要集中在多轮工具场景', '可安全放量'],
      },
      right: {
        title: '回归',
        sub: '之前对，现在错',
        points: ['共 11 例', '集中在日期与金额计算', '必须回滚或修 Prompt'],
      },
      axis: '同一个评测集，两次运行',
    },
    en: {
      left: {
        title: 'Improvements',
        sub: 'was wrong, now right',
        points: ['18 cases', 'mostly multi-turn tool use', 'safe to roll out'],
      },
      right: {
        title: 'Regressions',
        sub: 'was right, now wrong',
        points: ['11 cases', 'dates and money math', 'roll back or fix the prompt'],
      },
      axis: 'one eval set, two runs',
    },
  },
  'degrade-matrix': {
    kind: 'matrix',
    caption: {
      zh: '劣化发现要「自动比」：同比、环比、分版本、分租户，四个视角至少开两个。',
      en: 'Degradation detection must be automatic: week-over-week, version, tenant, segment — enable at least two.',
    },
    zh: {
      head: ['信号', '对比方式', '阈值示例', '误报风险'],
      rows: [
        ['成功率下降', '发布前后 2 小时', '-2 个百分点', '低'],
        ['平均轮次上升', '版本 A/B', '+0.8 轮', '中'],
        ['拒答率上升', '环比 7 天', '×1.5', '中（业务波动）'],
        ['抽检合格率下降', '同日评测集', '-3 个百分点', '低'],
      ],
      highlight: [0],
    },
    en: {
      head: ['Signal', 'Comparison', 'Example threshold', 'False positive risk'],
      rows: [
        ['Success rate down', '2h before/after release', '-2 points', 'low'],
        ['Avg turns up', 'version A/B', '+0.8 turns', 'medium'],
        ['Refusal rate up', '7-day week-over-week', '×1.5', 'medium (seasonality)'],
        ['Sample pass rate down', 'same-day eval set', '-3 points', 'low'],
      ],
      highlight: [0],
    },
  },

  /* ---------------- 11 安全 ---------------- */
  'retention-life': {
    kind: 'lifecycle',
    caption: {
      zh: '留存不是一个数字，而是一条流水线：热查 7 天、温存 30 天、归档 1 年、到期即删。',
      en: 'Retention is a pipeline, not a number: 7 hot days, 30 warm days, 1 year archive, then delete.',
    },
    zh: {
      states: [
        { t: '热存 0–7 天', s: 'Trace 全字段可查，最贵', tone: 'accent' },
        { t: '温存 7–30 天', s: '保留结构，正文采样', tone: 'blue' },
        { t: '归档 30–365 天', s: 'Parquet + 对象存储，按需恢复', tone: 'lime' },
        { t: '到期删除', s: '自动任务 + 删除审计', tone: 'coral' },
      ],
      note: '合规要求「可删除」和「可证明已删除」，后者常被忘掉。',
    },
    en: {
      states: [
        { t: 'Hot 0–7d', s: 'all fields queryable, most expensive', tone: 'accent' },
        { t: 'Warm 7–30d', s: 'structure kept, bodies sampled', tone: 'blue' },
        { t: 'Archive 30–365d', s: 'Parquet + object store, restore on demand', tone: 'lime' },
        { t: 'Delete', s: 'scheduled job + deletion audit', tone: 'coral' },
      ],
      note: 'Compliance wants both deletion and proof of deletion; the second is usually forgotten.',
    },
  },
  'tenant-matrix': {
    kind: 'matrix',
    caption: {
      zh: '多租户隔离要在四个层面同时成立，漏一层就等于没隔离。',
      en: 'Tenant isolation must hold on four layers at once; miss one and you have none.',
    },
    zh: {
      head: ['层面', '做法', '漏了会怎样'],
      rows: [
        ['资源属性', '每条 span 带 tenant.id', '无法按租户过滤与计费'],
        ['存储', '独立索引 / 分区 / 桶', '跨租户查询泄露'],
        ['查询', '强制注入租户过滤', '越权查看他人链路'],
        ['密钥', '按租户独立加密密钥', '删除时无法证明彻底'],
      ],
      highlight: [2],
    },
    en: {
      head: ['Layer', 'How', 'If missed'],
      rows: [
        ['Attributes', 'tenant.id on every span', 'cannot filter or bill by tenant'],
        ['Storage', 'separate index / partition / bucket', 'cross-tenant queries leak'],
        ['Query', 'inject tenant filter by force', 'users see other traces'],
        ['Keys', 'per-tenant encryption keys', 'cannot prove deletion'],
      ],
      highlight: [2],
    },
  },
  'access-matrix': {
    kind: 'matrix',
    caption: {
      zh: '三种角色够用：能看聚合、能看链路、能改配置。别再让所有人都是管理员。',
      en: 'Three roles are enough: aggregates, traces, settings. Stop making everyone an admin.',
    },
    zh: {
      head: ['角色', '聚合指标', '链路明细', 'Prompt 原文', '配置 / 导出'],
      rows: [
        ['业务方', '✓', '本租户', '✗', '✗'],
        ['工程师', '✓', '✓（脱敏）', '按需审批', '✗'],
        ['平台管理员', '✓', '✓', '✓', '✓'],
      ],
      highlight: [0],
    },
    en: {
      head: ['Role', 'Aggregates', 'Trace detail', 'Prompt text', 'Config / export'],
      rows: [
        ['Business', 'yes', 'own tenant', 'no', 'no'],
        ['Engineer', 'yes', 'yes (redacted)', 'on approval', 'no'],
        ['Admin', 'yes', 'yes', 'yes', 'yes'],
      ],
      highlight: [0],
    },
  },
  'residency-compare': {
    kind: 'compare',
    caption: {
      zh: '数据本地化不是「服务器在哪」，而是「谁能看到、能不能出境、删除后还在不在」。',
      en: 'Residency is not where the server sits: it is who can see it, whether it crosses borders, and whether deletion is final.',
    },
    zh: {
      left: {
        title: '自托管',
        sub: '数据边界 = 你的 VPC',
        points: ['可承诺不出境', '需自己做加密与备份', '跨区域要自己复制', '供应商支持依赖内部团队'],
      },
      right: {
        title: '云平台',
        sub: '边界 = 合同与区域选项',
        points: ['区域可选，但要看子处理商', '加密与审计由厂商提供', '跨境支持需合同条款', '迁移成本高'],
      },
      axis: '控制力 vs 便利性',
    },
    en: {
      left: {
        title: 'Self-hosted',
        sub: 'boundary = your VPC',
        points: ['Can promise no export', 'You own encryption and backups', 'Cross-region is your job', 'Support depends on your team'],
      },
      right: {
        title: 'Cloud',
        sub: 'boundary = contract + region',
        points: ['Region choice, but check subprocessors', 'Vendor provides encryption and audit', 'Cross-border needs contract terms', 'Migration is expensive'],
      },
      axis: 'control vs convenience',
    },
  },

  /* ---------------- 12 踩坑 ---------------- */
  'broken-trace': {
    kind: 'flow',
    caption: {
      zh: '断链的经典现场：中间某个服务重新生成了 trace_id，于是后半段成了孤儿。',
      en: 'The classic break: a middle service mints a new trace_id, and everything after becomes an orphan.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '前端', s: 'trace 4f9c', tone: 'accent' },
        { t: '网关', s: '透传正常', tone: 'lime' },
        { t: '队列 Worker', s: '新建 trace 8a11（断了）', tone: 'coral' },
        { t: '下游', s: '挂在 8a11 下', tone: 'muted' },
      ],
      edges: ['traceparent', '消息未带上下文', '新链路'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Frontend', s: 'trace 4f9c', tone: 'accent' },
        { t: 'Gateway', s: 'propagates fine', tone: 'lime' },
        { t: 'Queue worker', s: 'new trace 8a11 (broken)', tone: 'coral' },
        { t: 'Downstream', s: 'hangs under 8a11', tone: 'muted' },
      ],
      edges: ['traceparent', 'message lost context', 'new trace'],
    },
  },
  'stream-loss': {
    kind: 'sequence',
    caption: {
      zh: '流式丢 span 的根因通常不是采样，而是「span 在生成器里开始，在另一个进程结束」。',
      en: 'Lost streaming spans usually come from a span that starts in one generator and ends in another process.',
    },
    zh: {
      actors: ['Client', 'SSE Handler', 'Background Task'],
      steps: [
        { from: 1, to: 2, t: '建立流' },
        { from: 2, to: 2, t: 'start span（在此进程）' },
        { from: 2, to: 3, t: '转交后台任务生成内容' },
        { from: 3, to: 2, t: 'chunk 回调（上下文丢失）' },
        { from: 2, to: 3, t: 'end span 从未执行 → 半小时后超时', dashed: true },
      ],
    },
    en: {
      actors: ['Client', 'SSE handler', 'Background task'],
      steps: [
        { from: 1, to: 2, t: 'open the stream' },
        { from: 2, to: 2, t: 'start span (this process)' },
        { from: 2, to: 3, t: 'hand generation to a background task' },
        { from: 3, to: 2, t: 'chunk callback (context lost)' },
        { from: 2, to: 3, t: 'end span never runs → 30 min timeout', dashed: true },
      ],
    },
  },
  'cost-blow': {
    kind: 'bars',
    caption: {
      zh: '一次「跑飞」的任务长什么样：轮次翻倍，输入 token 指数涨，最后一步几乎全是上下文。',
      en: 'What a runaway task looks like: turns double, input tokens explode, and the last call is nearly all context.',
    },
    zh: {
      unit: '输入 token / 轮',
      items: [
        { t: '第 1 轮', v: 820, s: '$0.004', tone: 'lime' },
        { t: '第 4 轮', v: 3100, s: '$0.012', tone: 'accent' },
        { t: '第 8 轮', v: 9200, s: '$0.031', tone: 'coral' },
        { t: '第 12 轮', v: 24000, s: '$0.079', tone: 'coral' },
        { t: '第 15 轮', v: 41000, s: '$0.132', tone: 'coral' },
      ],
      note: '15 轮累计 $0.36，是正常任务的 7 倍。轮次上限比模型降级更省钱。',
    },
    en: {
      unit: 'input tokens / turn',
      items: [
        { t: 'Turn 1', v: 820, s: '$0.004', tone: 'lime' },
        { t: 'Turn 4', v: 3100, s: '$0.012', tone: 'accent' },
        { t: 'Turn 8', v: 9200, s: '$0.031', tone: 'coral' },
        { t: 'Turn 12', v: 24000, s: '$0.079', tone: 'coral' },
        { t: 'Turn 15', v: 41000, s: '$0.132', tone: 'coral' },
      ],
      note: 'Fifteen turns cost $0.36, 7× a normal task. A turn ceiling saves more than a cheaper model.',
    },
  },
  'silent-fail': {
    kind: 'compare',
    caption: {
      zh: '「任务成功」和「答案正确」是两件事；只看前者，等于闭着眼上线。',
      en: '"Task succeeded" and "answer is right" are different claims; tracking only the first is shipping with eyes closed.',
    },
    zh: {
      left: {
        title: '技术成功',
        sub: '系统视角',
        points: ['HTTP 200，span 无 error', '任务状态 completed', '没有异常日志', '延迟在 SLO 内'],
      },
      right: {
        title: '业务正确',
        sub: '质量视角',
        points: ['答案与事实一致', '没有编造政策或金额', '工具参数选对了', '用户不需要再问一遍'],
      },
      axis: '两者都过，才算成功',
    },
    en: {
      left: {
        title: 'Technical success',
        sub: 'system view',
        points: ['HTTP 200, no error span', 'task status completed', 'no exception logs', 'latency within SLO'],
      },
      right: {
        title: 'Business correctness',
        sub: 'quality view',
        points: ['answer matches facts', 'no invented policy or amount', 'right tool arguments', 'user does not re-ask'],
      },
      axis: 'Both must pass',
    },
  },
  'sampling-miss': {
    kind: 'flow',
    caption: {
      zh: '采样踩空的典型：10% 头采样正好把那批失败的全丢了，看板上写着「一切正常」。',
      en: 'The classic sampling miss: 10% head sampling drops exactly the failing batch, and the board says all is well.',
    },
    zh: {
      dir: 'v',
      nodes: [
        { t: '全部请求', s: '100% 进入', tone: 'accent' },
        { t: '头采样 10%', s: '按 trace_id 哈希', tone: 'blue' },
        { t: '异常批次被丢', s: '失败率高的租户恰好在 90% 里', tone: 'coral' },
        { t: '修法', s: '错误优先 + 尾采样 + 租户配额', tone: 'lime' },
      ],
      edges: ['进入', '抽样', '失真', '纠正'],
    },
    en: {
      dir: 'v',
      nodes: [
        { t: 'All requests', s: '100% in', tone: 'accent' },
        { t: 'Head sample 10%', s: 'hash by trace_id', tone: 'blue' },
        { t: 'The bad batch is dropped', s: 'the failing tenant sits in the other 90%', tone: 'coral' },
        { t: 'The fix', s: 'error-first + tail sampling + tenant quota', tone: 'lime' },
      ],
      edges: ['in', 'sample', 'distort', 'correct'],
    },
  },

  /* ---------------- 13 Demo ---------------- */
  'demo-trace': {
    kind: 'tree',
    caption: {
      zh: 'Demo 跑完你应该看到这棵树：三层 span，token 和成本都在属性里。',
      en: 'After running the demo you should see this tree: three levels, with tokens and cost as attributes.',
    },
    zh: {
      spans: [
        { t: 'invoke_agent demo-agent', s: 'service.name=demo', lvl: 0, dur: '2.4s', w: 100, tone: 'accent' },
        { t: 'chat gpt-4.1-mini', s: 'input=142, output=38, cost=$0.0004', lvl: 1, dur: '1.9s', w: 79, tone: 'blue' },
        { t: 'execute_tool get_weather', s: 'tool=weather.get, retries=0', lvl: 2, dur: '310ms', w: 13, tone: 'lime' },
        { t: 'chat gpt-4.1-mini', s: 'input=201, output=52, cost=$0.0006', lvl: 1, dur: '420ms', w: 18, tone: 'blue' },
      ],
      note: '如果只看到最外层，多半是没装 exporter；如果只有 chat 没有 tool，检查工具客户端包装。',
    },
    en: {
      spans: [
        { t: 'invoke_agent demo-agent', s: 'service.name=demo', lvl: 0, dur: '2.4s', w: 100, tone: 'accent' },
        { t: 'chat gpt-4.1-mini', s: 'input=142, output=38, cost=$0.0004', lvl: 1, dur: '1.9s', w: 79, tone: 'blue' },
        { t: 'execute_tool get_weather', s: 'tool=weather.get, retries=0', lvl: 2, dur: '310ms', w: 13, tone: 'lime' },
        { t: 'chat gpt-4.1-mini', s: 'input=201, output=52, cost=$0.0006', lvl: 1, dur: '420ms', w: 18, tone: 'blue' },
      ],
      note: 'Only the outer span? The exporter is missing. Chat but no tool span? Wrap the tool client.',
    },
  },
  'demo-stack': {
    kind: 'layers',
    caption: {
      zh: 'Demo 依赖只有四层：Python、OTel SDK、本地 Collector、一个能看链路的 UI。',
      en: 'The demo needs four layers: Python, the OTel SDK, a local collector, and something that shows traces.',
    },
    zh: {
      layers: [
        { t: '应用', items: ['Python 3.11+、openai / anthropic SDK'], tone: 'accent' },
        { t: '埋点', items: ['opentelemetry-sdk + OTLP exporter'], tone: 'blue' },
        { t: '收集', items: ['otel/opentelemetry-collector-contrib'], tone: 'lime' },
        { t: '查看', items: ['Langfuse / Jaeger / Tempo + Grafana'], tone: 'coral' },
      ],
    },
    en: {
      layers: [
        { t: 'App', items: ['Python 3.11+, openai / anthropic SDK'], tone: 'accent' },
        { t: 'Instrumentation', items: ['opentelemetry-sdk + OTLP exporter'], tone: 'blue' },
        { t: 'Collection', items: ['otel/opentelemetry-collector-contrib'], tone: 'lime' },
        { t: 'View', items: ['Langfuse / Jaeger / Tempo + Grafana'], tone: 'coral' },
      ],
    },
  },

  /* ---------------- 14 规模 ---------------- */
  'async-pipeline': {
    kind: 'flow',
    caption: {
      zh: '生产级上报管道：业务线程只往里丢，永远不等待网络。',
      en: 'A production export pipeline: the app thread only enqueues and never waits on the network.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '业务线程', s: 'span.end() 立即返回', tone: 'accent' },
        { t: '内存队列', s: '有界队列 + 丢弃策略', tone: 'blue' },
        { t: '导出线程', s: '批量 + 重试 + 退避', tone: 'lime' },
        { t: 'Collector', s: '背压与限流', tone: 'muted' },
      ],
      edges: ['非阻塞', '批处理', 'OTLP'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'App thread', s: 'span.end() returns immediately', tone: 'accent' },
        { t: 'In-memory queue', s: 'bounded + drop policy', tone: 'blue' },
        { t: 'Export thread', s: 'batch + retry + backoff', tone: 'lime' },
        { t: 'Collector', s: 'backpressure and limits', tone: 'muted' },
      ],
      edges: ['non-blocking', 'batching', 'OTLP'],
    },
  },
  'sampling-matrix': {
    kind: 'matrix',
    caption: {
      zh: '四种采样各有代价：没有完美方案，只有「你最怕漏掉什么」。',
      en: 'Every sampling strategy has a price: pick by what you are most afraid to miss.',
    },
    zh: {
      head: ['策略', '怎么工作', '优点', '代价'],
      rows: [
        ['头采样', '入口按比例决定', '实现简单、开销最低', '可能漏掉罕见故障'],
        ['尾采样', '收集完整个 trace 再决定', '保住错误与慢请求', '需要同 trace 聚合'],
        ['错误优先', '失败/超时全留', '故障必留证据', '正常流量仍需采样'],
        ['按租户配额', '大租户低比例、小租户全留', '公平且可控成本', '配置复杂'],
      ],
      highlight: [1],
    },
    en: {
      head: ['Strategy', 'How', 'Win', 'Cost'],
      rows: [
        ['Head sampling', 'decide at the edge by ratio', 'simple, cheapest', 'may miss rare failures'],
        ['Tail sampling', 'buffer a whole trace, then decide', 'keeps errors and slow requests', 'needs trace affinity'],
        ['Error-first', 'keep all failures and timeouts', 'evidence always kept', 'still need sampling for normal traffic'],
        ['Tenant quota', 'low ratio for big tenants, all for small', 'fair and bounded', 'complex config'],
      ],
      highlight: [1],
    },
  },
  'hot-cold': {
    kind: 'layers',
    caption: {
      zh: '冷热分离的本质：最近 7 天用来查故障，30 天以前只用来算账和审计。',
      en: 'Hot/cold split: the last 7 days are for debugging, anything older is for billing and audit.',
    },
    zh: {
      layers: [
        { t: '热层', items: ['最近 7 天全字段，支持按 trace_id 秒级查询'], tone: 'accent', note: '排障' },
        { t: '温层', items: ['8–30 天，正文采样，保留指标聚合'], tone: 'blue', note: '复盘' },
        { t: '冷层', items: ['30 天以上，Parquet 压缩归档'], tone: 'lime', note: '审计' },
        { t: '指标层', items: ['降采样后的长期时序，永久保留'], tone: 'muted', note: '趋势' },
      ],
    },
    en: {
      layers: [
        { t: 'Hot', items: ['last 7 days, all fields, second-level trace lookup'], tone: 'accent', note: 'debug' },
        { t: 'Warm', items: ['8–30 days, sampled bodies, metrics intact'], tone: 'blue', note: 'review' },
        { t: 'Cold', items: ['30+ days, compressed Parquet archive'], tone: 'lime', note: 'audit' },
        { t: 'Metrics', items: ['downsampled time series, kept forever'], tone: 'muted', note: 'trend' },
      ],
    },
  },
  'cluster-hub': {
    kind: 'hub',
    caption: {
      zh: 'Agent 集群的观测拓扑：每个节点本地批量，按 trace_id 路由到同一个 Collector。',
      en: 'Cluster topology: batch locally on each node, route by trace_id to the same collector.',
    },
    zh: {
      center: 'Collector 集群',
      nodes: ['Agent Pod A', 'Agent Pod B', 'Worker Pool', 'Gateway'],
      mode: 'star',
      note: '尾采样必须保证同一 trace 落到同一实例，否则你永远采不到完整链路。',
    },
    en: {
      center: 'Collector fleet',
      nodes: ['Agent pod A', 'Agent pod B', 'Worker pool', 'Gateway'],
      mode: 'star',
      note: 'Tail sampling requires trace affinity; otherwise no trace is ever complete.',
    },
  },

  /* ---------------- 15 生态 ---------------- */
  'eco-hub': {
    kind: 'hub',
    caption: {
      zh: '可观测性不是第六块拼图，而是把五块拼图粘起来的那层胶水。',
      en: 'Observability is not a sixth piece: it is the glue that holds the five together.',
    },
    zh: {
      center: '观测层',
      nodes: ['better-agent 调度', 'a2a-patterns 协作', 'mcp-patterns 工具', 'agent-memory-patterns 记忆', 'llm-gateway-patterns 模型'],
      mode: 'star',
      note: '每个站点负责「产生事件」，本手册负责「记录、聚合、告警、复盘」。',
    },
    en: {
      center: 'Observability',
      nodes: ['better-agent', 'a2a-patterns', 'mcp-patterns', 'agent-memory-patterns', 'llm-gateway-patterns'],
      mode: 'star',
      note: 'Each site produces events; this handbook records, aggregates, alerts and reviews them.',
    },
  },
}

export type DiagramId = keyof typeof diagrams
