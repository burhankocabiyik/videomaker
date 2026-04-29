/**
 * Vision-LLM helpers for analyzing reference videos.
 *
 * Frame extraction happens server-side via ffmpeg (see /api/podcast/analyze).
 * The frames + a prompt are sent to fal.ai's any-llm with a vision-capable
 * model. The model returns a structured description we can feed to the
 * podcast planner so the generated video mirrors the reference's format.
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

const VISION_MODEL = process.env.FAL_VISION_MODEL || 'openai/gpt-4o-mini';

const SYSTEM = [
    'You are a cinematographer reverse-engineering a short vertical podcast clip from sampled frames.',
    'You MUST reply with ONE minified JSON object on a single line — no markdown, no commentary.',
    'Pull the recurring visual identity per speaker so the same character can be re-generated frame-after-frame.',
    'Be specific about clothing, hair, accessories, microphone, set dressing and lighting.',
].join(' ');

const SCHEMA = `{
"format":{"aspect":"9:16|16:9|1:1","totalSeconds":40,"editRhythm":"fast cuts every 2-4s|slow drifting","captionStyle":"bold white sans-serif word-by-word with black stroke|..."},
"brand":{"position":"top-left|top-right|bottom-left|bottom-right|none","shape":"speech bubble|sticker|none","copy":"text on the sticker","palette":"red+white|black+yellow|..."},
"speakers":[
  {"id":"host","name":"label-only","appearance":"hair, beard, hat, jewelry, distinctive features","wardrobe":"specific clothing","setup":"microphone, chair","setting":"backdrop, props, lighting","lookDirection":"camera|left|right","framing":"medium close-up|over-the-shoulder"},
  {"id":"guest","name":"...","appearance":"...","wardrobe":"...","setup":"...","setting":"...","lookDirection":"...","framing":"..."}
],
"subtitle":{"font":"bold sans-serif","caseStyle":"all-caps|title|sentence","sizePx":56,"strokePx":4,"emphasisStyle":"italic accent on key noun|none","wordsPerBeat":2,"position":"lower-third"},
"sceneSuggestions":{"sceneCount":12,"clipDurationSec":3,"alternatingPattern":true}
}`;

export async function analyzeReferenceFrames({ frames, hint = '' }) {
    ensureConfigured();
    if (!Array.isArray(frames) || frames.length === 0) {
        throw new Error('analyzeReferenceFrames: no frames supplied.');
    }

    const userText = [
        hint ? `EXTRA CONTEXT: ${hint}` : null,
        'Look at every frame. Describe ONLY what you actually see in the reference. Do not invent extra speakers.',
        'Return JSON in EXACTLY this shape (fields you cannot infer should be sensible defaults):',
        SCHEMA,
    ].filter(Boolean).join('\n');

    const result = await fal.subscribe('fal-ai/any-llm/vision', {
        input: {
            model: VISION_MODEL,
            system_prompt: SYSTEM,
            prompt: userText,
            image_urls: frames,
        },
        logs: false,
    });

    const text = result?.data?.output ?? result?.output ?? '';
    if (!text) throw new Error('Vision model returned empty output.');
    const parsed = extractJson(text);
    if (!parsed) {
        throw new Error(`Vision model did not return valid JSON. Raw: ${text.slice(0, 400)}`);
    }
    return parsed;
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
