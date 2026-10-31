---
title: 09 · 看板设计：六块生产大屏
description: 总览、失败、成本、工具、会话、循环异常六块看板，每块给出面板定义、查询思路与布局建议。
outline: [2, 3]
---

# 09 · 看板设计：六块生产大屏

看板不是「把所有指标画成图」，而是**回答六个不同角色在早上九点会问的问题**。

老板问「今天正常吗」，SRE 问「哪儿坏了」，财务问「为什么这么贵」，工程问「哪个工具在拖后腿」，客服问「这个用户经历了什么」。

::: tip 人话翻译
一个好面板只做一件事：**让人在 5 秒内做出一个决定**。做不到的面板，就是装饰画。
:::

## 01 总览大盘 {#overview}

<Diagram id="board-overview" />

| 面板 | 指标 | 图表 | 位置 |
| --- | --- | --- | --- |
| 今日任务量 | `sum(agent.tasks)` | 折线 + 同比 | 左上 |
| 成功率 | `completed / started` | 折线 + SLO 横线 | 中上 |
| 总花费 | `sum(cost.usd)` | 堆叠柱（按模型） | 右上 |
| 延迟分位 | P50 / P95 / P99 | 分位带 | 中下 |
| 循环异常数 | `stop_reason=max_turns` | 单值 + 趋势 | 右下 |

布局原则：**左上放最重要的数字，右下放需要下钻的细节。** 人眼从左上开始扫。

```promql
# 成功率（带 SLO 线）
sum(rate(agent_tasks_total{status="completed"}[5m]))
/ sum(rate(agent_tasks_total[5m]))

# 单任务成本 P95
histogram_quantile(0.95, sum by (le) (rate(agent_task_cost_bucket[15m])))
```

::: warning 总览别放超过 8 个面板
超过 8 个，人就只看第一个和最后一个。剩下的都是心理安慰。
:::

## 02 失败分析看板 {#failure}

<Diagram id="board-failure" />

| 面板 | 内容 | 交互 |
| --- | --- | --- |
| 失败原因分布 | 按 `error.type` 分组 | 点击筛选 |
| 失败趋势 | 按小时 | 时间刷选 |
| Top 失败 Trace | 表格：trace_id、租户、耗时、原因 | 点击跳转 |
| 失败阶段 | 模型 / 工具 / 记忆 / 网关 | 热力图 |

```sql
-- ClickHouse：Top 20 失败链路
SELECT trace_id, tenant_id, error_type, count() AS spans, max(duration_ms) AS ms
FROM otel_spans
WHERE timestamp > now() - INTERVAL 1 HOUR AND status_code = 'ERROR'
GROUP BY trace_id, tenant_id, error_type
ORDER BY ms DESC
LIMIT 20;
```

失败看板的关键不是「有多少失败」，而是**「失败的形状」**：是集中在一个工具，还是分散在所有工具？是某个租户，还是全量？形状决定了谁去修。

## 03 成本分析看板 {#cost}

<Diagram id="board-cost" />

| 面板 | 维度 | 用途 |
| --- | --- | --- |
| 成本趋势 | 按天 / 按模型堆叠 | 发现异常增长 |
| 成本构成 | 输入 / 输出 / 缓存 / 工具 | 找优化点 |
| Top 租户成本 | 表格 + 预算线 | 商务对账 |
| 单任务成本分布 | 直方图 | 找长尾异常任务 |
| 缓存节省 | 命中 token × 单价差 | 证明优化有效 |

```
总成本 = 模型成本 + 工具成本 + 基础设施成本
模型成本 = Σ(tokens × 单价)
隐性成本 = 循环轮次 × 每轮上下文 token × 单价     ← 最容易被忽略
```

::: tip 成本看板一定要有「每成功任务成本」
单纯看总花费会误导：花得多可能是业务增长。**每成功任务成本**才反映效率，它涨了才是真的变贵。
:::

## 04 工具性能看板 {#tool}

<Diagram id="board-tool" />

| 面板 | 指标 | 图表 |
| --- | --- | --- |
| 各工具耗时 | P50 / P95 | 横向条形 |
| 工具失败率 | `errors / calls` | 表格 + 颜色 |
| 重试放大 | `retries / calls` | 折线 |
| 错误类型分布 | 按 `error.type` | 堆叠柱 |
| 工具调用量 | 按小时 | 折线 |

工具看板是**跨团队协作的入口**：当 `search_orders` 的 P95 从 300ms 涨到 2s，你需要一个能直接甩给订单团队的链接，而不是一句「你们接口变慢了」。

## 05 用户会话看板 {#session}

<Diagram id="board-session" />

| 面板 | 内容 |
| --- | --- |
| 会话列表 | session_id、用户、轮次、成本、最后状态 |
| 会话时间线 | 每条 trace 一行，可展开 |
| 用户成本 Top | 按日聚合，防滥用 |
| 放弃点分布 | 用户在第几轮离开 |
| 一键全链路 | 点击进入 trace 瀑布 |

会话看板是客服和产品的共同语言。客服关心「这个用户到底遇到了什么」，产品关心「大部分用户在第几轮放弃」。

| 角色 | 关注 |
| --- | --- |
| 客服 | 单个会话的完整经过 |
| 产品 | 放弃率、平均轮次 |
| 风控 | 单用户成本异常 |
| 工程 | 会话内错误分布 |

## 06 循环异常监控看板 {#loop}

<Diagram id="board-loop" />

| 面板 | 指标 | 阈值 |
| --- | --- | --- |
| 循环任务比例 | `max_turns` 占比 | > 2% 告警 |
| 轮次分布 | 直方图 | 长尾变厚 = 恶化 |
| 同工具连续调用 Top | `loop.count` 最大值 | > 3 关注 |
| 循环任务成本 | 这些任务的 `cost.usd` 总和 | 单独预算 |
| 循环租户 Top | 按租户聚合 | 定位异常客户 |

```sql
-- 找出「同一个工具在同一条 trace 里被调了 4 次以上」的任务
SELECT trace_id, tool_name, count() AS calls, sum(duration_ms) AS ms
FROM otel_spans
WHERE name LIKE 'execute_tool%' AND timestamp > now() - INTERVAL 1 DAY
GROUP BY trace_id, tool_name
HAVING calls >= 4
ORDER BY calls DESC
LIMIT 50;
```

::: danger 循环监控最容易被忽略的一点
循环任务往往**状态是 completed**。它没有失败、没有报错、没有超时，只是把同一个工具调了 37 次。如果你的看板只看失败率，这类事故永远不会出现。
:::

## 看板通用规范 {#board-sample}

| 规范 | 建议 |
| --- | --- |
| 时间范围 | 默认 24h，提供 1h / 7d 快捷 |
| 时区 | 统一 UTC+8 或 UTC，标注清楚 |
| 颜色 | 绿/黄/红只用于阈值，不用于装饰 |
| 单位 | 每个轴都要有单位 |
| 下钻 | 任何聚合图都能点到明细 |
| 空数据 | 显示「无数据」而不是 0 |
| 刷新 | 手动 + 30s 自动，避免抖动 |

## 避坑清单 {#pitfalls}

::: warning 看板设计的五个坑
1. **一屏 30 个图**。没人看得完，等于没有。
2. **没有下钻**。看到异常却点不进去，只能再去翻日志。
3. **平均线掩盖长尾**。P95 才是用户体验。
4. **空数据画成 0**。看起来像「一切正常」，其实是指标没上报。
5. **看板没有 owner**。半年后没人知道某个面板为什么存在。
:::

## 小结 {#recap}

- 六块看板对应六类问题：正常吗、哪儿坏了、为什么贵、谁拖后腿、这个用户经历了什么、有没有疯跑。
- 每块看板都要能下钻到 trace。
- 成本看板看「每成功任务成本」，不是总花费。
- 循环看板必须独立，因为循环任务通常显示成功。
- 面板数量控制在 8 个以内，空数据显示「无数据」。

下一章：把线上 trace 变成评测样本，让观测闭环。

## 延伸阅读 {#reading}

- [Grafana 面板最佳实践](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)：布局与可读性。
- [第 03 章 指标 Metrics](/metrics/)：这些面板背后的指标定义。
- [第 13 章 Demo 与模板](/demos/)：Grafana 看板 JSON 模板。
- [第 10 章 评估联动](/evals/)：看板发现不了的问题怎么办。
