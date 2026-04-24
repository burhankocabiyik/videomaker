import SaasNav from '@/components/SaasNav';
import ProjectsClient from './ProjectsClient';
import { providerSummary } from '@/lib/providers/config.js';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  const { label } = providerSummary();
  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans">
      <SaasNav provider={label} />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-white/50 text-sm mt-1 mb-8">
          Create a workspace per client, app, or campaign. Stored locally in your browser — wire up a DB for multi-device sync.
        </p>
        <ProjectsClient />
      </main>
    </div>
  );
}
