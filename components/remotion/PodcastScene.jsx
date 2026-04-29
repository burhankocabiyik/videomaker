import { AbsoluteFill, Img, Video, Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

function splitWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean);
}

/**
 * Word-by-word caption stack — bold white sans-serif with a thick black
 * stroke, like the example reference video. Caption sits in the lower
 * third. Each word "pops" with a brief scale animation when it enters.
 */
function CaptionStack({ words, emphasis }) {
    const frame = useCurrentFrame();
    const { durationInFrames, fps } = useVideoConfig();
    const totalWords = words.length;
    if (totalWords === 0) return null;

    // Reveal one word per beat, but always show the last 2 words at minimum.
    const wordsPerBeat = totalWords <= 4 ? 1 : 2;
    const beatLength = Math.max(6, Math.floor(durationInFrames / Math.ceil(totalWords / wordsPerBeat)));
    const visibleCount = Math.min(totalWords, Math.max(wordsPerBeat, Math.floor(frame / beatLength) * wordsPerBeat + wordsPerBeat));
    const visible = words.slice(0, visibleCount);

    return (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 220, pointerEvents: 'none' }}>
            <div style={{
                maxWidth: '88%',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '6px 14px',
                fontFamily: 'Inter, system-ui, "SF Pro Display", sans-serif',
                fontWeight: 900,
                letterSpacing: '-0.5px',
                fontSize: 56,
                lineHeight: 1.05,
                textAlign: 'center',
            }}>
                {visible.map((w, i) => {
                    const enterFrame = Math.floor(i / wordsPerBeat) * beatLength;
                    const localT = Math.max(0, frame - enterFrame);
                    const pop = interpolate(localT, [0, 6], [0.6, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                    const isEmphasis = emphasis && w.toLowerCase().replace(/[^a-z]/g, '') === String(emphasis).toLowerCase().replace(/[^a-z]/g, '');
                    return (
                        <span
                            key={i}
                            style={{
                                color: 'white',
                                WebkitTextStroke: '4px black',
                                paintOrder: 'stroke fill',
                                transform: `scale(${pop})`,
                                display: 'inline-block',
                                fontStyle: isEmphasis ? 'italic' : 'normal',
                                textShadow: '0 4px 12px rgba(0,0,0,0.6)',
                            }}
                        >
                            {w.toUpperCase()}
                        </span>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
}

function BrandSticker({ brand }) {
    if (!brand?.copy) return null;
    const palette = String(brand.palette || '#000+#FFFFFF').split('+');
    const bg = palette[0] || '#000';
    const fg = palette[1] || '#fff';
    const position = brand.position || 'top-left';
    const placement = {
        top: position.includes('top') ? 24 : undefined,
        bottom: position.includes('bottom') ? 24 : undefined,
        left: position.includes('left') ? 18 : undefined,
        right: position.includes('right') ? 18 : undefined,
    };
    const shape = brand.shape || 'speech bubble';

    return (
        <div style={{
            position: 'absolute',
            ...placement,
            zIndex: 30,
            transform: 'rotate(-6deg)',
            background: bg,
            color: fg,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: '-0.3px',
            padding: '10px 18px',
            borderRadius: shape === 'capsule' ? 999 : '22px 22px 22px 4px',
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
    speakerLabel,
}) {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    const FADE = 6;
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

            <BrandSticker brand={brand} />
            <CaptionStack words={words} emphasis={emphasis} />

            {speakerLabel ? (
                <div style={{
                    position: 'absolute', left: 18, bottom: 24, zIndex: 30,
                    fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14,
                    color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase',
                    background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 6,
                }}>
                    {speakerLabel}
                </div>
            ) : null}

            <AbsoluteFill style={{ backgroundColor: 'black', opacity: 1 - opacity, pointerEvents: 'none' }} />
        </AbsoluteFill>
    );
}
