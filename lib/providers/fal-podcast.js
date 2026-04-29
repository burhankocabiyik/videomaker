/**
 * Two-speaker podcast dialogue planner.
 *
 * Output shape mirrors the analyzer schema so a reference-video analysis
 * can be plugged in directly. Without an analysis, we use sensible defaults
 * and let the LLM imagine the show.
 */

import { fal } from '@fal-ai/client';
import { buildRealisticVideoPrompt } from '../podcast-realism.js';

let configured = false;
function ensureConfigured() {
    if (configured) return;
    const key = process.env.FAL_KEY;
    if (!key) throw new Error('FAL_KEY not configured.');
    fal.config({ credentials: key });
    configured = true;
}

// Default to a model that returns long structured JSON reliably; gpt-4o-mini
// hits a low-ish output cap on this schema once we add 6+ scenes.
const MODEL = process.env.FAL_LLM_MODEL || 'anthropic/claude-3.5-sonnet';
const MODEL_FALLBACKS = ['google/gemini-2.0-flash-001', 'openai/gpt-4o', 'openai/gpt-4o-mini'];

const SYSTEM = [
    'You script 9:16 podcasts where TWO HOSTS share ONE room and the edit cuts between their close-ups every 2-4s.',
    'Reply ONLY with a single-line minified JSON object — no markdown, no prose.',
    'STRICT ALTERNATION host↔guest scene-by-scene.',
    'Each line ≤10 words, conversational ("no way", "wait what", "[laughs]" OK).',
    'Arc: hook → intro product → reaction → 1-2 features → CTA.',
    'Set productPop:true on scenes where the product is named.',
    'imagePrompt is SHORT: only what CHANGES for that beat (expression/gesture). Room and wardrobe stay locked.',
    'setting: ONE description of the shared room used in every shot.',
    'No celebrity likenesses; anonymized stylized hosts.',
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

    const schema = `{"showName":"...","brandCopy":"<show name CAPS>","productCopy":"<product name>","setting":"shared room: armchairs, lamp, microphones, bookshelf, walls, lighting","speakers":[{"id":"host","persona":"...","appearance":"distinct face/hair","wardrobe":"clothes worn in every shot"},{"id":"guest","persona":"...","appearance":"different from host","wardrobe":"..."}],"hook":"cold open","scenes":[{"id":1,"speaker":"host","text":"≤10 words","imagePrompt":"only what changes (expression/gesture)","videoPrompt":"motion only ≤14 words","emphasis":"word|null","productPop":false}]}`;

    const userPrompt = [
        `SHOW: ${showName}`,
        `PRODUCT: ${appOrProduct || topic}`,
        `AUDIENCE: ${audience}`,
        `TONE: ${tone}`,
        `${safeSceneCount} scenes, ${safeClip}s each, alternating host↔guest, host opens and closes.`,
        styleBlob,
        'Output ONLY this JSON shape, ids 1..N:',
        schema,
    ].filter(Boolean).join('\n');

    // Try the configured model first, then walk through sturdy fallbacks if
    // the response gets truncated or comes back empty.
    const tryModels = [MODEL, ...MODEL_FALLBACKS.filter((m) => m !== MODEL)];
    let parsed = null;
    let lastRaw = '';
    let lastModel = MODEL;
    for (const m of tryModels) {
        try {
            const result = await fal.subscribe('fal-ai/any-llm', {
                input: { model: m, system_prompt: SYSTEM, prompt: userPrompt },
                logs: false,
            });
            const text = result?.data?.output ?? result?.output ?? '';
            lastRaw = text;
            lastModel = m;
            const candidate = extractJson(text);
            if (candidate?.scenes?.length) {
                parsed = candidate;
                break;
            }
        } catch (err) {
            lastRaw = `${m} threw: ${err.message}`;
            continue;
        }
    }
    if (!parsed) {
        throw new Error(`Podcast planner returned invalid JSON via ${lastModel}. Raw (${lastRaw.length} chars): ${lastRaw.slice(0, 500)}`);
    }

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
        // The thin LLM-side videoPrompt is a hint the realism builder uses;
        // we replace it below with the dense final paragraph.
        videoPromptHint: String(s.videoPrompt || ''),
        emphasis: s.emphasis && typeof s.emphasis === 'string' ? s.emphasis : null,
        productPop: Boolean(s.productPop),
    }));

    if (scenes.length === 0) throw new Error('Podcast planner returned zero scenes.');
    // Force the brand sticker copy to be the actual show name, even if the
    // model echoed back the placeholder text from the schema.
    const finalShow = parsed.showName || showName;
    const productGuess = (appOrProduct || topic || '').split(/[—\-–—:,.|]/)[0].trim().slice(0, 24) || finalShow;

    // Compact schema returns brandCopy / productCopy strings; older schema
    // returned full sticker objects. Support both.
    const finalBrand = parsed.brandSticker?.copy
        ? { ...parsed.brandSticker, copy: (parsed.brandSticker.copy || '').toLowerCase().includes('show name') ? finalShow.toUpperCase() : parsed.brandSticker.copy }
        : {
            position: 'top-left',
            shape: 'speech bubble',
            copy: (parsed.brandCopy || finalShow).toString().toUpperCase(),
            palette: '#0E0E0E+#FFFFFF',
          };

    let finalProduct = parsed.productSticker?.copy
        ? { ...parsed.productSticker }
        : (parsed.productCopy
            ? { shape: 'capsule', copy: parsed.productCopy, palette: '#FF2945+#FFFFFF' }
            : { shape: 'capsule', copy: productGuess, palette: '#FF2945+#FFFFFF' });
    if (finalProduct && (finalProduct.copy || '').toLowerCase().includes('product')) {
        finalProduct = { ...finalProduct, copy: productGuess };
    }

    // Drop placeholder echo-backs of the schema example.
    const PLACEHOLDER_SETTING = /shared room: armchairs, lamp, microphones, bookshelf, walls, lighting/i;
    const setting = parsed.setting && !PLACEHOLDER_SETTING.test(parsed.setting)
        ? parsed.setting
        : 'modern podcast studio with two beige armchairs facing each other, warm tungsten key light, soft ambient fill, a yellow accent floor lamp, a wooden bookshelf with plants and curated books, neutral linen wall, two podcast microphones on adjustable stands, vertical 9:16 framing';

    const finalSpeakers = parsed.speakers || [];

    // Server-side EXPAND: rewrite each scene's videoPrompt as the dense
    // hyper-realistic paragraph the user wants — character + setting +
    // cinematography + performance + dialogue + audio + UGC keywords.
    const richScenes = scenes.map((scene, idx) => {
        const speaker = finalSpeakers.find((sp) => sp.id === scene.speaker) || finalSpeakers[0];
        const realisticPrompt = buildRealisticVideoPrompt({
            plan: { showName: finalShow, setting, productSticker: finalProduct, speakers: finalSpeakers },
            scene,
            speaker,
            takeIndex: idx + 1,
        });
        return { ...scene, videoPrompt: realisticPrompt };
    });

    return {
        showName: finalShow,
        brandSticker: finalBrand,
        productSticker: finalProduct,
        setting,
        speakers: finalSpeakers,
        hook: parsed.hook || '',
        scenes: richScenes,
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
