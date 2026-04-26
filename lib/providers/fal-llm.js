import { fal } from '@fal-ai/client';
import { plannerStyleDirective } from '../prompt-library.js';

let configured = false;
function ensureConfigured() {
    if (configured) return;
    const key = process.env.FAL_KEY;
    if (!key) throw new Error('FAL_KEY not configured. Add it in Vercel env or .env.local.');
    fal.config({ credentials: key });
    configured = true;
}

const MODEL = process.env.FAL_LLM_MODEL || 'openai/gpt-4o-mini';

export async function planVideoScenes(opts = {}) {
    const {
        topic,
        tone = 'cinematic',
        audience = 'app users',
        durationSec = 30,
        style = 'cinematic product commercial',
        useVideoClips = false,
        sceneCount: requestedCount,
        clipDuration,
    } = opts;
    ensureConfigured();

    const sceneCount = Number.isFinite(requestedCount)
        ? Math.max(3, Math.min(30, Math.round(requestedCount)))
        : Math.max(3, Math.min(30, Math.round(durationSec / 5)));
    const perScene = Number.isFinite(clipDuration)
        ? Math.max(3, Math.min(30, Math.round(clipDuration)))
        : Math.max(3, Math.floor(durationSec / sceneCount));

    const system = [
        'You are a senior creative director writing shot lists for AI-generated product/UGC videos.',
        'You MUST reply with ONE minified JSON object on a single line, no markdown, no code fences, no commentary.',
        plannerStyleDirective(),
        'voiceText is a narrator line in the same language as the topic, max 16 words.',
    ].join(' ');

    const schema = `{"title":"<=60 chars","hook":"one-liner","style":"short tag","musicPrompt":"one line","scenes":[{"id":1,"duration":${perScene},"imagePrompt":"...","videoPrompt":"...","voiceText":"...","subtitle":"...","animation":"slowZoomIn|slowZoomOut|panRight|panLeft|breathing|static"}]}`;

    const userPrompt = [
        `TOPIC: ${topic}`,
        `TONE: ${tone}`,
        audience ? `AUDIENCE: ${audience}` : null,
        `STYLE: ${style}`,
        `DURATION: ${durationSec}s total, ${sceneCount} scenes @ ~${perScene}s each`,
        `MOTION CLIPS: ${useVideoClips ? 'yes' : 'no'}`,
        'Return exactly this JSON shape (ids 1..N, no trailing commas, no comments):',
        schema,
    ].filter(Boolean).join('\n');

    const result = await fal.subscribe('fal-ai/any-llm', {
        input: {
            model: MODEL,
            system_prompt: system,
            prompt: userPrompt,
        },
        logs: false,
    });

    const text = result?.data?.output ?? result?.output ?? '';
    if (!text) throw new Error('Scene planner returned empty output.');

    const parsed = extractJson(text);
    if (!parsed) {
        throw new Error(`Scene planner did not return valid JSON. Raw (${text.length} chars): ${text.slice(0, 500)}`);
    }

    const scenes = (parsed.scenes || []).map((s, idx) => ({
        id: Number(s.id ?? idx + 1),
        duration: Number(s.duration ?? perScene),
        imagePrompt: String(s.imagePrompt || ''),
        videoPrompt: String(s.videoPrompt || ''),
        voiceText: String(s.voiceText || ''),
        subtitle: String(s.subtitle || s.voiceText || ''),
        animation: ['slowZoomIn', 'slowZoomOut', 'panRight', 'panLeft', 'breathing', 'static'].includes(s.animation)
            ? s.animation
            : 'slowZoomIn',
    }));

    if (scenes.length === 0) {
        throw new Error('Scene planner returned zero scenes.');
    }

    return {
        title: String(parsed.title || topic).slice(0, 80),
        hook: String(parsed.hook || ''),
        style: String(parsed.style || style),
        musicPrompt: String(parsed.musicPrompt || ''),
        scenes,
    };
}

/**
 * Lenient JSON extraction:
 *   1. Strip markdown fences if present.
 *   2. Try a direct JSON.parse.
 *   3. Fall back to a balanced-brace scan.
 *   4. As a last resort, trim trailing commas/invalid chars.
 */
function extractJson(raw) {
    if (!raw) return null;

    let text = raw.trim();

    // Strip markdown fence
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();

    // Direct parse
    try { return JSON.parse(text); } catch { /* fall through */ }

    // Balanced-brace scan
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
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
                try { return JSON.parse(slice); } catch { /* retry with repair */ }
                // Repair: drop trailing commas in objects/arrays.
                const repaired = slice.replace(/,(\s*[}\]])/g, '$1');
                try { return JSON.parse(repaired); } catch { return null; }
            }
        }
    }
    return null;
}
