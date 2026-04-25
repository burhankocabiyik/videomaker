# GOAT UGC AI

**Type a topic. Ship a product video.**

GOAT UGC AI is an open-source, self-hostable AI video studio for app founders, creators, and agencies.
You give it a brief; it plans the shot list, writes every prompt, generates real motion clips on fal.ai
(Seedance 2.0 / Kling v2.1), and stitches them in a [Remotion](https://www.remotion.dev) player you can
preview in the browser and render to MP4 locally.

Live demo · [goat-ugc-ai.vercel.app](https://goat-ugc-ai.vercel.app)

> Built by [Burhan Kocabıyık](https://burhankocabiyik.com).
> Inspired by and adapted from [goatstarter/GOAT-youtube](https://github.com/goatstarter/GOAT-youtube)
> (Remotion patterns, scene component, prompting guide).

---

## What it does

| Stage | What happens | Powered by |
|---|---|---|
| 1. **Director** (`/api/video/plan`) | Topic → scene-by-scene shot list with image prompts, motion prompts, voice lines, duration, and animation. | `fal-ai/any-llm` (default `openai/gpt-4o-mini`) |
| 2. **Visuals** (`/api/generate/image`) — image-anchored mode | Anchor frame for each scene at 1280×720. | Flux Schnell · Flux Dev · Flux 1.1 Pro · **Nano Banana Pro** · **Nano Banana 2** · Seedream v4 · SDXL |
| 3. **Motion** (`/api/generate/video`) | Real AI motion clips per scene — image-to-video or text-to-video. | **Seedance 2.0** · Seedance 2.0 Fast · Kling v2.1 Master / Pro / Standard · Seedance 2.0 t2v |
| 4. **Stitch** (client) | Remotion `Player` composes scenes with fades, subtitles, optional Ken Burns. Edit / reorder / regenerate scenes inline. | `@remotion/player`, `remotion`, `jszip` |

Up to **5 minutes** total / 30 scenes per video. All scenes render in parallel.

---

## Two creation modes

- **Image-anchored** (default) — generate a still per scene, then animate it. More controllable, lower variance, great for product UGC.
- **Text-to-video** — skip stills entirely; send the scene prompt straight to Seedance 2.0 t2v. Best for abstract/dynamic shots where you don't need pixel-level control of the first frame.

A toggle in the brief panel switches between them; the available video models update accordingly.

---

## Inline scene editor

Right under the live Remotion player you get a Remotion-style timeline editor. For every scene:

- ↑ / ↓ to reorder
- ✕ to delete
- "+ Add scene" to insert a new one
- Inline edit subtitle / voice line, image prompt, motion prompt
- 5 s / 10 s clip length toggle
- Camera animation picker (zoom in/out, pan L/R, breathing, static) for the still
- Per-scene **Regenerate** button (re-runs only that one)
- Top toolbar: "Render missing scenes" and "Download assets (.zip)"

Edits to subtitle / animation / duration update the player live.
Prompt edits only kick in on the next regeneration so you don't burn credits.

---

## Self-host

### 1. Local dev

```bash
git clone <this-repo> goat-ugc-ai
cd goat-ugc-ai
cp .env.example .env.local
# Get a key at https://fal.ai/dashboard/keys, paste into FAL_KEY
npm install
npm run dev   # http://localhost:3000
```

### 2. Deploy to Vercel

```bash
vercel link
vercel env add FAL_KEY production       # paste your fal.ai key when prompted
vercel env add AI_PROVIDER production    # value: fal
vercel deploy --prod
```

That's it — no databases or auth required for the core flow. The dashboard's "Projects" view persists workspaces in `localStorage` until you wire a real DB.

### 3. Run on your own GPU (no fal.ai)

```bash
AI_PROVIDER=local LOCAL_INFERENCE_URL=http://127.0.0.1:7860 npm run dev
```

The local adapter is ~30 lines (`lib/providers/local.js`) — point it at your Ollama / ComfyUI / sd.cpp endpoint and adapt to your runtime's request shape.

---

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `FAL_KEY` | yes (cloud) | fal.ai API key |
| `AI_PROVIDER` | no | `fal` (default) or `local` |
| `FAL_LLM_MODEL` | no | Override scene-planner LLM (default `openai/gpt-4o-mini`) |
| `LOCAL_INFERENCE_URL` | yes (local mode) | Base URL of your local inference server |

See `.env.example`.

---

## Architecture at a glance

```
app/
├── page.js                       Marketing landing
├── video/                        Primary surface — brief, planner, editor, player
├── create/                       Single-image quick-fire
├── dashboard/                    SaaS shell + projects
└── api/
    ├── config/                   Active provider + capability summary
    ├── generate/image/           Provider-abstracted image generation
    ├── generate/video/           Provider-abstracted video generation
    └── video/plan/               Scene planner via fal-ai/any-llm

components/
├── SaasNav.js                    Top nav across SaaS pages
└── remotion/
    ├── Scene.jsx                 Ken Burns + fade + subtitles
    ├── VideoComposition.jsx      <Series> of scenes, 1280×720 @30fps
    └── Player.jsx                Client-side <Player> wrapper

lib/providers/
├── config.js                     AI_PROVIDER resolution + capability map
├── fal.js                        fal.ai image + video adapter (Seedance 2.0, Kling v2.1, Flux, Nano Banana 2/Pro)
├── fal-llm.js                    fal any-llm scene planner
├── local.js                      Local HTTP inference adapter
└── index.js                      Unified façade
```

---

## Contributing

PRs welcome. The code is intentionally small and reads top-to-bottom — no
framework gymnastics. Open an issue first for anything bigger than a
20-line change so we can align on direction.

---

## Credits

- [Remotion](https://www.remotion.dev) — the renderer that makes in-browser composition possible
- [fal.ai](https://fal.ai) — every generation in this pipeline
- [goatstarter/GOAT-youtube](https://github.com/goatstarter/GOAT-youtube) — the Remotion + Scene component blueprint we adapted
- Built by [Burhan Kocabıyık](https://burhankocabiyik.com)

---

## License

MIT.
