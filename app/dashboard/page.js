import Link from 'next/link';
import SaasNav from '@/components/SaasNav';
import { providerSummary } from '@/lib/providers/config.js';

export const dynamic = 'force-dynamic';

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-5">
      <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {hint ? <div className="text-[12px] text-white/40 mt-1">{hint}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const { label, capabilities, serverKeyConfigured } = providerSummary();

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans">
      <SaasNav provider={label} />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-white/50 text-sm mt-1">
              Your on-brand content OS. Jump into the video builder, or explore quick image generation.
            </p>
          </div>
          <Link
            href="/video"
            className="h-10 px-5 rounded-md text-xs font-semibold bg-[#d9ff00] text-black hover:bg-[#e5ff33] flex items-center shadow-lg shadow-[#d9ff00]/10"
          >
            + New video
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Provider"   value={label} hint={serverKeyConfigured ? 'Server key configured' : 'Set FAL_KEY on Vercel'} />
          <StatCard label="Scene plan" value={capabilities.scenePlan ? 'Enabled' : 'Off'} hint="fal.ai LLM" />
          <StatCard label="Image gen"  value={capabilities.image ? 'Enabled' : 'Off'} hint="Flux / SDXL / Nano Banana" />
          <StatCard label="Video gen"  value={capabilities.video ? 'Enabled' : 'Off'} hint="Kling / Veo / LTX" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/video"
            className="rounded-xl border border-[#d9ff00]/20 bg-[#d9ff00]/[0.03] p-6 hover:bg-[#d9ff00]/[0.06] transition-colors"
          >
            <div className="text-xs font-bold text-[#d9ff00] mb-2">VIDEO BUILDER</div>
            <div className="text-xl font-bold">Topic → shot list → scenes → video</div>
            <div className="text-sm text-white/60 mt-2">
              Plan, generate, and preview multi-scene product videos end-to-end in the browser. Powered by {label}.
            </div>
          </Link>

          <Link
            href="/create"
            className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.05] transition-colors"
          >
            <div className="text-xs font-bold text-white/50 mb-2">IMAGE QUICK-FIRE</div>
            <div className="text-xl font-bold">Single-image generator</div>
            <div className="text-sm text-white/60 mt-2">
              For one-off hero images and posters. Prompt → image in seconds.
            </div>
          </Link>

          <Link
            href="/dashboard/projects"
            className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.05] transition-colors"
          >
            <div className="text-xs font-bold text-white/50 mb-2">WORKSPACES</div>
            <div className="text-xl font-bold">Projects &amp; brand kits</div>
            <div className="text-sm text-white/60 mt-2">
              Organize output by client or product. Persisted locally until you wire a DB.
            </div>
          </Link>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="text-xs font-bold text-white/50 mb-2">HOSTING</div>
            <div className="text-xl font-bold">Cloud + local, your call</div>
            <div className="text-sm text-white/60 mt-2">
              Vercel for the shared team UI, or self-host on your own box with <code className="text-white/80">AI_PROVIDER=local</code>.
              See the README.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
