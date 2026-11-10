import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import { chat } from '../shared/stream.js'
import type { Intent, Source, Turn } from '../shared/protocol.js'
import './styles.css'

type IconName = 'cross' | 'doctor' | 'facility' | 'service' | 'calendar' | 'search' | 'external' | 'plus' | 'shield' | 'stop' | 'arrow'
const paths: Record<IconName, ReactNode> = {
  cross: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>,
  doctor: <><path d="M5 3v7a5 5 0 0 0 10 0V3M3 3h4m6 0h4m-7 12v2a4 4 0 0 0 8 0v-2"/><circle cx="18" cy="12" r="2.5"/></>,
  facility: <><path d="M3 21h18M6 21V4h12v17M9 4V2h6v2M10 21v-4h4v4M9 10h6m-3-3v6"/></>,
  service: <><path d="M8 4H5v17h14V4h-3M8 11h8m-8 5h8"/><rect x="8" y="2" width="8" height="5" rx="1"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-12 5 2 2 4-4"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>,
  external: <><path d="M13 5h6v6m0-6-8 8M10 6H5v13h13v-5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  shield: <><path d="m12 22 1-.5C18 19 21 16 21 11V5l-9-3-9 3v6c0 5 3 8 8 10.5z"/><path d="m8 12 2.5 2.5L16 9"/></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2"/>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
}
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

const suggestions: { icon: IconName; title: string; detail: string; question: string }[] = [
  { icon: 'doctor', title: 'Tìm bác sĩ', detail: 'Bác sĩ da liễu ở Hà Nội', question: 'Tìm bác sĩ da liễu ở Hà Nội' },
  { icon: 'facility', title: 'Tìm cơ sở y tế', detail: 'Phòng khám Bệnh viện Đại học Y Dược 1', question: 'Tìm Phòng khám Bệnh viện Đại học Y Dược 1' },
  { icon: 'service', title: 'Tìm gói khám', detail: 'Gói khám sức khỏe tổng quát', question: 'Gợi ý gói khám sức khỏe tổng quát' },
  { icon: 'calendar', title: 'Hỏi cách đặt khám', detail: 'Các bước đặt lịch trên BookingCare', question: 'Hướng dẫn đặt lịch khám trên BookingCare' },
]
const labels: Record<Source['kind'], string> = { doctor: 'Bác sĩ', facility: 'Cơ sở y tế', specialty: 'Chuyên khoa', service: 'Dịch vụ', faq: 'Hướng dẫn' }
type Message = Turn & {
  id: number; sources?: Source[]; handoff?: { url: string; label: string }; intent?: Intent;
  finished?: boolean; error?: string;
}
type Health = { documents: number }

function CitedText({ message }: { message: Message }) {
  return <div className="reply-text">{message.content.split(/(\[\d+\])/).map((part, i) => {
    const n = /^\[(\d+)\]$/.exec(part)
    const source = n && message.sources?.find(item => item.number === Number(n[1]))
    return source
      ? <a key={i} className="citation" href={source.url} target="_blank" rel="noreferrer" aria-label={'Nguồn ' + source.number + ': ' + source.title}>{source.number}</a>
      : part
  })}</div>
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [health, setHealth] = useState<Health>()
  const [healthError, setHealthError] = useState(false)
  const seq = useRef(0)
  const active = useRef<AbortController | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error()
      return response.json() as Promise<Health>
    }).then(setHealth).catch(() => { if (!controller.signal.aborted) setHealthError(true) })
    return () => controller.abort()
  }, [])

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages])

  async function send(text: string, selectedId?: string) {
    const message = text.trim()
    if (!message || active.current) return
    const history = messages.filter(m => m.role === 'user' || m.finished && !m.error && m.content)
      .slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 1600) }))
    const id = ++seq.current
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setInput('')
    setMessages(previous => [...previous, { id: -id, role: 'user', content: message }, { id, role: 'assistant', content: '' }])
    const update = (change: (m: Message) => Message) => setMessages(previous => previous.map(m => m.id === id ? change(m) : m))
    try {
      for await (const event of chat('/api/chat', { message, history, selectedId }, controller.signal)) {
        if (event.type === 'start') update(m => ({ ...m, intent: event.intent }))
        if (event.type === 'delta') update(m => ({ ...m, content: m.content + event.text }))
        if (event.type === 'sources') update(m => ({ ...m, sources: event.sources }))
        if (event.type === 'handoff') update(m => ({ ...m, handoff: { url: event.url, label: event.label } }))
        if (event.type === 'done') update(m => ({ ...m, finished: true }))
      }
    } catch (error) {
      update(m => ({ ...m, finished: true, error: controller.signal.aborted
        ? 'Đã dừng trả lời.' : error instanceof Error ? error.message : 'Đã có lỗi. Hãy thử lại.' }))
    } finally {
      if (active.current === controller) {
        active.current = null
        setBusy(false)
      }
    }
  }

  function reset() {
    active.current?.abort()
    active.current = null
    setBusy(false)
    setMessages([])
    setInput('')
    composer.current?.focus()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void send(input)
  }

  const modeText = healthError ? 'Mất kết nối' : !health ? 'Đang kết nối' : !health.documents
    ? 'Chưa có dữ liệu' : 'Trả lời bằng AI'
  const hasConversation = messages.length > 0
  return <div className="shell">
    <header className="top">
      <div className="top-inner">
        <div className="brand"><span className="brand-icon"><Icon name="cross" size={19}/></span><span>Trợ lý đi khám</span></div>
        <div className="top-actions">
          <span className={'status' + (healthError || (health && !health.documents) ? ' unavailable' : '')} role="status">{modeText}</span>
          {hasConversation && <button className="new" onClick={reset} aria-label="Tra cứu mới" title="Tra cứu mới"><Icon name="plus" size={18}/><span>Tra cứu mới</span></button>}
        </div>
      </div>
    </header>
    <main className={hasConversation ? 'main conversation' : 'main'}>
      {!hasConversation && <div className="welcome">
        <h1>Tìm nơi khám phù hợp</h1>
        <p>Tra cứu bác sĩ, cơ sở y tế và gói khám từ thông tin công khai trên BookingCare.</p>
      </div>}
      {hasConversation && <div className="thread" role="log" aria-label="Cuộc trò chuyện">
        {messages.map(m => m.role === 'user' ? <div key={m.id} className="user"><div>{m.content}</div></div> :
          <article key={m.id} className={'assistant ' + (m.intent === 'emergency' ? 'urgent' : '')}>
            <div className="reply-label">{m.intent === 'emergency' && <Icon name="shield" size={17}/>}
              {m.intent === 'emergency' ? 'Hướng dẫn cấp cứu' : 'Trợ lý đi khám'}</div>
            {!m.content && !m.error ? <div className="typing">Đang tra cứu…</div> : <CitedText message={m}/>}
            {m.error && <p className="error" role="status">{m.error}</p>}
            {m.handoff && <a className="handoff" href={m.handoff.url} target="_blank" rel="noreferrer">{m.handoff.label}<Icon name="external" size={16}/></a>}
            {!!m.sources?.length && <div className="sources">
              <h2>Nguồn BookingCare</h2>
              {m.sources.map(source => <div className="source" key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <span className="number">{source.number}</span><span><small>{labels[source.kind]}</small><strong>{source.title}</strong></span><Icon name="external" size={15}/>
                </a>
                {source.kind !== 'faq' && !m.handoff && <button disabled={busy} onClick={() => void send('Đặt lịch với ' + source.title, source.id)}><Icon name="calendar" size={15}/> Xem đặt khám</button>}
              </div>)}
            </div>}
          </article>)}
        <div className="thread-end" ref={bottom}/>
      </div>}
      <div className="compose">
        <form onSubmit={submit}>
          <label htmlFor="question" className="sr-only">Câu hỏi của bạn</label>
          {!hasConversation && <span className="search-icon"><Icon name="search" size={21}/></span>}
          <textarea id="question" ref={composer} value={input} rows={1} maxLength={900} aria-describedby="search-note"
            placeholder={hasConversation ? 'Nhập câu hỏi tiếp theo…' : 'Ví dụ: Bác sĩ da liễu ở Hà Nội'}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input) } }}/>
          {busy ? <button type="button" className="send" onClick={() => active.current?.abort()} aria-label="Dừng trả lời"><Icon name="stop" size={16}/> Dừng</button>
            : <button className="send" type="submit" disabled={!input.trim()}>{hasConversation ? 'Gửi' : 'Tra cứu'}</button>}
        </form>
        <p id="search-note">Chỉ hỗ trợ tra cứu. Vui lòng không nhập hồ sơ y tế hoặc số điện thoại.</p>
      </div>
      {!hasConversation && <section className="quick-search" aria-labelledby="quick-search-title">
        <h2 id="quick-search-title">Tra cứu nhanh</h2>
        <ul className="suggestions">{suggestions.map(item => <li key={item.title}>
          <button className="suggestion" onClick={() => void send(item.question)}>
            <Icon name={item.icon} size={22}/><span><strong>{item.title}</strong><small>{item.detail}</small></span><Icon name="arrow" size={17}/>
          </button>
        </li>)}</ul>
      </section>}
    </main>
    {!hasConversation && <footer className="site-footer">Thông tin dùng để tham khảo khi chọn nơi khám.</footer>}
  </div>
}
createRoot(document.getElementById('root')!).render(<App />)
