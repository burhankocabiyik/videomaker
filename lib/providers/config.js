/**
 * Runtime provider configuration.
 *
 * Cloud deployments default to fal.ai. Self-hosted deployments can swap in
 * a local HTTP-compatible inference server by setting LOCAL_INFERENCE_URL.
 */
export const PROVIDERS = {
    FAL: 'fal',
    LOCAL: 'local',
};

export function resolveProvider() {
    const raw = (process.env.AI_PROVIDER || '').toLowerCase();
    if (raw === PROVIDERS.LOCAL) return PROVIDERS.LOCAL;
    if (raw === PROVIDERS.FAL) return PROVIDERS.FAL;
    if (process.env.LOCAL_INFERENCE_URL) return PROVIDERS.LOCAL;
    return PROVIDERS.FAL;
}

export function providerLabel(id) {
    switch (id) {
        case PROVIDERS.LOCAL: return 'Local runtime';
        default:              return 'fal.ai';
    }
}

export function providerSummary() {
    const provider = resolveProvider();
    return {
        provider,
        label: providerLabel(provider),
        capabilities: {
            image: true,
            video: true,
            scenePlan: provider === PROVIDERS.FAL,
            voice: provider === PROVIDERS.FAL,
        },
        serverKeyConfigured: Boolean(
            (provider === PROVIDERS.FAL   && process.env.FAL_KEY) ||
            (provider === PROVIDERS.LOCAL && process.env.LOCAL_INFERENCE_URL),
        ),
    };
}
