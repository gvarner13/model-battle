# Model Battle

A small, full-stack image comparison app built with **TanStack Start**, **React**, and **Cloudflare Workers**. Upload one photo, get three independent descriptions and one typed classification. Results arrive as each model finishes—no mock responses, silent substitutions, or automatic “winner.”

## Models

| Model                        | Role                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `openai/gpt-6-luna`          | Describe the photo                                                             |
| `anthropic/claude-haiku-5.5` | Describe the photo                                                             |
| `google/gemini-3.8-flash`    | Describe the photo                                                             |
| `@cf/cloudflare/clairic`     | Independently detect animal, human, and object, with model-reported confidence |

Categories can overlap: a person holding a dog can include both humans and animals. “Object” means a non-living physical item. Confidence is confidence **in the returned answer**, including a negative detection, not necessarily the probability that a category is present. Clairic is a preview model.

## Run locally

Requires Node.js **22.18+**, npm, and a Cloudflare account with access to these models and AI Gateway billing configured.

```sh
npm ci
npx cf auth login
npm run dev
```

Open **http://localhost:3000**.

**Local inference is real and billable.** The AI binding uses `dev.remote: true`, because Workers AI has no local inference emulator. Each comparison makes four calls. The included sample photo is only sent to the models when you click **Compare perspectives**.

### AI Gateway setup

All four models use `env.AI.run(model, input, { gateway: { id } })`, with the provider-native image formats documented by Cloudflare. No provider API keys or Cloudflare tokens are sent to the browser or embedded in the app.

- The gateway defaults to **`default`**, which Cloudflare can create on first use. Change `AI_GATEWAY_ID` in `cloudflare.config.ts` to use an existing gateway in the same account.
- Set up [AI Gateway Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) with sufficient credits for third-party inference, or use supported [BYOK](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/) configuration. On the binding path, BYOK uses the provider key’s `default` alias; non-default aliases require provider-native REST endpoints instead.
- Keep runtime credentials out of client code. Local remote bindings use your CLI authentication; deployed Workers use the AI binding.
- AI Gateway cache and content-log collection are disabled per request. Gateway usage analytics and Worker operational logs may still exist.

A model’s failure is isolated to its own card. Billing, rate-limit, and access errors show actionable messages; one failed model does not hide successful results.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run format:check
```

Tests mock model inference and do not incur AI charges. They cover upload size/signature checks, origin checks, rate limiting, native provider formats, classifier uncertainty, parallel execution, streaming, and partial failures. A live sample-photo test also succeeded against all four requested model IDs during development.

## Deploy

```sh
npm run deploy
```

This uses the **cf CLI** and `cloudflare.config.ts` with the Cloudflare Vite plugin 2 beta, not Wrangler. Commit `package-lock.json` and use `npm ci` for reproducible installs. The checked-in configuration enables Workers Logs and sampled traces.

**Before public deployment:** protect the app with authentication or Cloudflare Access, configure gateway budget/spend controls, and consider Turnstile for public access. The built-in rate limiter permits five comparisons per minute per IP **per Cloudflare location**, not a global quota or authentication boundary. An `Origin` check prevents normal cross-site browser calls but is not an authentication mechanism. Anyone who can use an unprotected deployment can incur inference charges.

No deployment is performed automatically while building or testing.

## Uploads and privacy

- Accepts JPEG, PNG, and WebP uploads up to 20 MB in the browser.
- Re-encodes the image to JPEG, strips original metadata, and limits its longest edge to 1,600 pixels before uploading. Transparent areas become white.
- The Worker limits the streamed body to **4 MiB**, verifies the declared image type against its signature, and rejects unsupported or oversized uploads before inference.
- The app uses no database, R2 bucket, image history, or persistent photo storage. Images are held in memory for the comparison; original filenames are not sent to the API.
- Images are sent to Cloudflare and the three upstream providers. Their retention and data-processing terms still apply; do not upload sensitive photos without understanding those policies.
- Each inference has a 45-second timeout signal. Timings include provider and network latency; this is not a controlled speed benchmark.

## Code map

- `src/routes/index.tsx` — upload, preview, streamed results, and classification UI
- `src/lib/image.ts` — browser-side image normalization
- `src/lib/stream.ts` — incremental NDJSON reader
- `src/lib/models.ts` — model IDs and shared result types
- `src/server.ts` — Worker entrypoint; delegates pages to TanStack Start
- `src/server/analyze.ts` — validation, rate limiting, parallel inference, and response normalization
- `cloudflare.config.ts` — AI binding, gateway ID, rate limiter, and observability

## References

- [Cloudflare AI model catalog](https://developers.cloudflare.com/ai/models/)
- [AI binding with AI Gateway](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/)
- [Clairic image and typed-field schema](https://developers.cloudflare.com/workers-ai/models/clairic/)
- [TanStack Start on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [cf project configuration](https://developers.cloudflare.com/cf/projects/cloudflare-config/)

Sample cat photo: [Unsplash source image](https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba), served locally from `public/examples/cat.jpg` under the [Unsplash license](https://unsplash.com/license). Typography: DM Sans and Instrument Serif via Google Fonts.
