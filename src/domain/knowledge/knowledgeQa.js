import { markdownService } from '@/services/markdownService'
import {
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_TYPE_LABELS
} from '@/domain/knowledge/knowledgeAnalytics'

const MAX_CONTEXT_DOCS = 5
const MAX_DOC_CHARS = 1200

const CONFIDENCE_LABELS = {
  high: '高可信',
  medium: '中可信',
  low: '低可信'
}

const KNOWLEDGE_TYPES = ['note', 'concept', 'guide', 'decision', 'faq', 'source', 'case']
const KNOWLEDGE_STATUSES = ['draft', 'verified', 'outdated', 'archived']
const KNOWLEDGE_CONFIDENCES = ['low', 'medium', 'high']

const normalizeText = (value) => String(value || '').trim()

const tokenize = (query) => {
  const text = normalizeText(query).toLowerCase()
  const words = text.match(/[a-z0-9_\-]{2,}/g) || []
  const chars = text.match(/[\u4e00-\u9fa5]/g) || []
  return [...new Set([...words, ...chars])]
}

const includesAny = (text, tokens) => {
  const source = normalizeText(text).toLowerCase()
  return tokens.some((token) => source.includes(token))
}

const scoreDocument = (doc, tokens) => {
  if (!doc || doc.isFolder || tokens.length === 0) return 0

  const title = normalizeText(doc.title).toLowerCase()
  const aliases = Array.isArray(doc.aliases) ? doc.aliases.join(' ').toLowerCase() : ''
  const tags = Array.isArray(doc.tags) ? doc.tags.join(' ').toLowerCase() : ''
  const summary = normalizeText(doc.summary).toLowerCase()
  const body = markdownService.extractText(doc.content).toLowerCase()

  let score = 0
  tokens.forEach((token) => {
    if (title.includes(token)) score += 14
    if (aliases.includes(token)) score += 12
    if (tags.includes(token)) score += 8
    if (summary.includes(token)) score += 6
    if (body.includes(token)) score += 2
  })

  if (doc.knowledgeStatus === 'verified') score += 3
  if (doc.confidence === 'high') score += 2
  if (doc.knowledgeStatus === 'archived') score -= 3

  return score
}

const compactContent = (doc) => {
  const summary = normalizeText(doc.summary)
  if (summary) return summary
  return markdownService.generateSummary(doc.content, MAX_DOC_CHARS)
}

const formatContextDocument = (doc, index) => {
  const sourceUrl = normalizeText(doc.sourceUrl)
  const aliases = Array.isArray(doc.aliases) && doc.aliases.length > 0
    ? `\n别名：${doc.aliases.join('、')}`
    : ''

  return [
    `[${index}] ${doc.title}`,
    `类型：${KNOWLEDGE_TYPE_LABELS[doc.knowledgeType] || KNOWLEDGE_TYPE_LABELS.note}`,
    `状态：${KNOWLEDGE_STATUS_LABELS[doc.knowledgeStatus] || KNOWLEDGE_STATUS_LABELS.draft}`,
    `可信度：${CONFIDENCE_LABELS[doc.confidence] || CONFIDENCE_LABELS.medium}`,
    sourceUrl ? `来源链接：${sourceUrl}` : '',
    aliases.trim(),
    `内容：${compactContent(doc).slice(0, MAX_DOC_CHARS)}`
  ].filter(Boolean).join('\n')
}

export const retrieveRelevantDocuments = (question, documents, options = {}) => {
  const tokens = tokenize(question)
  const limit = options.limit || MAX_CONTEXT_DOCS
  const excludeIds = new Set((options.excludeIds || []).map(String))

  return [...documents]
    .filter((doc) => !doc.isFolder && !excludeIds.has(String(doc.id)))
    .map((doc) => ({ doc, score: scoreDocument(doc, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item, index) => ({
      id: String(item.doc.id),
      title: item.doc.title,
      summary: item.doc.summary || markdownService.generateSummary(item.doc.content, 160),
      knowledgeType: item.doc.knowledgeType || 'note',
      knowledgeStatus: item.doc.knowledgeStatus || 'draft',
      confidence: item.doc.confidence || 'medium',
      sourceUrl: item.doc.sourceUrl || '',
      score: item.score,
      index: index + 1,
      doc: item.doc
    }))
}

export const buildKnowledgeContext = (results) => {
  if (!Array.isArray(results) || results.length === 0) return ''
  return results.map((item, index) => formatContextDocument(item.doc, index + 1)).join('\n\n---\n\n')
}

export const buildKnowledgeQaMessages = ({ question, history = [], context }) => {
  const systemPrompt = [
    '你是个人知识库问答助手。只能优先依据“知识库上下文”回答。',
    '回答要求：',
    '1. 结论要直接，无法从上下文确认时明确说“知识库中没有足够依据”。',
    '2. 涉及事实、建议或步骤时，在句末用 [1]、[2] 这样的编号引用来源。',
    '3. 低可信、草稿、已过期内容只能作为线索，必须提示不确定性。',
    '4. 不要编造来源，不要引用上下文之外的编号。',
    '5. 最后用“来源”小节列出使用过的编号。'
  ].join('\n')

  return [
    { role: 'system', content: systemPrompt },
    ...history,
    {
      role: 'user',
      content: `知识库上下文：\n${context || '无匹配知识。'}\n\n用户问题：${question}`
    }
  ]
}

export const buildLowConfidenceNotice = (results) => {
  const weakItems = results.filter((item) => (
    item.confidence === 'low' ||
    item.knowledgeStatus === 'draft' ||
    item.knowledgeStatus === 'outdated'
  ))

  if (weakItems.length === 0) return ''

  const names = weakItems.slice(0, 3).map((item) => item.title).join('、')
  return `提示：检索到 ${weakItems.length} 条低可信、草稿或过期知识（${names}），回答会降低确定性。`
}

export const hasQuestionHit = (question, results) => {
  const tokens = tokenize(question)
  return results.some((item) => (
    includesAny(item.title, tokens) ||
    includesAny(item.summary, tokens)
  ))
}

export const parseAiJsonObject = (text) => {
  const source = normalizeText(text)
  if (!source) return {}

  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : source
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return {}

  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return {}
  }
}

export const buildDocumentOrganizeMessages = (doc) => [
  {
    role: 'system',
    content: [
      '你是个人知识库整理助手。请分析文档，返回一个 JSON 对象，不要输出 Markdown。',
      'JSON 字段：title, summary, tags, knowledgeType, knowledgeStatus, confidence, aliases。',
      'knowledgeType 只能是 note/concept/guide/decision/faq/source/case。',
      'knowledgeStatus 只能是 draft/verified/outdated/archived。',
      'confidence 只能是 low/medium/high。',
      'tags 和 aliases 必须是字符串数组。summary 控制在 160 字以内。'
    ].join('\n')
  },
  {
    role: 'user',
    content: [
      `标题：${doc.title}`,
      `当前标签：${Array.isArray(doc.tags) ? doc.tags.join('、') : ''}`,
      `正文：${String(doc.content || '').slice(0, 8000)}`
    ].join('\n\n')
  }
]

export const buildAutoTagMessages = (doc) => [
  {
    role: 'system',
    content: [
      '你是知识库标签助手。请只返回 JSON 对象，不要输出 Markdown。',
      'JSON 字段：tags, summary。',
      'tags 是 3 到 8 个短标签，避免空泛词。summary 控制在 120 字以内。'
    ].join('\n')
  },
  {
    role: 'user',
    content: [
      `标题：${doc.title}`,
      `已有标签：${Array.isArray(doc.tags) ? doc.tags.join('、') : ''}`,
      `正文：${String(doc.content || '').slice(0, 7000)}`
    ].join('\n\n')
  }
]

export const buildAutoSummaryMessages = (doc) => [
  {
    role: 'system',
    content: [
      '你是知识库摘要助手。请只返回 JSON 对象，不要输出 Markdown。',
      'JSON 字段：summary。',
      'summary 控制在 120 到 180 字，突出可复用结论、适用条件和注意事项。'
    ].join('\n')
  },
  {
    role: 'user',
    content: [
      `标题：${doc.title}`,
      `类型：${doc.knowledgeType || 'note'}`,
      `正文：${String(doc.content || '').slice(0, 8000)}`
    ].join('\n\n')
  }
]

export const buildConceptCardMessages = (doc) => [
  {
    role: 'system',
    content: [
      '你是知识库卡片生成助手。请把资料摘录转成一篇“概念卡片”。',
      '直接返回 Markdown，不要输出解释。',
      '结构必须包含：# 概念名称、## 一句话解释、## 详细说明、## 适用场景、## 易混淆概念、## 相关知识、## 来源。',
      '如果资料包含多个概念，请选择最核心、最可复用的一个。'
    ].join('\n')
  },
  {
    role: 'user',
    content: [
      `资料标题：${doc.title}`,
      doc.sourceUrl ? `来源链接：${doc.sourceUrl}` : '',
      `正文：${String(doc.content || '').slice(0, 9000)}`
    ].filter(Boolean).join('\n\n')
  }
]

export const extractMarkdownTitle = (markdown, fallback = '概念卡片') => {
  const match = String(markdown || '').match(/^#\s+(.+)$/m)
  return normalizeText(match?.[1]) || fallback
}

export const normalizeAiTags = (value) => {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))].slice(0, 10)
}

export const normalizeAiKnowledgePatch = (data = {}, fallback = {}) => {
  const tags = normalizeAiTags(data.tags)
  const aliases = normalizeAiTags(data.aliases)
  const type = KNOWLEDGE_TYPES.includes(data.knowledgeType) ? data.knowledgeType : fallback.knowledgeType || 'note'
  const status = KNOWLEDGE_STATUSES.includes(data.knowledgeStatus) ? data.knowledgeStatus : fallback.knowledgeStatus || 'draft'
  const confidence = KNOWLEDGE_CONFIDENCES.includes(data.confidence) ? data.confidence : fallback.confidence || 'medium'

  return {
    title: normalizeText(data.title) || fallback.title || '未命名',
    summary: normalizeText(data.summary) || fallback.summary || '',
    tags: tags.length > 0 ? tags : (Array.isArray(fallback.tags) ? fallback.tags : []),
    knowledgeType: type,
    knowledgeStatus: status,
    confidence,
    aliases
  }
}

export const buildRelatedRecommendationQuery = (doc) => [
  doc.title,
  Array.isArray(doc.aliases) ? doc.aliases.join(' ') : '',
  Array.isArray(doc.tags) ? doc.tags.join(' ') : '',
  doc.summary || '',
  markdownService.generateSummary(doc.content, 260)
].filter(Boolean).join(' ')
