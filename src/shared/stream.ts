import type { ChatEvent, ChatRequest } from './protocol.js'

export async function* chat(url: string, body: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  })
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message ?? 'Không kết nối được với trợ lý.')
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let pending = ''
  let done = false
  try {
    for (;;) {
      const item = await reader.read()
      if (item.done) break
      const lines = (pending + item.value).split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line) as ChatEvent
        if (event.type === 'error') throw new Error(event.message)
        if (event.type === 'done') done = true
        yield event
      }
    }
    if (!done) throw new Error('Kết nối bị gián đoạn. Hãy thử lại.')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
