# Agent Observability Patterns

> 《AI Agent 可观测性工程模式完全手册》 · The complete field guide to agent observability
> 把 Agent 的黑盒变成一条能看清、能度量、能追责、能优化的链路。

在线地址：**https://yuxinrun.github.io/agent-observability-patterns/**

[![Deploy](https://github.com/yuxinrun/agent-observability-patterns/actions/workflows/deploy.yml/badge.svg)](https://github.com/yuxinrun/agent-observability-patterns/actions/workflows/deploy.yml)

---

## 这是什么

Agent 不会喊疼。它只会静默超时、悄悄循环、把账单刷到四位数，然后给你一句「已完成」。

这个站点解决一个非常具体的问题：**你的 Agent 上线了，但你看不见它。** 全书 16 章，从「什么是 Span」讲到「一万个 Agent 同时跑怎么不烧钱」，包含 50+ 张手写图解、可直接运行的 Demo 和一份生产血泪清单。

- **中英双语**一键切换，**明暗主题**跟随系统并可手动切换
- **50+ 张手写 SVG/CSS 图解**：瀑布图、时序图、分层图、指标柱状图、选型矩阵
- **可直接复制的代码**：Python OTel 埋点、LangGraph + OpenLLMetry、CrewAI + Langfuse、A2A 透传、MCP 埋点、Grafana 看板 JSON
- **对齐官方规范**：OpenTelemetry GenAI 语义约定、Anthropic Claude 与 OpenAI Agents SDK 的 tracing 实践

## 生态矩阵

本项目是「Agent 工程模式」系列的一环，五个项目讲清五件事，可观测性是把它们粘在一起的那层胶水：

| 项目 | 负责什么 | 和可观测的关系 |
| --- | --- | --- |
| [better-agent](https://github.com/yuxinrun/better-agent) | 单 Agent 调度与循环 | 轮次与工具调用最密集，链路主体 |
| [mcp-patterns](https://github.com/yuxinrun/mcp-patterns) | 工具接入（MCP） | Server/Client 双端埋点，最容易断链 |
| [llm-gateway-patterns](https://github.com/yuxinrun/llm-gateway-patterns) | 模型网关与计量 | 成本数据的唯一权威来源 |
| [a2a-patterns](https://github.com/yuxinrun/a2a-patterns) | 多 Agent 协作 | 跨 Agent trace 透传与委派深度限制 |
| [agent-memory-patterns](https://github.com/yuxinrun/agent-memory-patterns) | 记忆层 | 记忆读写与召回耗时决定上下文质量 |

每个项目独立的站点风格、配色、动效、双语切换方式完全一致。

## 目录

| 章 | 标题 | 一句话 |
| --- | --- | --- |
| 00 | 开篇：最难监控的黑盒小朋友 | 为什么 Agent 和传统程序不是一回事 |
| 01 | 基础概念：底层原理 | Trace / Span / 上下文透传 / GenAI 属性 |
| 02 | 全链路追踪模式 | 八种 Pattern：ReAct、流式、分层、A2A、MCP、记忆、会话、错误快照 |
| 03 | 指标 Metrics 体系 | 任务 / 模型 / 工具 / 体验 / 业务五层指标 + SLO |
| 04 | 结构化日志与审计 | 必填字段、脱敏、采样、存储选型 |
| 05 | 告警体系 | P0–P3 分级、五类规则模板、降噪六件套 |
| 06 | 平台选型 | Langfuse / OpenLLMetry / Phoenix / LangSmith / 自建 |
| 07 | 集成实战 | 网关、MCP、A2A、记忆、调度框架怎么接 |
| 08 | 埋点工程模式 | 装饰器、中间件、回调、异步队列 + 五种反模式 |
| 09 | 看板设计 | 六块生产看板，逐块讲指标与图表 |
| 10 | 评估与观测联动 | Trace → 标注 → 评测 → 优化闭环 |
| 11 | 安全、隐私、合规 | 留存、脱敏、租户隔离、权限、本地化 |
| 12 | 高频踩坑大全 | 七个生产血泪故事与修法 |
| 13 | 可运行 Demo | 七套完整代码与配置模板 |
| 14 | 高并发与规模化 | 异步上报、采样策略、冷热分层、成本控制 |
| 15 | 生态联动 | 与另外五个项目的接缝与字段契约 |

## 技术栈

- [VitePress](https://vitepress.dev/)（最新稳定版，`^1.6`）
- Vue 3 + TypeScript，自定义主题与全局组件（`Diagram` / `Eco` / `ChapterMap`）
- 全站图解为手写 SVG/CSS，无图片依赖，缩放不失真
- 站内搜索为自建索引（`scripts/build-search.mjs`），无第三方服务
- 部署：GitHub Actions → GitHub Pages

## 本地运行

```bash
# 需要 Node 18+
npm install

# 开发（默认 http://localhost:5190/agent-observability-patterns/）
npm run dev

# 构建（会先重建搜索索引）
npm run build

# 预览构建产物
npm run preview
```

> 注意：`npm run dev` 与 `npm run build` 都会先执行搜索索引构建，因此新增 Markdown 后索引会自动更新。

## 目录结构

```
agent-observability-patterns/
├─ docs/
│  ├─ .vitepress/
│  │  ├─ config.mts            # 站点配置：双语、侧边栏、搜索、主题
│  │  ├─ data/
│  │  │  ├─ catalog.ts         # 目录单一事实来源（章节、小节锚点）
│  │  │  ├─ diagrams.ts        # 50+ 张图解的双语数据
│  │  │  └─ ecosystem.ts       # 生态矩阵
│  │  └─ theme/                # 自定义主题、组件与样式
│  ├─ index.md                 # 中文首页
│  ├─ en/                      # 英文全站镜像
│  ├─ intro/ … scale/          # 16 章正文
│  └─ public/                  # 静态资源与搜索索引
├─ scripts/build-search.mjs    # 搜索索引构建
└─ .github/workflows/deploy.yml
```

## 部署

推送到 `main` 分支即自动构建并发布到 GitHub Pages。首次部署需在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

## 贡献

发现错误、想补一个生产案例、或者觉得某个类比不够好笑，都欢迎提 PR。新增章节请同步修改 `docs/.vitepress/data/catalog.ts`，侧边栏、上下章导航、搜索索引都会自动跟随。

## License

MIT © [Yuxin](https://yuxin.run)
