import handler from '@tanstack/react-start/server-entry'
import { handleAnalyze } from './server/analyze'

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/analyze') {
      return handleAnalyze(request, {
        run: (model, input, options) => env.AI.run(model, input, options),
        limit: (key) => env.ANALYSIS_LIMITER.limit({ key }),
        gatewayId: env.AI_GATEWAY_ID,
      })
    }
    return handler.fetch(request)
  },
} satisfies ExportedHandler<Env>
