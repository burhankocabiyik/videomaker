'use client';

const ANIMATIONS = [
    { id: 'slowZoomIn',  label: 'Zoom in' },
    { id: 'slowZoomOut', label: 'Zoom out' },
    { id: 'panRight',    label: 'Pan right' },
    { id: 'panLeft',     label: 'Pan left' },
    { id: 'breathing',   label: 'Breathe' },
    { id: 'static',      label: 'Static' },
];

const DURATIONS = [5, 10];

function Field({ label, value, onChange, rows = 2, placeholder, mono = false }) {
    return (
        <label className="block">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</span>
            <textarea
                rows={rows}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`mt-1 w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30 ${mono ? 'font-mono' : ''}`}
            />
        </label>
    );
}

function SceneCard({
    scene, asset, busy, error, index, total, textOnly,
    onChange, onRegenerate, onMove, onDelete,
}) {
    const ready = textOnly ? Boolean(asset?.videoUrl) : Boolean(asset?.videoUrl || asset?.imageUrl);

    return (
        <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <div className="w-44 flex-none">
                    <div className="aspect-video rounded-md overflow-hidden bg-black/50 border border-white/5 relative">
                        {asset?.videoUrl ? (
                            <video src={asset.videoUrl} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                        ) : asset?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={asset.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/30 text-[11px]">
                                {busy ? 'Rendering…' : 'Queued'}
                            </div>
                        )}
                        {asset?.videoUrl ? (
                            <span className="absolute top-1 left-1 text-[9px] uppercase font-bold bg-[#d9ff00] text-black px-1.5 py-0.5 rounded">motion</span>
                        ) : asset?.imageUrl ? (
                            <span className="absolute top-1 left-1 text-[9px] uppercase font-bold bg-white/20 text-white/80 px-1.5 py-0.5 rounded">still</span>
                        ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onMove(scene.id, -1)}
                            disabled={index === 0}
                            className="w-8 h-7 rounded text-[12px] font-bold bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30"
                            title="Move up"
                        >↑</button>
                        <button
                            type="button"
                            onClick={() => onMove(scene.id, 1)}
                            disabled={index === total - 1}
                            className="w-8 h-7 rounded text-[12px] font-bold bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30"
                            title="Move down"
                        >↓</button>
                        <button
                            type="button"
                            onClick={() => onRegenerate(scene)}
                            disabled={busy}
                            className="flex-1 h-7 rounded text-[10px] font-semibold bg-[#d9ff00]/10 text-[#d9ff00] border border-[#d9ff00]/20 hover:bg-[#d9ff00]/20 disabled:opacity-40"
                        >
                            {busy ? '…' : ready ? 'Regenerate' : 'Render'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(scene.id)}
                            className="w-8 h-7 rounded text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                            title="Delete scene"
                        >✕</button>
                    </div>
                </div>

                {/* Editable fields */}
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-white/80">Scene {index + 1}</span>
                        <span className="text-[11px] text-white/40">·</span>
                        <div className="flex items-center gap-1">
                            {DURATIONS.map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => onChange(scene.id, { duration: d })}
                                    className={`h-6 px-2 rounded text-[10px] font-semibold border ${
                                        Number(scene.duration) === d
                                            ? 'bg-[#d9ff00] text-black border-[#d9ff00]'
                                            : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                                    }`}
                                >{d}s</button>
                            ))}
                        </div>
                        <span className="text-[11px] text-white/40">·</span>
                        <select
                            value={scene.animation || 'slowZoomIn'}
                            onChange={(e) => onChange(scene.id, { animation: e.target.value })}
                            className="h-6 bg-black/40 border border-white/10 rounded text-[10px] px-2 text-white/80 focus:outline-none"
                            disabled={textOnly}
                            title={textOnly ? 'Animations apply only when there is a still image' : 'Camera animation for the still'}
                        >
                            {ANIMATIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select>
                    </div>

                    <Field
                        label="Subtitle / voice line"
                        value={scene.subtitle ?? scene.voiceText}
                        onChange={(v) => onChange(scene.id, { subtitle: v, voiceText: v })}
                        rows={2}
                        placeholder="What gets said on this scene"
                    />

                    <details className="group">
                        <summary className="cursor-pointer text-[11px] text-white/50 hover:text-white/80 select-none">
                            Prompt details
                        </summary>
                        <div className="mt-2 space-y-2">
                            {!textOnly ? (
                                <Field
                                    label="Image prompt (anchor frame)"
                                    value={scene.imagePrompt}
                                    onChange={(v) => onChange(scene.id, { imagePrompt: v })}
                                    rows={2}
                                    placeholder="Describe the still: subject, lighting, framing"
                                />
                            ) : null}
                            <Field
                                label={textOnly ? 'Scene prompt' : 'Motion prompt'}
                                value={scene.videoPrompt}
                                onChange={(v) => onChange(scene.id, { videoPrompt: v })}
                                rows={2}
                                placeholder={textOnly
                                    ? 'Full description: scene + motion + lighting'
                                    : 'Camera + subject motion only — the image already has the content'
                                }
                            />
                        </div>
                    </details>

                    {error ? (
                        <div className="text-[11px] text-amber-400/90 bg-amber-400/5 border border-amber-400/20 rounded-md px-2 py-1.5">
                            ⚠ {error}
                        </div>
                    ) : null}
                </div>
            </div>
        </li>
    );
}

export default function SceneEditor({
    scenes, assets, generating, errors, textOnly,
    onChange, onRegenerate, onMove, onDelete, onAdd,
}) {
    return (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Editor — scenes & timeline</div>
                <button
                    type="button"
                    onClick={onAdd}
                    className="h-7 px-3 rounded-md text-[11px] font-semibold bg-[#d9ff00]/10 border border-[#d9ff00]/30 hover:bg-[#d9ff00]/20 text-[#d9ff00]"
                >
                    + Add scene
                </button>
            </div>
            <ul className="space-y-3">
                {scenes.map((scene, idx) => (
                    <SceneCard
                        key={scene.id}
                        scene={scene}
                        asset={assets[scene.id]}
                        busy={generating.has(scene.id)}
                        error={errors[scene.id]}
                        index={idx}
                        total={scenes.length}
                        textOnly={textOnly}
                        onChange={onChange}
                        onRegenerate={onRegenerate}
                        onMove={onMove}
                        onDelete={onDelete}
                    />
                ))}
            </ul>
            <div className="mt-4 text-[11px] text-white/40">
                Edits to subtitle, animation and duration update the player live.
                Changing image/motion prompts only affects the next <span className="text-white/70">Regenerate</span>.
            </div>
        </div>
    );
}
