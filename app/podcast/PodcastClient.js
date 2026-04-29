'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const PodcastPlayer = dynamic(
    () => import('@/components/remotion/PodcastPlayer.jsx').then((m) => m.PodcastPlayer),
    { ssr: false, loading: () => <div className="aspect-[9/16] max-w-[360px] mx-auto bg-black rounded-xl border border-white/10 flex items-center justify-center text-white/30 text-sm">Loading preview…</div> },
);

const VIDEO_MODELS = [
    { id: 'seedance-2',         label: 'Seedance 2.0 (recommended)' },
    { id: 'veo3-i2v',           label: 'Google Veo 3 (i2v)' },
    { id: 'kling-v3-pro',       label: 'Kling v3 Pro' },
    { id: 'kling-v3-standard',  label: 'Kling v3 Standard' },
    { id: 'seedance-2-fast',    label: 'Seedance 2.0 Fast (cheapest)' },
];

const IMAGE_MODELS = [
    { id: 'nano-banana-2',   label: 'Nano Banana 2 (consistent characters)' },
    { id: 'nano-banana-pro', label: 'Nano Banana Pro' },
    { id: 'flux-pro',        label: 'Flux 1.1 Pro' },
    { id: 'seedream-v4',     label: 'Seedream v4' },
];

const PHASES = [
    { id: 'plan',         label: '1. Write the show (alternating dialogue + takes)' },
    { id: 'wide',         label: '2. Establishing shot (both hosts in the same room)' },
    { id: 'host-anchor',  label: '3. Host close-up (image-to-image)' },
    { id: 'guest-anchor', label: '4. Guest close-up (image-to-image)' },
    { id: 'voice',        label: '5. Voice tracks per take (ElevenLabs)' },
    { id: 'motion',       label: '6. Motion clips per take (Seedance / Kling / Veo)' },
    { id: 'lipsync',      label: '7. Lip-sync each take (Sync-Lipsync 2.0 Pro)' },
    { id: 'merged',       label: '8. Slice + concat → MP4' },
];

function PhaseRow({ id, label, state, detail }) {
    const dot =
        state === 'running' ? <span className="w-2.5 h-2.5 rounded-full bg-[#d9ff00] animate-pulse" /> :
        state === 'done'    ? <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> :
        state === 'error'   ? <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> :
                              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />;
    return (
        <li key={id} className="flex items-start gap-3 text-[12px]">
            <span className="mt-1">{dot}</span>
            <div>
                <div className={state === 'done' ? 'text-white/80' : state === 'running' ? 'text-white' : 'text-white/40'}>{label}</div>
                {detail ? <div className="text-[10px] text-white/40 mt-0.5">{detail}</div> : null}
            </div>
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
        renderLipsync: true,
    });
    const [plan, setPlan] = useState(null);
    const [wide, setWide] = useState(null);
    const [anchors, setAnchors] = useState({});
    const [takeAssets, setTakeAssets] = useState({});       // { takeId: { audioUrl, videoUrl, syncedUrl } }
    const [phaseState, setPhaseState] = useState({});
    const [phaseDetail, setPhaseDetail] = useState({});
    const [errors, setErrors] = useState({ global: '', byTake: {} });
    const [running, setRunning] = useState(false);
    const [merging, setMerging] = useState(false);
    const [mergedUrl, setMergedUrl] = useState(null);
    const fileRef = useRef(null);
    const [analysis, setAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState('');

    const totalScenes = plan?.scenes?.length || 0;
    const onChange = (patch) => setForm((f) => ({ ...f, ...patch }));
    const setPhase = (id, state) => setPhaseState((p) => ({ ...p, [id]: state }));
    const setDetail = (id, text) => setPhaseDetail((p) => ({ ...p, [id]: text }));

    // ── Reference video (optional) ─────────────────────────────────────────
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

    // ── Pipeline ───────────────────────────────────────────────────────────
    const handleRun = useCallback(async (e) => {
        e?.preventDefault();
        if (running || !form.appOrProduct.trim()) return;
        setRunning(true);
        setPlan(null);
        setWide(null);
        setAnchors({});
        setTakeAssets({});
        setMergedUrl(null);
        setErrors({ global: '', byTake: {} });
        setPhaseState({});
        setPhaseDetail({});

        try {
            // 1 — plan
            setPhase('plan', 'running');
            const planResp = await fetch('/api/podcast/plan', {
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
            const planData = await planResp.json();
            if (!planResp.ok) throw new Error(planData.error || 'plan failed');
            setPlan(planData);
            setDetail('plan', `${planData.scenes.length} scenes · ${planData.takes?.length || 0} takes`);
            setPhase('plan', 'done');

            // 2 — wide
            setPhase('wide', 'running');
            const widePrompt = buildWidePrompt(planData);
            const wideResp = await fetch('/api/generate/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: widePrompt, model: form.imageModel, image_size: 'portrait_16_9' }),
            });
            const wideData = await wideResp.json();
            if (!wideResp.ok || !wideData.url) throw new Error(wideData.error || 'wide failed');
            setWide(wideData.url);
            setPhase('wide', 'done');

            // 3 — host anchor (i2i)
            const [a, b] = planData.speakers || [];
            setPhase('host-anchor', 'running');
            const hostAnchor = await editAnchor(form.imageModel, wideData.url, a, 'left', planData);
            setAnchors((m) => ({ ...m, host: hostAnchor }));
            setPhase('host-anchor', 'done');

            // 4 — guest anchor (i2i)
            setPhase('guest-anchor', 'running');
            const guestAnchor = await editAnchor(form.imageModel, wideData.url, b, 'right', planData);
            setAnchors((m) => ({ ...m, guest: guestAnchor }));
            setPhase('guest-anchor', 'done');

            const anchorByTake = (takeId) => {
                const take = planData.takes.find((t) => t.id === takeId);
                return take.speaker === a.id ? hostAnchor : guestAnchor;
            };

            // 5 — voice per take
            if (form.renderVoice) {
                setPhase('voice', 'running');
                let i = 0;
                for (const take of planData.takes) {
                    setDetail('voice', `take ${++i}/${planData.takes.length}: ${take.speaker}`);
                    const audioUrl = await renderTakeVoice(take);
                    setTakeAssets((m) => ({ ...m, [take.id]: { ...(m[take.id] || {}), audioUrl } }));
                }
                setPhase('voice', 'done');
            } else setPhase('voice', 'done');

            // 6 — motion per take
            if (form.renderMotion) {
                setPhase('motion', 'running');
                let i = 0;
                for (const take of planData.takes) {
                    setDetail('motion', `take ${++i}/${planData.takes.length}: ${take.speaker} (${take.totalDuration}s)`);
                    try {
                        const videoUrl = await renderTakeMotion({
                            take, plan: planData, anchorUrl: anchorByTake(take.id), form,
                        });
                        setTakeAssets((m) => ({ ...m, [take.id]: { ...(m[take.id] || {}), videoUrl } }));
                    } catch (err) {
                        setErrors((e) => ({ ...e, byTake: { ...e.byTake, [take.id]: 'motion: ' + err.message } }));
                    }
                }
                setPhase('motion', 'done');
            } else setPhase('motion', 'done');

            // 7 — lipsync per take (needs both audioUrl + videoUrl from prior phases)
            if (form.renderLipsync && form.renderMotion && form.renderVoice) {
                setPhase('lipsync', 'running');
                let i = 0;
                for (const take of planData.takes) {
                    setDetail('lipsync', `take ${++i}/${planData.takes.length}`);
                    const a = takeAssetsLatest()[take.id];
                    if (!a?.videoUrl || !a?.audioUrl) {
                        setErrors((e) => ({ ...e, byTake: { ...e.byTake, [take.id]: 'lipsync skipped: missing audio or video' } }));
                        continue;
                    }
                    try {
                        const r = await fetch('/api/generate/lipsync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ video_url: a.videoUrl, audio_url: a.audioUrl, model: 'lipsync-2-pro' }),
                        });
                        const d = await r.json();
                        if (!r.ok || !d.url) throw new Error(d.error || 'lipsync failed');
                        setTakeAssets((m) => ({ ...m, [take.id]: { ...(m[take.id] || {}), syncedUrl: d.url } }));
                    } catch (err) {
                        setErrors((e) => ({ ...e, byTake: { ...e.byTake, [take.id]: 'lipsync: ' + err.message } }));
                    }
                }
                setPhase('lipsync', 'done');
            } else setPhase('lipsync', 'done');
        } catch (err) {
            setErrors((e) => ({ ...e, global: err.message }));
            setPhaseState((p) => {
                const next = { ...p };
                for (const k of Object.keys(next)) if (next[k] === 'running') next[k] = 'error';
                return next;
            });
        } finally {
            setRunning(false);
        }
    }, [form, running, analysis]);

    // The closure inside the for-loop captures the OUTDATED takeAssets state.
    // takeAssetsLatest() reads the freshest snapshot via a ref-style trick.
    const takeAssetsLatestRef = useRef(takeAssets);
    takeAssetsLatestRef.current = takeAssets;
    const takeAssetsLatest = () => takeAssetsLatestRef.current;

    const handleMerge = async () => {
        if (!plan) return;
        setMerging(true);
        setMergedUrl(null);
        setPhase('merged', 'running');
        try {
            const response = await fetch('/api/podcast/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, takeAssets }),
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

    // For Remotion live preview we still need per-scene assets. Each scene
    // gets its own slice URL (we don't actually slice — we use the full take
    // video for the preview; Remotion plays from each scene's takeOffsetSec
    // for `duration` seconds). The merged MP4 is what gets the real cuts.
    const remotionAssets = useMemo(() => {
        const out = {};
        if (!plan?.scenes) return out;
        for (const scene of plan.scenes) {
            const t = takeAssets[scene.takeId];
            out[scene.id] = {
                imageUrl: scene.speaker === plan.speakers?.[0]?.id ? anchors.host : anchors.guest,
                videoUrl: t?.syncedUrl || t?.videoUrl || null,
                audioUrl: t?.audioUrl || null,
            };
        }
        return out;
    }, [plan, takeAssets, anchors]);

    const allTakesReady = (plan?.takes || []).every((t) => takeAssets[t.id]?.syncedUrl || takeAssets[t.id]?.videoUrl);

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
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Lines (≤24)</label>
                        <select value={form.sceneCount} onChange={(e) => onChange({ sceneCount: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30">
                            {[6, 8, 10, 12, 14, 16, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Per-line</label>
                        <select value={form.clipDuration} onChange={(e) => onChange({ clipDuration: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30">
                            {[3, 4, 5].map((n) => <option key={n} value={n}>{n}s</option>)}
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
                    <span><b>Motion clips</b> — one long take per speaker (~10s each)</span>
                </label>
                <label className="flex items-center gap-3 text-[12px] text-white/70 cursor-pointer">
                    <input type="checkbox" checked={form.renderVoice} onChange={(e) => onChange({ renderVoice: e.target.checked })} className="accent-[#d9ff00] w-4 h-4" />
                    <span><b>Voices</b> — ElevenLabs Roger (host) / Sarah (guest), one MP3 per take</span>
                </label>
                <label className="flex items-center gap-3 text-[12px] text-white/70 cursor-pointer">
                    <input type="checkbox" checked={form.renderLipsync} onChange={(e) => onChange({ renderLipsync: e.target.checked })} className="accent-[#d9ff00] w-4 h-4" />
                    <span><b>Lip-sync</b> — sync each take's mouth to its voice (Sync Lipsync 2.0 Pro)</span>
                </label>

                <button type="submit" disabled={running || !form.appOrProduct.trim()}
                    className="h-11 rounded-md bg-[#d9ff00] text-black text-sm font-bold hover:bg-[#e5ff33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {running ? 'Running pipeline…' : plan ? 'Re-run' : 'Generate podcast'}
                </button>

                {!serverKeyConfigured ? (
                    <div className="text-[11px] text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-md p-3">No server key for <b>{providerLabel}</b>. Set <code>FAL_KEY</code>.</div>
                ) : null}
                {errors.global ? <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-md p-3">{errors.global}</div> : null}

                <div className="text-[11px] text-white/40 leading-relaxed">
                    Cost guide (Seedance 2.0): ~$0.50 / take × 2-3 takes + ~$5 lipsync per video ≈ $7-8 per episode.
                </div>
            </form>

            {/* Right column */}
            <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                    <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Pipeline</div>
                    <ul className="space-y-2">
                        {PHASES.map((p) => <PhaseRow key={p.id} id={p.id} label={p.label} state={phaseState[p.id]} detail={phaseDetail[p.id]} />)}
                    </ul>
                </div>

                {(wide || anchors.host || anchors.guest) ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Identity locks (one shared room)</div>
                        <div className="grid grid-cols-3 gap-3">
                            {[{ src: wide, label: 'Establishing wide' },
                              { src: anchors.host, label: 'Host close-up' },
                              { src: anchors.guest, label: 'Guest close-up' }].map((a, i) => (
                                <div key={i}>
                                    <div className="aspect-[9/16] rounded-md overflow-hidden bg-black/50 border border-white/5">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        {a.src ? <img src={a.src} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">…</div>}
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
                                <div className="text-[11px] text-white/40 mt-1">{totalScenes} lines · {(plan.takes || []).length} takes · {(plan.speakers || []).map((s) => s.id).join(' ↔ ')}</div>
                            </div>
                            <div className="text-right">
                                <button onClick={handleMerge} disabled={merging || running || !allTakesReady}
                                    className="h-9 px-4 rounded-md text-xs font-bold bg-[#d9ff00] text-black hover:bg-[#e5ff33] disabled:opacity-40">
                                    {merging ? 'Merging…' : 'Slice → MP4'}
                                </button>
                                {mergedUrl ? <a href={mergedUrl} download className="block text-[11px] text-[#d9ff00] hover:underline mt-2">Download merged.mp4 ↓</a> : null}
                            </div>
                        </div>
                        <PodcastPlayer plan={plan} assets={remotionAssets} />
                        {mergedUrl ? <video src={mergedUrl} controls className="mt-4 w-full max-w-[360px] mx-auto rounded-md bg-black" /> : null}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
                        Fill the brief and hit Generate. The pipeline runs phase by phase on the right.
                    </div>
                )}

                {plan?.takes?.length ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                        <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Takes — long-form continuous shots</div>
                        <ul className="space-y-3">
                            {plan.takes.map((take) => {
                                const a = takeAssets[take.id] || {};
                                const err = errors.byTake?.[take.id];
                                return (
                                    <li key={take.id} className="flex gap-4 items-stretch">
                                        <div className="w-32 flex-none">
                                            <div className="aspect-[9/16] rounded-md overflow-hidden bg-black/50 border border-white/5">
                                                {a.syncedUrl ? <video src={a.syncedUrl} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                                                  : a.videoUrl ? <video src={a.videoUrl} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                                                  : <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">…</div>}
                                            </div>
                                            <div className="text-[10px] text-white/50 mt-1 text-center font-bold uppercase">{take.id}</div>
                                            <div className="text-[10px] text-white/40 mt-0.5 text-center">{take.totalDuration}s · {take.lines.length} lines</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white/85 leading-snug font-semibold mb-1">&ldquo;{take.combinedText}&rdquo;</div>
                                            <div className="text-[10px] text-white/40 space-y-0.5">
                                                {a.videoUrl ? <div>i2v: <a className="text-white/60 hover:underline" target="_blank" rel="noreferrer" href={a.videoUrl}>open</a></div> : null}
                                                {a.audioUrl ? <div className="flex items-center gap-2">audio: <audio src={a.audioUrl} controls className="h-5 inline-block" /></div> : null}
                                                {a.syncedUrl ? <div>lipsynced: <a className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer" href={a.syncedUrl}>open ↗</a></div> : null}
                                                {err ? <div className="text-amber-400/90">⚠ {err}</div> : null}
                                            </div>
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
        'A photorealistic, raw, NOT-AI-looking wide establishing photo — vertical 9:16, two real-looking podcast hosts in the same room, mid-conversation candid pose.',
        plan.setting ? `Setting: ${plan.setting}.` : null,
        a ? `Left armchair host (HOST): ${a.appearance}, wearing ${a.wardrobe}.` : null,
        b ? `Right armchair host (GUEST): ${b.appearance}, wearing ${b.wardrobe}.` : null,
        'Both clearly in the same frame, microphones in front of them, identical lighting, identical wall and bookshelf.',
        'Shot on Sony a7S III, 35mm prime f/2.8, ISO 800, raw unedited still — looks like a frame grab from a documentary podcast, NOT a generated render.',
        'Photorealistic skin texture: visible pores, peach fuzz, faint shadows under the eyes, fine asymmetric features, no airbrushing, no plastic skin, no waxy CGI look.',
        'Natural HDR colour, fine grain, mild teal-orange balance, soft warm tungsten key from frame-left, soft window fill from frame-right.',
        'NOT AI-looking, no symmetric face, no plastic doll skin, no over-smoothing, no extra fingers, no warped hands, no on-screen text, no watermark.',
    ].filter(Boolean).join(' ');
}

async function editAnchor(model, wideUrl, speaker, side, plan) {
    const prompt = [
        `Re-render only as a vertical 9:16 medium close-up of the ${side.toUpperCase()} podcast host from this exact same scene — the ${speaker?.persona || ''} ${speaker?.appearance || ''}.`,
        'Keep the SAME room, SAME lighting, SAME wardrobe, SAME microphone, SAME bookshelf and props as the reference image.',
        'Medium close-up, eye-level, microphone visible in lower third, eyes toward the other host across the table.',
        'Photorealistic skin texture: visible pores, peach fuzz, faint shadows under the eyes, fine asymmetric features, no airbrushing, no plastic skin.',
        'Shot on Sony a7S III, 35mm f/2.8, ISO 800, raw documentary still.',
        'NOT AI-looking, no waxy texture, no glossy CGI, no over-smoothing, no symmetric face, no extra fingers.',
    ].join(' ');
    const r = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, reference_image_url: wideUrl, image_size: 'portrait_16_9' }),
    });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || `${side} anchor failed`);
    return d.url;
}

async function renderTakeMotion({ take, plan, anchorUrl, form }) {
    const speaker = (plan.speakers || []).find((s) => s.id === take.speaker);
    // Build a take-level realism prompt: speaker says the COMBINED dialogue
    // continuously, sitting in the same chair, natural micro-motion.
    const settingLine = plan.setting;
    const promptText = [
        `A photorealistic, raw, NOT-AI-looking podcast clip — vertical 9:16, take ${take.id}, ${take.totalDuration}s continuous shot of ONE host (the ${take.speaker}) speaking the dialogue below into a podcast microphone.`,
        `Character: ${speaker?.appearance || ''}, wearing ${speaker?.wardrobe || ''}. Same room, same lighting, same chair as the reference.`,
        `Setting: ${settingLine}.`,
        `Cinematography: medium close-up, eye-level, 35mm f/2.8, deep DOF, subtle handheld micro-shake, breathing-driven head bob, occasional micro-rotation as the host glances across the table at the OTHER host, gentle weight shifts. NO Dutch angle, NO whip pans, NO jitter.`,
        `Lighting: practical-only — warm tungsten key from frame-left, soft window fill from frame-right, faint catch lights in both eyes.`,
        `Color & Grade: natural HDR with NO over-smoothing — visible pores, peach fuzz, micro shadows under the eyes, asymmetric features, fine grain, true skin tones.`,
        `Performance: speak the lines below naturally, with conversational energy, real micro-expressions, occasional chuckle, eyes alternating between the camera and the other host.`,
        `Dialogue:`,
        `"${take.combinedText}"`,
        `Audio & Ambience: Shure SM7B close to mouth, present voice, natural mouth sounds, faint armchair creak, very faint room tone, no music, no cuts, ONE TAKE natural pacing.`,
        `Authenticity: photorealistic podcast realism, NOT AI-looking, raw skin texture, real micro-expressions, asymmetric features, lived-in clothing creases, vertical 9:16, intimate co-host energy.`,
        `Quality control: no plastic skin, no airbrushed face, no symmetric eyes, no over-smoothing, no waxy texture, no glossy CGI look, no extra fingers, no warped hands, no flicker, no rolling shutter, no on-screen text, no watermark, no frame stutter.`,
    ].join('\n');

    // Clamp duration to model-friendly window.
    const requested = Math.max(5, Math.min(10, take.totalDuration));
    const r = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: promptText,
            image_url: anchorUrl,
            model: form.videoModel,
            duration: String(requested),
            aspect_ratio: '9:16',
        }),
    });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.message || d.fieldDetail || d.error || 'video failed');
    return d.url;
}

async function renderTakeVoice(take) {
    const r = await fetch('/api/generate/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: take.combinedText, speaker: take.speaker }),
    });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || 'voice failed');
    return d.url;
}
