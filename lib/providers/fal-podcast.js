/**
 * Two-speaker podcast dialogue planner.
 *
 * Output shape mirrors the analyzer schema so a reference-video analysis
 * can be plugged in directly. Without an analysis, we use sensible defaults
 * and let the LLM imagine the show.
 */

import { fal } from '@fal-ai/client';

let configured = false;
function ensureConfigured() {
    if (configured) return;
    const key = process.env.FAL_KEY;
    if (!key) throw new Error('FAL_KEY not configured.');
    fal.config({ credentials: key });
    configured = true;
}

const MODEL = process.env.FAL_LLM_MODEL || 'openai/gpt-4o-mini';

const SYSTEM = [
    'You are a senior short-form podcast producer scripting a 9:16 vertical podcast where TWO HOSTS sit in THE SAME ROOM at the same podcast table, on two armchairs facing each other, sharing one set with shared lighting, the same lamp, the same bookshelf, the same plants. Cuts alternate between a close-up of host A and a close-up of host B every 2-4 seconds inside that one room.',
    'You MUST reply with ONE minified JSON object on a single line — no markdown, no commentary.',
    'STRICT ALTERNATION: scene 1 = host, scene 2 = guest, scene 3 = host, … always alternating. Never two scenes from the same speaker in a row.',
    'Each scene is ONE beat: one short spoken line (max 10 words) that the speaker actually says into the microphone. Lines feel natural — "no way", "wait what", "[laughs]" allowed.',
    'The dialogue tells a story: cold-open hook → host introduces product → guest reacts in disbelief → they riff features → close on a CTA. Banter, not narration.',
    'On scenes where the product NAME or a key feature is introduced, set "productPop":true so the UI lands a colorful brand sticker on the frame.',
    'For per-scene imagePrompt: describe ONLY what changes for that beat (expression, gesture, gaze) — NOT the room, NOT the wardrobe. The wardrobe and room are already locked by the establishing shot. Keep it short, one sentence.',
    'For setting: write ONE shared description of the room — armchair colors, lamp, microphones, bookshelf details, lighting (warm tungsten or natural daylight), wall colors, props. This room appears in EVERY shot.',
    'Avoid celebrity likenesses; anonymized stylized podcast hosts.',
].join(' ');

export async function planPodcastEpisode({
    topic,
    showName = 'The Drop',
    appOrProduct = '',
    audience = 'curious app users',
    tone = 'energetic explainer',
    sceneCount = 12,
    clipDuration = 3,
    style = null,            // optional analyzer output
}) {
    ensureConfigured();

    const safeSceneCount = Math.max(6, Math.min(24, Math.round(sceneCount)));
    const safeClip = Math.max(3, Math.min(10, Math.round(clipDuration)));

    const styleBlob = style ? `\nVISUAL REFERENCE (mirror this exactly):\n${JSON.stringify(style)}\n` : '';

    const schema = `{"showName":"<repeat the input show name>","brandSticker":{"position":"top-left","shape":"speech bubble","copy":"<show name in caps>","palette":"#0E0E0E+#FFFFFF"},"productSticker":{"shape":"capsule|squiggle","copy":"<the actual product name from the brief>","palette":"#FF2945+#FFFFFF"},"setting":"the ONE shared room — armchair colors, lamp, microphone style, bookshelf, walls, lighting","speakers":[{"id":"host","persona":"...","appearance":"distinct face/hair/age/skin","wardrobe":"specific clothes for the WHOLE shoot","framing":"medium close-up, vertical 9:16, microphone visible"},{"id":"guest","persona":"...","appearance":"clearly different from host","wardrobe":"...","framing":"medium close-up, vertical 9:16, microphone visible"}],"hook":"first-line cold open","scenes":[{"id":1,"speaker":"host","text":"line ≤10 words","duration":${safeClip},"imagePrompt":"only what changes — gesture, expression, gaze","videoPrompt":"motion-only ≤14 words","emphasis":"key word to italicize|null","productPop":false}]}`;

    const userPrompt = [
        `SHOW NAME: ${showName}`,
        `TOPIC / APP / PRODUCT: ${appOrProduct || topic}`,
        `AUDIENCE: ${audience}`,
        `TONE: ${tone}`,
        `SCENE COUNT: ${safeSceneCount} (alternate host / guest, host opens and closes)`,
        `CLIP LENGTH: ${safeClip}s each`,
        styleBlob,
        'Return JSON of EXACTLY this shape, ids 1..N, no trailing commas:',
        schema,
    ].filter(Boolean).join('\n');

    const result = await fal.subscribe('fal-ai/any-llm', {
        input: {
            model: MODEL,
            system_prompt: SYSTEM,
            prompt: userPrompt,
        },
        logs: false,
    });

    const text = result?.data?.output ?? result?.output ?? '';
    if (!text) throw new Error('Podcast planner returned empty output.');
    const parsed = extractJson(text);
    if (!parsed) throw new Error(`Podcast planner returned invalid JSON. Raw: ${text.slice(0, 500)}`);

    const speakerIds = (parsed.speakers || []).map((s) => s.id);
    if (speakerIds.length < 2) throw new Error('Podcast planner needs exactly two speakers.');
    const [aId, bId] = speakerIds;

    // Hard-enforce strict alternation regardless of what the model returned —
    // this is the single most important visual signal.
    const scenes = (parsed.scenes || []).map((s, idx) => ({
        id: Number(s.id ?? idx + 1),
        speaker: idx % 2 === 0 ? aId : bId,
        text: String(s.text || '').slice(0, 140),
        duration: Number(s.duration) || safeClip,
        imagePrompt: String(s.imagePrompt || ''),
        videoPrompt: String(s.videoPrompt || ''),
        emphasis: s.emphasis && typeof s.emphasis === 'string' ? s.emphasis : null,
        productPop: Boolean(s.productPop),
    }));

    if (scenes.length === 0) throw new Error('Podcast planner returned zero scenes.');
    // Force the brand sticker copy to be the actual show name, even if the
    // model echoed back the placeholder text from the schema.
    const finalShow = parsed.showName || showName;
    const finalBrand = parsed.brandSticker
        ? { ...parsed.brandSticker, copy: (parsed.brandSticker.copy || '').toLowerCase().includes('show') ? finalShow : parsed.brandSticker.copy }
        : { position: 'top-left', shape: 'speech bubble', copy: finalShow, palette: '#0E0E0E+#FFFFFF' };
    let finalProduct = parsed.productSticker || null;
    if (finalProduct && (finalProduct.copy || '').toLowerCase().includes('product')) {
        // Pull a product name from the brief if the model left the placeholder.
        const guess = (appOrProduct || topic || '').split(/[—\-–—:,.|]/)[0].trim().slice(0, 24);
        finalProduct = { ...finalProduct, copy: guess || finalShow };
    }

    return {
        showName: finalShow,
        brandSticker: finalBrand,
        productSticker: finalProduct,
        setting: parsed.setting || 'modern podcast studio with two armchairs, warm tungsten lighting, one yellow accent lamp, a bookshelf with books and plants, two microphones on stands',
        speakers: parsed.speakers || [],
        hook: parsed.hook || '',
        scenes,
    };
}

function extractJson(raw) {
    if (!raw) return null;
    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    try { return JSON.parse(text); } catch { /* fall through */ }
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0, inString = false, escape = false;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) {
                const slice = text.slice(start, i + 1);
                try { return JSON.parse(slice); } catch { /* repair */ }
                const repaired = slice.replace(/,(\s*[}\]])/g, '$1');
                try { return JSON.parse(repaired); } catch { return null; }
            }
        }
    }
    return null;
}
