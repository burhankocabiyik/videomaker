import { NextResponse } from 'next/server';
import { providerSummary } from '@/lib/providers/config.js';
import { FAL_IMAGE_MODELS, FAL_VIDEO_MODELS } from '@/lib/providers/fal.js';

export const dynamic = 'force-dynamic';

export async function GET() {
    const summary = providerSummary();
    return NextResponse.json({
        ...summary,
        models: {
            image: summary.provider === 'fal' ? FAL_IMAGE_MODELS.map(({ id, label }) => ({ id, label })) : [],
            video: summary.provider === 'fal' ? FAL_VIDEO_MODELS.map(({ id, label }) => ({ id, label })) : [],
        },
    });
}
