# GOAT UGC AI

**Type a topic. Ship a product video.**

GOAT UGC AI is a SaaS-friendly, self-hostable AI video studio built for app founders and creative agencies.
You give it a brief; it plans the shot list, writes every image prompt, generates visuals on fal.ai, and
stitches them into a multi-scene video you can preview in-browser and render to 4K with [Remotion](https://www.remotion.dev).

No BYOK friction, no Muapi, no tabs: one key, one flow, open source.

Inspired by and adapted from [goatstarter/GOAT-youtube](https://github.com/goatstarter/GOAT-youtube) — Remotion
scene components, Ken Burns animations, and subtitle styling all ported over.

---

## The pipeline

| Stage | What happens | Powered by |
|---|---|---|
| 1. **Director** (`/api/video/plan`) | Scene-by-scene shot list with image prompts, motion prompts, voice lines, duration and animation per scene. | `fal-ai/any-llm` (Claude 3.5 Sonnet) |
| 2. **Visuals** (`/api/generate/image`) | Each scene's still rendered at 1280×720 (or any aspect). | `fal-ai/flux/schnell` · `flux/dev` · `flux-pro` · `fast-sdxl` · `nano-banana` |
| 3. **Motion** (`/api/generate/video`) — optional | Kling v1 turns the still into a 6–10s motion clip. Off by default so speed is king. | `fal-ai/kling-video` · `fal-ai/veo3/fast` · `fal-ai/ltx-video` |
| 4. **Stitch** (client) | Remotion `Player` composes scenes with Ken Burns, fades, subtitles and the 16:9 layout. Download assets as `.zip` for local `remotion render`. | `@remotion/player`, `remotion`, `jszip` |

All four stages share a **provider abstraction** (`lib/providers/`) so you can swap fal.ai for a local runtime without touching pages.

---

## What's inside

| Surface | Route | Notes |
|---|---|---|
| Landing | `/` | Marketing page, points at `/video` |
| Video builder | `/video` | The primary flow — topic → scene plan → per-scene generation → Remotion Player preview |
| Image quick-fire | `/create` | One-off hero images, Flux/SDXL/etc. |
| Dashboard | `/dashboard` | Stats, jump-off, provider status |
| Projects / brand kits | `/dashboard/projects` | Client-side project list |

Route handlers:

```
app/api/
├── config/                  reports active provider + capabilities
├── generate/image/          unified image gen (provider-abstracted)
├── generate/video/          unified video gen (provider-abstracted)
└── video/plan/              scene planning via fal any-llm
```

Remotion lives in `components/remotion/`:

```
Scene.jsx                    Ken Burns + fade + subtitles (image OR video track)
VideoComposition.jsx         <Series> of scenes, 1280×720@30fps
Player.jsx                   <Player> wrapper for client-side preview
```

Provider adapters live in `lib/providers/`:

```
config.js                    AI_PROVIDER resolution + capability map
fal.js                       fal.ai image + video adapter
fal-llm.js                   fal any-llm adapter for scene planning
local.js                     Local HTTP inference adapter
index.js                     Unified façade
```

---

## Quick start (cloud — fal.ai)

```bash
cp .env.example .env.local
# Set FAL_KEY
npm install
npm run dev   # http://localhost:3000
```

Visit `/video`, type a topic, hit **Generate video plan**. You'll see scenes fill in live.

### Deploying to Vercel

```bash
vercel link
vercel env add FAL_KEY production
vercel env add AI_PROVIDER production   # value: fal
vercel deploy --prod
```

The live demo runs at **https://goat-ugc-ai.vercel.app**.

---

## Quick start (self-host — local GPU)

Point the app at any HTTP endpoint that accepts `POST /generate` and returns `{ url }`:

```bash
AI_PROVIDER=local LOCAL_INFERENCE_URL=http://127.0.0.1:7860 npm run dev
```

Adapt `lib/providers/local.js` to your runtime's request shape — it's ~30 lines, read top to bottom.

---

## Rendering to MP4

The in-browser preview runs on `@remotion/player` (no server render needed). To export a final MP4:

1. On `/video`, once scenes are ready, click **Download assets (.zip)**.
2. Unzip locally. You'll get `plan.json` + `scene-N-image.jpg` (and optionally `scene-N-video.mp4`).
3. In a Remotion project, wire a composition that reads `plan.json` and renders each `scene` using the same
   `Scene` component shape as `components/remotion/Scene.jsx`.
4. `npx remotion render` → 4K MP4.

(The reason we don't render server-side on Vercel: a single FFmpeg+Chromium render blows past the serverless
function budget. Remotion Lambda or a self-hosted worker is the right home for final render — a follow-up.)

---

## Environment variables

| Var | Purpose |
|---|---|
| `AI_PROVIDER` | `fal` \| `local`. Omit to auto-detect. |
| `FAL_KEY` | fal.ai API key — required for cloud generation. |
| `LOCAL_INFERENCE_URL` | Base URL of your local inference server when `AI_PROVIDER=local`. |

See `.env.example`.

---

## Roadmap

- [ ] Voice track via fal.ai TTS (`playai-tts` or `elevenlabs` mode) — plumbing ready, UI to come
- [ ] Background music generation (fal-ai/stable-audio)
- [ ] Remotion Lambda render trigger from the UI
- [ ] Brand kits persisted in Postgres (Vercel Marketplace)
- [ ] A/B variant sweep: re-generate all scenes with style B in one click
- [ ] Storyboard import: paste a Google Doc brief → scenes

---

## Credits

- [goatstarter/GOAT-youtube](https://github.com/goatstarter/GOAT-youtube) — Remotion patterns, Scene component, prompting guide
- [Remotion](https://www.remotion.dev) — the renderer that makes in-browser composition possible
- [fal.ai](https://fal.ai) — every generation in this pipeline

Licensed MIT.
