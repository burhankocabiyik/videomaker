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

const DURATION_OPTIONS = [15, 30, 45, 60];
const TONES = ['energetic', 'cinematic', 'playful', 'authoritative', 'inspirational'];

function stateToStep(planning, generatingIds, doneIds, total) {
    if (planning) return 'Planning scenes';
    if (generatingIds.size > 0) return `Generating ${doneIds.size + 1}/${total} scene assets`;
    if (total && doneIds.size === total) return 'Ready to preview';
    return 'Idle';
}

export default function VideoClient({ serverKeyConfigured, providerLabel }) {
    const [form, setForm] = useState({
        topic: '',
        tone: 'cinematic',
        audience: '',
        durationSec: 30,
        useVideoClips: false,
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
            if (a?.imageUrl || a?.videoUrl) s.add(Number(id));
        }
        return s;
    }, [assets]);

    const totalScenes = plan?.scenes?.length || 0;
    const stepLabel = stateToStep(planning, generating, doneIds, totalScenes);

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
                body: JSON.stringify(form),
                signal: planAbort.current.signal,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Plan failed');
            setPlan(data);
            // Auto-fire scene asset generation.
            data.scenes.forEach((scene) => generateAssetsFor(scene, data, form.useVideoClips));
        } catch (err) {
            if (err.name !== 'AbortError') setErrors((e) => ({ ...e, global: err.message }));
        } finally {
            setPlanning(false);
        }
    }, [form, planning]);

    const generateAssetsFor = useCallback(async (scene, localPlan, useVideoClips) => {
        setGenerating((g) => new Set(g).add(scene.id));
        try {
            // Image first — always needed (video uses it as an anchor).
            const imagePromise = fetch('/api/generate/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: [scene.imagePrompt, localPlan.style].filter(Boolean).join(', '),
                    model: 'flux-schnell',
                    image_size: 'landscape_16_9',
                }),
            }).then(async (r) => {
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || 'image failed');
                return d.url;
            });

            const imageUrl = await imagePromise;
            setAssets((a) => ({ ...a, [scene.id]: { ...(a[scene.id] || {}), imageUrl } }));

            if (useVideoClips && scene.videoPrompt) {
                const videoResponse = await fetch('/api/generate/video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: scene.videoPrompt,
                        image_url: imageUrl,
                        model: 'kling-v1',
                        duration: scene.duration >= 10 ? '10' : '6',
                    }),
                });
                const vd = await videoResponse.json();
                if (videoResponse.ok && vd.url) {
                    setAssets((a) => ({ ...a, [scene.id]: { ...(a[scene.id] || {}), videoUrl: vd.url } }));
                } else {
                    // Non-fatal — fall back to Ken Burns on the still image.
                    setErrors((e) => ({
                        ...e,
                        byScene: { ...e.byScene, [scene.id]: vd.error || 'video clip failed, using still' },
                    }));
                }
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
        generateAssetsFor(scene, plan, form.useVideoClips);
    };

    const downloadZip = async () => {
        if (!plan) return;
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        zip.file('plan.json', JSON.stringify({ plan, assets }, null, 2));
        zip.file('README.txt', `GOAT UGC AI — exported asset bundle

Use this bundle with Remotion locally:
1. npx create-video my-video (pick Hello World template)
2. Drop plan.json + images into the src/data folder
3. Build a composition that iterates plan.scenes, playing each image or video for scene.duration seconds with the fade + Ken Burns animation of your choice
4. npx remotion render --props='./src/data/plan.json'
`);
        const fetches = Object.entries(assets).map(async ([id, a]) => {
            if (a.imageUrl) {
                const blob = await fetch(a.imageUrl).then((r) => r.blob());
                zip.file(`scene-${id}-image.jpg`, blob);
            }
            if (a.videoUrl) {
                const blob = await fetch(a.videoUrl).then((r) => r.blob());
                zip.file(`scene-${id}-video.mp4`, blob);
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
        <div className="grid lg:grid-cols-[360px_1fr] gap-6">
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
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Duration</label>
                        <select
                            value={form.durationSec}
                            onChange={(e) => onChange({ durationSec: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                        >
                            {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d}s</option>)}
                        </select>
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

                <label className="flex items-center gap-3 text-[12px] text-white/70 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.useVideoClips}
                        onChange={(e) => onChange({ useVideoClips: e.target.checked })}
                        className="accent-[#d9ff00] w-4 h-4"
                    />
                    <span>Generate motion clips (fal.ai kling) — slower but more dynamic. Off = Ken Burns on stills (fast).</span>
                </label>

                <button
                    type="submit"
                    disabled={planning || !form.topic.trim()}
                    className="h-11 rounded-md bg-[#d9ff00] text-black text-sm font-bold hover:bg-[#e5ff33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {planning ? 'Planning…' : plan ? 'Re-plan with new brief' : 'Generate video plan'}
                </button>

                {!serverKeyConfigured ? (
                    <div className="text-[11px] text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-md p-3">
                        No server key for <b>{providerLabel}</b>. Set <code>FAL_KEY</code> on Vercel and redeploy.
                    </div>
                ) : null}
                {errors.global ? (
                    <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-md p-3">{errors.global}</div>
                ) : null}
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
                                <div className="text-sm text-white/70 mt-1">{doneIds.size}/{totalScenes} scenes ready</div>
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
                                <span className="text-[11px] text-white/40">Scenes fill in as fal.ai returns each one.</span>
                            ) : (
                                <span className="text-[11px] text-[#d9ff00]">All scenes ready. Hit play to watch.</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
                        Write a brief on the left, hit “Generate video plan”, and the director will hand back a scene-by-scene shot list.
                    </div>
                )}

                {plan?.scenes?.length ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Scene shot list</div>
                        <ul className="space-y-3">
                            {plan.scenes.map((scene) => {
                                const a = assets[scene.id] || {};
                                const busy = generating.has(scene.id);
                                const ready = Boolean(a.imageUrl);
                                const sceneErr = errors.byScene?.[scene.id];
                                return (
                                    <li key={scene.id} className="flex gap-4 items-stretch">
                                        <div className="w-40 h-24 flex-none rounded-lg overflow-hidden bg-black/50 border border-white/5 relative">
                                            {a.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={a.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white/30 text-[11px]">
                                                    {busy ? 'Rendering…' : 'Queued'}
                                                </div>
                                            )}
                                            {a.videoUrl ? (
                                                <span className="absolute top-1 left-1 text-[9px] uppercase font-bold bg-[#d9ff00] text-black px-1.5 py-0.5 rounded">motion</span>
                                            ) : null}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-[11px] text-white/50 mb-1">
                                                <span className="font-bold text-white/80">Scene {scene.id}</span>
                                                <span>·</span>
                                                <span>{scene.duration}s</span>
                                                <span>·</span>
                                                <span className="capitalize">{scene.animation}</span>
                                            </div>
                                            <div className="text-sm text-white/85 leading-snug">&ldquo;{scene.voiceText}&rdquo;</div>
                                            <div className="text-[11px] text-white/40 mt-1 line-clamp-2">{scene.imagePrompt}</div>
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
                                                {busy ? '...' : ready ? 'Regenerate' : 'Retry'}
                                            </button>
                                            {a.imageUrl ? (
                                                <a
                                                    href={a.imageUrl}
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
