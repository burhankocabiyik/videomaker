import Link from 'next/link';

const PIPELINE = [
  {
    title: 'Director',
    body: 'Plot your video in plain English. Our scene planner writes the shot list.',
    icon: '✎',
  },
  {
    title: 'Visuals',
    body: 'fal.ai (Flux + SDXL + Nano Banana) renders every scene in your chosen aspect.',
    icon: '▩',
  },
  {
    title: 'Motion',
    body: 'Ken Burns on stills out of the box. Toggle on Kling for real motion clips.',
    icon: '▶',
  },
  {
    title: 'Ship',
    body: 'Preview in-browser via Remotion. Download the asset bundle and render locally at any resolution.',
    icon: '✦',
  },
];

const USE_CASES = [
  { tag: 'SaaS launches',  title: '30-second hero reel for your landing page' },
  { tag: 'Agencies',       title: 'Client teasers, variant A/B sets in minutes' },
  { tag: 'Ecommerce',      title: 'Product UGC for TikTok, Reels, Shorts' },
  { tag: 'Founders',       title: 'Weekly build-in-public recap videos' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans">
      <header className="sticky top-0 z-40 border-b border-white/[0.04] bg-black/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#d9ff00] flex items-center justify-center text-black font-black">G</div>
            <span className="font-bold tracking-tight">GOAT UGC AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <a href="#pipeline" className="hover:text-white">Pipeline</a>
            <a href="#use-cases" className="hover:text-white">Use cases</a>
            <a href="#self-host" className="hover:text-white">Self-host</a>
            <a href="https://github.com/goatstarter/goat-ugc-ai" target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="h-9 px-4 rounded-md text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 flex items-center">
              Dashboard
            </Link>
            <Link href="/video" className="h-9 px-4 rounded-md text-xs font-semibold bg-[#d9ff00] text-black hover:bg-[#e5ff33] flex items-center">
              Build a video →
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d9ff00]/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/60 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d9ff00] animate-pulse" />
            Topic → shot list → scenes → stitched video · powered by fal.ai + Remotion
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl">
            Type a topic. Ship a
            <span className="text-[#d9ff00]"> product video</span>
            <span className="text-white/30">.</span>
          </h1>
          <p className="mt-6 text-lg text-white/60 max-w-2xl">
            GOAT UGC AI plans your scenes, writes every prompt, renders the visuals on fal.ai, and hands you a
            Remotion-ready bundle you can preview in the browser or render into a 4K MP4 locally.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/video" className="h-12 px-6 rounded-md text-sm font-semibold bg-[#d9ff00] text-black hover:bg-[#e5ff33] flex items-center shadow-lg shadow-[#d9ff00]/10">
              Build a video →
            </Link>
            <Link href="/create" className="h-12 px-6 rounded-md text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 flex items-center">
              Just an image?
            </Link>
            <Link href="/dashboard" className="h-12 px-6 rounded-md text-sm font-semibold text-white/60 hover:text-white flex items-center">
              Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section id="pipeline" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.04]">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Four-stage pipeline</h2>
        <p className="text-white/50 max-w-2xl mb-10">Every video follows the same predictable path — so agencies can productise it, and founders can ship weekly.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PIPELINE.map((p) => (
            <div key={p.title} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
              <div className="text-[#d9ff00] text-2xl mb-4">{p.icon}</div>
              <div className="font-semibold mb-1">{p.title}</div>
              <div className="text-sm text-white/50 leading-relaxed">{p.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="use-cases" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.04]">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Built for</h2>
        <p className="text-white/50 max-w-2xl mb-10">Apps, agencies, and operators who need to turn briefs into on-brand motion — fast.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {USE_CASES.map((u) => (
            <div key={u.title} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-6">
              <div className="text-xs font-bold text-[#d9ff00] mb-2">{u.tag.toUpperCase()}</div>
              <div className="text-lg font-semibold">{u.title}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="self-host" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.04]">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[#d9ff00]/20 bg-[#d9ff00]/[0.03] p-8">
            <div className="text-xs font-bold text-[#d9ff00] mb-3">CLOUD</div>
            <div className="text-xl font-bold mb-2">Deploy to Vercel in 2 minutes</div>
            <div className="text-sm text-white/60 leading-relaxed mb-6">
              Drop a <code className="text-[#d9ff00]">FAL_KEY</code> in your Vercel env, push, and you&apos;re live. The team gets a shared studio URL with per-brand workspaces.
            </div>
            <Link href="/dashboard" className="text-[#d9ff00] text-sm font-semibold hover:underline">Provision now →</Link>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8">
            <div className="text-xs font-bold text-white/50 mb-3">LOCAL</div>
            <div className="text-xl font-bold mb-2">Run on your own GPU</div>
            <div className="text-sm text-white/60 leading-relaxed mb-6">
              Point <code className="text-white/80">AI_PROVIDER=local</code> at your Ollama, ComfyUI or sd.cpp runtime. Zero data leaves your box.
            </div>
            <a href="https://github.com/goatstarter/goat-ugc-ai#local-models" className="text-white/80 text-sm font-semibold hover:underline">Setup guide →</a>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-4 text-xs text-white/40">
        <div>
          © {new Date().getFullYear()} GOAT UGC AI · MIT · fal.ai + Remotion
        </div>
        <div className="flex gap-4">
          <Link href="/video" className="hover:text-white">Video</Link>
          <Link href="/create" className="hover:text-white">Image</Link>
          <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
          <a href="https://github.com/goatstarter/goat-ugc-ai" target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a>
        </div>
      </footer>
    </div>
  );
}
