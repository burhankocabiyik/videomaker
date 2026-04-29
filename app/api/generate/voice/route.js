import { NextResponse } from 'next/server';
import { generateVoice } from '@/lib/providers/fal-tts.js';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request) {
    try {
        const body = await request.json();
        if (!body.text || typeof body.text !== 'string') {
            return NextResponse.json({ error: 'text is required' }, { status: 400 });
        }
        const out = await generateVoice({
            text: body.text,
            speaker: body.speaker || 'host',
            voice: body.voice,
        });
        return NextResponse.json(out);
    } catch (error) {
        console.error('[api/generate/voice]', error);
        return NextResponse.json({ error: error.message || 'voice failed' }, { status: 500 });
    }
}
