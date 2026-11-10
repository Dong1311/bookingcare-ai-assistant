export type Kind = 'doctor' | 'facility' | 'specialty' | 'service' | 'faq'
export type Intent = 'emergency' | 'medical' | 'unsafe' | 'clarify' | 'faq' | 'search' | 'booking' | 'live'
export type Turn = { role: 'user' | 'assistant'; content: string }
export type ChatRequest = { message: string; history?: Turn[]; selectedId?: string }
export type Source = { id: string; number: number; title: string; url: string; kind: Kind; fetchedAt: string; excerpt: string }
export type Metrics = {
  latencyMs: number; firstTextMs: number | null; inputTokens: number | null;
  outputTokens: number | null; embeddingInputTokens: number | null; model: string | null;
  reasoningTokens: number | null;
  retrieval: 'lexical' | 'hybrid' | null;
  outcome: 'llm' | 'local' | 'policy' | 'fallback'; modelAttempted: boolean;
}
export type ChatEvent =
  | { type: 'start'; intent: Intent }
  | { type: 'delta'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'handoff'; url: string; label: string }
  | { type: 'done'; metrics: Metrics }
  | { type: 'error'; message: string }
