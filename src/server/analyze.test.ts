import { describe, expect, it, vi } from 'vitest'
import {
  extractClassifications,
  extractText,
  handleAnalyze,
  imageType,
  modelInput,
  readImage,
} from './analyze'
import type { Services } from './analyze'
import { MAX_IMAGE_BYTES } from '../lib/models'

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])
function request(body: BodyInit = jpeg, extra: RequestInit = {}) {
  return new Request('https://arena.example/api/analyze', {
    method: 'POST',
    headers: { Origin: 'https://arena.example', 'Content-Type': 'image/jpeg' },
    body,
    ...extra,
  })
}
const responses: Record<string, unknown> = {
  'openai/gpt-6-luna': {
    output: [{ type: 'message', content: [{ type: 'output_text', text: 'A cat on a ledge.' }] }],
  },
  'anthropic/claude-haiku-5.5': { content: [{ type: 'text', text: 'A black and white cat.' }] },
  'google/gemini-3.8-flash': {
    candidates: [{ content: { parts: [{ text: 'A cat with green eyes.' }] } }],
  },
  '@cf/cloudflare/clairic': {
    answers: {
      animal: { value: 1, confidence: 0.99 },
      human: { value: 0, confidence: 0.98 },
      object: { value: 1, confidence: 0.8 },
    },
    truncated: false,
  },
}
function services(): Services {
  return {
    gatewayId: 'test-gateway',
    limit: vi.fn(async () => ({ success: true })),
    run: vi.fn(async (model) => responses[model]),
  }
}

async function events(response: Response) {
  return (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
}

describe('image upload validation', () => {
  it('recognizes all supported signatures', () => {
    expect(imageType(jpeg)).toBe('image/jpeg')
    expect(imageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png')
    expect(imageType(new TextEncoder().encode('RIFF0000WEBP'))).toBe('image/webp')
    expect(imageType(new TextEncoder().encode('<script>'))).toBeNull()
  })
  it('accepts matching JPEG bytes', async () => {
    const image = await readImage(request())
    expect(image.type).toBe('image/jpeg')
    expect(image.bytes).toEqual(jpeg)
  })
  it('rejects a file masquerading as an image', async () => {
    await expect(readImage(request('<svg />'))).rejects.toMatchObject({ status: 415 })
  })
  it('rejects an empty image', async () => {
    await expect(readImage(request(new Uint8Array()))).rejects.toMatchObject({ status: 415 })
  })
  it('rejects a declared oversize upload before reading', async () => {
    await expect(
      readImage(
        request(jpeg, {
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(MAX_IMAGE_BYTES + 1) },
        }),
      ),
    ).rejects.toMatchObject({ status: 413 })
  })
  it('enforces the limit even without Content-Length', async () => {
    await expect(readImage(request(new Uint8Array(MAX_IMAGE_BYTES + 1)))).rejects.toMatchObject({
      status: 413,
    })
  })
  it('rejects unsupported MIME types', async () => {
    await expect(
      readImage(request(jpeg, { headers: { 'Content-Type': 'image/svg+xml' } })),
    ).rejects.toMatchObject({ status: 415 })
  })
})

describe('provider response normalization', () => {
  it('reads the three native response formats', () => {
    expect(extractText('openai', responses['openai/gpt-6-luna'])).toContain('cat')
    expect(extractText('anthropic', responses['anthropic/claude-haiku-5.5'])).toContain('cat')
    expect(extractText('google', responses['google/gemini-3.8-flash'])).toContain('cat')
  })
  it('also reads compatible chat completions', () => {
    expect(extractText('openai', { choices: [{ message: { content: 'A camera.' } }] })).toBe(
      'A camera.',
    )
    expect(extractText('google', { choices: [{ message: { content: 'A camera.' } }] })).toBe(
      'A camera.',
    )
  })
  it('does not display thinking blocks', () => {
    expect(
      extractText('google', {
        candidates: [
          {
            content: { parts: [{ thought: true, text: 'private reasoning' }, { text: 'A cat.' }] },
          },
        ],
      }),
    ).toBe('A cat.')
    expect(
      extractText('anthropic', {
        content: [
          { type: 'thinking', thinking: 'private' },
          { type: 'text', text: 'A cat.' },
        ],
      }),
    ).toBe('A cat.')
  })
  it('fails on missing descriptions instead of inventing results', () => {
    expect(() => extractText('openai', {})).toThrow('no description')
  })
  it('allows overlapping categories and preserves confidence', () => {
    expect(extractClassifications(responses['@cf/cloudflare/clairic'])).toEqual([
      { category: 'animal', present: true, confidence: 0.99 },
      { category: 'human', present: false, confidence: 0.98 },
      { category: 'object', present: true, confidence: 0.8 },
    ])
  })
  it('preserves uncertainty without fabricated confidence', () => {
    const data = extractClassifications({
      answers: { animal: { value: null, confidence: 2 }, human: { value: 8 } },
    })
    expect(data.every((item) => item.present === null && item.confidence === null)).toBe(true)
  })
  it('rejects truncated classifier results', () => {
    expect(() => extractClassifications({ answers: {}, truncated: true })).toThrow('incomplete')
  })
  it('uses embedded images with the documented Clairic fields', () => {
    const data = modelInput('clairic', 'data:image/jpeg;base64,AA==', 'AA==', 'image/jpeg')
    expect(data.images).toEqual(['data:image/jpeg;base64,AA=='])
    expect(data.model).toBe('clairic')
    expect(Object.keys(data.fields as object)).toEqual(['animal', 'human', 'object'])
  })
})

describe('analysis API', () => {
  it('only allows POST', async () => {
    const api = services()
    const response = await handleAnalyze(new Request('https://arena.example/api/analyze'), api)
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(api.run).not.toHaveBeenCalled()
  })
  it('rejects cross-origin and missing-origin calls', async () => {
    const api = services()
    for (const origin of ['https://other.example', '']) {
      expect(
        (await handleAnalyze(request(jpeg, { headers: { Origin: origin } }), api)).status,
      ).toBe(403)
    }
    expect(api.run).not.toHaveBeenCalled()
  })
  it('rate limits before invoking models', async () => {
    const api = services()
    api.limit = vi.fn(async () => ({ success: false }))
    const response = await handleAnalyze(request(), api)
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(api.run).not.toHaveBeenCalled()
  })
  it('rejects invalid images without inference', async () => {
    const api = services()
    expect((await handleAnalyze(request('not an image'), api)).status).toBe(415)
    expect(api.run).not.toHaveBeenCalled()
  })
  it('streams all four independent results and disables content logging/cache', async () => {
    const api = services()
    const response = await handleAnalyze(request(), api)
    expect(response.headers.get('content-type')).toBe('application/x-ndjson')
    expect(response.headers.get('cache-control')).toBe('no-store')
    const result = await events(response)
    expect(result).toHaveLength(5)
    expect(result.slice(0, 4).every((item) => item.status === 'success')).toBe(true)
    expect(result.at(-1)).toEqual({ done: true })
    expect(api.run).toHaveBeenCalledTimes(4)
    for (const call of vi.mocked(api.run).mock.calls) {
      expect(call[2].gateway).toEqual({ id: 'test-gateway', skipCache: true, collectLog: false })
      expect(call[2].signal).toBeInstanceOf(AbortSignal)
    }
  })
  it('starts all models concurrently and emits the faster result first', async () => {
    const api = services()
    let finishOpenAI!: (value: unknown) => void
    api.run = vi.fn((model) =>
      model === 'openai/gpt-6-luna'
        ? new Promise((resolve) => {
            finishOpenAI = resolve
          })
        : Promise.resolve(responses[model]),
    )
    const response = await handleAnalyze(request(), api)
    expect(api.run).toHaveBeenCalledTimes(4)
    const reader = response.body!.getReader()
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toContain('"key":"anthropic"')
    finishOpenAI(responses['openai/gpt-6-luna'])
    while (!(await reader.read()).done) {
      /* Drain the stream. */
    }
  })
  it('isolates provider failures and never returns raw errors', async () => {
    const api = services()
    api.run = vi.fn(async (model) => {
      if (model.startsWith('anthropic/')) throw new Error('sensitive-provider-debug-string')
      return responses[model]
    })
    const result = await events(await handleAnalyze(request(), api))
    expect(result.filter((item) => item.status === 'success')).toHaveLength(3)
    expect(result.find((item) => item.key === 'anthropic').status).toBe('error')
    expect(JSON.stringify(result)).not.toContain('sensitive-provider-debug-string')
  })
  it('maps credit failures to actionable errors', async () => {
    const api = services()
    api.run = vi.fn(async () => {
      throw new Error('Insufficient credits')
    })
    const result = await events(await handleAnalyze(request(), api))
    expect(result[0].error).toContain('billing')
  })
})
