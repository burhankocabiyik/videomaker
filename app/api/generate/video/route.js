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

        // Fish fal.ai's structured validation error out, if present, and
        // translate the most common ones into user-friendly messages so the
        // /video UI can surface them per-scene.
        const detail = error?.body?.detail?.[0];
        if (detail?.type === 'content_policy_violation') {
            return NextResponse.json({
                error: 'content_policy_violation',
                message: 'Seedance refused this image — it may show a recognizable face. Regenerating with a product/UI-focused prompt usually fixes it.',
                field: Array.isArray(detail.loc) ? detail.loc.join('.') : null,
            }, { status: 422 });
        }

        return NextResponse.json({
            error: error.message || 'Generation failed',
            name: error.name,
            status: error.status,
            fieldDetail: detail?.msg || null,
        }, { status: 500 });
    }
}
