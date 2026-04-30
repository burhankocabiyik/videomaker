/**
 * fal.ai TTS adapter — gender-matched ElevenLabs voices with natural prosody.
 *
 * The previous fixed host=Roger / guest=Sarah mapping created
 * gender-mismatch issues whenever the image generator picked an opposite-
 * gender character. The planner now emits speaker.gender and we choose
 * from a pool of warm, conversational voices that match.
 *
 * We also dial in expressive prosody settings so the delivery doesn't read
 * as robotic: lower stability for emotional variance, higher style boost.
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

const TTS_ENDPOINT = process.env.FAL_TTS_ENDPOINT || 'fal-ai/elevenlabs/tts/turbo-v2.5';

const VOICE_POOL = {
    male:   ['Roger', 'Liam', 'Brian', 'Charlie', 'Bill'],
    female: ['Sarah', 'Charlotte', 'Aria', 'Lily', 'Jessica'],
};

function pickVoice(gender, seed) {
    const pool = VOICE_POOL[gender] || VOICE_POOL.male;
    let h = 0;
    for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return pool[Math.abs(h) % pool.length];
}

export function resolveVoice({ voice, gender, speakerId }) {
    if (voice) return voice;
    const env = speakerId === 'host' ? process.env.FAL_VOICE_HOST
              : speakerId === 'guest' ? process.env.FAL_VOICE_GUEST
              : null;
    if (env) return env;
    return pickVoice(gender, speakerId);
}

export async function generateVoice({ text, speaker = 'host', gender, voice }) {
    ensureConfigured();
    if (!text || !text.trim()) throw new Error('text is required');

    const chosenVoice = resolveVoice({ voice, gender, speakerId: speaker });

    const isElevenlabs = TTS_ENDPOINT.includes('elevenlabs');
    const isKokoro = TTS_ENDPOINT.includes('kokoro');

    let input;
    if (isElevenlabs) {
        input = {
            text,
            voice: chosenVoice,
            stability: 0.35,
            similarity_boost: 0.78,
            style: 0.55,
            speed: 1,
        };
    } else if (isKokoro) {
        input = { prompt: text, voice: chosenVoice };
    } else {
        input = { text, voice: chosenVoice };
    }

    const result = await fal.subscribe(TTS_ENDPOINT, { input, logs: false });

    const data = result?.data || result || {};
    const audio = data.audio || data.audio_url || result?.audio || result?.audio_url;
    const url = typeof audio === 'string' ? audio : (audio?.url || null);
    if (!url) throw new Error('TTS returned no audio URL');
    return {
        provider: 'fal',
        endpoint: TTS_ENDPOINT,
        voice: chosenVoice,
        gender: gender || null,
        url,
        raw: result,
    };
}
