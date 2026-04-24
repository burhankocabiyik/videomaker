import { NextResponse } from 'next/server';
import { generateVideo } from '@/lib/providers/index.js';

export const runtime = 'nodejs';
export const maxDuration = 800;

export async function POST(request) {
    try {
        const body = await request.json();
        if (!body.prompt || typeof body.prompt !== 'string') {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }
        const result = await generateVideo(body);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[api/generate/video]', error);
        return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
    }
}
