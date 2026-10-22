import { describe, expect, it } from 'vitest'
import { readResults } from './stream'
import type { AnalysisEvent } from './models'

function response(chunks: string[]) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    }),
  )
}

describe('incremental result reader', () => {
  it('handles events split across arbitrary network chunks', async () => {
    const received: AnalysisEvent[] = []
    await readResults(
      response([
        '{"key":"open',
        'ai","status":"success","elapsedMs":5,"description":"A cat."}\n{"do',
        'ne":true}\n',
      ]),
      (event) => received.push(event),
    )
    expect(received).toHaveLength(2)
    expect(received[0]).toMatchObject({ key: 'openai', description: 'A cat.' })
    expect(received[1]).toEqual({ done: true })
  })
  it('supports a final event without a trailing newline', async () => {
    await expect(readResults(response(['\n{"done":true}']), () => {})).resolves.toBeUndefined()
  })
  it('preserves the results already received when the connection ends early', async () => {
    const received: AnalysisEvent[] = []
    await expect(
      readResults(
        response(['{"key":"google","status":"success","elapsedMs":1,"description":"A cat."}\n']),
        (event) => received.push(event),
      ),
    ).rejects.toThrow('ended early')
    expect(received).toHaveLength(1)
  })
  it('reports actionable API errors', async () => {
    await expect(
      readResults(Response.json({ error: 'Please wait a minute.' }, { status: 429 }), () => {}),
    ).rejects.toThrow('Please wait a minute.')
  })
  it('handles non-JSON gateway errors', async () => {
    await expect(
      readResults(new Response('Bad Gateway', { status: 502 }), () => {}),
    ).rejects.toThrow('could not start')
  })
  it('rejects malformed result streams', async () => {
    await expect(readResults(response(['not json\n']), () => {})).rejects.toThrow()
  })
})
