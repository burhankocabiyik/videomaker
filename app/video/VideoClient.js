'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import SceneEditor from './SceneEditor';
import { SCENE_TEMPLATES } from '@/lib/prompt-library.js';

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

const CLIP_DURATIONS = [5, 10];
const TONES = ['cinematic', 'energetic', 'playful', 'authoritative', 'inspirational'];

const VIDEO_MODELS_I2V = [
    { id: 'seedance-2',         label: 'Seedance 2.0 (latest, recommended)' },
    { id: 'seedance-2-fast',    label: 'Seedance 2.0 Fast (cheapest)' },
    { id: 'kling-v2.1-master',  label: 'Kling v2.1 Master (premium)' },
    { id: 'kling-v2.1-pro',     label: 'Kling v2.1 Pro' },
    { id: 'kling-v2.1-standard',label: 'Kling v2.1 Standard' },
];

const VIDEO_MODELS_T2V = [
    { id: 'seedance-2-t2v',     label: 'Seedance 2.0 (text-to-video)' },
];

const IMAGE_MODELS = [
    { id: 'flux-schnell',     label: 'Flux Schnell (fast)' },
    { id: 'nano-banana-pro',  label: 'Nano Banana Pro (Google, premium)' },
    { id: 'nano-banana-2',    label: 'Nano Banana 2 (Google, fast)' },
    { id: 'seedream-v4',      label: 'Seedream v4' },
    { id: 'flux-dev',         label: 'Flux Dev' },
    { id: 'flux-pro',         label: 'Flux 1.1 Pro' },
    { id: 'nano-banana',      label: 'Nano Banana 1 (legacy)' },
];

const SCENE_COUNT_OPTIONS = [3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 24, 30];

function stateToStep(planning, generating, doneIds, totalScenes) {
    if (planning) return 'Planning scenes';
    if (generating.size > 0) return `Rendering ${doneIds.size}/${totalScenes}`;
    if (totalScenes && doneIds.size === totalScenes) return 'All clips ready';
    return 'Idle';
}

function nextSceneId(scenes) {
    const max = scenes.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0);
    return max + 1;
}

function reorder(arr, idx, delta) {
    const next = [...arr];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return arr;
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    return next;
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
        videoModelT2V: 'seedance-2-t2v',
        textOnly: false,
        useVideoClips: true,
    });
    const [plan, setPlan] = useState(null);
    const [assets, setAssets] = useState({});
    const [errors, setErrors] = useState({ global: '', byScene: {} });
    const [planning, setPlanning] = useState(false);
    const [generating, setGenerating] = useState(new Set());
    const planAbort = useRef(null);

    const totalScenes = plan?.scenes?.length || 0;
    const totalDuration = useMemo(
        () => (plan?.scenes || []).reduce((acc, s) => acc + (Number(s.duration) || 0), 0),
        [plan],
    );

    const doneIds = useMemo(() => {
        const s = new Set();
        for (const [id, a] of Object.entries(assets)) {
            const idNum = Number(id);
            const scene = plan?.scenes?.find((sc) => sc.id === idNum);
            if (!scene) continue;
            if (form.useVideoClips ? a?.videoUrl : (form.textOnly ? a?.videoUrl : a?.imageUrl)) s.add(idNum);
        }
        return s;
    }, [assets, plan, form.useVideoClips, form.textOnly]);

    const stepLabel = stateToStep(planning, generating, doneIds, totalScenes);

    const onChange = (patch) => setForm((f) => ({ ...f, ...patch }));

    const applyTemplate = (template) => {
        setForm((f) => ({
            ...f,
            topic: template.topic,
            tone: template.tone || f.tone,
            sceneCount: template.sceneCount || f.sceneCount,
            clipDuration: template.clipDuration || f.clipDuration,
            useVideoClips: template.useVideoClips ?? f.useVideoClips,
            textOnly: template.textOnly ?? f.textOnly,
        }));
    };

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
            const totalDurationSec = form.sceneCount * form.clipDuration;
            const response = await fetch('/api/video/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: form.topic,
                    tone: form.tone,
                    audience: form.audience,
                    durationSec: totalDurationSec,
                    sceneCount: form.sceneCount,
                    clipDuration: form.clipDuration,
                    useVideoClips: form.useVideoClips,
                }),
                signal: planAbort.current.signal,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Plan failed');
            const scenes = data.scenes.map((s) => ({ ...s, duration: form.clipDuration }));
            const snapped = { ...data, scenes };
            setPlan(snapped);
            snapped.scenes.forEach((scene) => generateAssetsFor(scene, snapped, form));
        } catch (err) {
            if (err.name !== 'AbortError') setErrors((e) => ({ ...e, global: err.message }));
        } finally {
            setPlanning(false);
        }
    }, [form, planning]);

    const generateAssetsFor = useCallback(async (scene, localPlan, localForm) => {
        setGenerating((g) => new Set(g).add(scene.id));
        setErrors((e) => {
            const { [scene.id]: _drop, ...rest } = e.byScene || {};
            return { ...e, byScene: rest };
        });
        try {
            let imageUrl = null;
            if (!localForm.textOnly) {
                // 1. Anchor image — only when image-anchored mode is on.
                const imageResponse = await fetch('/api/generate/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: [scene.imagePrompt, localPlan?.style].filter(Boolean).join(', '),
                        model: localForm.imageModel,
                        image_size: 'landscape_16_9',
                    }),
                });
                const imageData = await imageResponse.json();
                if (!imageResponse.ok) throw new Error(imageData.error || 'image generation failed');
                imageUrl = imageData.url;
                setAssets((a) => ({ ...a, [scene.id]: { ...(a[scene.id] || {}), imageUrl } }));
            }

            // 2. Motion clip — Seedance / Kling i2v, or Seedance t2v if textOnly.
            if (localForm.useVideoClips || localForm.textOnly) {
                const videoModelId = localForm.textOnly ? localForm.videoModelT2V : localForm.videoModel;
                const videoBody = {
                    prompt: [scene.videoPrompt || 'subtle cinematic motion, camera drift, film grain', localForm.textOnly ? scene.imagePrompt : null]
                        .filter(Boolean).join('. '),
                    model: videoModelId,
                    duration: String(scene.duration || localForm.clipDuration),
                };
                if (!localForm.textOnly) videoBody.image_url = imageUrl;
                const videoResponse = await fetch('/api/generate/video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(videoBody),
                });
                const vd = await videoResponse.json();
                if (!videoResponse.ok || !vd.url) {
                    const friendly = vd.message || vd.fieldDetail || vd.error || 'video clip failed';
                    throw new Error(friendly);
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

    // ── Scene editor mutators ────────────────────────────────────────────────
    const updateScene = (id, patch) => {
        setPlan((p) => p && ({ ...p, scenes: p.scenes.map((s) => s.id === id ? { ...s, ...patch } : s) }));
    };
    const removeScene = (id) => {
        setPlan((p) => p && ({ ...p, scenes: p.scenes.filter((s) => s.id !== id) }));
        setAssets((a) => { const n = { ...a }; delete n[id]; return n; });
    };
    const moveScene = (id, dir) => {
        setPlan((p) => {
            if (!p) return p;
            const idx = p.scenes.findIndex((s) => s.id === id);
            if (idx === -1) return p;
            return { ...p, scenes: reorder(p.scenes, idx, dir) };
        });
    };
    const addScene = () => {
        setPlan((p) => {
            if (!p) return p;
            const id = nextSceneId(p.scenes);
            const newScene = {
                id,
                duration: form.clipDuration,
                imagePrompt: '',
                videoPrompt: '',
                voiceText: '',
                subtitle: '',
                animation: 'slowZoomIn',
            };
            return { ...p, scenes: [...p.scenes, newScene] };
        });
    };
    const regenerateScene = (scene) => {
        setAssets((a) => { const n = { ...a }; delete n[scene.id]; return n; });
        generateAssetsFor(scene, plan, form);
    };
    const generateAllMissing = () => {
        if (!plan) return;
        plan.scenes.forEach((scene) => {
            if (!assets[scene.id]?.videoUrl && !generating.has(scene.id)) {
                generateAssetsFor(scene, plan, form);
            }
        });
    };

    const downloadZip = async () => {
        if (!plan) return;
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        zip.file('plan.json', JSON.stringify({ plan, assets, form }, null, 2));
        zip.file('README.txt', [
            'GOAT UGC AI — exported asset bundle',
            '',
            'plan.json          full scene list with prompts and the original brief',
            'scene-N-image.jpg  anchor still (image-anchored mode only)',
            'scene-N-video.mp4  generated motion clip',
            '',
            'Local Remotion render:',
            '  1. npx create-video my-video',
            '  2. Drop this folder into public/assets/',
            '  3. Sequence scene-N-video.mp4 for `scene.duration` seconds each',
            '  4. npx remotion render',
        ].join('\n'));
        const fetches = Object.entries(assets).map(async ([id, a]) => {
            if (a.imageUrl) {
                try { const blob = await fetch(a.imageUrl).then((r) => r.blob()); zip.file(`scene-${id}-image.jpg`, blob); }
                catch { /* skip */ }
            }
            if (a.videoUrl) {
                try { const blob = await fetch(a.videoUrl).then((r) => r.blob()); zip.file(`scene-${id}-video.mp4`, blob); }
                catch { /* skip */ }
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
    const totalDurationSec = form.sceneCount * form.clipDuration;
    const visibleVideoModels = form.textOnly ? VIDEO_MODELS_T2V : VIDEO_MODELS_I2V;

    return (
        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
            {/* Brief panel */}
            <form onSubmit={handlePlan} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 flex flex-col gap-5 h-fit">
                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Templates (LTX-2 cinematographer style)</label>
                    <div className="grid grid-cols-2 gap-1.5">
                        {SCENE_TEMPLATES.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => applyTemplate(t)}
                                title={t.notes}
                                className="text-left h-auto py-2 px-2.5 rounded-md text-[11px] font-semibold bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] hover:border-[#d9ff00]/30 text-white/80 transition-colors"
                            >
                                <span className="text-[#d9ff00] mr-1.5">{t.emoji}</span>{t.label}
                            </button>
                        ))}
                    </div>
                    <a
                        href="https://github.com/goatstarter/goat-ugc-ai/blob/main/PROMPT_LIBRARY.md"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-white/40 hover:text-white/70 mt-2 inline-block"
                    >
                        Read the full prompt library →
                    </a>
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">What&apos;s the video about?</label>
                    <textarea
                        value={form.topic}
                        onChange={(e) => onChange({ topic: e.target.value })}
                        rows={4}
                        placeholder="60-second launch teaser for a B2B invoicing app — positions us against boring legacy tools, ends on a download CTA."
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
                            {SCENE_COUNT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
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
                            {CLIP_DURATIONS.map((c) => <option key={c} value={c}>{c}s clips</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <div className="text-[12px] text-white/50 pb-1">
                            Total: <span className="text-white font-semibold">
                                {Math.floor(totalDurationSec / 60) ? `${Math.floor(totalDurationSec / 60)}m ` : ''}
                                {totalDurationSec % 60}s
                            </span>
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

                <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                    <label className="flex items-center gap-3 text-[12px] text-white/80 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.textOnly}
                            onChange={(e) => onChange({ textOnly: e.target.checked, useVideoClips: true })}
                            className="accent-[#d9ff00] w-4 h-4"
                        />
                        <span><b>Text-to-video mode</b> — skip anchor images, generate clips straight from prompts</span>
                    </label>
                </div>

                {!form.textOnly ? (
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
                ) : null}

                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Video model</label>
                    <select
                        value={form.textOnly ? form.videoModelT2V : form.videoModel}
                        onChange={(e) => onChange(form.textOnly ? { videoModelT2V: e.target.value } : { videoModel: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                    >
                        {visibleVideoModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                </div>

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
                    Heads up: each Seedance/Kling clip lands in 60–180 s. Scenes render in parallel; a 10-scene 1m40s video
                    typically finishes in ~3 minutes. Up to 5 minutes total / 30 scenes supported.
                </div>
            </form>

            {/* Canvas + Editor */}
            <div className="space-y-4">
                {plan ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <div className="text-[11px] font-bold text-[#d9ff00] uppercase tracking-wider mb-1">Director&apos;s cut</div>
                                <div className="text-xl font-bold">{plan.title}</div>
                                {plan.hook ? <div className="text-white/60 text-sm mt-1 max-w-lg">{plan.hook}</div> : null}
                                <div className="text-[11px] text-white/40 mt-1">
                                    {totalScenes} scene{totalScenes === 1 ? '' : 's'} ·
                                    {' '}{Math.floor(totalDuration / 60) ? `${Math.floor(totalDuration / 60)}m ` : ''}{totalDuration % 60}s total
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider">{stepLabel}</div>
                                <div className="text-sm text-white/70 mt-1">{doneIds.size}/{totalScenes} clips ready</div>
                            </div>
                        </div>
                        <VideoPlayer scenes={plan.scenes} assets={assets} />
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            <button
                                onClick={generateAllMissing}
                                disabled={allReady}
                                className="h-9 px-4 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold disabled:opacity-40"
                            >
                                Render missing scenes
                            </button>
                            <button
                                onClick={downloadZip}
                                disabled={doneIds.size === 0}
                                className="h-9 px-4 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold disabled:opacity-40"
                            >
                                Download assets (.zip)
                            </button>
                            <button
                                onClick={addScene}
                                className="h-9 px-4 rounded-md bg-[#d9ff00]/10 border border-[#d9ff00]/30 hover:bg-[#d9ff00]/20 text-[#d9ff00] text-xs font-semibold"
                            >
                                + Add scene
                            </button>
                            <span className="text-[11px] text-white/40 ml-auto">
                                {allReady ? 'All clips ready · play above' : 'Scenes fill in as fal.ai returns each clip.'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
                        Brief on the left, hit &ldquo;Generate video&rdquo;, and the director will hand back a scene-by-scene shot
                        list. From there you can edit, reorder, add or delete scenes — the player updates instantly.
                    </div>
                )}

                {plan?.scenes?.length ? (
                    <SceneEditor
                        scenes={plan.scenes}
                        assets={assets}
                        generating={generating}
                        errors={errors.byScene || {}}
                        textOnly={form.textOnly}
                        onChange={updateScene}
                        onRegenerate={regenerateScene}
                        onMove={moveScene}
                        onDelete={removeScene}
                        onAdd={addScene}
                    />
                ) : null}
            </div>
        </div>
    );
}
