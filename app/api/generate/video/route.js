import { NextResponse } from 'next/server';
import { generateVideo } from '@/lib/providers/index.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

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
        const detail = {
            error: error.message || 'Generation failed',
            name: error.name,
            status: error.status,
            body: error.body,
        };
        return NextResponse.json(detail, { status: 500 });
    }
}
