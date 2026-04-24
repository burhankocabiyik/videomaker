import { fal } from '@fal-ai/client';

let configured = false;
function ensureConfigured() {
    if (configured) return;
    const key = process.env.FAL_KEY;
    if (!key) throw new Error('FAL_KEY not configured. Add it in Vercel env or .env.local.');
    fal.config({ credentials: key });
    configured = true;
}

/**
 * Ask fal.ai's any-llm endpoint to return a strict JSON response.
 * We ask for JSON, then best-effort-extract the first balanced {...} block.
 */
export async function planVideoScenes({ topic, tone = 'energetic', audience = 'app users', durationSec = 30, style = 'cinematic product commercial', useVideoClips = false }) {
    ensureConfigured();

    const sceneCount = Math.max(3, Math.min(10, Math.round(durationSec / 5)));
    const perScene = Math.max(3, Math.floor(durationSec / sceneCount));

    const system = `You are a senior creative director writing shot lists for AI-generated product / UGC videos. Return STRICT JSON matching the schema. Every imagePrompt must be detailed (lighting, subject, framing, mood). Every videoPrompt describes motion only (camera moves, subtle subject motion). voiceText is a short narrator line (<=18 words). Respond ONLY with the JSON object, no markdown.`;

    const userPrompt = `TOPIC: ${topic}
TONE: ${tone}
TARGET AUDIENCE: ${audience}
STYLE PRESET: ${style}
TOTAL DURATION: ~${durationSec} seconds
SCENE COUNT: ${sceneCount}
PER-SCENE DURATION: ~${perScene} seconds
USE VIDEO CLIPS (image-to-video): ${useVideoClips}

Return JSON of shape:
{
  "title": "string, <=60 chars",
  "hook": "string, one-liner that opens the video",
  "style": "string, a short tag line style preset to keep all scenes consistent",
  "musicPrompt": "string, one-line vibe for background music",
  "scenes": [
    {
      "id": 1,
      "duration": ${perScene},
      "imagePrompt": "detailed visual prompt for fal.ai flux/nano-banana",
      "videoPrompt": "motion-only prompt for image-to-video, <=20 words",
      "voiceText": "narrator line in the same language as the topic",
      "subtitle": "optional shorter text on screen (or same as voiceText)",
      "animation": "slowZoomIn | slowZoomOut | panRight | panLeft | breathing | static"
    }
  ]
}`;

    const result = await fal.subscribe('fal-ai/any-llm', {
        input: {
            model: 'anthropic/claude-3.5-sonnet',
            system_prompt: system,
            prompt: userPrompt,
        },
        logs: false,
    });

    const text = result?.data?.output || result?.output || '';
    const parsed = extractJson(text);
    if (!parsed) {
        throw new Error('Scene planner did not return valid JSON. Raw output: ' + text.slice(0, 300));
    }

    // Normalize
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

    return {
        title: String(parsed.title || topic).slice(0, 80),
        hook: String(parsed.hook || ''),
        style: String(parsed.style || style),
        musicPrompt: String(parsed.musicPrompt || ''),
        scenes,
    };
}

function extractJson(text) {
    if (!text) return null;
    // Prefer a fenced json block.
    const fence = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
    const candidate = fence ? fence[1] : text;
    // Scan for the first balanced object.
    const start = candidate.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < candidate.length; i++) {
        const ch = candidate[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) {
                const slice = candidate.slice(start, i + 1);
                try {
                    return JSON.parse(slice);
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}
