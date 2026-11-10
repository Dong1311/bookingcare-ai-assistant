import { mkdir, writeFile, rename } from 'node:fs/promises'
import { load } from 'cheerio'
import robotsParser from 'robots-parser'
import { canonical, kindOf, locationsIn, origin, termsUrl, type Doc } from '../src/server/knowledge.js'
import type { Kind } from '../src/shared/protocol.js'

const agent = 'BookingCareScreeningDemo'
const delay = 1050
const quotas: Record<Kind, number> = { faq: 10, specialty: 14, doctor: 26, facility: 13, service: 13 }
const hubs = [
  '/', '/benh-nhan-thuong-hoi', '/dich-vu-y-te/kham-chuyen-khoa',
  '/co-so-y-te/tat-ca', '/dich-vu-y-te/kham-tong-quat', '/dich-vu-y-te/xet-nghiem-y-hoc',
]
const priority = [
  termsUrl,
  ...[
    'da-lieu-s11', 'co-xuong-khop-s1', 'than-kinh-s18', 'tieu-hoa-s22', 'tim-mach-s3',
    'tai-mui-hong-s4', 'san-phu-khoa-s19', 'cot-song-s24',
  ].map(slug => origin + '/dich-vu-y-te/kham-chuyen-khoa/' + slug),
  origin + '/dich-vu-y-te/kham-tong-quat/kham-tong-quat-s31',
  origin + '/co-so-y-te/benh-vien-benh-nhiet-doi-trung-uong-p111',
]
const visited = new Set<string>()
const queue = new Set<string>(priority)
const robotsUrl = origin + '/robots.txt'
const robotsResponse = await fetch(robotsUrl, { redirect: 'error', signal: AbortSignal.timeout(7000) })
if (!robotsResponse.ok) throw new Error('robots.txt unavailable; stopping ingestion')
const rules = robotsParser(robotsUrl, await robotsResponse.text())
const pacing = Math.max(delay, 1000 * (rules.getCrawlDelay(agent) ?? 0))
let nextRequest = performance.now() + pacing

async function fetchPage(url: string): Promise<{ url: string; html: string } | undefined> {
  for (let hops = 0; hops < 3; hops++) {
    if (rules.isAllowed(url, agent) !== true || visited.has(url)) return
    visited.add(url)
    await new Promise(resolve => setTimeout(resolve, Math.max(0, nextRequest - performance.now())))
    nextRequest = performance.now() + pacing
    const response = await fetch(url, {
      headers: { 'user-agent': agent, accept: 'text/html' },
      redirect: 'manual', signal: AbortSignal.timeout(8000),
    })
    if (response.status === 429 || response.status === 403 || response.status === 503) {
      await response.body?.cancel()
      throw new Error('STOP HTTP ' + response.status)
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      const target = location && canonical(location, url)
      if (!target || !kindOf(target)) return
      url = target
      continue
    }
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) return { url, html: await response.text() }
    await response.body?.cancel()
    console.warn('Skipped', url, response.status)
    return
  }
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function inspect(html: string, url: string, kind?: Kind): Doc | undefined {
  const $ = load(html)
  $('script, style, noscript, footer, nav, iframe, form').remove()
  $('a[href]').each((_, node) => {
    const href = $(node).attr('href')
    const target = href && canonical(href, url)
    if (target && kindOf(target) && !visited.has(target)) queue.add(target)
  })
  if (!kind) return
  const title = clean($('h1').first().text())
  if (!title) return
  const tidy = (values: string[]) => [...new Set(values.map(clean))].filter(v => v.length > 4)
  const textOf = (selector: string, limit = 12) => tidy($(selector).slice(0, limit).map((_, node) => $(node).text()).get())
  let sections: string[]
  let locations: string[] = []
  let tags: string[] = []
  if (kind === 'faq') {
    const main = $('main').first()
    const pieces = main.length ? main.find('h2,h3,h4,p,li') : $('h2,h3,h4,p,li')
    sections = []
    let current = ''
    pieces.each((_, node) => {
      const line = clean($(node).text())
      if (!line) return
      if (/^h[234]$/.test(node.tagName) && current) {
        sections.push(current)
        current = ''
      }
      current += (current ? '\n' : '') + line
    })
    if (current) sections.push(current)
  } else {
    const description = '[data-testid="expandable-html-view-content"]'
    const primary = kind === 'doctor' || /-i\d+$/.test(url)
      ? ['clinic-summary', 'province']
      : kind === 'facility' ? ['clinic-place-address', 'clinic-place-bookingcare-intro', 'clinic-place-summary'] : []
    const primaryText = primary.flatMap(name => textOf('[data-testid="' + name + '"]', 1))
    const address = kind === 'facility' ? primaryText[0] : textOf('[data-testid="province"]', 1)[0]
    locations = locationsIn(address ?? '')
    tags = textOf('[data-testid="breadcrumb-item-3"]', 1).filter(tag => tag !== title)
    const descriptions = textOf(description, 1)
    const related = kind === 'specialty' || (kind === 'service' && /-s\d+$/.test(url))
      ? textOf('[data-testid="clinic-title"]', 7) : []
    if (kind === 'specialty') locations = locationsIn(descriptions[0] ?? '')
    sections = tidy([
      ...primaryText, ...descriptions,
      ...(related.length ? ['Danh mục hiển thị: ' + related.join(' · ')] : []),
    ])
  }
  if (sections.length === 0) sections = ['Trang danh mục công khai: ' + title]
  return {
    url, kind, title, fetchedAt: new Date().toISOString(), tags, locations,
    sections: sections.flatMap(section => section.match(/[\s\S]{1,1100}(?=\s|$)|[\s\S]{1,1100}/g) ?? [])
      .map(value => value.trim()).filter(Boolean).slice(0, 35),
  }
}

const docs: Doc[] = []
const counts: Partial<Record<Kind, number>> = {}
async function visit(url: string, kind?: Kind) {
  try {
    const page = await fetchPage(url)
    if (!page) return
    const doc = inspect(page.html, page.url, kind ? kindOf(page.url) : undefined)
    if (doc) {
      docs.push(doc)
      counts[doc.kind] = (counts[doc.kind] ?? 0) + 1
      console.log(doc.kind, doc.url)
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('STOP ')) throw error
    console.warn('Skipped', url, error instanceof Error ? error.name : 'fetch error')
  }
}

for (const hub of hubs) await visit(origin + hub)
for (const kind of ['faq', 'specialty', 'service', 'facility', 'doctor'] as const) {
  for (const url of queue) {
    if ((counts[kind] ?? 0) >= quotas[kind] || visited.size >= 100) break
    if (kindOf(url) === kind) await visit(url, kind)
  }
}

if (!['faq', 'doctor', 'facility', 'service'].every(kind => docs.some(doc => doc.kind === kind)))
  throw new Error('Incomplete snapshot. Previous index retained.')
await mkdir('data', { recursive: true })
const snapshot = { collectedAt: new Date().toISOString(), docs }
const tempPath = 'data/bookingcare-' + process.pid + '.tmp'
await writeFile(tempPath, JSON.stringify(snapshot, null, 2))
await rename(tempPath, 'data/bookingcare.json')
console.log('Saved', docs.length, 'documents', counts)
