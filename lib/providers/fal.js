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

// Maps abstract model ids used by the SaaS UI to concrete fal.ai endpoints.
// Keep this list short + opinionated — users get overwhelmed by 200 options.
export const FAL_IMAGE_MODELS = [
    {
        id: 'flux-schnell',
        label: 'Flux Schnell (fast)',
        endpoint: 'fal-ai/flux/schnell',
        defaultImageSize: 'landscape_4_3',
    },
    {
        id: 'flux-dev',
        label: 'Flux Dev (balanced)',
        endpoint: 'fal-ai/flux/dev',
        defaultImageSize: 'landscape_4_3',
    },
    {
        id: 'flux-pro',
        label: 'Flux 1.1 Pro (premium)',
        endpoint: 'fal-ai/flux-pro/v1.1',
        defaultImageSize: 'landscape_4_3',
    },
    {
        id: 'sdxl',
        label: 'Stable Diffusion XL',
        endpoint: 'fal-ai/fast-sdxl',
        defaultImageSize: 'square_hd',
    },
    {
        id: 'nano-banana',
        label: 'Nano Banana',
        endpoint: 'fal-ai/nano-banana',
        defaultImageSize: 'square_hd',
    },
];

export const FAL_VIDEO_MODELS = [
    {
        id: 'kling-v1',
        label: 'Kling v1 (image-to-video)',
        endpoint: 'fal-ai/kling-video/v1/standard/image-to-video',
    },
    {
        id: 'veo3-fast',
        label: 'Veo 3 Fast (text-to-video)',
        endpoint: 'fal-ai/veo3/fast',
    },
    {
        id: 'ltx-video',
        label: 'LTX Video',
        endpoint: 'fal-ai/ltx-video',
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

    const result = await fal.subscribe(model.endpoint, {
        input,
        logs: false,
    });

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
    const input = {
        prompt: params.prompt,
    };
    if (params.image_url) input.image_url = params.image_url;
    if (params.duration) input.duration = params.duration;
    if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;

    const result = await fal.subscribe(model.endpoint, {
        input,
        logs: false,
    });

    const video = result?.data?.video || result?.video;
    return {
        provider: 'fal',
        model: model.id,
        endpoint: model.endpoint,
        url: video?.url || null,
        raw: result,
    };
}
