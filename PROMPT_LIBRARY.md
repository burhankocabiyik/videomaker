# LTX-2 Prompt Library for GOAT UGC AI

A practical, opinionated prompt library for generating product / UGC videos with [Lightricks LTX-2](https://github.com/Lightricks/LTX-2) (and compatible image-to-video / text-to-video models running through GOAT UGC AI on fal.ai — Seedance 2.0, Kling v2.1, Veo 3 Fast).

LTX-2 is the first DiT-based audio + video foundation model, so prompts can describe **what is heard** as well as what is seen. This library is organized so every prompt below works as-is for LTX-2 and (with the audio cues stripped) also performs well on Seedance / Kling.

> Sources used while writing this:
> - [Lightricks/LTX-2 README — "Prompting for LTX-2"](https://github.com/Lightricks/LTX-2)
> - [LTX docs · prompting guide](https://docs.ltx.video/api-documentation/prompting-guide)
> - [LTX blog · prompting guide for LTX-2](https://ltx.io/model/model-blog/prompting-guide-for-ltx-2)
> - [LTX blog · LTX-2.3 prompt guide](https://ltx.io/model/model-blog/ltx-2-3-prompt-guide)
> - [Crepal · LTX-2 prompting guide](https://crepal.ai/blog/aivideo/blog-ltx-2-prompting-guide/)
> - [DEV.to · LTX-2 prompting guide](https://dev.to/gary_yan_86eb77d35e0070f5/ltx-2-prompting-guide-master-ai-video-generation-with-expert-techniques-2ejk)

---

## 1. The 7-part anatomy of an LTX-2 prompt

LTX-2's official guidance: *"think like a cinematographer describing a shot list."* Write **one flowing paragraph, 4–8 sentences, under 200 words**, in chronological order. Stack the elements in this order:

| # | Element | What goes here |
|---|---|---|
| 1 | **Main action** | The single sentence that tells the model what is happening. Lead with a verb. |
| 2 | **Gestures & nuance** | Micro-motion: hands, breathing, hair, fabric, particles, a glint of light. |
| 3 | **Appearance** | Subject specifics — clothing, finish, materials. Be literal, not metaphorical. |
| 4 | **Environment** | Setting, depth, background props. Don't bury the subject. |
| 5 | **Camera work** | Shot framing + one clean movement (see vocab below). |
| 6 | **Lighting & color** | Photographic terms: golden hour, soft north window, tungsten, etc. |
| 7 | **Audio (LTX-2 only)** | Sounds, ambience, music vibe — see §5. |

Two killers to avoid: **stacking many movements** (one camera move is almost always better than two) and **vague motion words** like *"dynamic"* or *"epic"* — replace with explicit verbs.

---

## 2. Camera vocabulary

Pick **one** camera move per prompt. LTX-2 reliably understands the terms below.

### Translations (camera intent → prompt phrase)
| Intent | Prompt phrase |
|---|---|
| Reveal / build intensity | `slow dolly in` · `slow push-in` |
| Pull back / show scale | `slow dolly out` · `crane pull back revealing scale` |
| Move sideways | `slow pan left` · `slow pan right` |
| Lateral travel | `slow track left` · `track forward` |
| Look up / awe | `subtle tilt up` |
| Look down / pressure | `subtle tilt down` |
| Hold detail | `static lock-off` |
| Bird's eye | `overhead top-down shot` · `drone-style reveal` |
| Conversational | `over-the-shoulder` · `two-shot, alternating over-the-shoulder` |
| Focus shift | `rack focus from foreground to background` |
| Energy without chaos | `subtle handheld micro-shakes` (avoid full handheld) |

**Speed modifiers** that work: `slow`, `gentle`, `0.5× speed`, `creeping`, `cinematic`.

**Speed words to avoid**: `fast`, `rapid`, `whip` — they break temporal coherence on most i2v models.

---

## 3. Lighting & color vocabulary

LTX-2 responds to *photographic* language. Use the right terms; the model will emulate the look.

### Lighting

- `golden hour rim light, long shadows`
- `soft north-window light, gentle falloff`
- `overcast diffuse light, low contrast`
- `practical lamp as key, warm tungsten, slight spill`
- `volumetric light rays, dust particles in the beam`
- `harsh midday sun, deep shadows, high contrast`
- `neon-lit interior, magenta and cyan rim`
- `single-source rembrandt lighting, dark background`
- `firelight flicker, warm cast on faces`

### Film stock / color grade tags

- `Kodak Vision3 250D, fine grain, slightly desaturated`
- `RED Komodo, clean modern look`
- `super-16mm, visible grain, slightly blown highlights`
- `Arri Alexa LogC, gentle filmic roll-off`
- `cool teal-and-orange grade, low saturation`
- `bleach-bypass, crushed blacks, muted color`
- `pastel, low contrast, lifted blacks`

### Lenses & framing
`85mm portrait f/2`, `35mm wide environmental`, `50mm natural perspective`, `24mm anamorphic flare`, `macro 1:1`, `close-up`, `medium two-shot`, `wide establishing`.

---

## 4. Negative prompts

LTX-2 / Seedance / Kling all benefit from **5–8 targeted negatives**, not 20. Stick to 1–2 of these per category:

```
no extra limbs, no face warp, no object duplication
no text artifacts, no watermarks, no floating logos
no extreme motion blur, no rolling shutter wobble
no flicker, no frame-to-frame texture shift
no Dutch angle, no rapid handheld, keep horizon level
```

---

## 5. Audio prompting (LTX-2 only)

LTX-2 generates **synchronized audio** with the video. Treat the audio prompt as a sentence inside your main paragraph — don't put it in a separate field. Cover three things:

1. **Diegetic sound** (caused by what's in the shot) — *the keyboard clatter, the espresso machine hiss, the door closing.*
2. **Ambience** (room tone) — *a quiet co-working space buzz, distant traffic, soft rainfall outside.*
3. **Music or score cue** (vibe, not lyrics) — *a slow ambient swell, a confident upbeat lo-fi loop.*

**Phrase like a sound designer:** `low room tone with the soft thud of a coffee cup placed on a wooden desk and a subtle ambient synth pad rising in the background.`

**Avoid:** specific song names, copyrighted artists, made-up brand jingles, or precise BPM.

---

## 6. Ready-to-use templates by use case

Each block below has a short **brief** (paste into GOAT UGC AI's `/video` brief panel) and a **per-scene prompt** in the LTX-2 7-part shape. Drop the audio sentence if you're rendering with Seedance / Kling.

> *Convention:* `[product]`, `[brand]`, `[founder name]` are placeholders — replace before rendering.

### 6.1 SaaS / B2B app launch teaser

**Brief**
```
60-second launch teaser for [product], a B2B [category] app that replaces
spreadsheet chaos with one shared workspace. Tone: cinematic-confident.
End on a download CTA. Audience: ops leads at 50–500 person companies.
```

**Hero scene prompt (image-anchored)**
```
A modern dashboard for [product] glows on a 16-inch laptop in a quiet
co-working space at dusk. The cursor glides across a clean kanban board,
cells fill with green status pills, a notification pulses softly. The
surrounding desk is minimal: a ceramic coffee cup, a notebook, an LED
desk lamp throwing warm tungsten light from screen-right. A slow dolly-in
pushes from medium to close on the screen, the UI staying tack-sharp
while the background falls into shallow bokeh. Overcast window light
mixes with the warm practical, RED Komodo clean-modern look, slight
desaturation, no flicker. A low ambient synth pad swells under the
quiet hum of an open-plan office and a single keystroke as the cursor
clicks "Ship".
```

**Closing CTA scene**
```
Tight macro on a hand pressing the [brand] download button on an iPhone
in portrait, the button's lime-green ring lights up the moment of
contact. The phone sits on a slate desk, water glass and AirPods case
softly out of focus on the right, all rendered in shallow depth. A
subtle handheld micro-shake adds presence; the camera holds static
through the press, then lifts a centimeter as the screen fades to the
[brand] wordmark. Practical key from above, neutral grade, no Dutch
angle. The soft tap of the screen click and a confident, single-piano-
note sting close the spot.
```

---

### 6.2 Ecommerce product UGC (clothing / accessory)

**Brief**
```
20-second TikTok-vertical UGC for [product], a [category] for [audience].
Tone: playful but premium. Show texture, fit, and the moment of joy.
Aspect: 9:16. End on the product floating against a clean color block.
```

**Texture beat**
```
Macro shot of [product]'s stitching catching light, a single thread of
deep emerald thread holding tension as fingers ease the seam open. Skin,
hair flicker, and fabric grain are crisp in the foreground; the
background is a creamy out-of-focus studio sweep. Slow rack focus from
the seam to the brand label, then a static lock-off as light passes
across the surface. Soft north-window lighting, Kodak Vision3 250D
look, fine grain, no extreme saturation. The faint rustle of fabric
folds and a low ambient mood pad fill the room.
```

**Reveal beat**
```
Three-quarter view of [product] floating against a pastel green
backdrop. The piece rotates 25 degrees on its vertical axis, edges
catching a soft rim light, dust motes drifting through a single beam.
Slow pan right, locked horizon, no object duplication. Clean studio
look, controlled speculars, even lighting. A single warm chime and
the soft swell of a cheerful synth motif punctuate the rotation.
```

---

### 6.3 Founder reel / build-in-public weekly recap

**Brief**
```
30-second weekly recap for indie founder [founder name]. Three beats:
the build, the ship, the response. Tone: inspirational without being
cheesy. We never see the founder's face — focus on hands, screens,
artifacts.
```

**Build beat**
```
An over-the-shoulder shot of a developer's hands moving across a
mechanical keyboard at 2am. The room is dim, lit only by the cool white
of a 27-inch display and the warm glow of a LIFX desk lamp. Code
scrolls in a Monokai theme, a unit-test indicator flicks from red to
green, a coffee cup sits half-empty in the corner. A subtle handheld
micro-shake holds on the keyboard for two seconds, then a slow tilt up
reveals the green checkmark on screen. Practical-only lighting, ARRI
LogC roll-off, deep blacks, no flicker. The clack of keys, the soft
fan of a laptop, and a low confident lo-fi loop underscore the moment.
```

**Ship beat**
```
A static lock-off on a phone face-up on a wooden desk. The screen wakes,
the notification stack fills: a Stripe charge, a Slack reaction, a new
sign-up. Each card slides up with a gentle bounce, none stay long
enough to be readable. Overhead practical light throws soft shadows
across the wood grain. Clean modern grade, slight teal lift in the
shadows, no text warping. The hush of the room is broken by three
soft chimes — one per notification — and a quiet rising synth pad.
```

---

### 6.4 Mobile app demo (lifestyle / fitness / habit)

**Brief**
```
45-second mobile-first demo for [app name], a habit-tracking app. Tone:
calm and confident. Frame everything around the morning routine. Always
show the phone in-hand or on a surface — never floating.
```

**Morning hook**
```
Macro on a phone resting on a pale linen pillow at sunrise. The screen
gently brightens as the [app name] streak counter ticks up to "Day 47"
in a soft serif typeface. A finger enters from frame-bottom and taps
the morning check-in, the haptic ripple animating outward in soft
green. Subtle handheld micro-shake adds breath, then settles into a
static hold. Soft golden hour rim light, cool teal-and-orange grade,
shallow depth. Distant birdsong, the soft tap of finger on glass, and
a single major-key piano note welcome the day.
```

**Routine beat**
```
Over-the-shoulder of a runner's wrist in motion, a smartwatch showing
[app name]'s pace and route in real time. Trees blur past in mid
focus, the watch crisp in the foreground. A slow track forward keeps
the wrist centered as the path opens. Overcast diffuse light, fine
grain, low contrast, deep focus. Footfalls on gravel, breath in
4-count rhythm, and a confident lo-fi loop track at quiet volume.
```

---

### 6.5 Agency teaser / brand sizzle

**Brief**
```
40-second sizzle reel for [agency name], a creative studio that ships
launch films and product OS. Tone: confident, no-cliché, no founder
voiceovers. Build on textures and craft. Three to five beats max.
```

**Identity moment**
```
A studio table from above: a printed proof of [client] packaging, a
foam-core mock, a single cup of espresso, a Pantone fan deck open on
warm reds. A hand enters from frame-right, slides the proof half a
centimeter to align with a grid taped to the table. Static lock-off,
overhead practical light from a soft box, neutral grade, controlled
speculars. The soft slide of paper, the hiss of the espresso machine
in the background, and a single low ambient drone fill the moment.
```

**Process beat**
```
A close-up on a designer's screen as a wireframe locks into a hi-fi
mock — components snap into place row by row, a tiny progress bar
fills at the bottom. Slow rack focus from the bezel of the iMac to
the artboard, the room lit by the cool blue of a single window.
Kodak Vision3 250D look, slight desaturation, no flicker, no text
artifacts. The click of a magic mouse, the room tone of an empty
studio, a confident upbeat synth motif rising softly under the cuts.
```

---

### 6.6 Event / launch announcement

**Brief**
```
15-second hero clip for the [event name] launch. Tone: cinematic,
confident, slightly mysterious. Aspect: 16:9. End on the wordmark
hitting the center of frame at the exact moment the music pad swells.
```

**Reveal beat**
```
Wide establishing shot of a dim auditorium pre-show — empty seats, a
single beam of light cutting through a haze of theatrical fog,
spotlights on a clean black stage. A slow dolly-in pushes through the
seats toward the stage, the haze parting around the camera path. ARRI
Alexa LogC, deep blacks, gentle filmic roll-off, no Dutch angle. The
distant murmur of a crowd, a low rising synth drone, and a single
heartbeat-tempo kick anchor the ten-second climb to the wordmark
hitting screen-center.
```

---

## 7. How GOAT UGC AI uses this library

The pieces inside this repo that read directly from this guide:

- **`lib/prompt-library.js`** — exports `LTX2_PRINCIPLES`, `CAMERA_MOVES`, `LIGHTING_LOOKS`, `SCENE_TEMPLATES`. The scene planner prompt at `lib/providers/fal-llm.js` injects the principles + camera vocab so every plan it returns is already in LTX-2 cinematographer style.
- **`/api/prompt-library`** — read-only JSON endpoint that returns the same templates the UI uses.
- **`/video` Templates row** — the brief panel exposes the 6 categories above as one-tap presets that fill in `topic`, `tone`, scene count and clip duration.

If you change this MD file, also update `lib/prompt-library.js` so the app's runtime stays in sync.

---

## 8. Quick prompt-doctor checklist

Run every scene prompt through this list before hitting render:

- [ ] **One camera move** — not two.
- [ ] **Single-paragraph, ≤200 words** — chronological, not poetic.
- [ ] **Explicit verbs** — replaced any *"dynamic"* / *"epic"* / *"intense"*?
- [ ] **Subject ≠ identifiable face** — Seedance refuses recognizable people.
- [ ] **Lighting & color named with photographic terms** — not vibes.
- [ ] **5–8 negatives** — not a wall.
- [ ] **(LTX-2 only) audio sentence present** — diegetic + ambience + score cue.
- [ ] **CTA / hero moment lands within the last 20% of the clip** — pacing.

---

*Last updated 2026-04-26 · maintained alongside the GOAT UGC AI codebase by [Burhan Kocabıyık](https://burhankocabiyik.com).*
