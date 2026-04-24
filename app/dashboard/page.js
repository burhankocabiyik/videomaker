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
  const { provider, label, capabilities, serverKeyConfigured } = providerSummary();

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans">
      <SaasNav provider={label} />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-white/50 text-sm mt-1">
              Your on-brand content OS. Pick a surface below or jump straight into Create.
            </p>
          </div>
          <Link
            href="/create"
            className="h-10 px-5 rounded-md text-xs font-semibold bg-[#d9ff00] text-black hover:bg-[#e5ff33] flex items-center shadow-lg shadow-[#d9ff00]/10"
          >
            + New Generation
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Provider" value={label} hint={serverKeyConfigured ? 'Server key configured' : 'Client / BYOK mode'} />
          <StatCard label="Image gen" value={capabilities.image ? 'Enabled' : 'Off'} hint="Primary surface for UGC" />
          <StatCard label="Video gen" value={capabilities.video ? 'Enabled' : 'Off'} hint="Product reels + ads" />
          <StatCard label="Agents"    value={capabilities.agents ? 'Enabled' : 'Off'} hint="Multi-step pipelines" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/create"
            className="rounded-xl border border-[#d9ff00]/20 bg-[#d9ff00]/[0.03] p-6 hover:bg-[#d9ff00]/[0.06] transition-colors"
          >
            <div className="text-xs font-bold text-[#d9ff00] mb-2">QUICK CREATE</div>
            <div className="text-xl font-bold">One-click image generation</div>
            <div className="text-sm text-white/60 mt-2">
              Clean, opinionated UI powered by {label}. Ideal for weekly asset drops.
            </div>
          </Link>

          <Link
            href="/studio"
            className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.05] transition-colors"
          >
            <div className="text-xs font-bold text-white/50 mb-2">PRO STUDIO</div>
            <div className="text-xl font-bold">Full Open Generative AI studio</div>
            <div className="text-sm text-white/60 mt-2">
              Image / video / lipsync / cinema / agents / workflows. Muapi-powered; ideal for power users.
            </div>
          </Link>

          <Link
            href="/dashboard/projects"
            className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.05] transition-colors"
          >
            <div className="text-xs font-bold text-white/50 mb-2">WORKSPACES</div>
            <div className="text-xl font-bold">Projects & brand kits</div>
            <div className="text-sm text-white/60 mt-2">
              Organize output by client or product. Persisted in your browser until you wire a DB.
            </div>
          </Link>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="text-xs font-bold text-white/50 mb-2">HOSTING</div>
            <div className="text-xl font-bold">Cloud + local, your call</div>
            <div className="text-sm text-white/60 mt-2">
              Vercel for the shared team UI, or self-host on your own box with <code className="text-white/80">AI_PROVIDER=local</code>.
              See the README for each path.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
