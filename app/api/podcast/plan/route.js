import { NextResponse } from 'next/server';
import { planPodcastEpisode } from '@/lib/providers/fal-podcast.js';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request) {
    try {
        const body = await request.json();
        if (!body.topic && !body.appOrProduct) {
            return NextResponse.json({ error: 'topic or appOrProduct is required' }, { status: 400 });
        }
        const plan = await planPodcastEpisode({
            topic: body.topic,
            appOrProduct: body.appOrProduct,
            showName: body.showName,
            audience: body.audience,
            tone: body.tone,
            sceneCount: Number(body.sceneCount) || 12,
            clipDuration: Number(body.clipDuration) || 3,
            style: body.style || null,
        });
        return NextResponse.json(plan);
    } catch (error) {
        console.error('[api/podcast/plan]', error);
        return NextResponse.json({ error: error.message || 'Plan failed' }, { status: 500 });
    }
}
