---
title: 06 · 观测平台选型：Langfuse / Phoenix / LangSmith
description: 四个开源平台的定位与自托管难度、轻量自建方案、商用对比，以及最小推荐生产组合。
outline: [2, 3]
---

# 06 · 观测平台选型：Langfuse / Phoenix / LangSmith

选平台就像选房子：**不是选最好的，是选最不容易后悔的。**

你会后悔的三件事：数据搬不走、账单随请求数线性上涨、以及「这个功能只有他们的 SDK 支持」。

::: tip 人话翻译
先分清两类东西：
- **采集库**（OpenLLMetry、OpenInference、OTel SDK）负责「把数据弄出来」，通常是开源的、可替换的。
- **观测平台**（Langfuse、Phoenix、LangSmith、Datadog）负责「存起来、看起来」，通常绑定账单。

**最稳的策略是：采集走标准，平台可替换。**
:::

## 01 平台全景与定位 {#landscape}

<Diagram id="platform-matrix" />

| 平台 | 定位 | 协议 | 自托管 | 数据主权 | 适合谁 |
| --- | --- | --- | --- | --- | --- |
| **Langfuse** | LLM 应用观测 + 提示词管理 + 评测 | OTel / 自有 SDK | Docker Compose，较简单 | 完全自持 | 想要开箱即用的产品团队 |
| **OpenLLMetry** | 采集库，不是平台 | OTel 原生 | 无（它只负责产出） | 你选后端 | 已有后端，只缺埋点 |
| **Phoenix** | 评测优先的观测 + 实验 | OTel / OpenInference | 单容器，易 | 完全自持 | 算法团队、评测驱动 |
| **LangSmith** | 商业 SaaS，链路 + 评测 + 数据集 | 自有 + OTel 入口 | 企业版可自托管 | 云端为主 | 已用 LangChain 的团队 |
| **Datadog / New Relic** | 全栈 APM 的 LLM 模块 | OTel / 自有 agent | 不支持 | 云端 | 已有 APM 合同的大企业 |

一句话版本：

- 想**一周上线**：Langfuse Cloud 或自托管 Langfuse。
- 想**不被绑定**：OpenLLMetry + 任意 OTLP 后端（含 Grafana Tempo）。
- 想**做评测**：Phoenix 或 Langfuse 的 dataset + eval 功能。
- 想**全公司一个 APM**：Datadog / New Relic 的 LLM Observability 模块。

## 02 什么场景选哪个 {#selection}

<Diagram id="selection-flow" />

| 你的情况 | 推荐 | 理由 |
| --- | --- | --- |
| 3 人团队，两周要上线 | Langfuse Cloud | 零运维，trace + prompt + eval 都有 |
| 金融/医疗，数据不能出境 | 自托管 Langfuse 或 Phoenix | 数据完全在自己 VPC |
| 已有 Prometheus + Grafana | OpenLLMetry + Tempo + Grafana | 不引入新平台，复用现有值班体系 |
| 要做系统性评测与回归 | Phoenix | 评测 UI 与实验管理更顺手 |
| 深度使用 LangChain / LangGraph | LangSmith | 集成最深，调试体验最好 |
| 已有 Datadog 合同 | Datadog LLM Observability | 复用告警、SLO、值班 |
| 只想先看看链路长什么样 | OpenLLMetry + Jaeger | 半天能跑通 |

::: warning 「开源」不等于「免费」
Langfuse、Phoenix 的自托管版本可以免费用，但你要付出：机器、Postgres、ClickHouse、备份、升级、以及一个人半职的运维时间。算下来常常比 SaaS 贵——除非你的数据确实不能出去。
:::

## 03 轻量自建：Tempo + OpenObserve {#lightweight}

如果你的诉求只是「能看到链路、能搜日志、能配告警」，一套纯开源栈就够，而且成本可控。

<Diagram id="light-stack" />

```yaml
# docker-compose.yml（精简版，仅示意组件关系）
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

| 组件 | 负责 | 替代品 |
| --- | --- | --- |
| OTel Collector | 接收 OTLP、批处理、脱敏、分流 | Vector、Fluent Bit |
| Tempo | Trace 存储与查询 | Jaeger、ClickHouse |
| OpenObserve | 日志存储与检索 | Loki、ELK |
| Prometheus | 指标 | VictoriaMetrics、Mimir |
| Grafana | 看板与告警 | 自建前端 |

这套栈的优点是**没有按请求计费**，缺点是**没有 LLM 专属视图**（提示词对比、数据集、评测）。你可以在 Grafana 里自己拼，但要花时间。

## 04 商用方案对比 {#commercial}

<Diagram id="commercial-compare" />

| 维度 | Datadog LLM Observability | New Relic AI Monitoring | LangSmith |
| --- | --- | --- | --- |
| 计费方式 | 按 span / 主机 / 自定义指标 | 按用量（数据摄入 + 用户） | 按 trace 数 / 席位 |
| 优势 | 全栈关联，告警体系成熟 | 与 APM 深度整合 | LLM 专用 UI 最顺手 |
| 劣势 | 贵，LLM 语义支持相对通用 | LLM 功能仍在补齐 | 强绑定 LangChain 生态 |
| 数据出境 | 云端 | 云端 | 云端（企业版可自托管） |
| 适合 | 已有合同的大企业 | 已用 New Relic 的团队 | LangChain 重度用户 |

商用方案真正卖的不是「存储」，是**和现有值班、告警、权限体系的整合**。如果你们公司所有人已经在 Datadog 里看 SLO，硬塞一个新平台反而降低效率。

## 05 最小推荐生产组合 {#recommended}

<Diagram id="rec-stack" />

这是一套「不后悔」的组合，也是本手册 Demo 采用的结构：

| 层 | 选型 | 作用 |
| --- | --- | --- |
| 采集 | OTel SDK + OpenLLMetry（或 OpenInference） | 产出 `gen_ai.*` 标准 span |
| 中转 | OTel Collector | 批处理、脱敏、采样、双写 |
| 链路 | Langfuse 或 Tempo | 人看的瀑布图 |
| 指标 | Prometheus / ClickHouse | 看板与告警 |
| 日志 | Loki 或 OpenObserve | 审计与检索 |
| 评测 | Phoenix / Langfuse dataset | 质量闭环 |
| 展示 | Grafana + 平台自带 UI | 各角色各看各的 |

```yaml
# otel.yaml：一份配置同时喂两个后端，迁移期最爱
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

::: tip 双写是迁移期的最优解
先用双写跑两周，对比两边数据是否一致，再决定留哪个。比「一次性切换然后发现字段全丢」便宜太多。
:::

## 选型评分卡 {#board-sample}

不要靠感觉选，按权重打分（1~5 分），加权后再讨论：

| 维度 | 权重 | 说明 |
| --- | --- | --- |
| 数据合规 | 30% | 能否自托管、数据在哪 |
| 总成本（含人力） | 25% | 三年 TCO，不只是账单 |
| 协议开放度 | 20% | 是否 OTel 原生、能否导出 |
| 功能匹配 | 15% | 是否需要 prompt 管理 / 评测 |
| 上手速度 | 10% | 团队多久能跑通 |

## 避坑清单 {#pitfalls}

::: warning 选型的五个坑
1. **只看 demo 好看**。Demo 里的链路都是 3 层，你的真实链路有 30 层。
2. **忽略数据导出能力**。迁移时发现只能导出 CSV，等于被锁死。
3. **用 SDK 而不是 OTel 埋点**。换平台 = 重写埋点。
4. **低估自托管的运维成本**。ClickHouse 的磁盘会以你意想不到的速度增长。
5. **没算评测成本**。LLM-as-judge 的模型调用费常常比观测存储还贵。
:::

## 小结 {#recap}

- 采集与平台分离：采集走 OTel 标准，平台保持可替换。
- Langfuse 均衡、Phoenix 偏评测、OpenLLMetry 只是采集库、LangSmith 生态绑定深。
- 轻量自建 = Collector + Tempo + OpenObserve + Prometheus + Grafana。
- 商用方案买的是整合度，不是存储。
- 最小生产组合：标准埋点 + Collector 双写 + 一个链路平台 + 一套指标告警。

下一章把这些组件逐个接进你的技术栈：网关、MCP、A2A、记忆、调度框架。

## 延伸阅读 {#reading}

- [Langfuse 自托管文档](https://langfuse.com/self-hosting)：Docker Compose 与生产部署。
- [OpenLLMetry](https://github.com/traceloop/openllmetry)：LLM 应用的 OTel 自动埋点。
- [Arize Phoenix](https://github.com/Arize-ai/phoenix)：本地可跑的评测与观测。
- [第 13 章 可运行 Demo](/demos/)：包含 Langfuse 一键启动脚本。
