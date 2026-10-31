---
title: 10 · 评估联动：让线上 Trace 自己变聪明
description: 从真实链路自动抽样本、做回归与 LLM-as-judge、自动发现版本劣化，形成 Trace → 标注 → 评测 → 优化 的闭环。
outline: [2, 3]
---

# 10 · 评估联动：让线上 Trace 自己变聪明

指标能告诉你「成功率 97%」，但回答不了一个致命问题：**那 97% 里，有多少其实答错了？**

这就是为什么需要评估（Evals）。而评估最贵的部分从来不是打分，是**找到值得打分的样本**。好消息是：你已经有了。

::: tip 人话翻译
- **观测**回答「发生了什么」。
- **评估**回答「做得对不对」。
- **联动**的意思是：不用人工编测试集，让线上真实链路自己长出一个测试集。
:::

## 01 从 Trace 自动提取样本 {#extract}

<Diagram id="sample-flow" />

不是所有 trace 都值得进评测集。优先抽这五类：

| 类型 | 筛选条件 | 价值 |
| --- | --- | --- |
| 失败样本 | `status = ERROR` | 修 bug 的直接输入 |
| 长尾样本 | `agent.turn > 8` 或 P99 耗时 | 找效率与逻辑问题 |
| 负反馈样本 | 用户点踩 / 转人工 | 最真实的「答错了」 |
| 边界样本 | `finish_reason = length` | 截断与上下文溢出 |
| 随机基线 | 每日随机 1% | 防止只盯异常 |

```python
def harvest(span_rows):
    for row in span_rows:
        if not is_candidate(row):
            continue
        yield {
            "sample_id": row["trace_id"],
            "input": redact(row["user_input"]),
            "output": redact(row["final_answer"]),
            "context": {
                "turns": row["agent.turn"],
                "tools": row["tools_used"],
                "model": row["gen_ai.request.model"],
                "cost_usd": row["cost.usd"],
            },
            "label": {
                "source": "production",
                "signal": row["signal"],          # error / feedback / long_tail
                "human_label": None,
            },
        }
```

三个必须做的清洗：

1. **脱敏**：手机号、身份证、密钥先过一遍。
2. **去重**：同一用户反复问同一个问题，只留一条（按输入 hash）。
3. **脱上下文**：把租户内部 ID 替换为占位符，避免评测集泄露业务结构。

## 02 回归测试与 LLM-as-judge {#regression}

<Diagram id="regression-compare" />

有了样本，评测分两层：

| 层 | 方法 | 成本 | 适合 |
| --- | --- | --- | --- |
| 规则断言 | 关键词、JSON schema、正则 | 极低 | 格式、必填字段、拒答 |
| 语义相似 | embedding 距离 | 低 | 答案是否跑题 |
| LLM-as-judge | 用模型按 rubric 打分 | 中 | 准确性、语气、完整性 |
| 人工抽检 | 人看 | 高 | 校准 judge、争议样本 |

```python
RUBRIC = """
你是客服质检员。根据以下标准给回答打分（1-5）：
5 = 完全正确，信息完整，语气合适
3 = 基本正确，但遗漏关键信息或语气生硬
1 = 错误、编造事实、或答非所问
只输出 JSON：{"score": int, "reason": str}
"""

def judge(sample):
    resp = llm.chat(
        system=RUBRIC,
        user=f"用户问题：{sample['input']}\n\nAgent 回答：{sample['output']}",
        temperature=0,
    )
    result = json.loads(resp.text)
    return result["score"], result["reason"]
```

::: warning judge 也会骗你
LLM-as-judge 有三个已知偏差：**偏爱长答案**、**偏爱自己家的模型输出**、**对数字与事实不敏感**。上线前必须用 200 条人工标注校准，一致率低于 80% 就不要用它做门槛。
:::

回归对比要关注「变化」，不是「绝对值」：

| 指标 | 计算 | 判断 |
| --- | --- | --- |
| 平均分 | `mean(score)` | 下降 > 0.3 需排查 |
| 胜率 | 新版本更好的样本占比 | < 45% 说明退化 |
| 严重错误率 | `score <= 2` 占比 | 任何上升都算事故 |
| 一致性 | 与人工标注一致率 | 用于校准 judge |

## 03 指标劣化自动发现 {#degradation}

<Diagram id="degrade-matrix" />

版本上线后，指标变差有两种：**突变**（当天就掉）和**渐变**（一周慢慢烂）。

| 信号 | 检测方式 | 说明 |
| --- | --- | --- |
| 成功率突降 | 5 分钟窗口对比前 1 小时 | 最常见，也最好抓 |
| 平均轮次上升 | 7 天移动平均 | 提示词退化的早期信号 |
| 单任务成本上升 | 按版本分组 | 上下文膨胀或循环 |
| 评测均分下降 | 每日抽样 200 条 | 质量层面的真话 |
| 拒答率变化 | 按版本对比 | 安全策略误伤 |

```python
def detect(version, baseline_days=7):
    cur = metrics.load(version=version, window="1d")
    base = metrics.load(version="previous", window=f"{baseline_days}d")
    alerts = []
    for name, threshold in {"success_rate": -0.02, "mean_turns": +0.3,
                            "cost_per_task": +0.15, "eval_score": -0.2}.items():
        delta = cur[name] - base[name]
        if (threshold < 0 and delta < threshold) or (threshold > 0 and delta > threshold):
            alerts.append({"metric": name, "delta": round(delta, 3)})
    return alerts
```

::: tip 用「版本」作为一等公民
没有版本维度的观测系统，在灰度发布时会变成一场猜谜。每一个 span 都该带 `deployment.version` 和 `prompt.version`。
:::

## 04 观测闭环 {#closed-loop}

<Diagram id="eval-loop" />

闭环不是一句口号，它有五个必须打通的环节：

| 环节 | 输入 | 输出 | 负责人 |
| --- | --- | --- | --- |
| 发现 | 看板 / 告警 / 用户反馈 | 问题清单 | SRE / 客服 |
| 取样 | Trace 存储 | 评测样本 | 平台 |
| 标注 | 样本 + rubric | 标签 | 算法 / 人工 |
| 评测 | 新旧版本 | 分数与胜率 | 算法 |
| 优化 | 评测结论 | 新 prompt / 新逻辑 | 工程 |

```python
# 把「负反馈」自动变成待标注样本，是闭环里性价比最高的一步
def on_user_feedback(trace_id, rating):
    if rating >= 0:
        return
    sample = harvest_one(trace_id)
    sample["label"]["signal"] = "negative_feedback"
    dataset.push("needs_review", sample)
    alerts.maybe_fire("negative_feedback_spike", trace_id)
```

一个成熟的闭环，每周应该能回答：**这周我们改了什么、改好了多少、有没有改坏什么。** 答不上来，说明闭环还只是个 PPT。

## 评估体系健康指标 {#board-sample}

| 指标 | 定义 | 健康线 |
| --- | --- | --- |
| 样本新鲜度 | 最近 7 天样本占比 | > 70% |
| 标注覆盖率 | 有标签样本 / 抽取样本 | > 60% |
| judge 一致率 | 与人工标注一致 | > 80% |
| 回归频率 | 每周执行次数 | ≥ 2 |
| 问题闭环率 | 发现问题到验证修复 | > 50% / 月 |

## 避坑清单 {#pitfalls}

::: warning 评估联动的五个坑
1. **只用「黄金测试集」**。真实分布早就变了，测试集还在去年的世界里。
2. **样本不带元数据**。发现问题时无法回溯是哪类用户、哪个模型。
3. **judge 没校准就上生产**。分数看起来很稳定，其实一直偏。
4. **只评测不行动**。每周生成报告，没人改 prompt，等于没做。
5. **评测集泄露 PII**。测试数据往往比生产数据更容易被随意传播。
:::

## 小结 {#recap}

- 评测样本优先从失败、长尾、负反馈、截断、随机基线里抽。
- 清洗三件套：脱敏、去重、脱上下文。
- 评测四层：规则、相似度、LLM-as-judge、人工抽检。
- judge 必须用人工标注校准，一致率低于 80% 不要做门槛。
- 劣化检测要看版本维度，突变与渐变用不同窗口。
- 闭环五环节缺一不可，否则只是「定期生成报告」。

下一章讲企业最关心的话题：安全、隐私与合规。

## 延伸阅读 {#reading}

- [OpenAI Evals 指南](https://platform.openai.com/docs/guides/evals)：评测的基本范式。
- [Langfuse Datasets & Evals](https://langfuse.com/docs/datasets/overview)：数据集与打分实践。
- [第 09 章 看板设计](/dashboards/)：发现问题的入口。
- [第 11 章 安全与合规](/security/)：评测数据的隐私边界。
