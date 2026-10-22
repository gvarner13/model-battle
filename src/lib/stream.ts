import type { AnalysisEvent } from './models'

export async function readResults(
  response: Response,
  onEvent: (event: AnalysisEvent) => void,
): Promise<void> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'The comparison could not start. Please try again.')
  }
  if (!response.body) throw new Error('Your browser could not receive model results.')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let complete = false
  const parse = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line) as AnalysisEvent
    if ('done' in event) complete = true
    onEvent(event)
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let boundary: number
      while ((boundary = buffer.indexOf('\n')) !== -1) {
        parse(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 1)
      }
    }
    if (buffer.trim()) parse(buffer)
    if (!complete) throw new Error('The connection ended early. Please run the comparison again.')
  } finally {
    reader.releaseLock()
  }
}
