# GOAT UGC AI

**SaaS AI content studio for apps and agencies.**
Generate images, videos, lip-sync clips and cinematic UGC with a pluggable provider layer — cloud on Vercel with **fal.ai**, shared with **Muapi.ai** (BYOK), or fully self-hosted against your own local models.

Built on top of the excellent [Open Generative AI](https://github.com/Anil-matcha/Open-Generative-AI) studio (by [@Anil-matcha](https://github.com/Anil-matcha)) and its sibling projects — `Vibe-Workflow` and `Open-Poe-AI`. We keep their studio intact and layer a SaaS shell + provider abstraction on top so app founders and agencies can ship production content without stitching tooling together.

---

## What's inside

| Surface | Route | Powered by |
|---|---|---|
| Marketing landing | `/` | Native |
| SaaS dashboard | `/dashboard` | Native |
| Projects / brand kits | `/dashboard/projects` | Native |
| Quick create | `/create` | Provider-abstracted (fal / muapi / local) |
| Pro Studio (image, video, lipsync, cinema, workflows, agents) | `/studio` | Muapi.ai (the full Open Generative AI experience) |

Under the hood:

- **Provider abstraction** (`lib/providers/`) — unified `generateImage()` / `generateVideo()` that dispatches to fal.ai, Muapi.ai or a local inference server based on `AI_PROVIDER`.
- **SaaS shell** (`app/dashboard`, `app/create`, `components/SaasNav.js`) — landing, project management, quick create, history.
- **Legacy studio** (`components/StandaloneShell.js`, `packages/studio`) — untouched; the original Higgsfield-class studio from Open Generative AI, proxied through Next.js to Muapi.
- **Shared cloud key injection** — muapi proxies fall back to `MUAPI_KEY` from env when a user hasn't brought their own.

---

## Quick start (cloud — fal.ai)

```bash
cp .env.example .env.local
# Set AI_PROVIDER=fal and add your FAL_KEY
npm install
npm run setup   # builds the vendored studio / workflow / agent packages
npm run dev     # http://localhost:3000
```

Landing at `/`, dashboard at `/dashboard`, quick generator at `/create`.

### Deploying to Vercel

1. Push this repo to GitHub (already pushed to `goatstarter/goat-ugc-ai`).
2. `vercel link` then `vercel env add FAL_KEY` (production + preview).
3. Set `AI_PROVIDER=fal`.
4. `vercel deploy --prod`.

Because the studio package needs a small Babel build step, the repo ships a `postinstall` (and a `vercel-build` script) that runs `npm run build:packages` before Next builds.

---

## Quick start (self-host — local models)

Ideal for regulated industries, heavy agencies, or anyone who wants zero vendor lock-in.

```bash
# Run your local inference server (Ollama, ComfyUI, sd.cpp, or any HTTP endpoint
# that exposes POST /generate and returns { url }).
# Point the app at it:

AI_PROVIDER=local LOCAL_INFERENCE_URL=http://127.0.0.1:7860 npm run dev
```

Adapt `lib/providers/local.js` to your runtime's exact request/response shape — it's deliberately small so you can read it top-to-bottom.

---

## Environment variables

| Var | Purpose |
|---|---|
| `AI_PROVIDER` | `fal` \| `muapi` \| `local`. Omit to auto-detect from whichever key is set. |
| `FAL_KEY` | fal.ai API key (for cloud SaaS). |
| `MUAPI_KEY` | Muapi.ai API key. Optional — enables server-side shared access for the Pro Studio. |
| `LOCAL_INFERENCE_URL` | Base URL of your local inference server when `AI_PROVIDER=local`. |

See `.env.example`.

---

## Architecture at a glance

```
app/
├── page.js                 landing
├── dashboard/              SaaS shell (dashboard, projects)
├── create/                 simplified fal.ai generator
├── studio/                 Pro Studio (Open Generative AI)
└── api/
    ├── config              reports active provider to the client
    ├── generate/image      unified image route (provider-abstracted)
    ├── generate/video      unified video route (provider-abstracted)
    ├── api/v1/*            muapi generation proxy (preserved)
    ├── app/*               muapi app proxy (preserved)
    ├── agents/*            muapi agents proxy (preserved)
    └── workflow/*          muapi workflows proxy (preserved)
lib/providers/
├── config.js               AI_PROVIDER resolution + capability map
├── fal.js                  fal.ai adapter
├── muapi.js                Muapi.ai server-side adapter
├── local.js                Local HTTP adapter
└── index.js                Unified façade
components/
├── SaasNav.js              SaaS top nav
├── StandaloneShell.js      Original Open Generative AI shell (untouched)
└── ApiKeyModal.js          Muapi BYOK modal (untouched)
packages/
├── studio/                 Original studio package (Image/Video/... studios)
├── Vibe-Workflow/          Workflow builder
└── Open-Poe-AI/            Agent runtime
```

### Why this split

The full Open Generative AI studio is huge and already well-tuned around Muapi.ai. Rewriting it to talk to fal.ai or a local runtime would be a high-risk, low-reward refactor. So we kept `/studio` on rails and added a provider-abstracted, SaaS-flavoured surface (`/create`, `/dashboard`) on top. Teams can use the simpler surface for routine UGC and drop into `/studio` when they need the full firepower.

---

## Credits

- [Anil-matcha/Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) — the brilliant Higgsfield-class studio this builds on.
- [SamurAIGPT/Vibe-Workflow](https://github.com/SamurAIGPT/Vibe-Workflow) — workflow builder.
- [Anil-matcha/Open-Poe-AI](https://github.com/Anil-matcha/Open-Poe-AI) — agent runtime.
- [fal.ai](https://fal.ai) — default cloud provider.

Licensed MIT. Make cool things.
