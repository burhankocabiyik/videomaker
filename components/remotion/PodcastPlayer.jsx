'use client';

import { Player } from '@remotion/player';
import { PodcastComposition, podcastTotalFrames, PODCAST_FPS, PODCAST_WIDTH, PODCAST_HEIGHT } from './PodcastComposition.jsx';

export function PodcastPlayer({ plan, assets, autoPlay = false }) {
    const scenes = plan?.scenes || [];
    const duration = podcastTotalFrames(scenes);
    return (
        <Player
            component={PodcastComposition}
            durationInFrames={duration}
            compositionWidth={PODCAST_WIDTH}
            compositionHeight={PODCAST_HEIGHT}
            fps={PODCAST_FPS}
            inputProps={{ plan, assets }}
            autoPlay={autoPlay}
            loop
            controls
            style={{ width: '100%', maxWidth: 360, margin: '0 auto', aspectRatio: `${PODCAST_WIDTH}/${PODCAST_HEIGHT}`, background: 'black', borderRadius: 12 }}
        />
    );
}
