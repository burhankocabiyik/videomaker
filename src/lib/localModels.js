// Frontend-side local model catalog (mirrors electron/lib/modelCatalog.js)
export const LOCAL_MODEL_CATALOG = [
    // ── Z-Image (Tongyi-MAI) ────────────────────────────────────────────────
    {
        id: 'z-image-turbo',
        name: 'Z-Image Turbo',
        description: 'WaveSpeed\'s featured local model — 6B params, ultra-fast 8-step generation. No API key needed.',
        type: 'z-image',
        filename: 'z_image_turbo-Q4_K.gguf',
        sizeGB: 3.4,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 8,
        defaultGuidance: 1.0,
        tags: ['turbo', 'fast', 'local', 'featured'],
        featured: true,
    },
    {
        id: 'z-image-base',
        name: 'Z-Image Base',
        description: 'Full-quality 6B parameter model from Tongyi-MAI — higher detail, 50-step generation.',
        type: 'z-image',
        filename: 'Z-Image-Q4_K_M.gguf',
        sizeGB: 3.5,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 50,
        defaultGuidance: 7.5,
        tags: ['high-quality', 'local', 'detailed'],
        featured: true,
    },
    // ── Classic SD 1.5 ──────────────────────────────────────────────────────
    {
        id: 'dreamshaper-8',
        name: 'Dreamshaper 8',
        description: 'Versatile SD 1.5 model — great for portraits, landscapes, and artistic styles.',
        type: 'sd1',
        filename: 'DreamShaper_8_pruned.safetensors',
        sizeGB: 2.1,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 20,
        defaultGuidance: 7.5,
        tags: ['photorealistic', 'artistic', 'versatile'],
    },
    {
        id: 'realistic-vision-v51',
        name: 'Realistic Vision v5.1',
        description: 'Highly photorealistic people and scenes, based on SD 1.5.',
        type: 'sd1',
        filename: 'realisticVisionV51_v51VAE.safetensors',
        sizeGB: 2.1,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 25,
        defaultGuidance: 7,
        tags: ['photorealistic', 'portraits', 'people'],
    },
    {
        id: 'anything-v5',
        name: 'Anything v5',
        description: 'High quality anime and illustration style image generation.',
        type: 'sd1',
        filename: 'anything-v5-PrtRE.safetensors',
        sizeGB: 2.1,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 20,
        defaultGuidance: 7,
        tags: ['anime', 'illustration', 'artistic'],
    },
    // ── SDXL ────────────────────────────────────────────────────────────────
    {
        id: 'stable-diffusion-xl-base',
        name: 'SDXL Base 1.0',
        description: 'Official Stable Diffusion XL base model — higher resolution, excellent quality.',
        type: 'sdxl',
        filename: 'sd_xl_base_1.0.safetensors',
        sizeGB: 6.9,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultSteps: 30,
        defaultGuidance: 7.5,
        tags: ['sdxl', 'high-quality', 'versatile'],
    },
];

export function getLocalModelById(id) {
    return LOCAL_MODEL_CATALOG.find(m => m.id === id) || null;
}
