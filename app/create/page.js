import SaasNav from '@/components/SaasNav';
import CreateClient from './CreateClient';
import { providerSummary } from '@/lib/providers/config.js';
import { FAL_IMAGE_MODELS } from '@/lib/providers/fal.js';

export const dynamic = 'force-dynamic';

const IMAGE_SIZES = [
  { id: 'square_hd',      label: 'Square (1:1)' },
  { id: 'portrait_4_3',   label: 'Portrait 4:3' },
  { id: 'portrait_16_9',  label: 'Portrait 9:16' },
  { id: 'landscape_4_3',  label: 'Landscape 4:3' },
  { id: 'landscape_16_9', label: 'Landscape 16:9' },
];

export default function CreatePage() {
  const summary = providerSummary();
  const models = summary.provider === 'fal'
    ? FAL_IMAGE_MODELS.map(({ id, label }) => ({ id, label }))
    : [{ id: 'flux-schnell-image', label: 'Flux Schnell (Muapi)' }];

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans">
      <SaasNav provider={summary.label} />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Create</h1>
          <p className="text-white/50 text-sm mt-1">
            Quick, no-nonsense generator powered by <span className="text-white/80 font-semibold">{summary.label}</span>.
            Prompt → asset. For the full studio with video/lipsync/agents, use <a className="text-[#d9ff00] hover:underline" href="/studio">Pro Studio</a>.
          </p>
        </div>
        <CreateClient summary={summary} models={models} imageSizes={IMAGE_SIZES} />
      </main>
    </div>
  );
}
