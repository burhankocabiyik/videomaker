import SaasNav from '@/components/SaasNav';
import VideoClient from './VideoClient';
import { providerSummary } from '@/lib/providers/config.js';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Video · GOAT UGC AI',
    description: 'Turn a topic into a multi-scene AI product video. Scene plan, images, optional motion — fal.ai powered, Remotion rendered.',
};

export default function VideoPage() {
    const summary = providerSummary();
    return (
        <div className="min-h-screen bg-[#030303] text-white font-sans">
            <SaasNav provider={summary.label} />
            <main className="max-w-6xl mx-auto px-6 py-10">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">Video builder</h1>
                    <p className="text-white/50 text-sm mt-1 max-w-2xl">
                        Give the director a topic. It plans scenes, writes prompts, generates images (and optional motion clips)
                        via <span className="text-white/80 font-semibold">{summary.label}</span>, and stitches them in a Remotion player
                        you can preview and download.
                    </p>
                </div>
                <VideoClient serverKeyConfigured={summary.serverKeyConfigured} providerLabel={summary.label} />
            </main>
        </div>
    );
}
