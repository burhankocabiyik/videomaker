import { PROVIDERS, resolveProvider } from './config.js';
import * as fal from './fal.js';
import * as muapi from './muapi.js';
import * as local from './local.js';

function adapterFor(provider) {
    switch (provider) {
        case PROVIDERS.FAL:   return fal;
        case PROVIDERS.LOCAL: return local;
        case PROVIDERS.MUAPI: return muapi;
        default: throw new Error(`Unknown AI_PROVIDER: ${provider}`);
    }
}

export async function generateImage(params) {
    const provider = resolveProvider();
    const adapter = adapterFor(provider);
    if (typeof adapter.generateImage !== 'function') {
        throw new Error(`Provider ${provider} does not support image generation yet.`);
    }
    return adapter.generateImage(params);
}

export async function generateVideo(params) {
    const provider = resolveProvider();
    const adapter = adapterFor(provider);
    if (typeof adapter.generateVideo !== 'function') {
        throw new Error(`Provider ${provider} does not support video generation yet. Current provider: ${provider}`);
    }
    return adapter.generateVideo(params);
}

export { PROVIDERS, resolveProvider };
export { FAL_IMAGE_MODELS, FAL_VIDEO_MODELS } from './fal.js';
