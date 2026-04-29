'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const PodcastPlayer = dynamic(
    () => import('@/components/remotion/PodcastPlayer.jsx').then((m) => m.PodcastPlayer),
    { ssr: false, loading: () => <div className="aspect-[9/16] max-w-[360px] mx-auto bg-black rounded-xl border border-white/10 flex items-center justify-center text-white/30 text-sm">Loading preview…</div> },
);

const VIDEO_MODELS = [
    { id: 'seedance-2',         label: 'Seedance 2.0 (recommended)' },
    { id: 'seedance-2-fast',    label: 'Seedance 2.0 Fast' },
    { id: 'kling-v2.1-pro',     label: 'Kling v2.1 Pro' },
    { id: 'kling-v2.1-master',  label: 'Kling v2.1 Master' },
];

const IMAGE_MODELS = [
    { id: 'nano-banana-2',   label: 'Nano Banana 2 (consistent characters)' },
    { id: 'nano-banana-pro', label: 'Nano Banana Pro' },
    { id: 'flux-schnell',    label: 'Flux Schnell (fast)' },
    { id: 'seedream-v4',     label: 'Seedream v4' },
];

export default function PodcastClient({ serverKeyConfigured, providerLabel }) {
    const [form, setForm] = useState({
        appOrProduct: '',
        showName: 'The Drop',
        audience: 'curious app users',
        tone: 'energetic explainer',
        sceneCount: 12,
        clipDuration: 3,
        imageModel: 'nano-banana-2',
        videoModel: 'seedance-2',
        renderMotion: true,
    });
    const [analysis, setAnalysis] = useState(null);
    const [analysisError, setAnalysisError] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [plan, setPlan] = useState(null);
    const [assets, setAssets] = useState({});                 // { sceneId: { imageUrl, videoUrl } }
    const [anchorBySpeaker, setAnchorBySpeaker] = useState({}); // first image per speaker for consistency
    const [errors, setErrors] = useState({ global: '', byScene: {} });
    const [planning, setPlanning] = useState(false);
    const [generating, setGenerating] = useState(new Set());
    const fileRef = useRef(null);

    const totalScenes = plan?.scenes?.length || 0;
    const doneIds = useMemo(() => {
        const s = new Set();
        for (const [id, a] of Object.entries(assets)) {
            if (form.renderMotion ? a?.videoUrl : a?.imageUrl) s.add(Number(id));
        }
        return s;
    }, [assets, form.renderMotion]);

    const onChange = (patch) => setForm((f) => ({ ...f, ...patch }));

    // ── Reference video upload + analysis ───────────────────────────────────
    const handleAnalyze = async (file) => {
        setAnalyzing(true);
        setAnalysisError('');
        setAnalysis(null);
        try {
            const response = await fetch('/api/podcast/analyze', {
                method: 'POST',
                headers: { 'Content-Type': file.type || 'video/mp4', 'x-hint': form.appOrProduct || '' },
                body: file,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'analyze failed');
            setAnalysis(data.analysis);
            // Mirror analyzer suggestions into the form.
            const sug = data.analysis?.sceneSuggestions;
            if (sug?.sceneCount) onChange({ sceneCount: Math.max(6, Math.min(24, Number(sug.sceneCount))) });
            if (sug?.clipDurationSec) onChange({ clipDuration: Math.max(3, Math.min(10, Number(sug.clipDurationSec))) });
        } catch (err) {
            setAnalysisError(err.message);
        } finally {
            setAnalyzing(false);
        }
    };

    // ── Plan + per-scene asset generation ──────────────────────────────────
    const handlePlan = useCallback(async (e) => {
        e?.preventDefault();
        if (planning || !form.appOrProduct.trim()) return;
        setErrors({ global: '', byScene: {} });
        setAssets({});
        setAnchorBySpeaker({});
        setPlan(null);
        setPlanning(true);
        try {
            const response = await fetch('/api/podcast/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appOrProduct: form.appOrProduct,
                    showName: form.showName,
                    audience: form.audience,
                    tone: form.tone,
                    sceneCount: form.sceneCount,
                    clipDuration: form.clipDuration,
                    style: analysis,
                    topic: form.appOrProduct,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'plan failed');
            setPlan(data);
            // Kick off generation, but serialize PER SPEAKER so the first
            // scene of each speaker becomes the consistency anchor for the rest.
            kickOffGeneration(data);
        } catch (err) {
            setErrors((e) => ({ ...e, global: err.message }));
        } finally {
            setPlanning(false);
        }
    }, [form, planning, analysis]);

    const kickOffGeneration = (localPlan) => {
        const bySpeaker = new Map();
        for (const scene of localPlan.scenes) {
            const list = bySpeaker.get(scene.speaker) || [];
            list.push(scene);
            bySpeaker.set(scene.speaker, list);
        }
        // For each speaker: render the first scene to establish the anchor,
        // then fan out the rest in parallel using that anchor as reference.
        for (const [, scenes] of bySpeaker) {
            (async () => {
                try {
                    const [first, ...rest] = scenes;
                    const firstAssets = await generateScene(first, localPlan, null);
                    if (firstAssets?.imageUrl) {
                        setAnchorBySpeaker((m) => ({ ...m, [first.speaker]: firstAssets.imageUrl }));
                    }
                    await Promise.all(rest.map((s) => generateScene(s, localPlan, firstAssets?.imageUrl)));
                } catch (err) {
                    console.error('speaker generation failed', err);
                }
            })();
        }
    };

    const generateScene = async (scene, localPlan, referenceImageUrl) => {
        setGenerating((g) => new Set(g).add(scene.id));
        setErrors((e) => {
            const { [scene.id]: _drop, ...rest } = e.byScene || {};
            return { ...e, byScene: rest };
        });
        try {
            const speaker = (localPlan.speakers || []).find((s) => s.id === scene.speaker);
            const characterLock = speaker
                ? `Same character every shot: ${speaker.appearance}. Wardrobe: ${speaker.wardrobe}. ${speaker.setting ? 'Set: ' + speaker.setting + '.' : ''} Framing: ${speaker.framing || 'medium close-up'}, vertical 9:16, podcast microphone visible.`
                : '';
            const fullPrompt = [scene.imagePrompt, characterLock].filter(Boolean).join(' ');

            const imageResponse = await fetch('/api/generate/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: fullPrompt,
                    model: form.imageModel,
                    image_size: 'portrait_16_9',
                    reference_image_url: referenceImageUrl || undefined,
                }),
            });
            const imageData = await imageResponse.json();
            if (!imageResponse.ok || !imageData.url) {
                throw new Error(imageData.error || 'image generation failed');
            }
            const imageUrl = imageData.url;
            setAssets((a) => ({ ...a, [scene.id]: { ...(a[scene.id] || {}), imageUrl } }));

            if (form.renderMotion) {
                const videoResponse = await fetch('/api/generate/video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: scene.videoPrompt || 'subtle talking, head nods, soft hand gesture, natural micro-motion',
                        image_url: imageUrl,
                        model: form.videoModel,
                        duration: String(scene.duration || form.clipDuration),
                        aspect_ratio: '9:16',
                    }),
                });
                const vd = await videoResponse.json();
                if (!videoResponse.ok || !vd.url) {
                    throw new Error(vd.message || vd.fieldDetail || vd.error || 'video clip failed');
                }
                setAssets((a) => ({ ...a, [scene.id]: { ...(a[scene.id] || {}), videoUrl: vd.url } }));
            }

            return { imageUrl };
        } catch (err) {
            setErrors((e) => ({ ...e, byScene: { ...e.byScene, [scene.id]: err.message } }));
            return null;
        } finally {
            setGenerating((g) => {
                const next = new Set(g);
                next.delete(scene.id);
                return next;
            });
        }
    };

    const regenerateScene = (scene) => {
        const anchor = anchorBySpeaker[scene.speaker] || null;
        setAssets((a) => { const n = { ...a }; delete n[scene.id]; return n; });
        generateScene(scene, plan, anchor);
    };

    const allReady = totalScenes > 0 && doneIds.size === totalScenes;

    return (
        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
            {/* Brief panel */}
            <form onSubmit={handlePlan} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 flex flex-col gap-5 h-fit">
                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Reference video (optional)</label>
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAnalyze(f); }}
                        />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={analyzing}
                            className="h-9 px-3 rounded-md text-[11px] font-semibold bg-white/5 border border-white/10 hover:bg-white/10 flex-1"
                        >
                            {analyzing ? 'Analyzing frames…' : analysis ? 'Re-analyze a different video' : 'Upload a reference clip'}
                        </button>
                    </div>
                    {analysis ? (
                        <div className="text-[10px] text-emerald-400/80 mt-2">
                            ✓ Analyzed · {analysis?.sceneSuggestions?.sceneCount || '?'} scenes · {analysis?.format?.aspect || '?'} ·
                            {' '}{analysis?.speakers?.length || 0} speaker{analysis?.speakers?.length === 1 ? '' : 's'} detected
                        </div>
                    ) : null}
                    {analysisError ? <div className="text-[11px] text-red-400 mt-2">{analysisError}</div> : null}
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">App / product to talk about</label>
                    <textarea
                        value={form.appOrProduct}
                        onChange={(e) => onChange({ appOrProduct: e.target.value })}
                        rows={3}
                        placeholder="Linear — issue tracker for software teams. Hook: keyboard-first, command-palette everything, opinionated defaults."
                        className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Show name</label>
                        <input
                            value={form.showName}
                            onChange={(e) => onChange({ showName: e.target.value })}
                            placeholder="The Drop"
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Tone</label>
                        <input
                            value={form.tone}
                            onChange={(e) => onChange({ tone: e.target.value })}
                            placeholder="energetic explainer"
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Scenes</label>
                        <select
                            value={form.sceneCount}
                            onChange={(e) => onChange({ sceneCount: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                        >
                            {[6, 8, 10, 12, 14, 16, 20, 24].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Clip length</label>
                        <select
                            value={form.clipDuration}
                            onChange={(e) => onChange({ clipDuration: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                        >
                            {[3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}s</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Audience</label>
                    <input
                        value={form.audience}
                        onChange={(e) => onChange({ audience: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Image model</label>
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
                            disabled={!form.renderMotion}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30 disabled:opacity-40"
                        >
                            {VIDEO_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                    </div>
                </div>

                <label className="flex items-center gap-3 text-[12px] text-white/70 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.renderMotion}
                        onChange={(e) => onChange({ renderMotion: e.target.checked })}
                        className="accent-[#d9ff00] w-4 h-4"
                    />
                    <span><b>Render motion clips</b> — Seedance/Kling animate each speaker shot. Off = stills only (fast).</span>
                </label>

                <button
                    type="submit"
                    disabled={planning || !form.appOrProduct.trim()}
                    className="h-11 rounded-md bg-[#d9ff00] text-black text-sm font-bold hover:bg-[#e5ff33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {planning ? 'Writing the show…' : plan ? 'Re-write show' : 'Generate podcast'}
                </button>

                {!serverKeyConfigured ? (
                    <div className="text-[11px] text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-md p-3">
                        No server key for <b>{providerLabel}</b>. Set <code>FAL_KEY</code> on Vercel.
                    </div>
                ) : null}
                {errors.global ? (
                    <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-md p-3">{errors.global}</div>
                ) : null}

                <div className="text-[11px] text-white/40 leading-relaxed">
                    Pipeline: 1) plan two-speaker dialogue · 2) Nano Banana 2 generates the first shot per speaker, then EDITs every
                    follow-up using that shot as a reference for visual consistency · 3) Seedance 2.0 turns each shot into a 3–6s
                    talking clip · 4) Remotion overlays bold word-by-word captions and the show sticker.
                </div>
            </form>

            {/* Preview + scenes */}
            <div className="space-y-4">
                {plan ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <div className="text-[11px] font-bold text-[#d9ff00] uppercase tracking-wider mb-1">{plan.showName}</div>
                                <div className="text-xl font-bold">{plan.hook || 'Two-speaker show'}</div>
                                <div className="text-[11px] text-white/40 mt-1">
                                    {totalScenes} scenes · {(plan.speakers || []).map((s) => s.id).join(' ↔ ')}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider">
                                    {planning ? 'Writing show' : (generating.size ? `Rendering ${doneIds.size}/${totalScenes}` : (allReady ? 'Ready' : 'Idle'))}
                                </div>
                                <div className="text-sm text-white/70 mt-1">{doneIds.size}/{totalScenes} ready</div>
                            </div>
                        </div>
                        <PodcastPlayer plan={plan} assets={assets} />
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
                        Optionally drop a reference clip, fill the brief on the left, hit &ldquo;Generate podcast&rdquo;. The first shot
                        of each speaker becomes the consistency anchor for every follow-up shot.
                    </div>
                )}

                {plan?.scenes?.length ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Dialogue · scene shot list</div>
                        <ul className="space-y-3">
                            {plan.scenes.map((scene) => {
                                const a = assets[scene.id] || {};
                                const busy = generating.has(scene.id);
                                const sceneErr = errors.byScene?.[scene.id];
                                return (
                                    <li key={scene.id} className="flex gap-4 items-stretch">
                                        <div className="w-24 flex-none">
                                            <div className="aspect-[9/16] rounded-md overflow-hidden bg-black/50 border border-white/5 relative">
                                                {a.videoUrl ? (
                                                    <video src={a.videoUrl} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                                                ) : a.imageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={a.imageUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">{busy ? 'Render…' : 'Queued'}</div>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-white/50 mt-1 text-center font-bold uppercase tracking-wider">{scene.speaker}</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] text-white/50 mb-1">Scene {scene.id} · {scene.duration}s</div>
                                            <div className="text-sm text-white/90 leading-snug font-semibold">&ldquo;{scene.text}&rdquo;</div>
                                            <div className="text-[11px] text-white/40 mt-1 line-clamp-2" title={scene.imagePrompt}>{scene.imagePrompt}</div>
                                            {sceneErr ? <div className="text-[11px] text-amber-400/80 mt-1">⚠ {sceneErr}</div> : null}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => regenerateScene(scene)} disabled={busy} className="h-7 px-3 rounded-md text-[10px] font-semibold bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40">
                                                {busy ? '…' : 'Regen'}
                                            </button>
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
