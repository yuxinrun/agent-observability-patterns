---
title: 04 · 结构化日志与审计日志
description: 审计字段清单、脱敏流水线、采样策略，以及 ELK、Loki、ClickHouse 怎么选。
outline: [2, 3]
---

# 04 · 结构化日志与审计日志

Trace 告诉你「怎么走的」，指标告诉你「有多糟」，日志告诉你**「具体发生了什么」**——包括谁在什么时候、对什么、做了什么。

但日志也是数据库里最容易变成垃圾场的部分。三个月后你打开一看：2TB 的 `INFO: done`，和三条真正有用的报错混在一起。

::: tip 人话翻译
- **调试日志**是给工程师看的便签：随手写、随时删、可以脏。
- **审计日志**是给合规和法务看的合同：字段固定、不能改、要能举证。
- 两者混在同一个文件里，是最常见的技术债。
:::

## 01 调试日志 vs 审计日志 {#audit-vs-debug}

| 维度 | 调试日志 | 审计日志 |
| --- | --- | --- |
| 读者 | 写代码的人 | 合规、安全、客服、法务 |
| 格式 | 半结构化，随便写 | 强 schema，字段必填 |
| 生命周期 | 7~30 天 | 180 天~3 年（看行业） |
| 可变性 | 可以丢、可以采样 | 不可篡改，需哈希链或 WORM |
| 内容 | 变量、异常栈、耗时 | 谁、何时、对什么、结果、依据 |
| 失败代价 | 多喝一杯咖啡 | 罚款、诉讼、无法自证 |

一个典型 Agent 请求，两类日志各写各的：

```python
import logging, uuid

audit = logging.getLogger("audit")
debug = logging.getLogger("agent")

def handle_task(user, task):
    request_id = str(uuid.uuid4())
    audit.info("task.started", extra={
        "event_id": request_id,
        "actor.id": user.id_hashed,
        "actor.role": user.role,
        "action": "agent.task.start",
        "target.type": "agent",
        "target.id": "support-agent",
        "tenant.id": user.tenant,
        "trace_id": current_trace_id(),
        "policy.version": "refund-policy-v3",
    })
    debug.debug("prompt tokens=%d turn=%d", 1204, 2)
```

## 02 Agent 审计日志必填字段 {#fields}

<Diagram id="audit-fields" />

| 字段 | 示例 | 为什么必须有 |
| --- | --- | --- |
| `event_id` | `evt_01J8…` | 幂等、去重、对账 |
| `occurred_at` | ISO 8601 + 时区 | 跨国业务的时间基准 |
| `actor.id` / `actor.role` | `u_9f2…` / `support` | 谁做的 |
| `action` | `agent.tool.call` | 做了什么 |
| `target.type` / `target.id` | `order` / `A10293` | 对谁做的 |
| `result` | `success` / `denied` | 结果，含拒绝 |
| `reason` | `policy_blocked` | 为什么是这个结果 |
| `trace_id` / `span_id` | `4f9c…` | 一键跳转链路 |
| `tenant.id` | `acme` | 隔离与计费 |
| `policy.version` | `refund-policy-v3` | 当时依据哪条规则 |
| `prev_hash` | `sha256:…` | 防篡改链 |

::: warning 审计日志里不要写「模型觉得」
审计要的是**可举证的事实**：调用了哪个工具、参数是什么（脱敏后）、返回什么状态、依据哪条策略。不要写「模型判断用户可能想退款」这种无法验证的描述。
:::

Agent 场景下，有四类事件必须审计：

| 事件 | 例子 | 保留期建议 |
| --- | --- | --- |
| 权限决策 | 工具调用被策略拒绝 | 1 年 |
| 资金/权益变更 | 退款、改价、发券 | 3 年（按行业） |
| 敏感数据访问 | 读取用户地址、病历 | 1~3 年 |
| 人工干预 | 客服接管、强制结束 | 1 年 |

## 03 敏感内容脱敏 {#redaction}

<Diagram id="redaction-flow" />

原则：**在离开进程之前脱敏**。等到日志平台再脱敏，数据已经过了一遍网络、落了一次盘。

```python
import re

PATTERNS = {
    "phone_cn": r"(?<!\d)1[3-9]\d{9}(?!\d)",
    "id_card_cn": r"(?<!\d)\d{17}[\dXx](?!\d)",
    "email": r"[\w.+-]+@[\w-]+\.[\w.]+",
    "api_key": r"(sk|ak|ghp)_[A-Za-z0-9]{16,}",
    "bank_card": r"(?<!\d)\d{16,19}(?!\d)",
}

def redact(text: str) -> str:
    for name, pattern in PATTERNS.items():
        text = re.sub(pattern, f"[REDACTED:{name}]", text)
    return text
```

| 数据类型 | 处理方式 | 说明 |
| --- | --- | --- |
| 手机号、身份证 | 掩码或哈希 | 保留后四位便于客服核对 |
| 邮箱 | 哈希 + 域名保留 | `a***@example.com` |
| 密钥、Cookie | **整段删除** | 不要掩码，直接删 |
| 用户原文 | 默认不入库 | 需授权 + 短保留期 |
| 工具返回体 | 截断 + 脱敏 | 前 500 字符足够定位 |

三层防线，缺一不可：

1. **SDK 层**：日志 formatter 里统一脱敏（防止有人忘了调）。
2. **Collector 层**：OTel `redaction` processor 兜底（防第三方库偷偷打日志）。
3. **存储层**：字段级加密 + 访问审计（防内部人肉查询）。

## 04 日志采样策略 {#sampling}

<Diagram id="log-sampling" />

日志量通常是 trace 的 5~20 倍。全量存 = 给存储厂商交学费。

| 策略 | 怎么做 | 适合 |
| --- | --- | --- |
| 级别采样 | DEBUG 1%，INFO 10%，WARN/ERROR 100% | 默认起点 |
| 哈希采样 | `hash(trace_id) % 100 < 10` | 保证同一链路全采或全不采 |
| 尾采样 | 先缓冲，出错再落盘 | 故障必留样本 |
| 速率限制 | 每服务每秒 N 条 | 防日志风暴 |

```python
import hashlib

def should_log(level: str, trace_id: str) -> bool:
    if level in ("WARN", "ERROR", "AUDIT"):
        return True
    bucket = int(hashlib.md5(trace_id.encode()).hexdigest()[:8], 16) % 100
    return bucket < (1 if level == "DEBUG" else 10)
```

::: tip 用 trace_id 做哈希，而不是随机数
随机采样会出现「链路里 A 服务有日志、B 服务没有」的惨剧。按 `trace_id` 取模，一条链路要么全留，要么全丢。
:::

## 05 日志持久化选型 {#storage}

<Diagram id="log-store" />

| 方案 | 强项 | 弱项 | 适合规模 |
| --- | --- | --- | --- |
| ELK / OpenSearch | 全文检索强、生态成熟 | 资源重、运维贵 | 中大型，已有团队 |
| Loki | 便宜、和 Grafana 天生一对 | 不支持复杂聚合查询 | 中小型，以标签查询为主 |
| ClickHouse | 聚合极快、压缩比高、成本低 | 需要自己建查询层 | 大型，日志+指标统一分析 |
| 对象存储 + DuckDB | 极便宜、按需查 | 不适合实时 | 归档、合规留存 |

经验组合：

- **日增 < 50GB**：Loki + 对象存储，够用且省心。
- **日增 50~500GB，需要复杂分析**：ClickHouse。
- **合规要求强检索 + 现有团队熟悉**：ELK。
- **审计日志**：单独一条链路，写 WORM 存储，不要和调试日志混在一起。

## 日志健康指标 {#board-sample}

| 指标 | 定义 | 异常含义 |
| --- | --- | --- |
| 日志量/请求 | 每请求条数 | 突增 = 循环或重复打点 |
| ERROR 占比 | error 条数 / 总数 | 上升 = 真出事了 |
| 脱敏命中数 | 每分钟替换次数 | 突增 = 有新数据源没治理 |
| 丢弃率 | 被采样/限流丢弃比例 | 过高 = 故障时看不到日志 |
| 审计缺口 | 应有事件 - 实有事件 | > 0 就是合规问题 |

## 避坑清单 {#pitfalls}

::: warning 日志的五个血泪坑
1. **在循环里打 INFO**。一轮 40 次工具调用，日志比 trace 大 100 倍。
2. **把整个 request body 打出来**。里面有 token、手机号、地址。
3. **审计日志和业务日志用同一个 logger**。采样策略一改，合规证据没了。
4. **只存 message 不存 trace_id**。出事时无法从日志跳到链路。
5. **时间戳用本地时间不带时区**。跨国排查时你会怀疑人生。
:::

## 小结 {#recap}

- 调试日志给人看，审计日志给合规看，物理隔离。
- 审计字段的核心是「谁、何时、对什么、做了什么、结果如何、依据什么」。
- 脱敏要在进程内做，Collector 兜底，存储层再加密。
- 采样按 `trace_id` 哈希，错误与审计永不采样。
- 选型看日增量和查询模式，审计日志单独走 WORM。

下一章：什么时候该吵醒一个人，以及怎么让告警不被无视。

## 延伸阅读 {#reading}

- [OpenTelemetry Logs 数据模型](https://opentelemetry.io/docs/specs/otel/logs/data-model/)：字段与严重级别的标准定义。
- [OpenTelemetry Collector 处理器](https://opentelemetry.io/docs/collector/configuration/#processors)：脱敏、采样、批处理的配置入口。
- [第 05 章 告警体系](/alerts/)：日志里的错误怎么变成一次有效的呼叫。
- [第 11 章 安全与合规](/security/)：留存、隔离与数据边界。
