import { NextResponse } from 'next/server';
import { planVideoScenes } from '@/lib/providers/fal-llm.js';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request) {
    try {
        const body = await request.json();
        if (!body.topic || typeof body.topic !== 'string' || body.topic.trim().length < 3) {
            return NextResponse.json({ error: 'topic is required (min 3 chars)' }, { status: 400 });
        }
        const plan = await planVideoScenes({
            topic: body.topic.trim(),
            tone: body.tone,
            audience: body.audience,
            durationSec: Number(body.durationSec) || 30,
            style: body.style,
            useVideoClips: Boolean(body.useVideoClips),
        });
        return NextResponse.json(plan);
    } catch (error) {
        console.error('[api/video/plan]', error);
        return NextResponse.json({ error: error.message || 'Scene planning failed' }, { status: 500 });
    }
}
