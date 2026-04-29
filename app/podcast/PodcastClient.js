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
    { id: 'veo3-i2v',           label: 'Google Veo 3 (i2v)' },
    { id: 'kling-v3-pro',       label: 'Kling v3 Pro' },
    { id: 'kling-v3-standard',  label: 'Kling v3 Standard' },
    { id: 'kling-v3-4k',        label: 'Kling v3 4K' },
    { id: 'kling-v2.1-master',  label: 'Kling v2.1 Master' },
    { id: 'kling-v2.1-pro',     label: 'Kling v2.1 Pro' },
];

const IMAGE_MODELS = [
    { id: 'nano-banana-2',   label: 'Nano Banana 2 (consistent characters)' },
    { id: 'nano-banana-pro', label: 'Nano Banana Pro' },
    { id: 'flux-schnell',    label: 'Flux Schnell (fast)' },
    { id: 'seedream-v4',     label: 'Seedream v4' },
];

// Each phase the pipeline walks through, surfaced in the UI as a checklist.
const PHASES = [
    { id: 'plan',           label: '1. Write the show' },
    { id: 'wide',           label: '2. Establishing shot (both hosts in the room)' },
    { id: 'host-anchor',    label: '3. Close-up: host (image-to-image from wide)' },
    { id: 'guest-anchor',   label: '4. Close-up: guest (image-to-image from wide)' },
    { id: 'scene-images',   label: '5. Per-scene character takes (image-to-image)' },
    { id: 'scene-motion',   label: '6. Motion clips (Seedance / Kling / Veo)' },
    { id: 'scene-voice',    label: '7. Voices (ElevenLabs)' },
    { id: 'merged',         label: '8. Merge → single MP4' },
];

function PhaseRow({ id, label, state }) {
    const dot =
        state === 'running'  ? <span className="w-2.5 h-2.5 rounded-full bg-[#d9ff00] animate-pulse" /> :
        state === 'done'     ? <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> :
        state === 'error'    ? <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> :
                                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />;
    return (
        <li key={id} className="flex items-center gap-3 text-[12px]">
            {dot}
            <span className={state === 'done' ? 'text-white/80' : state === 'running' ? 'text-white' : 'text-white/40'}>{label}</span>
        </li>
    );
}

export default function PodcastClient({ serverKeyConfigured, providerLabel }) {
    const [form, setForm] = useState({
        appOrProduct: '',
        showName: 'The Drop',
        audience: 'curious app users',
        tone: 'energetic explainer',
        sceneCount: 8,
        clipDuration: 3,
        imageModel: 'nano-banana-2',
        videoModel: 'seedance-2',
        renderMotion: true,
        renderVoice: true,
    });
    const [plan, setPlan] = useState(null);
    const [wide, setWide] = useState(null);
    const [anchors, setAnchors] = useState({});           // { host: url, guest: url }
    const [assets, setAssets] = useState({});             // { sceneId: { imageUrl, videoUrl, audioUrl } }
    const [phaseState, setPhaseState] = useState({});     // { phaseId: 'running'|'done'|'error' }
    const [errors, setErrors] = useState({ global: '', byScene: {} });
    const [running, setRunning] = useState(false);
    const [merging, setMerging] = useState(false);
    const [mergedUrl, setMergedUrl] = useState(null);
    const fileRef = useRef(null);
    const [analysis, setAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState('');

    const totalScenes = plan?.scenes?.length || 0;
    const doneIds = useMemo(() => {
        const s = new Set();
        for (const [id, a] of Object.entries(assets)) {
            if (a?.imageUrl) s.add(Number(id));
        }
        return s;
    }, [assets]);

    const onChange = (patch) => setForm((f) => ({ ...f, ...patch }));
    const setPhase = (id, state) => setPhaseState((p) => ({ ...p, [id]: state }));

    // ── Reference video (optional) ───────────────────────────────────────────
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
        } catch (err) {
            setAnalysisError(err.message);
        } finally {
            setAnalyzing(false);
        }
    };

    // ── Pipeline ────────────────────────────────────────────────────────────
    const handleRun = useCallback(async (e) => {
        e?.preventDefault();
        if (running || !form.appOrProduct.trim()) return;
        setRunning(true);
        setPlan(null);
        setWide(null);
        setAnchors({});
        setAssets({});
        setMergedUrl(null);
        setErrors({ global: '', byScene: {} });
        setPhaseState({});

        try {
            // Phase 1 — plan
            setPhase('plan', 'running');
            const planResponse = await fetch('/api/podcast/plan', {
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
            const planData = await planResponse.json();
            if (!planResponse.ok) throw new Error(planData.error || 'plan failed');
            setPlan(planData);
            setPhase('plan', 'done');

            // Phase 2 — establishing wide shot of BOTH hosts in the SAME room
            setPhase('wide', 'running');
            const widePrompt = buildWidePrompt(planData);
            const wideResp = await fetch('/api/generate/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: widePrompt,
                    model: form.imageModel,
                    image_size: 'portrait_16_9',
                }),
            });
            const wideData = await wideResp.json();
            if (!wideResp.ok || !wideData.url) throw new Error(wideData.error || 'wide shot failed');
            setWide(wideData.url);
            setPhase('wide', 'done');

            // Phase 3 — speaker A close-up via image-to-image from the wide
            const [hostSpeaker, guestSpeaker] = planData.speakers || [];
            setPhase('host-anchor', 'running');
            const hostAnchor = await editAnchor(form.imageModel, wideData.url, hostSpeaker, 'left', planData.setting);
            setAnchors((a) => ({ ...a, host: hostAnchor }));
            setPhase('host-anchor', 'done');

            // Phase 4 — guest close-up
            setPhase('guest-anchor', 'running');
            const guestAnchor = await editAnchor(form.imageModel, wideData.url, guestSpeaker, 'right', planData.setting);
            setAnchors((a) => ({ ...a, guest: guestAnchor }));
            setPhase('guest-anchor', 'done');

            // Phase 5 — per-scene image (uses speaker anchor as reference)
            setPhase('scene-images', 'running');
            for (const scene of planData.scenes) {
                const speakerAnchor = scene.speaker === hostSpeaker?.id ? hostAnchor : guestAnchor;
                const sceneImage = await editScene(form.imageModel, speakerAnchor, scene);
                setAssets((m) => ({ ...m, [scene.id]: { ...(m[scene.id] || {}), imageUrl: sceneImage } }));
            }
            setPhase('scene-images', 'done');

            // Phase 6 — motion clips (per-scene, sequential to keep UI legible)
            if (form.renderMotion) {
                setPhase('scene-motion', 'running');
                for (const scene of planData.scenes) {
                    try {
                        const clip = await renderMotion(scene, assetsCurrent(scene.id), form);
                        setAssets((m) => ({ ...m, [scene.id]: { ...(m[scene.id] || {}), videoUrl: clip } }));
                    } catch (err) {
                        setErrors((e) => ({ ...e, byScene: { ...e.byScene, [scene.id]: 'motion: ' + err.message } }));
                    }
                }
                setPhase('scene-motion', 'done');
            } else {
                setPhase('scene-motion', 'done');
            }

            // Phase 7 — voices
            if (form.renderVoice) {
                setPhase('scene-voice', 'running');
                for (const scene of planData.scenes) {
                    try {
                        const audio = await renderVoice(scene);
                        setAssets((m) => ({ ...m, [scene.id]: { ...(m[scene.id] || {}), audioUrl: audio } }));
                    } catch (err) {
                        setErrors((e) => ({ ...e, byScene: { ...e.byScene, [scene.id]: 'voice: ' + err.message } }));
                    }
                }
                setPhase('scene-voice', 'done');
            } else {
                setPhase('scene-voice', 'done');
            }

            // Phase 8 stays pending until user clicks Merge.
        } catch (err) {
            setErrors((e) => ({ ...e, global: err.message }));
            // mark current running phase as error.
            setPhaseState((p) => {
                const next = { ...p };
                for (const k of Object.keys(next)) if (next[k] === 'running') next[k] = 'error';
                return next;
            });
        } finally {
            setRunning(false);
        }
    }, [form, running, analysis, plan]);

    const assetsCurrent = (id) => {
        // Read latest assets for given scene from localStorage proxy.
        // We read straight from React state via a function that closes over assets.
        return assets[id] || {};
    };

    const handleMerge = async () => {
        if (!plan) return;
        setMerging(true);
        setMergedUrl(null);
        setPhase('merged', 'running');
        try {
            const response = await fetch('/api/podcast/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, assets }),
            });
            const data = await response.json();
            if (!response.ok || !data.url) throw new Error(data.error || 'merge failed');
            setMergedUrl(data.url);
            setPhase('merged', 'done');
        } catch (err) {
            setErrors((e) => ({ ...e, global: 'merge: ' + err.message }));
            setPhase('merged', 'error');
        } finally {
            setMerging(false);
        }
    };

    return (
        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
            {/* Brief panel */}
            <form onSubmit={handleRun} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 flex flex-col gap-5 h-fit">
                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Reference video (optional)</label>
                    <div className="flex items-center gap-2">
                        <input ref={fileRef} type="file" accept="video/*" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAnalyze(f); }} />
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={analyzing}
                            className="h-9 px-3 rounded-md text-[11px] font-semibold bg-white/5 border border-white/10 hover:bg-white/10 flex-1">
                            {analyzing ? 'Analyzing frames…' : analysis ? 'Re-analyze a different video' : 'Upload a reference clip'}
                        </button>
                    </div>
                    {analysis ? <div className="text-[10px] text-emerald-400/80 mt-2">✓ Analyzed · {analysis?.format?.aspect || '?'}</div> : null}
                    {analysisError ? <div className="text-[11px] text-red-400 mt-2">{analysisError}</div> : null}
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">App / product to talk about</label>
                    <textarea value={form.appOrProduct} onChange={(e) => onChange({ appOrProduct: e.target.value })} rows={3}
                        placeholder="Linear — issue tracker for software teams. Hook: keyboard-first, command-palette, opinionated."
                        className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Show name</label>
                        <input value={form.showName} onChange={(e) => onChange({ showName: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Tone</label>
                        <input value={form.tone} onChange={(e) => onChange({ tone: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Scenes</label>
                        <select value={form.sceneCount} onChange={(e) => onChange({ sceneCount: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30">
                            {[6, 8, 10, 12, 14, 16, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Clip length</label>
                        <select value={form.clipDuration} onChange={(e) => onChange({ clipDuration: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30">
                            {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}s</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Image model</label>
                        <select value={form.imageModel} onChange={(e) => onChange({ imageModel: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30">
                            {IMAGE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Video model</label>
                        <select value={form.videoModel} onChange={(e) => onChange({ videoModel: e.target.value })} disabled={!form.renderMotion}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30 disabled:opacity-40">
                            {VIDEO_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                    </div>
                </div>

                <label className="flex items-center gap-3 text-[12px] text-white/70 cursor-pointer">
                    <input type="checkbox" checked={form.renderMotion} onChange={(e) => onChange({ renderMotion: e.target.checked })} className="accent-[#d9ff00] w-4 h-4" />
                    <span><b>Render motion clips</b> — Seedance/Kling/Veo animate each shot.</span>
                </label>
                <label className="flex items-center gap-3 text-[12px] text-white/70 cursor-pointer">
                    <input type="checkbox" checked={form.renderVoice} onChange={(e) => onChange({ renderVoice: e.target.checked })} className="accent-[#d9ff00] w-4 h-4" />
                    <span><b>Generate voices</b> — host &amp; guest get distinct ElevenLabs voices, mixed into the final MP4.</span>
                </label>

                <button type="submit" disabled={running || !form.appOrProduct.trim()}
                    className="h-11 rounded-md bg-[#d9ff00] text-black text-sm font-bold hover:bg-[#e5ff33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {running ? 'Running pipeline…' : plan ? 'Re-run' : 'Generate podcast'}
                </button>

                {!serverKeyConfigured ? (
                    <div className="text-[11px] text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-md p-3">No server key for <b>{providerLabel}</b>. Set <code>FAL_KEY</code>.</div>
                ) : null}
                {errors.global ? <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-md p-3">{errors.global}</div> : null}
            </form>

            {/* Right column */}
            <div className="space-y-4">
                {/* Phases */}
                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                    <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Pipeline</div>
                    <ul className="space-y-2">
                        {PHASES.map((p) => <PhaseRow key={p.id} id={p.id} label={p.label} state={phaseState[p.id]} />)}
                    </ul>
                </div>

                {/* Establishing + anchors gallery */}
                {(wide || anchors.host || anchors.guest) ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Identity locks (one shared room)</div>
                        <div className="grid grid-cols-3 gap-3">
                            {[{ id: 'wide', src: wide, label: 'Establishing wide' },
                              { id: 'host', src: anchors.host, label: 'Host close-up (i2i)' },
                              { id: 'guest', src: anchors.guest, label: 'Guest close-up (i2i)' }
                             ].map((a) => (
                                <div key={a.id}>
                                    <div className="aspect-[9/16] rounded-md overflow-hidden bg-black/50 border border-white/5">
                                        {a.src ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={a.src} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">…</div>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-white/50 mt-1 text-center">{a.label}</div>
                                </div>
                             ))}
                        </div>
                    </div>
                ) : null}

                {plan ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <div className="text-[11px] font-bold text-[#d9ff00] uppercase tracking-wider mb-1">{plan.showName}</div>
                                <div className="text-xl font-bold">{plan.hook || 'Two-speaker show'}</div>
                                <div className="text-[11px] text-white/40 mt-1">{totalScenes} scenes · {(plan.speakers || []).map((s) => s.id).join(' ↔ ')}</div>
                                <div className="text-[10px] text-white/30 mt-2 line-clamp-2 max-w-md" title={plan.setting}>{plan.setting}</div>
                            </div>
                            <div className="text-right">
                                <button
                                    onClick={handleMerge}
                                    disabled={merging || running || doneIds.size < totalScenes || totalScenes === 0}
                                    className="h-9 px-4 rounded-md text-xs font-bold bg-[#d9ff00] text-black hover:bg-[#e5ff33] disabled:opacity-40">
                                    {merging ? 'Merging…' : 'Merge → MP4'}
                                </button>
                                {mergedUrl ? (
                                    <a href={mergedUrl} download className="block text-[11px] text-[#d9ff00] hover:underline mt-2">
                                        Download merged.mp4 ↓
                                    </a>
                                ) : null}
                            </div>
                        </div>
                        <PodcastPlayer plan={plan} assets={assets} />
                        {mergedUrl ? (
                            <video src={mergedUrl} controls className="mt-4 w-full max-w-[360px] mx-auto rounded-md bg-black" />
                        ) : null}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
                        Fill the brief on the left and hit “Generate podcast”. Watch each phase finish on the right.
                    </div>
                )}

                {plan?.scenes?.length ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Dialogue · scene shot list</div>
                        <ul className="space-y-3">
                            {plan.scenes.map((scene) => {
                                const a = assets[scene.id] || {};
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
                                                    <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">queued</div>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-white/50 mt-1 text-center font-bold uppercase tracking-wider">{scene.speaker}</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] text-white/50 mb-1">Scene {scene.id} · {scene.duration}s {scene.productPop ? '· product pop' : ''}</div>
                                            <div className="text-sm text-white/90 leading-snug font-semibold">&ldquo;{scene.text}&rdquo;</div>
                                            {a.audioUrl ? (
                                                <audio src={a.audioUrl} controls className="mt-1 h-6" />
                                            ) : null}
                                            {sceneErr ? <div className="text-[11px] text-amber-400/80 mt-1">⚠ {sceneErr}</div> : null}
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

// ── Helpers ────────────────────────────────────────────────────────────────
function buildWidePrompt(plan) {
    const [a, b] = plan.speakers || [];
    return [
        'Wide establishing shot, vertical 9:16, two podcast hosts sitting across from each other in the same room.',
        plan.setting ? `Setting: ${plan.setting}.` : null,
        a ? `Left armchair host (the show's HOST): ${a.appearance}, wearing ${a.wardrobe}.` : null,
        b ? `Right armchair host (the GUEST): ${b.appearance}, wearing ${b.wardrobe}.` : null,
        'Both clearly visible in the same frame, both with microphones in front, identical lighting, identical wall and bookshelf, cinematic depth.',
        'Photo-realistic, sharp focus, soft warm light, no text, no logos, no watermarks.',
    ].filter(Boolean).join(' ');
}

async function editAnchor(model, wideUrl, speaker, side, setting) {
    const prompt = [
        `Re-render only as a vertical 9:16 medium close-up of the ${side.toUpperCase()} host from this exact same scene — the ${speaker?.persona || ''} ${speaker?.appearance || ''}.`,
        'Keep the SAME room, SAME lighting, SAME wardrobe, SAME microphone, SAME bookshelf and props that are visible in the reference image.',
        speaker?.framing ? `Framing: ${speaker.framing}.` : 'Framing: medium close-up, microphone visible, eyes to camera.',
        'Photo-realistic, sharp focus.',
    ].join(' ');
    const r = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            model,
            reference_image_url: wideUrl,
            image_size: 'portrait_16_9',
        }),
    });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || `${side} anchor failed`);
    return d.url;
}

async function editScene(model, anchorUrl, scene) {
    const prompt = [
        'Same character, same wardrobe, same room, same lighting, same microphone — only the EXPRESSION/GESTURE changes for this beat.',
        scene.imagePrompt || 'Speaking into the microphone, natural expression.',
        'Vertical 9:16, medium close-up, photo-realistic.',
    ].join(' ');
    const r = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            model,
            reference_image_url: anchorUrl,
            image_size: 'portrait_16_9',
        }),
    });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || 'scene image failed');
    return d.url;
}

async function renderMotion(scene, sceneAssets, form) {
    const r = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: scene.videoPrompt || 'subtle talking, mouth movement, soft head tilt, natural micro-motion',
            image_url: sceneAssets.imageUrl,
            model: form.videoModel,
            duration: String(scene.duration || form.clipDuration),
            aspect_ratio: '9:16',
        }),
    });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.message || d.fieldDetail || d.error || 'video failed');
    return d.url;
}

async function renderVoice(scene) {
    const r = await fetch('/api/generate/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scene.text, speaker: scene.speaker }),
    });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || 'voice failed');
    return d.url;
}
