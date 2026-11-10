import { ChatOpenAI } from '@langchain/openai'

const modelPattern = /^gpt-5\.4(?:-mini|-nano)?(?:-2026-03-(?:05|17))?$/
export const apiKey = process.env.OPENAI_API_KEY?.trim()
export const embeddingModel = 'text-embedding-3-small'

export function configuredModel(env: 'CHAT_MODEL' | 'JUDGE_MODEL') {
  const model = process.env[env]?.trim() || (env === 'CHAT_MODEL' ? 'gpt-5.4-mini' : 'gpt-5.4')
  if (!modelPattern.test(model)) throw new Error(env + ' is outside the supported GPT-5.4 allowlist.')
  return model
}

export function configuredChatReasoning() {
  const effort = process.env.CHAT_REASONING_EFFORT?.trim() || 'none'
  if (effort !== 'none' && effort !== 'low' && effort !== 'medium')
    throw new Error('CHAT_REASONING_EFFORT must be none, low, or medium.')
  return effort
}

export function openAI(env: 'CHAT_MODEL' | 'JUDGE_MODEL', maxTokens: number) {
  if (!apiKey) throw new Error('Set OPENAI_API_KEY in the project .env.')
  return new ChatOpenAI({
    apiKey, model: configuredModel(env),
    reasoning: { effort: env === 'CHAT_MODEL' ? configuredChatReasoning() : 'none' },
    useResponsesApi: true, streamUsage: true, maxTokens, maxRetries: 0,
    modelKwargs: { store: false },
    timeout: env === 'CHAT_MODEL' ? 8800 : 25000,
    ...(env === 'JUDGE_MODEL' ? { temperature: 0 } : {}),
  })
}
