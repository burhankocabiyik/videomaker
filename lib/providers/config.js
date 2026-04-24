/**
 * Runtime provider configuration.
 *
 * Resolved from env vars on the server. Clients should query /api/config to
 * discover the active provider and its capabilities without leaking keys.
 */
export const PROVIDERS = {
    FAL: 'fal',
    MUAPI: 'muapi',
    LOCAL: 'local',
};

export function resolveProvider() {
    const raw = (process.env.AI_PROVIDER || '').toLowerCase();
    if (raw === PROVIDERS.FAL) return PROVIDERS.FAL;
    if (raw === PROVIDERS.LOCAL) return PROVIDERS.LOCAL;
    if (raw === PROVIDERS.MUAPI) return PROVIDERS.MUAPI;

    // Zero-config defaults — pick whichever key is present, else fall back
    // to BYOK Muapi for the best out-of-the-box DX.
    if (process.env.FAL_KEY) return PROVIDERS.FAL;
    if (process.env.LOCAL_INFERENCE_URL) return PROVIDERS.LOCAL;
    return PROVIDERS.MUAPI;
}

export function providerLabel(id) {
    switch (id) {
        case PROVIDERS.FAL:   return 'fal.ai';
        case PROVIDERS.LOCAL: return 'Local runtime';
        default:              return 'Muapi.ai (BYOK)';
    }
}

export function providerSummary() {
    const provider = resolveProvider();
    return {
        provider,
        label: providerLabel(provider),
        capabilities: {
            image: true,
            video: provider === PROVIDERS.MUAPI || provider === PROVIDERS.FAL,
            lipsync: provider === PROVIDERS.MUAPI || provider === PROVIDERS.FAL,
            agents: provider === PROVIDERS.MUAPI,
            workflows: provider === PROVIDERS.MUAPI,
            local: provider === PROVIDERS.LOCAL,
        },
        // Never leak keys — just advertise whether one is configured.
        serverKeyConfigured: Boolean(
            (provider === PROVIDERS.FAL   && process.env.FAL_KEY) ||
            (provider === PROVIDERS.MUAPI && process.env.MUAPI_KEY) ||
            (provider === PROVIDERS.LOCAL && process.env.LOCAL_INFERENCE_URL)
        ),
    };
}
