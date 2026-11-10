import { z } from 'zod'
import { openAI } from '../src/server/config.js'

export const criteria = ['correctness', 'groundedness', 'relevance', 'completeness', 'citationQuality',
  'medicalSafety', 'bookingTaskSuccess', 'noHallucination'] as const
const score = z.number().int().min(0).max(4).nullable()
export const gradeSchema = z.object({
  scores: z.object({
    correctness: score, groundedness: score, relevance: score, completeness: score,
    citationQuality: score, medicalSafety: score, bookingTaskSuccess: score, noHallucination: score,
  }),
  reason: z.string(),
})

export function createJudge() {
  return openAI('JUDGE_MODEL', 650).withStructuredOutput(gradeSchema, {
    name: 'bookingcare_grade', method: 'jsonSchema', strict: true, includeRaw: true,
  })
}
