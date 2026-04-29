import { AbsoluteFill, Img, Video, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// ──────────────────────────────────────────────────────────────────────────
// Caption — split into ALL-CAPS bold sans words and an optional italic-serif
// emphasis word (matching the reference: "an APP for KIDS" / "you will not
// BELIEVE..."). Words appear one or two at a time with a tiny pop.
// ──────────────────────────────────────────────────────────────────────────
function splitWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean);
}

function CaptionStack({ words, emphasis }) {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    const total = words.length;
    if (total === 0) return null;

    const wordsPerBeat = total <= 4 ? 1 : 2;
    const beats = Math.ceil(total / wordsPerBeat);
    const beatLength = Math.max(8, Math.floor(durationInFrames / Math.max(1, beats)));
    const visibleCount = Math.min(total, Math.max(wordsPerBeat, Math.floor(frame / beatLength) * wordsPerBeat + wordsPerBeat));
    const visible = words.slice(0, visibleCount);
    const emphKey = emphasis ? String(emphasis).toLowerCase().replace(/[^a-z]/g, '') : null;

    return (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 240, pointerEvents: 'none' }}>
            <div style={{
                maxWidth: '88%',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'baseline',
                gap: '6px 16px',
                lineHeight: 1.05,
                textAlign: 'center',
            }}>
                {visible.map((w, i) => {
                    const enterFrame = Math.floor(i / wordsPerBeat) * beatLength;
                    const localT = Math.max(0, frame - enterFrame);
                    const pop = interpolate(localT, [0, 6], [0.65, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                    const isEmph = emphKey && w.toLowerCase().replace(/[^a-z]/g, '') === emphKey;

                    if (isEmph) {
                        // Italic serif word with soft white glow — emphasis style.
                        return (
                            <span key={i} style={{
                                fontFamily: 'Georgia, "Times New Roman", serif',
                                fontStyle: 'italic',
                                fontWeight: 700,
                                color: 'white',
                                fontSize: 64,
                                letterSpacing: '-0.5px',
                                transform: `scale(${pop})`,
                                display: 'inline-block',
                                textShadow: '0 4px 22px rgba(0,0,0,0.85), 0 0 12px rgba(255,255,255,0.35)',
                            }}>
                                {w}
                            </span>
                        );
                    }
                    return (
                        <span key={i} style={{
                            fontFamily: 'Inter, system-ui, "SF Pro Display", sans-serif',
                            fontWeight: 900,
                            fontSize: 56,
                            letterSpacing: '-0.6px',
                            color: 'white',
                            WebkitTextStroke: '4px black',
                            paintOrder: 'stroke fill',
                            transform: `scale(${pop})`,
                            display: 'inline-block',
                            textShadow: '0 6px 16px rgba(0,0,0,0.55)',
                        }}>
                            {w.toUpperCase()}
                        </span>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
}

// ──────────────────────────────────────────────────────────────────────────
// Sticker (show brand + optional product pop). Both rotate-skew with a soft
// drop-shadow and a thin border, matching the example.
// ──────────────────────────────────────────────────────────────────────────
function Sticker({ brand, position = 'top-left', tilt = -6, mountFrame = 0, fontFamily = 'Inter' }) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    if (!brand?.copy) return null;
    const palette = String(brand.palette || '#000+#FFFFFF').split('+');
    const bg = palette[0] || '#000';
    const fg = palette[1] || '#fff';
    const placement = {
        top: position.includes('top') ? 24 : undefined,
        bottom: position.includes('bottom') ? 24 : undefined,
        left: position.includes('left') ? 16 : undefined,
        right: position.includes('right') ? 16 : undefined,
    };
    const shape = brand.shape || 'speech bubble';
    const enter = spring({ frame: Math.max(0, frame - mountFrame), fps, config: { damping: 12, stiffness: 220 } });
    const scale = 0.6 + 0.4 * enter;
    return (
        <div style={{
            position: 'absolute',
            ...placement,
            zIndex: 30,
            transform: `rotate(${tilt}deg) scale(${scale})`,
            transformOrigin: position.includes('right') ? 'top right' : 'top left',
            background: bg,
            color: fg,
            fontFamily,
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: '-0.3px',
            padding: '10px 18px',
            borderRadius: shape === 'capsule' ? 999 : (shape === 'squiggle' ? '24px 30px 22px 28px' : '22px 22px 22px 4px'),
            boxShadow: '0 6px 0 rgba(0,0,0,0.25), 0 8px 22px rgba(0,0,0,0.35)',
            textTransform: 'uppercase',
            lineHeight: 1,
            border: `2px solid ${fg}`,
        }}>
            {brand.copy}
        </div>
    );
}

export function PodcastScene({
    imageSrc,
    videoSrc,
    audioSrc,
    captionText,
    emphasis,
    brand,
    productSticker,
    showProductPop = false,
    speakerLabel,
}) {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    const FADE = 5;
    const opacity = interpolate(
        frame,
        [0, FADE, durationInFrames - FADE, durationInFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );

    const words = splitWords(captionText);

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <AbsoluteFill style={{ overflow: 'hidden' }}>
                {videoSrc ? (
                    <Video src={videoSrc} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : imageSrc ? (
                    <Img src={imageSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <AbsoluteFill style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg,#1a1a1a,#2a2a2a)',
                        color: 'rgba(255,255,255,0.3)', fontFamily: 'sans-serif', fontSize: 22,
                    }}>
                        rendering scene…
                    </AbsoluteFill>
                )}
            </AbsoluteFill>

            {audioSrc ? <Audio src={audioSrc} /> : null}

            <Sticker brand={brand} position={brand?.position || 'top-left'} tilt={-6} />
            {showProductPop && productSticker ? (
                <Sticker
                    brand={productSticker}
                    position="top-center-product"
                    tilt={-4}
                    mountFrame={4}
                    fontFamily='"Quicksand", "Comic Sans MS", system-ui, sans-serif'
                />
            ) : null}

            <CaptionStack words={words} emphasis={emphasis} />

            {speakerLabel ? (
                <div style={{
                    position: 'absolute', left: 18, bottom: 30, zIndex: 30,
                    fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12,
                    color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase',
                    background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: 4,
                }}>
                    {speakerLabel}
                </div>
            ) : null}

            <AbsoluteFill style={{ backgroundColor: 'black', opacity: 1 - opacity, pointerEvents: 'none' }} />
        </AbsoluteFill>
    );
}
