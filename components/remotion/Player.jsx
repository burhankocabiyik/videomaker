'use client';

import { Player } from '@remotion/player';
import { VideoComposition, totalDurationFrames, FPS, WIDTH, HEIGHT } from './VideoComposition.jsx';

export function VideoPlayer({ scenes, assets, autoPlay = false }) {
    const duration = totalDurationFrames(scenes);
    return (
        <Player
            component={VideoComposition}
            durationInFrames={duration}
            compositionWidth={WIDTH}
            compositionHeight={HEIGHT}
            fps={FPS}
            inputProps={{ scenes, assets }}
            autoPlay={autoPlay}
            loop
            controls
            style={{ width: '100%', aspectRatio: `${WIDTH}/${HEIGHT}`, background: 'black', borderRadius: 12 }}
        />
    );
}
