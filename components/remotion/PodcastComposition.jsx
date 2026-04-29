import { AbsoluteFill, Series } from 'remotion';
import { PodcastScene } from './PodcastScene';

export const PODCAST_FPS = 30;
export const PODCAST_WIDTH = 720;
export const PODCAST_HEIGHT = 1280;

export function podcastSceneDurationFrames(scene) {
    return Math.max(15, Math.ceil((scene.duration || 3) * PODCAST_FPS));
}

export function podcastTotalFrames(scenes) {
    return scenes.reduce((acc, s) => acc + podcastSceneDurationFrames(s), 0) || PODCAST_FPS;
}

export function PodcastComposition({ plan, assets = {} }) {
    const scenes = plan?.scenes || [];
    const brand = plan?.brandSticker || { copy: plan?.showName, position: 'top-left', shape: 'speech bubble' };
    const speakers = plan?.speakers || [];

    if (scenes.length === 0) {
        return (
            <AbsoluteFill style={{ background: 'black', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
                No scenes yet
            </AbsoluteFill>
        );
    }

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <Series>
                {scenes.map((scene) => {
                    const a = assets[scene.id] || {};
                    const speaker = speakers.find((s) => s.id === scene.speaker);
                    return (
                        <Series.Sequence key={scene.id} durationInFrames={podcastSceneDurationFrames(scene)}>
                            <PodcastScene
                                imageSrc={a.imageUrl}
                                videoSrc={a.videoUrl}
                                captionText={scene.text}
                                emphasis={scene.emphasis}
                                brand={brand}
                                speakerLabel={speaker?.persona ? `${scene.speaker.toUpperCase()} · ${speaker.persona.split(',')[0]}` : scene.speaker.toUpperCase()}
                            />
                        </Series.Sequence>
                    );
                })}
            </Series>
        </AbsoluteFill>
    );
}
