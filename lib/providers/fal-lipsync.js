/**
 * fal Sync-Lipsync v2 adapter — sync a generated take video to its
 * matching ElevenLabs audio so mouths actually move with the dialogue.
 *
 * Endpoint: fal-ai/sync-lipsync/v2
 * Inputs:   video_url, audio_url, model="lipsync-2-pro" (default), sync_mode
 * Output:   { video: { url } }
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

export async function lipsync({ videoUrl, audioUrl, model = 'lipsync-2-pro', syncMode = 'cut_off' }) {
    ensureConfigured();
    if (!videoUrl) throw new Error('videoUrl is required');
    if (!audioUrl) throw new Error('audioUrl is required');

    const result = await fal.subscribe('fal-ai/sync-lipsync/v2', {
        input: { video_url: videoUrl, audio_url: audioUrl, model, sync_mode: syncMode },
        logs: false,
    });

    const video = result?.data?.video || result?.video;
    const url = typeof video === 'string' ? video : (video?.url || null);
    if (!url) throw new Error('Lipsync returned no video URL');
    return {
        provider: 'fal',
        endpoint: 'fal-ai/sync-lipsync/v2',
        model,
        url,
        raw: result,
    };
}
