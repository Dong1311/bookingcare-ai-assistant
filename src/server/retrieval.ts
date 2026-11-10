import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { apiKey, embeddingModel } from './config.js'
import { normalize, locationsIn, type Doc } from './knowledge.js'
import type { Kind } from '../shared/protocol.js'

const stop = new Set('a ai anh ban ben bi bo cac can cho co cua cung dan dang day den di do duoc em gi giup hay hen hoi hon kham khoa khi khong la lam lich mot minh muon nao nay nen neu nhat nhung o qua roi se sao theo thi thong tin tim toi trong tu va ve vi voi xin y bac si benh vien phong dia chi bacsi dich vu dat bookingcare the'.split(' '))
const words = (text: string) => normalize(text).split(' ').filter(token => token.length > 1 && !stop.has(token))
const terms = (text: string) => [...new Set(words(text))]
const faqTopics: [RegExp, RegExp][] = [
  [/\b(?:mien phi|phi dat|mat phi|thanh toan|quet the|chuyen khoan|dat coc)\b/, /-f6$/],
  [/\b(?:bao hiem|bao lanh)\b/, /-f7$/],
  [/\b(?:huy lich|doi lich|nhap sai|sai thong tin|den muon|di muon|cach dat|dat .* the nao|huong dan dat)\b/, /-f2$/],
  [/\b(?:benh vien cong|benh vien tu|dia chi|trang thiet bi|cuoi tuan)\b/, /-f5$/],
  [/\b(?:bookingcare la gi|bookingcare .*phai .*benh vien)\b/, /-f1$/],
  [/\bho so suc khoe\b/, /-f11$/],
  [/\b(?:gia thuc te|sau khi kham|sau kham)\b/, /-f10$/],
]
const faqHeadings: [RegExp, RegExp][] = [
  [/\bbookingcare (?:la gi|co phai)\b/, /\bbookingcare co phai la mot benh vien\b/],
  [/\b(?:benh vien cong|benh vien tu)\b/, /\bcong hay benh vien tu\b/],
  [/\bbao lanh\b/, /\bbao lanh\b/],
  [/\bhuy lich.*(?:lam the nao|nhu the nao)\b/, /\bmuon huy lich kham thi lam the nao\b/],
  [/\b(?:cach dat|huong dan dat)\b/, /\blam the nao de dat lich kham\b/],
]
export const signature = (docs: Doc[]) => createHash('sha256').update(JSON.stringify(docs)).digest('hex')
export const embeddingText = (doc: Doc) => [doc.title, ...doc.tags, ...doc.locations, ...doc.sections].join('\n').slice(0, 4500)

export type Match = { doc: Doc; excerpt: string; score: number }
type Entry = { doc: Doc; title: Set<string>; terms: Set<string>; sections: Set<string>[] }
export type SearchResult = { matches: Match[]; strategy: 'lexical' | 'hybrid'; embeddingTokens: number | null }

export async function vectorsFor(docs: Doc[]) {
  try {
    const result = z.object({ digest: z.string(), model: z.literal(embeddingModel), vectors: z.array(z.array(z.number()).length(512)) })
      .parse(JSON.parse(await readFile('data/vectors.json', 'utf8')))
    if (result.digest === signature(docs) && result.vectors.length === docs.length) return result.vectors
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('Vector index invalid; using lexical search.')
  }
}

async function queryVector(query: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(1600)
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: embeddingModel, input: query, dimensions: 512 }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!response.ok) throw new Error('Embedding HTTP ' + response.status)
  const result = z.object({
    data: z.array(z.object({ embedding: z.array(z.number()).length(512) })).min(1),
    usage: z.object({ prompt_tokens: z.number() }),
  }).parse(await response.json())
  return { vector: result.data[0].embedding, tokens: result.usage.prompt_tokens }
}

export class Retriever {
  readonly entries: Entry[]
  private readonly weights = new Map<string, number>()

  constructor(readonly docs: Doc[], private readonly vectors?: number[][]) {
    this.entries = docs.map(doc => ({
      doc, title: new Set(words([doc.title, ...doc.tags].join(' '))),
      terms: new Set(words(embeddingText(doc))),
      sections: doc.sections.map(section => new Set(words(section))),
    }))
    const frequencies = new Map<string, number>()
    for (const entry of this.entries)
      for (const word of entry.terms) frequencies.set(word, (frequencies.get(word) ?? 0) + 1)
    for (const [word, frequency] of frequencies)
      this.weights.set(word, 1 + Math.log((docs.length + 1) / (frequency + 1)))
  }

  private weight(query: string[], text: Set<string>) {
    return query.reduce((total, term) => total + (text.has(term) ? this.weights.get(term) ?? 1 : 0), 0)
  }

  async search(query: string, kinds: Kind[], signal?: AbortSignal, lexicalOnly = false): Promise<SearchResult> {
    const cities = locationsIn(query)
    const cityWords = new Set(cities.flatMap(city => city.split(' ')).concat(['hcm', 'tphcm', 'sai', 'gon']))
    const queryTerms = terms(query).filter(term => !cityWords.has(term))
    let semantic: Awaited<ReturnType<typeof queryVector>> | undefined
    if (!lexicalOnly && apiKey && this.vectors && queryTerms.length) {
      try {
        semantic = await queryVector(query, signal)
      } catch {
        signal?.throwIfAborted()
      }
    }
    const normalized = normalize(query)
    const faqTopic = faqTopics.find(([pattern]) => pattern.test(normalized))?.[1]
    const faqHeading = faqHeadings.find(([pattern]) => pattern.test(normalized))?.[1]
    const remoteCare = /\b(?:tu xa|truc tuyen|online)\b/.test(normalized)
    const addressQuestion = /\b(?:dia chi|o dau)\b/.test(normalized)
    const matches = this.entries.flatMap((entry, index) => {
      if (!kinds.includes(entry.doc.kind)) return []
      const isFaq = entry.doc.kind === 'faq'
      if (!isFaq && cities.length && !cities.some(city => entry.doc.locations.includes(city))) return []
      const title = normalize(entry.doc.title)
      const isRemote = entry.doc.kind === 'service' && /-tu-xa-s\d+$/.test(entry.doc.url)
      if (remoteCare && !isFaq && !isRemote) return []
      const docTopic = isFaq && Boolean(faqTopic?.test(entry.doc.url))
      const sectionScores = entry.sections.map((section, i) => {
        const text = entry.doc.sections[i]
        if (!isFaq) return this.weight(queryTerms, section)
        const [heading, ...body] = text.split('\n')
        const isFaqIndex = entry.doc.url.includes('/benh-nhan-thuong-hoi/')
        if (isFaqIndex && (body.join(' ').length < 24 || !heading.includes('?'))) return -1
        const hint = faqHeading?.test(normalize(heading)) ? 18 : 0
        return this.weight(queryTerms, section) + 2 * this.weight(queryTerms, new Set(words(heading))) + hint
      })
      const best = sectionScores.indexOf(Math.max(...sectionScores))
      const exactTitle = normalized.includes(title) && title.length > 5
      const matchScore = this.weight(queryTerms, entry.terms)
      const topicBoost = docTopic ? 30 : 0
      const routeBoost = isRemote && remoteCare ? 10 : 0
      const lexical = (isFaq ? sectionScores[best] : matchScore) +
        2 * this.weight(queryTerms, entry.title) + (exactTitle ? 14 : 0) + topicBoost + routeBoost
      const similarity = semantic && this.vectors
        ? this.vectors[index].reduce((sum, v, i) => sum + v * semantic.vector[i], 0) : 0
      const hasRemoteSpecialty = queryTerms.filter(term => !['xa', 'truc', 'tuyen', 'online'].includes(term)).some(term => entry.title.has(term))
      if (remoteCare && isRemote && !hasRemoteSpecialty && queryTerms.some(term => !['xa', 'truc', 'tuyen', 'online'].includes(term)) && similarity < 0.53)
        return []
      if (!docTopic && !exactTitle && (matchScore < 2 || (queryTerms.length >= 4 && queryTerms.filter(term => entry.terms.has(term)).length < 2)) && similarity < 0.53)
        return []
      const excerpt = entry.doc.kind === 'facility' && addressQuestion
        ? entry.doc.sections[0] + '\n' + entry.doc.sections[best] : entry.doc.sections[best]
      return [{ doc: entry.doc, excerpt, score: lexical + 9 * Math.max(0, similarity - 0.22) }]
    }).sort((a, b) => b.score - a.score)
    return { matches: matches.slice(0, 4), strategy: semantic ? 'hybrid' : 'lexical', embeddingTokens: semantic?.tokens ?? (this.vectors && apiKey && !lexicalOnly ? null : 0) }
  }
}

export function createSearchTools(retriever: Retriever) {
  const schema = z.object({ query: z.string().max(2600), lexicalOnly: z.boolean() })
  function searchTool(name: string, description: string, kinds: Kind[]) {
    return tool(({ query, lexicalOnly }, config) => retriever.search(query, kinds, config?.signal, lexicalOnly),
      { name, description, schema })
  }
  return {
    doctor: searchTool('searchDoctor', 'Tìm bác sĩ và chuyên khoa.', ['doctor', 'specialty']),
    facility: searchTool('searchFacility', 'Tìm cơ sở y tế công khai.', ['facility']),
    service: searchTool('searchService', 'Tìm danh mục và dịch vụ y tế.', ['service', 'specialty']),
    faq: searchTool('searchFAQ', 'Tra cứu hướng dẫn sử dụng BookingCare.', ['faq']),
    any: searchTool('searchCatalog', 'Tra cứu danh mục khám.', ['doctor', 'facility', 'specialty', 'service']),
  }
}
