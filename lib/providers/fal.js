import { fal } from '@fal-ai/client';

let configured = false;

function ensureConfigured() {
    if (configured) return;
    const key = process.env.FAL_KEY;
    if (!key) {
        throw new Error('FAL_KEY not set in environment. Add it to .env.local or your Vercel project.');
    }
    fal.config({ credentials: key });
    configured = true;
}

// ── Image models ─────────────────────────────────────────────────────────────
// Used as the first frame for image-to-video clips. Fast + sharp beats pretty
// here, since motion will take over right after.
export const FAL_IMAGE_MODELS = [
    {
        id: 'flux-schnell',
        label: 'Flux Schnell (fast)',
        endpoint: 'fal-ai/flux/schnell',
        defaultImageSize: 'landscape_16_9',
    },
    {
        id: 'flux-dev',
        label: 'Flux Dev (balanced)',
        endpoint: 'fal-ai/flux/dev',
        defaultImageSize: 'landscape_16_9',
    },
    {
        id: 'flux-pro',
        label: 'Flux 1.1 Pro (premium)',
        endpoint: 'fal-ai/flux-pro/v1.1',
        defaultImageSize: 'landscape_16_9',
    },
    {
        id: 'seedream-v4',
        label: 'Seedream v4',
        endpoint: 'fal-ai/bytedance/seedream/v4/text-to-image',
        defaultImageSize: 'landscape_16_9',
    },
    {
        id: 'sdxl',
        label: 'Stable Diffusion XL',
        endpoint: 'fal-ai/fast-sdxl',
        defaultImageSize: 'landscape_16_9',
    },
    {
        id: 'nano-banana',
        label: 'Nano Banana',
        endpoint: 'fal-ai/nano-banana',
        defaultImageSize: 'landscape_16_9',
    },
];

// ── Video models ─────────────────────────────────────────────────────────────
// Image-to-video by default. Seedance Pro is the fastest sweet-spot; Kling
// v2.1 Master is the quality ceiling. We avoid v1 — quality jump is noticeable.
export const FAL_VIDEO_MODELS = [
    {
        id: 'seedance-v2-pro',
        label: 'Seedance v2 Pro (latest, recommended)',
        endpoint: 'fal-ai/bytedance/seedance/v2/pro/image-to-video',
        mode: 'image-to-video',
        durations: ['5', '10'],
    },
    {
        id: 'seedance-v2-lite',
        label: 'Seedance v2 Lite (cheapest)',
        endpoint: 'fal-ai/bytedance/seedance/v2/lite/image-to-video',
        mode: 'image-to-video',
        durations: ['5', '10'],
    },
    {
        id: 'kling-v2.1-master',
        label: 'Kling v2.1 Master (premium)',
        endpoint: 'fal-ai/kling-video/v2.1/master/image-to-video',
        mode: 'image-to-video',
        durations: ['5', '10'],
    },
    {
        id: 'kling-v2.1-pro',
        label: 'Kling v2.1 Pro',
        endpoint: 'fal-ai/kling-video/v2.1/pro/image-to-video',
        mode: 'image-to-video',
        durations: ['5', '10'],
    },
    {
        id: 'kling-v2.1-standard',
        label: 'Kling v2.1 Standard',
        endpoint: 'fal-ai/kling-video/v2.1/standard/image-to-video',
        mode: 'image-to-video',
        durations: ['5', '10'],
    },
    {
        id: 'seedance-v2-pro-t2v',
        label: 'Seedance v2 Pro (text-to-video)',
        endpoint: 'fal-ai/bytedance/seedance/v2/pro/text-to-video',
        mode: 'text-to-video',
        durations: ['5', '10'],
    },
];

export function findImageModel(id) {
    return FAL_IMAGE_MODELS.find((m) => m.id === id) || FAL_IMAGE_MODELS[0];
}

export function findVideoModel(id) {
    return FAL_VIDEO_MODELS.find((m) => m.id === id) || FAL_VIDEO_MODELS[0];
}

export async function generateImage(params = {}) {
    ensureConfigured();
    const model = findImageModel(params.model);
    const input = {
        prompt: params.prompt,
        image_size: params.image_size || params.aspect_ratio || model.defaultImageSize,
        num_images: params.num_images || 1,
    };
    if (params.seed != null && params.seed !== -1) input.seed = params.seed;
    if (params.image_url) input.image_url = params.image_url;
    if (params.negative_prompt) input.negative_prompt = params.negative_prompt;

    const result = await fal.subscribe(model.endpoint, { input, logs: false });

    const images = result?.data?.images || result?.images || [];
    const primary = images[0];
    return {
        provider: 'fal',
        model: model.id,
        endpoint: model.endpoint,
        url: primary?.url || null,
        images,
        raw: result,
    };
}

export async function generateVideo(params = {}) {
    ensureConfigured();
    const model = findVideoModel(params.model);

    const input = { prompt: params.prompt };
    // image-to-video needs an anchor frame. Text-to-video skips it.
    if (model.mode === 'image-to-video') {
        if (!params.image_url) {
            throw new Error(`${model.label} is image-to-video — image_url is required.`);
        }
        input.image_url = params.image_url;
    }

    // Normalize duration to string '5' or '10' — that's what both families want.
    if (params.duration) {
        const d = String(params.duration);
        input.duration = model.durations.includes(d) ? d : model.durations[0];
    }
    if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
    if (params.resolution) input.resolution = params.resolution;
    if (params.negative_prompt) input.negative_prompt = params.negative_prompt;

    const result = await fal.subscribe(model.endpoint, { input, logs: false });

    const video = result?.data?.video || result?.video;
    return {
        provider: 'fal',
        model: model.id,
        endpoint: model.endpoint,
        url: video?.url || null,
        raw: result,
    };
}
