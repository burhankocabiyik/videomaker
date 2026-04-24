const MUAPI_BASE = 'https://api.muapi.ai';

function requireKey() {
    const key = process.env.MUAPI_KEY;
    if (!key) throw new Error('MUAPI_KEY not set in environment.');
    return key;
}

async function pollForResult(requestId, key, maxAttempts = 120, interval = 2000) {
    const url = `${MUAPI_BASE}/api/v1/predictions/${requestId}/result`;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, interval));
        const response = await fetch(url, { headers: { 'Content-Type': 'application/json', 'x-api-key': key } });
        if (!response.ok) {
            if (response.status >= 500) continue;
            throw new Error(`Poll failed: ${response.status}`);
        }
        const data = await response.json();
        const status = data.status?.toLowerCase();
        if (status === 'completed' || status === 'succeeded' || status === 'success') return data;
        if (status === 'failed' || status === 'error') {
            throw new Error(`Generation failed: ${data.error || 'Unknown error'}`);
        }
    }
    throw new Error('Generation timed out');
}

export async function generateImage(params = {}) {
    const key = requireKey();
    const endpoint = params.endpoint || params.model || 'flux-schnell-image';
    const payload = {
        prompt: params.prompt,
    };
    if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
    if (params.resolution) payload.resolution = params.resolution;
    if (params.image_url) {
        payload.image_url = params.image_url;
        payload.strength = params.strength || 0.6;
    }
    if (params.seed && params.seed !== -1) payload.seed = params.seed;

    const response = await fetch(`${MUAPI_BASE}/api/v1/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Muapi submit failed: ${response.status} ${text.slice(0, 200)}`);
    }
    const submit = await response.json();
    const requestId = submit.request_id || submit.id;
    if (!requestId) return { provider: 'muapi', endpoint, url: submit.url || null, raw: submit };

    const result = await pollForResult(requestId, key);
    const url = result.outputs?.[0] || result.url || result.output?.url || null;
    return { provider: 'muapi', endpoint, url, raw: result };
}
