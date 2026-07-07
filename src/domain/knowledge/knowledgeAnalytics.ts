import type { KnowledgeStatus, KnowledgeType, LegacyDocumentNode } from '@/domain/document/types'

export type KnowledgeHealth = {
  total: number
  drafts: number
  verified: number
  outdated: number
  archived: number
  missingTags: number
  missingSummary: number
  isolated: number
  score: number
}

export type KnowledgeMaintenanceLists = {
  needsOrganizing: LegacyDocumentNode[]
  needsReview: LegacyDocumentNode[]
  isolated: LegacyDocumentNode[]
}

export type KnowledgeAnalysis = {
  documents: LegacyDocumentNode[]
  health: KnowledgeHealth
  maintenance: KnowledgeMaintenanceLists
  typeCounts: Record<KnowledgeType, number>
  statusCounts: Record<KnowledgeStatus, number>
}

export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  note: '普通记录',
  concept: '概念',
  guide: '指南',
  decision: '决策',
  faq: '问答',
  source: '资料',
  case: '案例'
}

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeStatus, string> = {
  draft: '草稿',
  verified: '已验证',
  outdated: '已过期',
  archived: '已归档'
}

const KNOWLEDGE_TYPES: KnowledgeType[] = ['note', 'concept', 'guide', 'decision', 'faq', 'source', 'case']
const KNOWLEDGE_STATUSES: KnowledgeStatus[] = ['draft', 'verified', 'outdated', 'archived']
const REVIEW_INTERVAL_DAYS = 90

const getKnowledgeDocuments = (documents: LegacyDocumentNode[]) => {
  return documents.filter((doc) => !doc.isFolder)
}

const normalizeKnowledgeType = (value: unknown): KnowledgeType => {
  return KNOWLEDGE_TYPES.includes(value as KnowledgeType) ? (value as KnowledgeType) : 'note'
}

const normalizeKnowledgeStatus = (value: unknown): KnowledgeStatus => {
  return KNOWLEDGE_STATUSES.includes(value as KnowledgeStatus) ? (value as KnowledgeStatus) : 'draft'
}

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0

const isReviewExpired = (doc: LegacyDocumentNode, now = new Date()) => {
  if (doc.knowledgeStatus === 'outdated') return true
  if (!doc.reviewedAt) return false

  const reviewedAt = new Date(String(doc.reviewedAt))
  if (Number.isNaN(reviewedAt.getTime())) return false

  const diffDays = Math.floor((now.getTime() - reviewedAt.getTime()) / 86400000)
  return diffDays > REVIEW_INTERVAL_DAYS
}

const buildTitleIndex = (documents: LegacyDocumentNode[]) => {
  const titleToId = new Map<string, string>()
  documents.forEach((doc) => {
    if (!doc.title) return
    titleToId.set(String(doc.title).trim(), String(doc.id))
  })
  return titleToId
}

const extractWikiLinks = (content: string) => {
  const links: string[] = []
  const pattern = /\[\[([^\]]+)\]\]/g
  let match = pattern.exec(content)

  while (match) {
    const title = String(match[1] || '').split('|')[0].trim()
    if (title) links.push(title)
    match = pattern.exec(content)
  }

  return links
}

const buildRelationIdSet = (documents: LegacyDocumentNode[]) => {
  const titleToId = buildTitleIndex(documents)
  const relatedIds = new Set<string>()

  documents.forEach((doc) => {
    const docId = String(doc.id)
    if (doc.parentId) {
      relatedIds.add(docId)
      relatedIds.add(String(doc.parentId))
    }

    if (Array.isArray(doc.relatedIds)) {
      doc.relatedIds.forEach((id) => {
        if (!id) return
        relatedIds.add(docId)
        relatedIds.add(String(id))
      })
    }

    if (hasText(doc.content)) {
      extractWikiLinks(String(doc.content)).forEach((title) => {
        const targetId = titleToId.get(title)
        if (!targetId) return
        relatedIds.add(docId)
        relatedIds.add(targetId)
      })
    }
  })

  return relatedIds
}

export const analyzeKnowledgeBase = (documents: LegacyDocumentNode[], now = new Date()): KnowledgeAnalysis => {
  const knowledgeDocs = getKnowledgeDocuments(documents)
  const relationIdSet = buildRelationIdSet(knowledgeDocs)

  const typeCounts = KNOWLEDGE_TYPES.reduce((acc, type) => {
    acc[type] = 0
    return acc
  }, {} as Record<KnowledgeType, number>)

  const statusCounts = KNOWLEDGE_STATUSES.reduce((acc, status) => {
    acc[status] = 0
    return acc
  }, {} as Record<KnowledgeStatus, number>)

  const health: KnowledgeHealth = {
    total: knowledgeDocs.length,
    drafts: 0,
    verified: 0,
    outdated: 0,
    archived: 0,
    missingTags: 0,
    missingSummary: 0,
    isolated: 0,
    score: 100
  }

  const needsOrganizing: LegacyDocumentNode[] = []
  const needsReview: LegacyDocumentNode[] = []
  const isolated: LegacyDocumentNode[] = []

  knowledgeDocs.forEach((doc) => {
    const type = normalizeKnowledgeType(doc.knowledgeType)
    const status = normalizeKnowledgeStatus(doc.knowledgeStatus)
    const noTags = !Array.isArray(doc.tags) || doc.tags.length === 0
    const noSummary = !hasText(doc.summary)
    const expired = isReviewExpired(doc, now)
    const docIsIsolated = !relationIdSet.has(String(doc.id))

    typeCounts[type] += 1
    statusCounts[status] += 1

    if (status === 'draft') health.drafts += 1
    if (status === 'verified') health.verified += 1
    if (status === 'archived') health.archived += 1
    if (expired) health.outdated += 1
    if (noTags) health.missingTags += 1
    if (noSummary) health.missingSummary += 1
    if (docIsIsolated) health.isolated += 1

    if (status === 'draft' || noTags || noSummary) needsOrganizing.push(doc)
    if (expired) needsReview.push(doc)
    if (docIsIsolated) isolated.push(doc)
  })

  if (health.total === 0) {
    health.score = 0
  } else {
    const penalty =
      health.drafts * 6 +
      health.outdated * 12 +
      health.missingTags * 7 +
      health.missingSummary * 5 +
      health.isolated * 4
    health.score = Math.max(0, Math.min(100, Math.round(100 - penalty / health.total)))
  }

  const byUpdatedAtDesc = (a: LegacyDocumentNode, b: LegacyDocumentNode) => {
    return new Date(String(b.updatedAt || b.createdAt || 0)).getTime() -
      new Date(String(a.updatedAt || a.createdAt || 0)).getTime()
  }

  return {
    documents: knowledgeDocs,
    health,
    typeCounts,
    statusCounts,
    maintenance: {
      needsOrganizing: needsOrganizing.sort(byUpdatedAtDesc).slice(0, 6),
      needsReview: needsReview.sort(byUpdatedAtDesc).slice(0, 6),
      isolated: isolated.sort(byUpdatedAtDesc).slice(0, 6)
    }
  }
}
