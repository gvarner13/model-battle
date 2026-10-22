import { bindings, defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'model-battle',
    entrypoint: './src/server.ts',
    compatibilityDate: '2026-10-21',
    compatibilityFlags: ['nodejs_compat'],
    env: {
      // Workers AI has no local emulator. Local comparisons call real models and incur usage.
      AI: bindings.ai({ dev: { remote: true } }),
      AI_GATEWAY_ID: bindings.text('default'),
      ANALYSIS_LIMITER: bindings.rateLimit({
        namespace: '1001',
        simple: { limit: 5, period: 60 },
      }),
    },
    observability: {
      enabled: true,
      logs: { enabled: true, headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
  },
})
