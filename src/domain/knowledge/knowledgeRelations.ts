import type { LegacyDocumentNode } from '@/domain/document/types'

export type KnowledgeLink = {
  doc: LegacyDocumentNode
  label?: string
}

export type KnowledgeMention = {
  doc: LegacyDocumentNode
  matchedText: string
}

export type KnowledgeRelationDetail = {
  outgoing: KnowledgeLink[]
  backlinks: KnowledgeLink[]
  manual: KnowledgeLink[]
  unlinkedMentions: KnowledgeMention[]
}

const normalizeText = (value: unknown) => String(value || '').trim()

const isDocument = (doc: LegacyDocumentNode) => doc && !doc.isFolder

const uniqueById = <T extends { doc: LegacyDocumentNode }>(items: T[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const id = normalizeText(item.doc.id)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export const extractKnowledgeWikiLinks = (content: unknown) => {
  const text = String(content || '')
  const links: string[] = []
  const pattern = /\[\[([^\]]+)\]\]/g
  let match = pattern.exec(text)

  while (match) {
    const raw = normalizeText(match[1])
    const title = normalizeText(raw.split('|')[0])
    if (title) links.push(title)
    match = pattern.exec(text)
  }

  return links
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildLookup = (documents: LegacyDocumentNode[]) => {
  const byId = new Map<string, LegacyDocumentNode>()
  const byTitleOrAlias = new Map<string, LegacyDocumentNode>()

  documents.filter(isDocument).forEach((doc) => {
    const id = normalizeText(doc.id)
    if (id) byId.set(id, doc)

    const names = [doc.title, ...(Array.isArray(doc.aliases) ? doc.aliases : [])]
      .map(normalizeText)
      .filter(Boolean)

    names.forEach((name) => {
      byTitleOrAlias.set(name.toLowerCase(), doc)
    })
  })

  return { byId, byTitleOrAlias }
}

const contentContainsWikiLinkTo = (content: unknown, names: string[]) => {
  const linkedNames = extractKnowledgeWikiLinks(content).map((name) => name.toLowerCase())
  return names.some((name) => linkedNames.includes(name.toLowerCase()))
}

const getNamesForDocument = (doc: LegacyDocumentNode) => {
  return [doc.title, ...(Array.isArray(doc.aliases) ? doc.aliases : [])]
    .map(normalizeText)
    .filter(Boolean)
}

const findUnlinkedMention = (source: LegacyDocumentNode, target: LegacyDocumentNode) => {
  const content = String(source.content || '')
  if (!content) return ''

  const names = getNamesForDocument(target)
  if (contentContainsWikiLinkTo(content, names)) return ''

  return names.find((name) => {
    if (!name || name.length < 2) return false
    return new RegExp(escapeRegExp(name), 'i').test(content)
  }) || ''
}

export const buildKnowledgeRelations = (
  currentDoc: LegacyDocumentNode | null | undefined,
  documents: LegacyDocumentNode[]
): KnowledgeRelationDetail => {
  if (!currentDoc || currentDoc.isFolder) {
    return {
      outgoing: [],
      backlinks: [],
      manual: [],
      unlinkedMentions: []
    }
  }

  const currentId = normalizeText(currentDoc.id)
  const allDocs = documents.filter((doc) => isDocument(doc) && normalizeText(doc.id) !== currentId)
  const { byId, byTitleOrAlias } = buildLookup(documents)

  const outgoing = extractKnowledgeWikiLinks(currentDoc.content).map((title) => {
    const doc = byTitleOrAlias.get(title.toLowerCase())
    return doc ? { doc, label: title } : null
  }).filter(Boolean) as KnowledgeLink[]

  const currentNames = getNamesForDocument(currentDoc)
  const backlinks = allDocs.map((doc) => {
    return contentContainsWikiLinkTo(doc.content, currentNames) ? { doc } : null
  }).filter(Boolean) as KnowledgeLink[]

  const manual = (Array.isArray(currentDoc.relatedIds) ? currentDoc.relatedIds : []).map((id) => {
    const doc = byId.get(normalizeText(id))
    return doc && normalizeText(doc.id) !== currentId ? { doc } : null
  }).filter(Boolean) as KnowledgeLink[]

  const unlinkedMentions = allDocs.map((doc) => {
    const matchedText = findUnlinkedMention(doc, currentDoc)
    return matchedText ? { doc, matchedText } : null
  }).filter(Boolean) as KnowledgeMention[]

  return {
    outgoing: uniqueById(outgoing),
    backlinks: uniqueById(backlinks),
    manual: uniqueById(manual),
    unlinkedMentions: uniqueById(unlinkedMentions)
  }
}
