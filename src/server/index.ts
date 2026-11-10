import express from 'express'
import { apiKey } from './config.js'

if (!apiKey) {
  console.error('Thiếu OPENAI_API_KEY. Tạo .env từ .env.example và điền key trước khi chạy.')
  process.exit(1)
}
if (process.argv.includes('--local')) throw new Error('Tùy chọn --local đã bị bỏ. Chạy npm run dev để bật hybrid RAG.')

const { default: app } = await import('./app.js')
if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite')
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
} else {
  app.use(express.static('dist', { index: 'index.html' }))
}

const port = Number(process.env.PORT ?? 4173)
app.listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port + ' (hybrid RAG)'))
