/**
 * Two-speaker podcast dialogue planner.
 *
 * The planner emits SCENES (alternating host/guest, ≤10 words each) and
 * post-processes them into TAKES — long-form continuous shots, one per
 * speaker per ≤10-second window. The video pipeline generates ONE i2v
 * clip + ONE TTS track + ONE lipsync per take, then the renderer slices
 * each take per scene and concats alternating slices into the final cut.
 *
 * Why takes: continuous body language across cuts (the host appears to
 * keep talking instead of resetting between every line), and dramatically
 * fewer/cheaper i2v + lipsync calls.
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
    'speakers must look like REAL people, not stylised CGI; describe asymmetric features, real skin, lived-in clothing.',
    'No celebrity likenesses.',
].join(' ');

const MAX_TAKE_SEC = Number(process.env.PODCAST_MAX_TAKE_SEC || 10);

export async function planPodcastEpisode({
    topic,
    showName = 'The Drop',
    appOrProduct = '',
    audience = 'curious app users',
    tone = 'energetic explainer',
    sceneCount = 8,
    clipDuration = 3,
    style = null,
}) {
    ensureConfigured();

    const safeSceneCount = Math.max(6, Math.min(24, Math.round(sceneCount)));
    const safeClip = Math.max(3, Math.min(MAX_TAKE_SEC, Math.round(clipDuration)));

    const styleBlob = style ? `\nVISUAL REFERENCE (mirror this exactly):\n${JSON.stringify(style)}\n` : '';

    const schema = `{"showName":"...","brandCopy":"<show name CAPS>","productCopy":"<product name>","setting":"shared room: armchairs, lamp, microphones, bookshelf, walls, lighting","speakers":[{"id":"host","persona":"...","appearance":"distinct face/hair, real-looking, asymmetric features, lived-in","wardrobe":"clothes worn in every shot"},{"id":"guest","persona":"...","appearance":"different from host, real-looking","wardrobe":"..."}],"hook":"cold open","scenes":[{"id":1,"speaker":"host","text":"≤10 words","imagePrompt":"only what changes (expression/gesture)","emphasis":"word|null","productPop":false}]}`;

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
            if (candidate?.scenes?.length) { parsed = candidate; break; }
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

    // Hard-enforce strict alternation regardless of what the model returned.
    const scenes = (parsed.scenes || []).map((s, idx) => ({
        id: Number(s.id ?? idx + 1),
        speaker: idx % 2 === 0 ? aId : bId,
        text: String(s.text || '').slice(0, 140),
        duration: safeClip,
        imagePrompt: String(s.imagePrompt || ''),
        emphasis: s.emphasis && typeof s.emphasis === 'string' ? s.emphasis : null,
        productPop: Boolean(s.productPop),
    }));
    if (scenes.length === 0) throw new Error('Podcast planner returned zero scenes.');

    // ── Sticker / setting normalisation ─────────────────────────────────────
    const finalShow = parsed.showName || showName;
    const productGuess = (appOrProduct || topic || '').split(/[—\-–—:,.|]/)[0].trim().slice(0, 24) || finalShow;
    const finalBrand = parsed.brandSticker?.copy
        ? { ...parsed.brandSticker, copy: (parsed.brandSticker.copy || '').toLowerCase().includes('show name') ? finalShow.toUpperCase() : parsed.brandSticker.copy }
        : { position: 'top-left', shape: 'speech bubble', copy: (parsed.brandCopy || finalShow).toString().toUpperCase(), palette: '#0E0E0E+#FFFFFF' };
    let finalProduct = parsed.productSticker?.copy
        ? { ...parsed.productSticker }
        : (parsed.productCopy
            ? { shape: 'capsule', copy: parsed.productCopy, palette: '#FF2945+#FFFFFF' }
            : { shape: 'capsule', copy: productGuess, palette: '#FF2945+#FFFFFF' });
    if (finalProduct && (finalProduct.copy || '').toLowerCase().includes('product')) {
        finalProduct = { ...finalProduct, copy: productGuess };
    }
    const PLACEHOLDER_SETTING = /shared room: armchairs, lamp, microphones, bookshelf, walls, lighting/i;
    const setting = parsed.setting && !PLACEHOLDER_SETTING.test(parsed.setting)
        ? parsed.setting
        : 'modern home podcast studio with two beige armchairs facing each other, warm tungsten key light from a yellow accent floor lamp at frame-left, soft window fill from frame-right, a wooden bookshelf with plants and curated books, neutral linen wall, two podcast microphones on adjustable stands, vertical 9:16 framing';

    const finalSpeakers = parsed.speakers || [];

    // ── Group scenes into TAKES per speaker, ≤MAX_TAKE_SEC each ─────────────
    const takes = buildTakes(scenes, MAX_TAKE_SEC);

    // ── Stamp each scene with its take id + offset within that take ─────────
    const offsets = new Map();
    for (const take of takes) {
        let cursor = 0;
        for (const sceneId of take.sceneIds) {
            offsets.set(sceneId, { takeId: take.id, takeOffsetSec: cursor });
            const sc = scenes.find((s) => s.id === sceneId);
            cursor += sc.duration;
        }
    }
    const richScenes = scenes.map((scene, idx) => {
        const speaker = finalSpeakers.find((sp) => sp.id === scene.speaker) || finalSpeakers[0];
        const realisticPrompt = buildRealisticVideoPrompt({
            plan: { showName: finalShow, setting, productSticker: finalProduct, speakers: finalSpeakers },
            scene,
            speaker,
            takeIndex: idx + 1,
        });
        const off = offsets.get(scene.id) || {};
        return { ...scene, videoPrompt: realisticPrompt, takeId: off.takeId, takeOffsetSec: off.takeOffsetSec || 0 };
    });

    return {
        showName: finalShow,
        brandSticker: finalBrand,
        productSticker: finalProduct,
        setting,
        speakers: finalSpeakers,
        hook: parsed.hook || '',
        scenes: richScenes,
        takes,
    };
}

/**
 * Greedy bin-pack scenes per speaker into takes ≤ maxSec long.
 * Lines stay in scene order within a take so the lipsync timeline is
 * monotonic.
 */
function buildTakes(scenes, maxSec) {
    const bySpeaker = new Map();
    for (const sc of scenes) {
        if (!bySpeaker.has(sc.speaker)) bySpeaker.set(sc.speaker, []);
        bySpeaker.get(sc.speaker).push(sc);
    }
    const takes = [];
    for (const [speaker, list] of bySpeaker) {
        let bucket = null;
        let takeCounter = 1;
        for (const sc of list) {
            if (!bucket || bucket.totalDuration + sc.duration > maxSec) {
                if (bucket) takes.push(bucket);
                bucket = {
                    id: `${speaker}-take-${takeCounter++}`,
                    speaker,
                    sceneIds: [],
                    lines: [],
                    totalDuration: 0,
                };
            }
            bucket.sceneIds.push(sc.id);
            bucket.lines.push(sc.text);
            bucket.totalDuration += sc.duration;
        }
        if (bucket) takes.push(bucket);
    }
    // combinedText reads naturally for TTS (full sentences, comma pauses).
    for (const t of takes) {
        t.combinedText = t.lines
            .map((l) => String(l).trim())
            .map((l) => l.endsWith('.') || l.endsWith('?') || l.endsWith('!') ? l : l + '.')
            .join(' ');
    }
    return takes;
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
