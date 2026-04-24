import { AbsoluteFill, Series } from 'remotion';
import { Scene } from './Scene';

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 720;

export function sceneDurationFrames(scene) {
    return Math.max(15, Math.ceil((scene.duration || 4) * FPS));
}

export function totalDurationFrames(scenes) {
    return scenes.reduce((acc, s) => acc + sceneDurationFrames(s), 0) || FPS;
}

export function VideoComposition({ scenes = [], assets = {} }) {
    if (!scenes.length) {
        return (
            <AbsoluteFill style={{
                background: 'black',
                color: 'rgba(255,255,255,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Inter, sans-serif',
            }}>
                No scenes yet
            </AbsoluteFill>
        );
    }

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <Series>
                {scenes.map((scene) => {
                    const a = assets[scene.id] || {};
                    return (
                        <Series.Sequence key={scene.id} durationInFrames={sceneDurationFrames(scene)}>
                            <Scene
                                imageSrc={a.imageUrl}
                                videoSrc={a.videoUrl}
                                audioSrc={a.audioUrl}
                                subtitle={scene.subtitle || scene.voiceText}
                                animation={scene.animation || 'slowZoomIn'}
                            />
                        </Series.Sequence>
                    );
                })}
            </Series>
        </AbsoluteFill>
    );
}
