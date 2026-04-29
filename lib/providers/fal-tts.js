/**
 * fal.ai TTS adapter — produces a per-scene voice clip we can sync into
 * the Remotion composition. Defaults to ElevenLabs Turbo v2.5 (quality
 * sweet-spot); the cheaper Kokoro endpoint is a one-env-var fallback.
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

// ElevenLabs takes voice *names*. Two contrasting voices so host vs guest
// reads as a real conversation. Override per-deployment via env.
const VOICE_HOST  = process.env.FAL_VOICE_HOST  || 'Roger';
const VOICE_GUEST = process.env.FAL_VOICE_GUEST || 'Sarah';

export const TTS_VOICES = {
    host:  VOICE_HOST,
    guest: VOICE_GUEST,
};

export async function generateVoice({ text, speaker = 'host', voice }) {
    ensureConfigured();
    if (!text || !text.trim()) throw new Error('text is required');
    const chosenVoice = voice || TTS_VOICES[speaker] || TTS_VOICES.host;

    const isElevenlabs = TTS_ENDPOINT.includes('elevenlabs');
    const isKokoro = TTS_ENDPOINT.includes('kokoro');

    let input;
    if (isElevenlabs) {
        input = { text, voice: chosenVoice, stability: 0.45, similarity_boost: 0.75, speed: 1 };
    } else if (isKokoro) {
        // Kokoro uses `prompt` + `voice`.
        input = { prompt: text, voice: chosenVoice };
    } else {
        // Generic shape — most fal TTS endpoints accept these two.
        input = { text, voice: chosenVoice };
    }

    const result = await fal.subscribe(TTS_ENDPOINT, { input, logs: false });

    // Find the audio URL across the various fal response shapes.
    const data = result?.data || result || {};
    const audio = data.audio || data.audio_url || result?.audio || result?.audio_url;
    const url = typeof audio === 'string' ? audio : (audio?.url || null);
    if (!url) throw new Error('TTS returned no audio URL');
    return {
        provider: 'fal',
        endpoint: TTS_ENDPOINT,
        voice: chosenVoice,
        url,
        raw: result,
    };
}
