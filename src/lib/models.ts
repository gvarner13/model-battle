export const MODELS = [
  {
    key: 'openai',
    id: 'openai/gpt-6-luna',
    name: 'GPT-6 Luna',
    provider: 'OpenAI',
    mark: 'O',
    color: 'green',
  },
  {
    key: 'anthropic',
    id: 'anthropic/claude-haiku-5.5',
    name: 'Claude Haiku 5.5',
    provider: 'Anthropic',
    mark: 'A',
    color: 'clay',
  },
  {
    key: 'google',
    id: 'google/gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'Google',
    mark: 'G',
    color: 'blue',
  },
] as const

export const CATEGORIES = ['animal', 'human', 'object'] as const
export type Category = (typeof CATEGORIES)[number]
export type ModelKey = (typeof MODELS)[number]['key'] | 'clairic'
export type Classification = {
  category: Category
  present: boolean | null
  confidence: number | null
}
export type ModelResult = {
  key: ModelKey
  status: 'success' | 'error'
  elapsedMs: number
  description?: string
  classifications?: Classification[]
  error?: string
}
export type AnalysisEvent = ModelResult | { done: true }
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
