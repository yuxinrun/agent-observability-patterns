---
title: 03 · 指标 Metrics：生产看板该统计什么
description: 任务、模型、工具、体验、业务五层指标，成本公式、SLO 模板与聚合维度，附可抄的看板样例。
outline: [2, 3]
---

# 03 · 指标 Metrics：生产看板该统计什么

Trace 是病历，Metrics 是体检报告首页那六个箭头。

病历很详细，但你不会每天读 3000 份病历。你需要的是：今天成功率掉了 4 个点、P95 延迟涨了 800ms、单任务成本翻倍。**指标的价值不在于精确，而在于能让你一眼看出「今天和昨天不一样」。**

::: tip 人话翻译
指标 = 分子 / 分母 + 时间窗口 + 分组标签。写指标时永远先问三件事：**分子是谁、分母是谁、按什么切。** 三个答不上来，这个指标一定会在某天骗你。
:::

## 01 任务层指标 {#task}

任务层回答「这单生意成不成」。它是老板和客服最先看的一层。

<Diagram id="task-metrics" />

| 指标 | 定义 | 分母陷阱 |
| --- | --- | --- |
| 完成率 | `completed / started` | 分母要不要算排队失败的？要单列 |
| 失败率 | `failed / started` | 用户主动取消不能算失败 |
| 取消率 | `cancelled / started` | 取消率高常常是「等太久」 |
| 超时率 | `timeout / started` | 要区分「模型慢」和「工具慢」 |
| 平均轮次 | `avg(agent.turn)` | 只算成功任务会低估 |
| 循环异常率 | `stop_reason == max_turns` 占比 | 最贵的那个指标 |

```python
from opentelemetry import metrics

meter = metrics.get_meter("support-agent")
tasks = meter.create_counter("agent.tasks", unit="1")
turns = meter.create_histogram("agent.turns", unit="1")
duration = meter.create_histogram("agent.duration", unit="ms")

def finish(task, status, turns_used, elapsed_ms):
    attrs = {"agent": "support-agent", "status": status, "tenant": task.tenant}
    tasks.add(1, attrs)
    turns.record(turns_used, attrs)
    duration.record(elapsed_ms, attrs)
```

::: warning 完成率 99.7% 的团队，通常是把失败标成了成功
先定义「什么叫做完了」：模型输出了最终答案？工具真的执行成功？业务状态真的变更了？三个都满足才算 completed，否则你的看板只是在自我安慰。
:::

## 02 LLM 模型指标 {#llm}

模型层回答「钱花在哪、慢在哪」。

<Diagram id="llm-metrics" />

| 指标 | 定义 | 备注 |
| --- | --- | --- |
| TTFT | 请求到首个 token | 流式体验的核心 |
| 总耗时 | 请求到结束 | 与输出 token 强相关 |
| tokens/s | `output_tokens / 生成耗时` | 判断供应商是否降速 |
| 输入/输出 token | 分别统计 | 输入通常占成本大头 |
| 缓存命中 token | `cache_read_input_tokens` | 命中能省 80%~90% |
| 单次成本 | token × 单价 | 见下方公式 |
| 拒绝率 | `finish_reason == refusal` | 安全策略触发 |

```
cost = input_tokens        * price_in
     + output_tokens       * price_out
     + cache_read_tokens   * price_in * 0.1
     + cache_write_tokens  * price_in * 1.25
```

价格一定要**配置化**，不要写死在代码里。模型降价、换供应商、加缓存策略，都是运维动作，不该发版。

| 场景 | 该盯的指标 |
| --- | --- |
| 用户抱怨「打字机卡顿」 | TTFT P95、tokens/s |
| 月底账单超标 | 单任务成本 P95、缓存命中率 |
| 输出被截断 | `finish_reasons == length` 占比 |
| 供应商抖动 | 首字失败率、超时率按 provider 分组 |

## 03 工具调用指标 {#tool}

工具层回答「哪个工具在拖后腿」。

<Diagram id="tool-metrics" />

| 指标 | 定义 | 健康线（经验值） |
| --- | --- | --- |
| 调用成功率 | `ok / calls` | > 98% |
| 重试次数 | `retries / calls` | < 0.2 |
| 耗时 P95 | 工具级 | 按工具定，别统一 |
| 错误分布 | 按 `error.type` 分组 | 看 Top 3 就够 |
| 空结果率 | 返回 0 条的占比 | 高说明查询构造有问题 |

**标签一定要低基数。** `tool.name`、`error.type`、`status` 可以；`user.id`、`query`、`order_id` 绝对不能进标签，否则你的时序库会以每天几十万条新序列的速度膨胀。

```python
tools = meter.create_counter("tool.calls", unit="1")
latency = meter.create_histogram("tool.latency", unit="ms")

def call_tool(name: str, fn, *args):
    started = time.perf_counter()
    try:
        result = fn(*args)
        tools.add(1, {"tool": name, "status": "ok"})
        return result
    except Exception as exc:
        tools.add(1, {"tool": name, "status": "error", "error_type": type(exc).__name__})
        raise
    finally:
        latency.record((time.perf_counter() - started) * 1000, {"tool": name})
```

## 04 用户体验指标 {#ux}

技术指标好看、用户仍然骂人，是 Agent 产品最常见的错位。

<Diagram id="ux-metrics" />

| 指标 | 定义 | 为什么重要 |
| --- | --- | --- |
| 首次响应时长 | 用户发出到看见第一个字 | 超过 2s 就开始怀疑 |
| 任务完成时长 P95 | 端到端 | 长任务要给进度反馈 |
| 会话平均成本 | `session_cost / sessions` | 免费用户也要算账 |
| 单用户日成本上限 | 按用户聚合 | 防薅羊毛 |
| 放弃率 | 中途关闭 / 总会话 | 最能反映真实体验 |

::: tip 一个便宜又好用的指标
**「用户连发两条消息的间隔」**。小于 3 秒通常意味着上一轮答非所问，用户急了。这个指标不需要任何前端埋点，服务端时间戳就够。
:::

## 05 业务指标 {#business}

业务层回答「这东西到底有没有用」。

<Diagram id="business-metrics" />

| 指标 | 怎么算 | 数据来源 |
| --- | --- | --- |
| 幻觉发生率 | 抽样评测判错 / 抽样数 | 第 10 章评测闭环 |
| 拒绝回答率 | `refusal / answers` | 模型 finish_reason |
| 人工介入率 | 转人工 / 总会话 | 业务系统 |
| 一次解决率 | 无二次追问 / 会话 | 会话分析 |
| 用户满意度 | 点赞 / (点赞 + 点踩) | 前端反馈 |

::: warning 幻觉率不能从 trace 里直接算
Trace 只能告诉你「它说了什么」，不能告诉你「说得对不对」。幻觉率必须来自评测或人工标注。任何声称「从日志自动算幻觉率」的方案，本质都是在猜。
:::

## 06 SLO 设定模板 {#slo}

SLO 不是越高越好，是要和成本、体验取得平衡。

<Diagram id="slo-matrix" />

| SLI | SLO 目标 | 错误预算（30 天） | 超了怎么办 |
| --- | --- | --- | --- |
| 任务成功率 | 99.0% | 7.2 小时不可用 | 冻结功能上线，先修稳定性 |
| TTFT P95 | < 1.5s | 5% 请求可超 | 查供应商与首包链路 |
| 端到端 P95 | < 20s | 5% 请求可超 | 查工具与轮次 |
| 单任务成本 P95 | < $0.05 | 5% 任务可超 | 查 prompt 长度与循环 |
| 工具成功率 | > 98% | 2% 调用可失败 | 找工具 owner |

**错误预算的用法**：预算充足时大胆发版，预算烧完时只修 bug。这比「所有人都小心一点」有效一百倍。

```yaml
# 伪代码：多窗口燃烧率告警，比固定阈值少 80% 的噪音
- alert: AgentSuccessBudgetFastBurn
  expr: sli:agent_success:ratio5m < 0.95 and sli:agent_success:ratio1h < 0.98
  for: 5m
  labels: { severity: P1 }
```

## 07 指标聚合模式 {#aggregation}

<Diagram id="agg-layers" />

同一份指标，至少要在五个维度上可切：

| 维度 | 典型取值 | 用途 |
| --- | --- | --- |
| 租户 | `tenant.id` | 计费、隔离、SaaS 分层 |
| 模型 | `gen_ai.request.model` | 成本与质量对比 |
| Agent 类型 | `gen_ai.agent.name` | 哪个业务线在恶化 |
| 技能 / 工具 | `gen_ai.tool.name` | 工具治理 |
| 版本 | `deployment.version` | 上线回归对比 |

**基数预算**：一条时间序列的成本约为 1~3 KB/月。`tenant × model × agent × status` 如果有 2000 × 6 × 12 × 4 = 57.6 万条序列，账单会先于故障到来。经验做法是分层——租户维度只保留核心 5 个指标，明细维度放 trace 里按需查。

## 指标看板样例 {#board-sample}

| 面板 | 指标 | 视图 |
| --- | --- | --- |
| 今日任务量 | `sum(agent.tasks)` | 折线 + 同比 |
| 成功率 | `completed / started` | 折线 + SLO 线 |
| 花费 | `sum(cost.usd)` | 堆叠柱（按模型） |
| 延迟 | P50 / P95 / P99 | 分位带 |
| 循环异常 | `stop_reason=max_turns` | 单值 + Top 租户 |
| 工具失败 Top5 | 按 `tool` 分组 | 横向条形 |

## 避坑清单 {#pitfalls}

::: warning 指标设计的五个经典错误
1. **分母不统一**。同一个「成功率」在三个看板上三个值，从此没人相信看板。
2. **把 ID 当标签**。基数爆炸，Prometheus 先 OOM，然后你 OOM。
3. **只看平均不看分位**。平均 3 秒，P95 已经 40 秒，用户早跑了。
4. **成本和 token 混为一谈**。缓存、批处理、不同模型单价，都会让两者背离。
5. **没有版本维度**。上线后指标变差，你却不知道是哪个版本。
:::

## 小结 {#recap}

- 任务层看结果，模型层看钱，工具层看短板，体验层看感受，业务层看价值。
- 每个指标都要能回答：分子、分母、时间窗、分组。
- 成本公式配置化，价格变动不该发版。
- SLO 配错误预算，预算决定「发版还是修 bug」。
- 聚合维度要有基数预算，ID 永远不进标签。

下一章处理最容易被忽视、也最容易出事的部分：日志与审计。

## 延伸阅读 {#reading}

- [OpenTelemetry Metrics 概念](https://opentelemetry.io/docs/concepts/signals/metrics/)：Counter、Histogram、Gauge 的取舍。
- [Google SRE Workbook：错误预算](https://sre.google/workbook/error-budget-policy/)：SLO 的组织落地方式。
- [第 09 章 看板设计](/dashboards/)：把这些指标摆成六块屏。
- [第 05 章 告警体系](/alerts/)：指标什么时候该叫人。
