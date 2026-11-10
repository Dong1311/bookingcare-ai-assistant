import { writeFile, rename } from 'node:fs/promises'
import { OpenAIEmbeddings } from '@langchain/openai'
import { apiKey, embeddingModel } from '../src/server/config.js'
import { loadSnapshot } from '../src/server/knowledge.js'
import { embeddingText, signature } from '../src/server/retrieval.js'

if (!apiKey) throw new Error('Set OPENAI_API_KEY in .env before creating the optional vector index.')
const { docs } = await loadSnapshot()
const embeddings = new OpenAIEmbeddings({ apiKey, model: embeddingModel, dimensions: 512, batchSize: 32, maxRetries: 1 })
const vectors = await embeddings.embedDocuments(docs.map(embeddingText))
const tempPath = 'data/vectors-' + process.pid + '.tmp'
await writeFile(tempPath, JSON.stringify({ digest: signature(docs), model: embeddingModel, vectors }))
await rename(tempPath, 'data/vectors.json')
console.log('Indexed', vectors.length, 'documents')
