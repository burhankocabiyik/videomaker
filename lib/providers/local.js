/**
 * Local provider — delegates to a locally hosted inference server. Intended
 * for self-hosted deployments where you already run Ollama, ComfyUI, sd.cpp,
 * or any OpenAI-compatible image endpoint on your own GPU box.
 *
 * Convention: POST {LOCAL_INFERENCE_URL}/generate with the raw params, expect
 * { url, raw } back. Adapt the endpoint to your runtime.
 */

export async function generateImage(params = {}) {
    const base = process.env.LOCAL_INFERENCE_URL;
    if (!base) {
        throw new Error('LOCAL_INFERENCE_URL not configured. Set it to your local inference server, e.g. http://127.0.0.1:7860');
    }

    const response = await fetch(`${base.replace(/\/$/, '')}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: params.model || 'default',
            prompt: params.prompt,
            negative_prompt: params.negative_prompt,
            aspect_ratio: params.aspect_ratio,
            image_url: params.image_url,
            seed: params.seed,
            steps: params.steps,
            guidance_scale: params.guidance_scale,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Local inference failed: ${response.status} ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    return {
        provider: 'local',
        endpoint: base,
        url: data.url || data.output || null,
        raw: data,
    };
}
