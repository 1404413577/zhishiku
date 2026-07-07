/**
 * 文档模板
 */
export const templates = [
  {
    id: 'knowledge-concept',
    name: '概念卡片',
    icon: '🧠',
    content: `# 概念名称

> 创建于 ${new Date().toLocaleDateString('zh-CN')}

## 一句话解释


## 详细说明


## 适用场景

-

## 易混淆概念

-

## 相关知识

-

## 来源

-`
  },
  {
    id: 'knowledge-guide',
    name: '操作指南',
    icon: '🧭',
    content: `# 指南标题

> 创建于 ${new Date().toLocaleDateString('zh-CN')}

## 目标


## 前置条件

-

## 操作步骤

1.

## 验证方式

-

## 常见问题

-

## 相关知识

-`
  },
  {
    id: 'knowledge-decision',
    name: '决策记录',
    icon: '⚖️',
    content: `# 决策标题

**日期：** ${new Date().toLocaleDateString('zh-CN')}
**状态：** 草稿

## 背景


## 备选方案

### 方案一


### 方案二


## 决策


## 理由


## 影响


## 后续复核

-`
  },
  {
    id: 'knowledge-faq',
    name: 'FAQ',
    icon: '❓',
    content: `# 问题

## 简短答案


## 详细解释


## 适用条件

-

## 相关问题

-`
  },
  {
    id: 'knowledge-source',
    name: '资料摘录',
    icon: '🔖',
    content: `# 资料标题

**来源：**
**作者：**
**阅读日期：** ${new Date().toLocaleDateString('zh-CN')}

## 摘要


## 关键摘录

>

## 我的理解


## 可转化的知识点

-`
  },
  {
    id: 'knowledge-case',
    name: '问题案例',
    icon: '🧪',
    content: `# 案例标题

**日期：** ${new Date().toLocaleDateString('zh-CN')}

## 场景


## 问题


## 原因


## 解决方案


## 验证结果


## 经验沉淀

-`
  },
  {
    id: 'meeting',
    name: '会议纪要',
    icon: '📋',
    content: `# 会议纪要

**日期：** ${new Date().toLocaleDateString('zh-CN')}
**参会人员：**
**主持人：**

---

## 会议议题

1.

## 讨论内容

### 议题一


## 决议事项

- [ ]

## 下次会议

**时间：**
**议题：**

---

> 记录人：`
  },
  {
    id: 'weekly',
    name: '周报',
    icon: '📊',
    content: `# 周报 (${getWeekRange()})

## 本周完成

-

## 进行中


## 遇到的问题


## 下周计划

-

## 需要协助


---
> 更新于 ${new Date().toLocaleDateString('zh-CN')}`
  },
  {
    id: 'reading',
    name: '读书笔记',
    icon: '📖',
    content: `# 读书笔记：《书名》

**作者：**
**阅读日期：** ${new Date().toLocaleDateString('zh-CN')}
**评分：** ⭐⭐⭐⭐⭐

---

## 书籍简介


## 核心观点

### 1.

### 2.

## 精彩摘录

>

## 个人感悟


## 行动清单

- [ ]

---
> 阅读进度：第 章 / 共 章`
  },
  {
    id: 'journal',
    name: '每日日志',
    icon: '📝',
    content: `# ${new Date().toLocaleDateString('zh-CN')} 日志

## 今日目标


## 时间线

| 时间 | 事项 |
| --- | --- |
| 09:00 |  |
|  |  |

## 收获与反思


## 明日计划

- [ ]

---
> 🌟 今日关键词：`
  },
  {
    id: 'tech',
    name: '技术文档',
    icon: '💻',
    content: `# 技术文档

> 创建于 ${new Date().toLocaleDateString('zh-CN')}

---

## 概述


## 背景


## 方案设计

### 架构


## 实现细节

\`\`\`
\`\`\`

## 注意事项


## 参考资料

-
`
  },
  {
    id: 'blank',
    name: '空白文档',
    icon: '📄',
    content: ''
  }
]

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`
  return `${fmt(monday)} - ${fmt(sunday)}`
}
