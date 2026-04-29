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
    'You are a senior podcast producer scripting a short vertical (9:16) podcast about a digital product.',
    'You MUST reply with ONE minified JSON object on a single line — no markdown, no commentary.',
    'Two recurring speakers ("host" and "guest") chat back-and-forth. Each scene is one beat — one short line spoken by one of the two. Lines feel natural, not corporate.',
    'Lines must work as caption text — short, punchy, max 12 words. Word-by-word captioning will overlay them.',
    'imagePrompt must lock visual identity to the speaker description for THAT scene (clothing, hair, set dressing, lighting). videoPrompt describes only motion (subtle nodding, hand gesture, leaning forward).',
    'Avoid identifiable real people; characters should read as anonymized podcast hosts (no celebrity likenesses).',
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

    const schema = `{"showName":"...","brandSticker":{"position":"top-left|top-right","shape":"speech bubble|capsule","copy":"...","palette":"#hex+#hex"},"speakers":[{"id":"host","persona":"...","appearance":"...","wardrobe":"...","setting":"...","framing":"..."},{"id":"guest","persona":"...","appearance":"...","wardrobe":"...","setting":"...","framing":"..."}],"hook":"first-scene attention grabber","scenes":[{"id":1,"speaker":"host","text":"line ≤12 words","duration":${safeClip},"imagePrompt":"detailed visual prompt that includes all speaker identity locks","videoPrompt":"motion-only ≤14 words","emphasis":"key word to italicize|null"}]}`;

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
    const fallbackId = speakerIds[0] || 'host';
    const scenes = (parsed.scenes || []).map((s, idx) => ({
        id: Number(s.id ?? idx + 1),
        speaker: speakerIds.includes(s.speaker) ? s.speaker : fallbackId,
        text: String(s.text || '').slice(0, 140),
        duration: Number(s.duration) || safeClip,
        imagePrompt: String(s.imagePrompt || ''),
        videoPrompt: String(s.videoPrompt || ''),
        emphasis: s.emphasis && typeof s.emphasis === 'string' ? s.emphasis : null,
    }));

    if (scenes.length === 0) throw new Error('Podcast planner returned zero scenes.');
    return {
        showName: parsed.showName || showName,
        brandSticker: parsed.brandSticker || { position: 'top-left', shape: 'speech bubble', copy: showName, palette: '#000+#FFFFFF' },
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
