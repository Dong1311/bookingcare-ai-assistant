import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type { Kind } from '../shared/protocol.js'

export const origin = 'https://bookingcare.vn'
export const termsUrl = origin + '/trang/dieu-khoan-su-dung-i7'
export const bookingSearch = origin + '/timkiem'
const docKind = z.enum(['doctor', 'facility', 'specialty', 'service', 'faq'])

export function canonical(value: string, base = origin): string | null {
  try {
    const url = new URL(value, base)
    if (url.origin !== origin || url.username || url.password) return null
    return origin + url.pathname.replace(/\/$/, '')
  } catch {
    return null
  }
}

export function kindOf(value: string): Kind | undefined {
  const path = new URL(value).pathname
  if (/^\/benh-nhan-thuong-hoi\/[\w-]+-f\d+$/.test(path) || value === termsUrl) return 'faq'
  if (/^\/co-so-y-te\/[\w-]+-p\d+$/.test(path)) return 'facility'
  if (/^\/dich-vu-y-te\/[\w-]+\/[\w-]+-s\d+$/.test(path))
    return path.includes('/kham-chuyen-khoa/') ? 'specialty' : 'service'
  if (/^\/dich-vu-y-te\/[\w-]+\/[\w-]+-i\d+$/.test(path))
    return /\/kham-(chuyen-khoa|tu-xa|tinh-than)\//.test(path) ? 'doctor' : 'service'
}

const docSchema = z.object({
  url: z.string().refine(v => canonical(v) === v && Boolean(kindOf(v))),
  title: z.string().min(1), kind: docKind, fetchedAt: z.iso.datetime(),
  tags: z.array(z.string()), locations: z.array(z.string()), sections: z.array(z.string()).min(1),
}).refine(doc => kindOf(doc.url) === doc.kind)
const snapshotSchema = z.object({ collectedAt: z.iso.datetime(), docs: z.array(docSchema) })
export type Doc = z.infer<typeof docSchema>

export function profileKind(kind: Kind, title: string): Kind {
  return kind === 'doctor' && /^(?:kham|goi|dich vu)\b/.test(normalize(title)) ? 'service' : kind
}

export async function loadSnapshot(path = 'data/bookingcare.json') {
  const snapshot = snapshotSchema.parse(JSON.parse(await readFile(path, 'utf8')))
  return { ...snapshot, docs: snapshot.docs.map(doc => ({ ...doc, kind: profileKind(doc.kind, doc.title) })) }
}

export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export const places = [
  ['ha noi', /\bha noi\b/],
  ['ho chi minh', /\b(?:ho chi minh|tphcm|tp hcm|sai gon|hcm)\b/],
  ['da nang', /\bda nang\b/],
  ['dong nai', /\bdong nai\b/],
  ['binh duong', /\bbinh duong\b/],
  ['hai phong', /\bhai phong\b/],
  ['can tho', /\bcan tho\b/],
] as const

export function locationsIn(text: string): string[] {
  const value = normalize(text)
  return places.filter(([, pattern]) => pattern.test(value)).map(([city]) => city)
}
