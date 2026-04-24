'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const VideoPlayer = dynamic(
    () => import('@/components/remotion/Player.jsx').then((m) => m.VideoPlayer),
    { ssr: false, loading: () => <PlayerSkeleton /> },
);

function PlayerSkeleton() {
    return (
        <div className="w-full aspect-video rounded-xl bg-black border border-white/10 flex items-center justify-center text-white/30 text-sm">
            Loading preview…
        </div>
    );
}

const CLIP_DURATIONS = [
    { id: 5,  label: '5 s clips' },
    { id: 10, label: '10 s clips' },
];
const TONES = ['cinematic', 'energetic', 'playful', 'authoritative', 'inspirational'];

const VIDEO_MODELS = [
    { id: 'seedance-2',         label: 'Seedance 2.0 (latest, recommended)' },
    { id: 'seedance-2-fast',    label: 'Seedance 2.0 Fast (cheapest)' },
    { id: 'kling-v2.1-master',  label: 'Kling v2.1 Master (premium)' },
    { id: 'kling-v2.1-pro',     label: 'Kling v2.1 Pro' },
    { id: 'kling-v2.1-standard',label: 'Kling v2.1 Standard' },
];

const IMAGE_MODELS = [
    { id: 'flux-schnell', label: 'Flux Schnell (fast)' },
    { id: 'seedream-v4',  label: 'Seedream v4' },
    { id: 'flux-dev',     label: 'Flux Dev' },
    { id: 'flux-pro',     label: 'Flux 1.1 Pro' },
    { id: 'nano-banana',  label: 'Nano Banana' },
];

function stateToStep(planning, generating, doneIds, totalScenes) {
    if (planning) return 'Planning scenes';
    if (generating.size > 0) return `Rendering ${doneIds.size}/${totalScenes}`;
    if (totalScenes && doneIds.size === totalScenes) return 'All clips ready';
    return 'Idle';
}

export default function VideoClient({ serverKeyConfigured, providerLabel }) {
    const [form, setForm] = useState({
        topic: '',
        tone: 'cinematic',
        audience: '',
        clipDuration: 5,
        sceneCount: 6,
        imageModel: 'flux-schnell',
        videoModel: 'seedance-2',
        useVideoClips: true,
    });
    const [plan, setPlan] = useState(null);
    const [assets, setAssets] = useState({});
    const [errors, setErrors] = useState({ global: '', byScene: {} });
    const [planning, setPlanning] = useState(false);
    const [generating, setGenerating] = useState(new Set());
    const planAbort = useRef(null);

    const doneIds = useMemo(() => {
        const s = new Set();
        for (const [id, a] of Object.entries(assets)) {
            const scene = plan?.scenes?.find((sc) => sc.id === Number(id));
            if (!scene) continue;
            // A scene is "done" when it has either a video clip (if clips are on)
            // or at least an image (fallback / still mode).
            if (form.useVideoClips ? a?.videoUrl : a?.imageUrl) s.add(Number(id));
        }
        return s;
    }, [assets, plan, form.useVideoClips]);

    const totalScenes = plan?.scenes?.length || 0;
    const stepLabel = stateToStep(planning, generating, doneIds, totalScenes);
    const durationSec = form.clipDuration * form.sceneCount;

    const onChange = (patch) => setForm((f) => ({ ...f, ...patch }));

    const handlePlan = useCallback(async (e) => {
        e?.preventDefault();
        if (planning || !form.topic.trim()) return;
        planAbort.current?.abort();
        planAbort.current = new AbortController();
        setErrors({ global: '', byScene: {} });
        setAssets({});
        setPlan(null);
        setPlanning(true);
        try {
            const response = await fetch('/api/video/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: form.topic,
                    tone: form.tone,
                    audience: form.audience,
                    durationSec,
                    sceneCount: form.sceneCount,
                    clipDuration: form.clipDuration,
                    useVideoClips: form.useVideoClips,
                }),
                signal: planAbort.current.signal,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Plan failed');
            // Snap scene durations to the clip duration we're rendering.
            const scenes = data.scenes.map((s) => ({ ...s, duration: form.clipDuration }));
            const snapped = { ...data, scenes };
            setPlan(snapped);
            snapped.scenes.forEach((scene) => generateAssetsFor(scene, snapped, form));
        } catch (err) {
            if (err.name !== 'AbortError') setErrors((e) => ({ ...e, global: err.message }));
        } finally {
            setPlanning(false);
        }
    }, [form, planning, durationSec]);

    const generateAssetsFor = useCallback(async (scene, localPlan, localForm) => {
        setGenerating((g) => new Set(g).add(scene.id));
        setErrors((e) => {
            const { [scene.id]: _drop, ...rest } = e.byScene || {};
            return { ...e, byScene: rest };
        });
        try {
            // 1. Image — always generated, doubles as thumbnail + anchor frame.
            const imageResponse = await fetch('/api/generate/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: [scene.imagePrompt, localPlan.style].filter(Boolean).join(', '),
                    model: localForm.imageModel,
                    image_size: 'landscape_16_9',
                }),
            });
            const imageData = await imageResponse.json();
            if (!imageResponse.ok) throw new Error(imageData.error || 'image generation failed');
            const imageUrl = imageData.url;
            setAssets((a) => ({ ...a, [scene.id]: { ...(a[scene.id] || {}), imageUrl } }));

            // 2. Video clip — image-to-video using the chosen model.
            if (localForm.useVideoClips) {
                const videoResponse = await fetch('/api/generate/video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: scene.videoPrompt || 'subtle cinematic motion, camera drift, film grain',
                        image_url: imageUrl,
                        model: localForm.videoModel,
                        duration: String(localForm.clipDuration),
                    }),
                });
                const vd = await videoResponse.json();
                if (!videoResponse.ok || !vd.url) {
                    throw new Error(vd.error || 'video clip failed');
                }
                setAssets((a) => ({ ...a, [scene.id]: { ...(a[scene.id] || {}), videoUrl: vd.url } }));
            }
        } catch (err) {
            setErrors((e) => ({ ...e, byScene: { ...e.byScene, [scene.id]: err.message } }));
        } finally {
            setGenerating((g) => {
                const next = new Set(g);
                next.delete(scene.id);
                return next;
            });
        }
    }, []);

    const regenerateScene = (scene) => {
        setAssets((a) => { const n = { ...a }; delete n[scene.id]; return n; });
        generateAssetsFor(scene, plan, form);
    };

    const downloadZip = async () => {
        if (!plan) return;
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        zip.file('plan.json', JSON.stringify({ plan, assets, form }, null, 2));
        zip.file('README.txt', [
            'GOAT UGC AI — exported asset bundle',
            '',
            'plan.json          — full scene list with prompts and the original brief',
            'scene-N-image.jpg  — still used as the anchor frame / thumbnail',
            'scene-N-video.mp4  — generated motion clip (if enabled)',
            '',
            'Render locally with Remotion:',
            '  1. npx create-video my-video (pick Hello World)',
            '  2. Drop this folder into public/assets/',
            '  3. Build a composition that sequences scene-N-video.mp4 for `form.clipDuration` seconds each.',
            '  4. npx remotion render',
        ].join('\n'));

        const fetches = Object.entries(assets).map(async ([id, a]) => {
            if (a.imageUrl) {
                try {
                    const blob = await fetch(a.imageUrl).then((r) => r.blob());
                    zip.file(`scene-${id}-image.jpg`, blob);
                } catch { /* skip */ }
            }
            if (a.videoUrl) {
                try {
                    const blob = await fetch(a.videoUrl).then((r) => r.blob());
                    zip.file(`scene-${id}-video.mp4`, blob);
                } catch { /* skip */ }
            }
        });
        await Promise.all(fetches);
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(plan.title || 'goat-ugc').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const allReady = totalScenes > 0 && doneIds.size === totalScenes;

    return (
        <div className="grid lg:grid-cols-[380px_1fr] gap-6">
            {/* Brief panel */}
            <form onSubmit={handlePlan} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 flex flex-col gap-5 h-fit">
                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">
                        What&apos;s the video about?
                    </label>
                    <textarea
                        value={form.topic}
                        onChange={(e) => onChange({ topic: e.target.value })}
                        rows={4}
                        placeholder="30-second launch teaser for a B2B invoicing app — positions us against boring legacy tools, ends on a download CTA."
                        className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Tone</label>
                        <select
                            value={form.tone}
                            onChange={(e) => onChange({ tone: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                        >
                            {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Scenes</label>
                        <select
                            value={form.sceneCount}
                            onChange={(e) => onChange({ sceneCount: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                        >
                            {[3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Clip length</label>
                        <select
                            value={form.clipDuration}
                            onChange={(e) => onChange({ clipDuration: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                        >
                            {CLIP_DURATIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <div className="text-[12px] text-white/50 pb-1">
                            Total: <span className="text-white font-semibold">{durationSec}s</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Audience (optional)</label>
                    <input
                        value={form.audience}
                        onChange={(e) => onChange({ audience: e.target.value })}
                        placeholder="indie app founders, Shopify brands, GenZ buyers…"
                        className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                    />
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Image model (anchor frame)</label>
                    <select
                        value={form.imageModel}
                        onChange={(e) => onChange({ imageModel: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                    >
                        {IMAGE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Video model</label>
                    <select
                        value={form.videoModel}
                        onChange={(e) => onChange({ videoModel: e.target.value })}
                        disabled={!form.useVideoClips}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30 disabled:opacity-40"
                    >
                        {VIDEO_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                </div>

                <label className="flex items-center gap-3 text-[12px] text-white/70 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.useVideoClips}
                        onChange={(e) => onChange({ useVideoClips: e.target.checked })}
                        className="accent-[#d9ff00] w-4 h-4"
                    />
                    <span>Generate motion clips (Seedance / Kling). Turn off for cheap Ken Burns preview only.</span>
                </label>

                <button
                    type="submit"
                    disabled={planning || !form.topic.trim()}
                    className="h-11 rounded-md bg-[#d9ff00] text-black text-sm font-bold hover:bg-[#e5ff33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {planning ? 'Planning…' : plan ? 'Re-plan with new brief' : 'Generate video'}
                </button>

                {!serverKeyConfigured ? (
                    <div className="text-[11px] text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-md p-3">
                        No server key for <b>{providerLabel}</b>. Set <code>FAL_KEY</code> on Vercel and redeploy.
                    </div>
                ) : null}
                {errors.global ? (
                    <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-md p-3">{errors.global}</div>
                ) : null}

                <div className="text-[11px] text-white/40 leading-relaxed">
                    Heads up: motion clips take 60–180 s per scene on Seedance/Kling. All scenes render in parallel, so a 6-scene video
                    usually lands in under 3 minutes.
                </div>
            </form>

            {/* Canvas */}
            <div className="space-y-4">
                {plan ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <div className="text-[11px] font-bold text-[#d9ff00] uppercase tracking-wider mb-1">Director&apos;s cut</div>
                                <div className="text-xl font-bold">{plan.title}</div>
                                {plan.hook ? <div className="text-white/60 text-sm mt-1 max-w-lg">{plan.hook}</div> : null}
                            </div>
                            <div className="text-right">
                                <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider">{stepLabel}</div>
                                <div className="text-sm text-white/70 mt-1">{doneIds.size}/{totalScenes} clips ready</div>
                            </div>
                        </div>
                        <VideoPlayer scenes={plan.scenes} assets={assets} />
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            <button
                                onClick={downloadZip}
                                disabled={doneIds.size === 0}
                                className="h-9 px-4 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold disabled:opacity-40"
                            >
                                Download assets (.zip)
                            </button>
                            {!allReady ? (
                                <span className="text-[11px] text-white/40">Scenes fill in as fal.ai returns each clip.</span>
                            ) : (
                                <span className="text-[11px] text-[#d9ff00]">All clips ready. Hit play to watch.</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
                        Write a brief on the left, hit “Generate video”, and the director will hand back a scene-by-scene shot list —
                        then render each scene on Seedance or Kling.
                    </div>
                )}

                {plan?.scenes?.length ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Scene shot list</div>
                        <ul className="space-y-3">
                            {plan.scenes.map((scene) => {
                                const a = assets[scene.id] || {};
                                const busy = generating.has(scene.id);
                                const sceneErr = errors.byScene?.[scene.id];
                                return (
                                    <li key={scene.id} className="flex gap-4 items-stretch">
                                        <div className="w-40 h-24 flex-none rounded-lg overflow-hidden bg-black/50 border border-white/5 relative">
                                            {a.videoUrl ? (
                                                <video
                                                    src={a.videoUrl}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                    loop
                                                    playsInline
                                                    autoPlay
                                                />
                                            ) : a.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={a.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white/30 text-[11px]">
                                                    {busy ? 'Rendering…' : 'Queued'}
                                                </div>
                                            )}
                                            {a.videoUrl ? (
                                                <span className="absolute top-1 left-1 text-[9px] uppercase font-bold bg-[#d9ff00] text-black px-1.5 py-0.5 rounded">motion</span>
                                            ) : a.imageUrl ? (
                                                <span className="absolute top-1 left-1 text-[9px] uppercase font-bold bg-white/20 text-white/80 px-1.5 py-0.5 rounded">still</span>
                                            ) : null}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-[11px] text-white/50 mb-1">
                                                <span className="font-bold text-white/80">Scene {scene.id}</span>
                                                <span>·</span>
                                                <span>{scene.duration}s</span>
                                            </div>
                                            <div className="text-sm text-white/85 leading-snug">&ldquo;{scene.voiceText}&rdquo;</div>
                                            <div className="text-[11px] text-white/40 mt-1 line-clamp-2" title={scene.imagePrompt}>
                                                <span className="text-white/60 font-semibold">IMG:</span> {scene.imagePrompt}
                                            </div>
                                            {scene.videoPrompt ? (
                                                <div className="text-[11px] text-white/40 line-clamp-1" title={scene.videoPrompt}>
                                                    <span className="text-white/60 font-semibold">MOTION:</span> {scene.videoPrompt}
                                                </div>
                                            ) : null}
                                            {sceneErr ? (
                                                <div className="text-[11px] text-amber-400/80 mt-1">⚠ {sceneErr}</div>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => regenerateScene(scene)}
                                                disabled={busy}
                                                className="h-8 px-3 rounded-md text-[11px] font-semibold bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40"
                                            >
                                                {busy ? '...' : 'Regenerate'}
                                            </button>
                                            {a.videoUrl ? (
                                                <a
                                                    href={a.videoUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="h-8 px-3 rounded-md text-[11px] font-semibold text-white/60 border border-white/10 hover:bg-white/5 flex items-center justify-center"
                                                >
                                                    Open ↗
                                                </a>
                                            ) : null}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
