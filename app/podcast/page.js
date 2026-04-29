import SaasNav from '@/components/SaasNav';
import PodcastClient from './PodcastClient';
import { providerSummary } from '@/lib/providers/config.js';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Podcast · GOAT UGC AI',
    description: 'Two-speaker vertical podcast video about your app — analyzed format, consistent characters via Nano Banana 2, motion via Seedance 2.0.',
};

export default function PodcastPage() {
    const summary = providerSummary();
    return (
        <div className="min-h-screen bg-[#030303] text-white font-sans">
            <SaasNav provider={summary.label} />
            <main className="max-w-6xl mx-auto px-6 py-10">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">Podcast video builder</h1>
                    <p className="text-white/50 text-sm mt-1 max-w-2xl">
                        Two-speaker, 9:16, branded sticker, word-by-word captions — built for app and product explainers.
                        Optionally upload a reference video and we&apos;ll mirror its format frame-by-frame.
                    </p>
                </div>
                <PodcastClient serverKeyConfigured={summary.serverKeyConfigured} providerLabel={summary.label} />
            </main>
        </div>
    );
}
