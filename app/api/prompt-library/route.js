import { NextResponse } from 'next/server';
import {
    LTX2_PRINCIPLES,
    CAMERA_MOVES,
    LIGHTING_LOOKS,
    FILM_LOOKS,
    NEGATIVE_TAILS,
    SCENE_TEMPLATES,
} from '@/lib/prompt-library.js';

export const dynamic = 'force-static';

export async function GET() {
    return NextResponse.json({
        version: 1,
        principles: LTX2_PRINCIPLES,
        cameraMoves: CAMERA_MOVES,
        lightingLooks: LIGHTING_LOOKS,
        filmLooks: FILM_LOOKS,
        negativeTails: NEGATIVE_TAILS,
        templates: SCENE_TEMPLATES,
        source: 'PROMPT_LIBRARY.md (LTX-2 cinematographer style)',
    });
}
