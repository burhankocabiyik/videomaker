/**
 * GOAT UGC AI prompt library — runtime mirror of PROMPT_LIBRARY.md.
 *
 * Two consumers:
 *   1. The /video brief panel reads SCENE_TEMPLATES to surface one-tap
 *      presets (SaaS launch, ecommerce UGC, founder reel, etc.).
 *   2. The fal.ai scene planner injects LTX2_PRINCIPLES + CAMERA_MOVES
 *      into its system prompt so every generated scene already follows
 *      LTX-2 cinematographer style.
 *
 * Keep this file in sync with PROMPT_LIBRARY.md.
 */

export const LTX2_PRINCIPLES = [
    'Write each imagePrompt and videoPrompt as ONE flowing paragraph in chronological order, ≤200 words.',
    'Lead with the main action verb. Replace vague intensifiers (epic, dynamic, intense) with explicit verbs.',
    'Pick exactly ONE camera move per scene — never stack two.',
    'Use photographic vocabulary for lighting and color (golden hour rim light, soft north-window light, ARRI LogC roll-off, Kodak Vision3 250D, RED Komodo clean look).',
    'Name framing and lens (85mm f/2 portrait, 35mm wide environmental, macro 1:1, over-the-shoulder).',
    'When motion-only (videoPrompt for image-to-video), describe motion ONLY — no static content the still already shows.',
    'For LTX-2 add a single sentence covering diegetic sound + ambient room tone + score cue. Skip for Seedance/Kling.',
    'Avoid recognizable identifiable human faces in close-up — Seedance and other partner models refuse them. Prefer hands, screens, products, silhouettes, over-the-shoulder, or people seen from behind / at distance.',
    'End each prompt with a tight 5–8 word negative tail when relevant: e.g. "no text artifacts, no flicker, no Dutch angle".',
];

export const CAMERA_MOVES = [
    { id: 'slowDollyIn',    phrase: 'slow dolly-in',                useFor: 'reveal, intensity build' },
    { id: 'slowDollyOut',   phrase: 'slow dolly-out',               useFor: 'pull back, scale reveal' },
    { id: 'slowPanLeft',    phrase: 'slow pan left',                useFor: 'gentle lateral, context' },
    { id: 'slowPanRight',   phrase: 'slow pan right',               useFor: 'gentle lateral, context' },
    { id: 'trackForward',   phrase: 'slow track forward',           useFor: 'travel through space' },
    { id: 'tiltUp',         phrase: 'subtle tilt up',               useFor: 'awe, hero moment' },
    { id: 'tiltDown',       phrase: 'subtle tilt down',             useFor: 'pressure, reveal beneath' },
    { id: 'staticLockOff',  phrase: 'static lock-off',              useFor: 'detail, product hero' },
    { id: 'overhead',       phrase: 'overhead top-down shot',       useFor: 'flat-lay, layout' },
    { id: 'overTheShoulder',phrase: 'over-the-shoulder',            useFor: 'point of view, intimacy' },
    { id: 'rackFocus',      phrase: 'slow rack focus',              useFor: 'attention transfer' },
    { id: 'subtleHandheld', phrase: 'subtle handheld micro-shakes', useFor: 'documentary feel' },
];

export const LIGHTING_LOOKS = [
    { id: 'goldenHour',  phrase: 'golden hour rim light, long shadows' },
    { id: 'softWindow',  phrase: 'soft north-window light, gentle falloff' },
    { id: 'overcast',    phrase: 'overcast diffuse light, low contrast' },
    { id: 'tungsten',    phrase: 'practical lamp as key, warm tungsten, slight spill' },
    { id: 'volumetric',  phrase: 'volumetric light rays, dust particles in the beam' },
    { id: 'highKey',     phrase: 'soft box key with white reflective fill, even high-key' },
    { id: 'neonNoir',    phrase: 'neon-lit interior, magenta and cyan rim' },
    { id: 'rembrandt',   phrase: 'single-source Rembrandt lighting, dark background' },
];

export const FILM_LOOKS = [
    { id: 'kodak250d',   phrase: 'Kodak Vision3 250D, fine grain, slightly desaturated' },
    { id: 'redKomodo',   phrase: 'RED Komodo, clean modern look' },
    { id: 'super16',     phrase: 'super-16mm, visible grain, slightly blown highlights' },
    { id: 'arriLogC',    phrase: 'ARRI Alexa LogC, gentle filmic roll-off' },
    { id: 'tealOrange',  phrase: 'cool teal-and-orange grade, low saturation' },
    { id: 'pastel',      phrase: 'pastel, low contrast, lifted blacks' },
];

export const NEGATIVE_TAILS = [
    'no extra limbs, no face warp, no object duplication',
    'no text artifacts, no watermarks, no floating logos',
    'no extreme motion blur, no rolling shutter wobble',
    'no flicker, no frame-to-frame texture shift',
    'no Dutch angle, no rapid handheld, keep horizon level',
];

/**
 * Six SaaS-friendly story templates, mirroring PROMPT_LIBRARY.md §6.
 * Each template fills the brief panel form when a user clicks the preset.
 */
export const SCENE_TEMPLATES = [
    {
        id: 'saas-launch',
        label: 'SaaS launch teaser',
        emoji: '◐',
        topic: '60-second launch teaser for [product], a B2B [category] app that replaces spreadsheet chaos with one shared workspace. Position us against legacy tools, end on a download CTA. Audience: ops leads at 50–500 person companies.',
        tone: 'cinematic',
        sceneCount: 6,
        clipDuration: 10,
        useVideoClips: true,
        textOnly: false,
        notes: 'Hero scene = dashboard close-up with shallow bokeh. Closing scene = hand pressing CTA on phone.',
    },
    {
        id: 'ecom-ugc',
        label: 'Ecommerce product UGC',
        emoji: '▩',
        topic: '20-second TikTok-vertical UGC for [product], a [category] for [audience]. Show texture, fit, and the moment of joy. Premium-but-playful tone. End on the product floating against a clean color block.',
        tone: 'playful',
        sceneCount: 4,
        clipDuration: 5,
        useVideoClips: true,
        textOnly: false,
        notes: 'Macro stitching, texture, fabric — keep humans out of frame.',
    },
    {
        id: 'founder-reel',
        label: 'Founder weekly recap',
        emoji: '✎',
        topic: '30-second weekly build-in-public recap for indie founder [founder name]. Three beats: build, ship, response. Inspirational without cheese. Never show the founder’s face — focus on hands, screens, artifacts.',
        tone: 'inspirational',
        sceneCount: 5,
        clipDuration: 5,
        useVideoClips: true,
        textOnly: false,
        notes: 'Lots of practical light, mechanical keyboard, screen close-ups.',
    },
    {
        id: 'app-demo',
        label: 'Mobile app demo',
        emoji: '▢',
        topic: '45-second mobile-first demo for [app name], a habit-tracking app. Calm, confident tone. Frame everything around the morning routine. Always show the phone in-hand or on a surface — never floating.',
        tone: 'cinematic',
        sceneCount: 6,
        clipDuration: 5,
        useVideoClips: true,
        textOnly: false,
        notes: 'Macro phone screen + over-the-shoulder watch face. Soft natural light.',
    },
    {
        id: 'agency-sizzle',
        label: 'Agency sizzle reel',
        emoji: '✦',
        topic: '40-second sizzle reel for [agency name], a creative studio that ships launch films and product OS. Confident, no-cliché. No founder voiceovers. Build on textures and craft. Three to five beats max.',
        tone: 'authoritative',
        sceneCount: 5,
        clipDuration: 5,
        useVideoClips: true,
        textOnly: false,
        notes: 'Studio table flat-lay, hand pulling things into a grid, designer screen.',
    },
    {
        id: 'event-launch',
        label: 'Event launch hero',
        emoji: '◉',
        topic: '15-second hero clip for the [event name] launch. Cinematic, confident, slightly mysterious. End on the wordmark hitting the center of frame at the exact moment the music pad swells.',
        tone: 'cinematic',
        sceneCount: 3,
        clipDuration: 5,
        useVideoClips: true,
        textOnly: false,
        notes: 'Wide establishing → push through haze → wordmark drop.',
    },
];

/** Compact directive injected into the LLM scene planner system prompt. */
export function plannerStyleDirective() {
    const cameraVocab = CAMERA_MOVES.map((c) => c.phrase).join(', ');
    const lightingVocab = LIGHTING_LOOKS.slice(0, 6).map((l) => l.phrase.split(',')[0]).join(', ');
    return [
        'Write every imagePrompt and videoPrompt in LTX-2 cinematographer style:',
        '— ONE flowing paragraph, chronological, ≤200 words.',
        '— Lead with the main action verb; explicit verbs only (no "dynamic" / "epic").',
        '— Pick ONE camera move per scene from this list: ' + cameraVocab + '.',
        '— Name lighting with photographic terms (e.g. ' + lightingVocab + ').',
        '— Avoid recognizable human faces in close-up; prefer hands, screens, products, silhouettes, over-the-shoulder, or people from behind.',
        '— End the videoPrompt with a short negative tail (e.g. "no flicker, no Dutch angle, no text artifacts").',
    ].join(' ');
}
