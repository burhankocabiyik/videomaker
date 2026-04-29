import { NextResponse } from 'next/server';
import { lipsync } from '@/lib/providers/fal-lipsync.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request) {
    try {
        const body = await request.json();
        if (!body.video_url || !body.audio_url) {
            return NextResponse.json({ error: 'video_url and audio_url are required' }, { status: 400 });
        }
        const out = await lipsync({
            videoUrl: body.video_url,
            audioUrl: body.audio_url,
            model: body.model,
            syncMode: body.sync_mode,
        });
        return NextResponse.json(out);
    } catch (error) {
        console.error('[api/generate/lipsync]', error);
        return NextResponse.json({ error: error.message || 'lipsync failed' }, { status: 500 });
    }
}
