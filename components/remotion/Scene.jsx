import { AbsoluteFill, Img, Video, Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export function Scene({
    imageSrc,
    videoSrc,
    audioSrc,
    subtitle,
    animation = 'slowZoomIn',
}) {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    switch (animation) {
        case 'slowZoomIn':
            scale = interpolate(frame, [0, durationInFrames], [1, 1.15]);
            break;
        case 'slowZoomOut':
            scale = interpolate(frame, [0, durationInFrames], [1.15, 1]);
            break;
        case 'panRight':
            scale = 1.1;
            translateX = interpolate(frame, [0, durationInFrames], [0, -50]);
            break;
        case 'panLeft':
            scale = 1.1;
            translateX = interpolate(frame, [0, durationInFrames], [-50, 0]);
            break;
        case 'breathing':
            scale = interpolate(frame, [0, durationInFrames / 2, durationInFrames], [1, 1.05, 1]);
            break;
        default:
            scale = 1;
    }

    const FADE = 15;
    const opacity = interpolate(
        frame,
        [0, FADE, durationInFrames - FADE, durationInFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <AbsoluteFill style={{ overflow: 'hidden' }}>
                {videoSrc ? (
                    <Video
                        src={videoSrc}
                        muted
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                ) : imageSrc ? (
                    <Img
                        src={imageSrc}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
                        }}
                    />
                ) : (
                    <AbsoluteFill style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #111 0%, #222 100%)',
                        color: 'rgba(255,255,255,0.25)',
                        fontFamily: 'sans-serif',
                        fontSize: 20,
                    }}>
                        (generating…)
                    </AbsoluteFill>
                )}
            </AbsoluteFill>

            {audioSrc && <Audio src={audioSrc} />}

            {subtitle && (
                <AbsoluteFill style={{
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    paddingBottom: 60,
                }}>
                    <div style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 30,
                        fontWeight: 600,
                        color: 'white',
                        textShadow: '2px 2px 6px rgba(0,0,0,0.9)',
                        textAlign: 'center',
                        maxWidth: '82%',
                        backgroundColor: 'rgba(0,0,0,0.45)',
                        padding: '12px 22px',
                        borderRadius: 10,
                        opacity,
                        borderLeft: '3px solid #d9ff00',
                    }}>
                        {subtitle}
                    </div>
                </AbsoluteFill>
            )}

            <AbsoluteFill style={{ backgroundColor: 'black', opacity: 1 - opacity, pointerEvents: 'none' }} />
        </AbsoluteFill>
    );
}
