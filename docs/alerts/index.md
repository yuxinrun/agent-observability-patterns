---
title: 05 · 告警体系：什么时候该吵醒人
description: P0-P3 分级、五类高频告警规则模板、降噪流水线，以及自带 trace 链接的告警通知。
outline: [2, 3]
---

# 05 · 告警体系：什么时候该吵醒人

告警不是「出事了发条消息」，而是**一次有成本的人类中断**。

发对了，工程师凌晨三点爬起来，二十分钟定位，损失可控。发错了，三个月后所有人都把告警群设成免打扰，真正的 P0 躺在里面长蘑菇。

::: tip 人话翻译
告警系统只有两个失败模式：**该叫的时候没叫（漏报）**，和**不该叫的时候狂叫（狼来了）**。第二种更致命，因为它会永久摧毁第一种的补救能力。
:::

## 01 告警分级 P0–P3 {#severity}

<Diagram id="severity" />

| 级别 | 定义 | 响应 | 通知方式 | 例子 |
| --- | --- | --- | --- | --- |
| P0 | 核心业务不可用 / 资损 | 5 分钟内 | 电话 + 短信 + 群 | 支付 Agent 全量失败 |
| P1 | 主要功能受损，有绕行 | 30 分钟内 | 短信 + 群 | 成功率跌破 SLO |
| P2 | 局部异常，不影响主流程 | 工作日处理 | 群 / 工单 | 某个工具失败率 5% |
| P3 | 趋势性问题 | 排期优化 | 周报 | 平均轮次缓慢上升 |

分级的关键不是「严重程度」，而是**「现在叫人值不值」**。判断标准很土但很好用：如果叫醒一个人能让他立刻做点什么（回滚、限流、切流量），就是 P0/P1；如果只能等天亮，那就是 P2。

```yaml
# 分级要写进规则里，而不是靠值班同学临场判断
labels:
  severity: P1
  team: agent-platform
  runbook: https://wiki/runbooks/agent-success-drop
```

## 02 五类高频告警规则 {#rules}

<Diagram id="alert-rules" />

### 1. 任务失败率飙升

```yaml
- alert: AgentFailureRateHigh
  expr: |
    sum(rate(agent_tasks_total{status="failed"}[5m]))
    / sum(rate(agent_tasks_total[5m])) > 0.05
  for: 5m
  labels: { severity: P1 }
```

### 2. 单任务 token / 成本超标

```yaml
- alert: AgentTaskCostSpike
  expr: histogram_quantile(0.95, sum by (le) (rate(agent_task_cost_bucket[15m]))) > 0.20
  for: 10m
  labels: { severity: P1 }
```

### 3. 无限循环 Agent（轮次过多）

```yaml
- alert: AgentRunawayLoop
  expr: sum(rate(agent_tasks_total{stop_reason="max_turns"}[10m]))
        / sum(rate(agent_tasks_total[10m])) > 0.02
  for: 10m
  labels: { severity: P1 }
```

这条比失败率更值钱：循环往往**不会失败**，它只是很贵。

### 4. 工具持续报错

```yaml
- alert: ToolErrorBurst
  expr: sum by (tool) (rate(tool_calls_total{status="error"}[5m])) > 0.5
  for: 5m
  labels: { severity: P2 }
```

### 5. 链路超时与网关异常

```yaml
- alert: AgentEndToEndTimeout
  expr: histogram_quantile(0.95, sum by (le) (rate(agent_duration_bucket[10m]))) > 30000
  for: 10m
  labels: { severity: P1 }
```

| 规则 | 关键阈值 | 误报来源 |
| --- | --- | --- |
| 失败率 | 5% / 5min | 批量任务集中失败 |
| 单任务成本 | P95 > $0.20 | 单个大客户的长文档 |
| 循环率 | 2% / 10min | 上线了新提示词 |
| 工具错误 | > 0.5/s | 上游限流 |
| 端到端超时 | P95 > 30s | 供应商抖动 |

## 03 告警降噪策略 {#noise}

<Diagram id="noise-pipe" />

| 手段 | 做法 | 效果 |
| --- | --- | --- |
| 分组 | 按 `alertname + tenant + tool` 聚合 | 100 条变 3 条 |
| 抑制 | P0 触发时静音同源 P2 | 避免雪崩刷屏 |
| 去重 | 相同指纹 30 分钟内只发一次 | 去掉重试放大 |
| 延迟 | `for: 5m`，持续才发 | 去掉瞬时抖动 |
| 静默窗口 | 发布、批处理、演练期间 | 去掉计划内噪音 |
| 燃烧率 | 多窗口预算告警 | 去掉慢性噪音 |

::: warning 告警风暴的真实代价
一次数据库抖动可以产生 400 条告警，其中 399 条是同一个根因。值班同学滑了 5 分钟才看到第一条，然后花 20 分钟确认「都是同一个事」。降噪不是体验优化，是 MTTR 优化。
:::

## 04 告警附带上下文 {#context}

<Diagram id="alert-context" />

一条合格的告警应该让人**不用打开电脑就知道大概发生了什么**。

```text
[P1] Agent 成功率跌破 SLO
当前值: 93.2%（SLO 99.0%，持续 8 分钟）
影响: 租户 acme 为主（占失败量 62%）
Top 失败原因: tool_timeout (search_orders, 41 次)
示例链路: https://obs.example.com/trace/4f9c1d2e8a7b4c6d
运行手册: https://wiki/runbooks/agent-success-drop
最近变更: support-agent v2.4.1 于 22:10 部署
```

| 字段 | 作用 |
| --- | --- |
| 当前值 + SLO 线 | 一眼判断严重程度 |
| 影响面（租户 / 版本） | 决定先切流还是先回滚 |
| Top 失败原因 | 省掉第一轮排查 |
| **Trace 链接** | 一键进入现场 |
| Runbook | 新人也能照着做 |
| 最近变更 | 80% 的故障答案在这里 |

```python
def build_alert(payload):
    trace = payload["sample_trace_id"]
    return {
        "title": f'[{payload["severity"]}] {payload["name"]}',
        "text": (
            f'当前值 {payload["value"]:.1%}（SLO {payload["slo"]:.1%}）\n'
            f'影响租户 {payload["top_tenant"]}，占失败 {payload["share"]:.0%}\n'
            f'示例链路 {OBS_URL}/trace/{trace}\n'
            f'运行手册 {payload["runbook"]}'
        ),
    }
```

## 告警健康度指标 {#board-sample}

| 指标 | 定义 | 健康线 |
| --- | --- | --- |
| 每周告警数 | 总量 | 按团队容量定，通常 < 20 |
| 有效率 | 需要人工动作的占比 | > 70% |
| 平均确认时长 | 从发出到有人认领 | < 5 分钟（P0/P1） |
| 重复告警率 | 同指纹重复占比 | < 10% |
| 静默覆盖率 | 计划内事件被静默比例 | > 90% |

## 避坑清单 {#pitfalls}

::: warning 告警系统的五个自杀式设计
1. **为每个指标都配一条告警**。最后所有人只看群名。
2. **阈值写死，不随流量变化**。白天正常、夜里全红。
3. **告警里没有 trace 链接**。值班同学从零开始排查。
4. **P0 也走邮件**。邮件在凌晨等于没发。
5. **没有 owner**。所有人都以为别人会处理。
:::

## 小结 {#recap}

- 分级看「现在叫人能不能立刻做点什么」，不是看心情。
- 五类必备规则：失败率、成本、循环、工具错误、端到端超时。
- 降噪六件套：分组、抑制、去重、延迟、静默、燃烧率。
- 告警必须自带：当前值、影响面、Top 原因、trace 链接、runbook、最近变更。
- 每周复盘告警有效率，无效告警是要还的技术债。

下一章：平台选型——Langfuse、OpenLLMetry、Phoenix、LangSmith，到底选哪个。

## 延伸阅读 {#reading}

- [Prometheus Alerting 最佳实践](https://prometheus.io/docs/practices/alerting/)：规则设计与命名。
- [Google SRE：多窗口燃烧率告警](https://sre.google/workbook/alerting-on-slos/)：SLO 告警的标准实现。
- [第 10 章 评估联动](/evals/)：为什么有些问题只能靠评测发现。
- [第 12 章 高频踩坑](/pitfalls/)：告警疲劳的完整病例。
