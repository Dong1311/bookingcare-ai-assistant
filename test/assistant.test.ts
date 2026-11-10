import test from 'node:test'
import assert from 'node:assert/strict'
import { AIMessage } from '@langchain/core/messages'
import type { ChatEvent, ChatRequest } from '../src/shared/protocol.js'
import { bookingSearch, canonical, termsUrl, type Doc } from '../src/server/knowledge.js'
import { redact } from '../src/server/policy.js'

process.env.OPENAI_API_KEY = 'fixture-key'
const { createAssistant } = await import('../src/server/assistant.js')
const { Retriever } = await import('../src/server/retrieval.js')
const { createJudge, criteria } = await import('../eval/judge.js')
const fetchedAt = '2026-11-09T00:00:00.000Z'
const facility = 'https://bookingcare.vn/co-so-y-te/benh-vien-minh-hoa-p1'
const remote = 'https://bookingcare.vn/dich-vu-y-te/kham-tu-xa/bac-si-tieu-hoa-tu-xa-s48'
const docs: Doc[] = [
  { url: facility, title: 'Bệnh viện Minh Họa', kind: 'facility', locations: ['ha noi'], tags: [],
    fetchedAt, sections: ['Địa chỉ minh họa tại Hà Nội.'] },
  { url: termsUrl, title: 'Điều khoản sử dụng', kind: 'faq', locations: [], tags: [],
    fetchedAt, sections: ['Chính sách minh họa.'] },
  { url: remote, title: 'Bác sĩ Tiêu hóa từ xa', kind: 'service', locations: [], tags: [],
    fetchedAt, sections: ['Danh mục tư vấn Tiêu hóa từ xa.'] },
]
const retriever = new Retriever(docs)

async function collect(answer: ReturnType<typeof createAssistant>, request: ChatRequest) {
  const events: ChatEvent[] = []
  for await (const event of answer(request)) events.push(event)
  return events
}

test('emergency overrides booking and provides an official source', async () => {
  const events = await collect(createAssistant(retriever, 'local'), { message: 'Bố tôi bất tỉnh, đặt lịch khám giúp' })
  assert.deepEqual(events.map(event => event.type), ['start', 'sources', 'delta', 'done'])
  assert.deepEqual(events[0], { type: 'start', intent: 'emergency' })
  assert.ok(events.some(event => event.type === 'delta' && event.text.includes('115')))
})

test('never accepts a user-supplied destination for booking', async () => {
  const events = await collect(createAssistant(retriever, 'local'), {
    message: 'Đặt lịch cho tôi', selectedId: 'https://invalid.example/visit',
  })
  assert.equal(events.find(event => event.type === 'handoff')?.url, bookingSearch)
  assert.equal(canonical('https://bookingcare.vn.invalid.example/'), null)
})

test('valid booking selection hands off with an explicit no-booking status', async () => {
  const events = await collect(createAssistant(retriever, 'local'), {
    message: 'Đặt lịch với Bệnh viện Minh Họa', selectedId: facility,
  })
  assert.equal(events.find(event => event.type === 'handoff')?.url, facility)
  assert.ok(events.some(event => event.type === 'delta' && event.text.includes('Chưa có lịch hẹn')))
})

test('remote specialty and strict city filtering', async () => {
  const answer = createAssistant(retriever, 'local')
  const events = await collect(answer, { message: 'Tìm dịch vụ khám tiêu hóa từ xa' })
  assert.equal(events.find(event => event.type === 'sources')?.sources[0].url, remote)
  const wrongCity = await collect(answer, { message: 'Tìm Bệnh viện Minh Họa ở Đà Nẵng' })
  assert.ok(!wrongCity.some(event => event.type === 'sources'))
})

test('redaction covers common contact and identifier formats', () => {
  assert.equal(redact('demo@example.test, +84 900 111 222, 123456789012'),
    '[đã ẩn email], [đã ẩn số điện thoại], [đã ẩn mã cá nhân]')
})

test('Responses stream drops invalid claims and records provider usage', async t => {
  const fakeResponse = {
    id: 'resp_fixture', model: 'gpt-5.4-mini', status: 'completed', output: [],
    usage: { input_tokens: 135, output_tokens: 29, total_tokens: 164 },
  }
  const content = [
    { type: 'response.created', response: fakeResponse },
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'Có thể xem Bệnh viện Minh Họa ' },
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: '[1]\nGiá 300000 đồng [1]\nNguồn giả [9]' },
    { type: 'response.completed', response: fakeResponse },
  ].map(event => 'event: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n').join('')
  const fetch = t.mock.method(globalThis, 'fetch', async (url: URL | string, options: RequestInit) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses')
    const payload = JSON.parse(String(options.body))
    assert.equal(payload.reasoning.effort, 'none')
    assert.equal(payload.max_output_tokens, 420)
    assert.equal(payload.store, false)
    assert.doesNotMatch(JSON.stringify(payload.input), /demo@example\.test/)
    return new Response(content, { headers: { 'Content-Type': 'text/event-stream' } })
  })
  const events = await collect(createAssistant(retriever, 'model'), {
    message: 'Tìm Bệnh viện Minh Họa. demo@example.test',
  })
  assert.equal(fetch.mock.callCount(), 1)
  assert.deepEqual(events.filter(event => event.type === 'delta').map(event => event.text),
    ['Có thể xem Bệnh viện Minh Họa [1]'])
  const metrics = events.find(event => event.type === 'done')!.metrics
  assert.equal(metrics.outcome, 'llm')
  assert.equal(metrics.inputTokens, 135)
  assert.equal(metrics.outputTokens, 29)
})

test('provider failure keeps the cited fallback and does not invent usage', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":{"message":"fixture error"}}', {
    status: 503, headers: { 'Content-Type': 'application/json' },
  }))
  const events = await collect(createAssistant(retriever, 'model'), { message: 'Tìm Bệnh viện Minh Họa' })
  assert.ok(events.some(event => event.type === 'delta' && event.text.includes('Minh Họa [1]')))
  const metrics = events.find(event => event.type === 'done')!.metrics
  assert.equal(metrics.outcome, 'fallback')
  assert.equal(metrics.inputTokens, null)
  assert.equal(metrics.outputTokens, null)
})

test('judge sends a strict schema and retains parsed and raw results', async t => {
  const grade = { scores: Object.fromEntries(criteria.map(name => [name, 3])), reason: 'Fixture' }
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: URL | string, options: RequestInit) => {
    const payload = JSON.parse(String(options.body))
    assert.equal(payload.temperature, 0)
    assert.equal(payload.reasoning.effort, 'none')
    assert.equal(payload.text.format.strict, true)
    assert.equal(payload.text.format.name, 'bookingcare_grade')
    return Response.json({
      id: 'resp_fixture', model: 'gpt-5.4', status: 'completed',
      output: [{ id: 'msg_fixture', type: 'message', role: 'assistant',
        content: [{ type: 'output_text', text: JSON.stringify(grade), annotations: [] }] }],
      usage: { input_tokens: 95, output_tokens: 35, total_tokens: 130 },
    })
  })
  const result = await createJudge().invoke('Judge fixture')
  assert.equal(fetch.mock.callCount(), 1)
  assert.deepEqual(result.parsed, grade)
  assert.ok(result.raw instanceof AIMessage)
  assert.equal(result.raw.usage_metadata?.input_tokens, 95)
})
