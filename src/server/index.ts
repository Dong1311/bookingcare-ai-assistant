import { once } from 'node:events'
import express from 'express'
import { z } from 'zod'
import { createAssistant } from './assistant.js'
import { loadSnapshot } from './knowledge.js'
import { Retriever, vectorsFor } from './retrieval.js'
import { apiKey, configuredChatReasoning } from './config.js'

const body = z.object({
  message: z.string().trim().min(1).max(900),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(1600),
  })).max(6).optional(),
  selectedId: z.string().max(300).optional(),
}).strict()
if (!apiKey) {
  console.error('Thiếu OPENAI_API_KEY. Tạo .env từ .env.example và điền key trước khi chạy.')
  process.exit(1)
}
if (process.argv.includes('--local')) throw new Error('Tùy chọn --local đã bị bỏ. Chạy npm run dev để bật hybrid RAG.')
const snapshot = await loadSnapshot()
const docs = snapshot.docs
const vectors = await vectorsFor(docs)
if (!vectors?.length) {
  throw new Error('Hybrid RAG requires an index matching the BookingCare snapshot. Run npm run embed to rebuild it.')
}
const answer = createAssistant(new Retriever(docs, vectors), 'model')
const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '20kb' }))
app.get('/api/health', (_req, res) => res.json({
  mode: 'model', documents: docs.length, collectedAt: snapshot.collectedAt,
  retrieval: 'hybrid',
  reasoningEffort: configuredChatReasoning(),
}))

let active = 0
app.post('/api/chat', async (req, res) => {
  const parsed = body.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Câu hỏi hoặc lịch sử hội thoại không hợp lệ.' })
    return
  }
  if (active >= 4) {
    res.status(429).json({ message: 'Trợ lý đang bận. Bạn thử lại sau vài giây nhé.' })
    return
  }
  active++
  const controller = new AbortController()
  res.on('close', () => controller.abort())
  res.set({
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  try {
    for await (const event of answer(parsed.data, controller.signal)) {
      if (controller.signal.aborted) break
      if (!res.write(JSON.stringify(event) + '\n'))
        await once(res, 'drain', { signal: controller.signal })
      if (event.type === 'done') console.log(JSON.stringify({ event: 'chat.turn', ...event.metrics }))
    }
  } catch {
    if (!controller.signal.aborted)
      res.write(JSON.stringify({ type: 'error', message: 'Tra cứu gặp lỗi. Bạn có thể thử lại.' }) + '\n')
  } finally {
    active--
    res.end()
  }
})

if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite')
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
} else {
  app.use(express.static('dist', { index: 'index.html' }))
}
app.use('/api', (_req, res) => res.status(404).json({ message: 'Không tìm thấy API.' }))
app.use((error: { status?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(error)
  const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500
  res.status(status).json({ message: status === 500 ? 'Tra cứu gặp lỗi.' : 'Dữ liệu gửi lên không hợp lệ.' })
})

const port = Number(process.env.PORT ?? 4173)
app.listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port + ' (hybrid RAG)'))
