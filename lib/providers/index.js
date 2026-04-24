import { PROVIDERS, resolveProvider } from './config.js';
import * as fal from './fal.js';
import * as local from './local.js';

function adapterFor(provider) {
    switch (provider) {
        case PROVIDERS.FAL:   return fal;
        case PROVIDERS.LOCAL: return local;
        default: throw new Error(`Unknown AI_PROVIDER: ${provider}`);
    }
}

export async function generateImage(params) {
    const adapter = adapterFor(resolveProvider());
    if (typeof adapter.generateImage !== 'function') {
        throw new Error('Active provider does not support image generation.');
    }
    return adapter.generateImage(params);
}

export async function generateVideo(params) {
    const adapter = adapterFor(resolveProvider());
    if (typeof adapter.generateVideo !== 'function') {
        throw new Error('Active provider does not support video generation.');
    }
    return adapter.generateVideo(params);
}

export { PROVIDERS, resolveProvider };
export { FAL_IMAGE_MODELS, FAL_VIDEO_MODELS } from './fal.js';
