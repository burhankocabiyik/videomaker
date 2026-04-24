import Link from 'next/link';

const FEATURES = [
  {
    title: 'Image Studio',
    body: 'Flux, SDXL, Nano Banana Pro, Seedream and 100+ models in one canvas.',
    icon: '▩',
  },
  {
    title: 'Video Studio',
    body: 'Kling, Veo, Seedance and Runway-class generation for product reels.',
    icon: '▶',
  },
  {
    title: 'Lip Sync & Cinema',
    body: 'Shoot cinematic UGC in minutes. Sync voiceovers to any face or avatar.',
    icon: '◉',
  },
  {
    title: 'Agents & Workflows',
    body: 'Compose multi-step creative pipelines. Hand off drafts to your team.',
    icon: '✦',
  },
];

const STEPS = [
  { n: 1, title: 'Pick a model', body: 'Choose a cloud provider (fal.ai, muapi.ai) or wire in local models on your own GPU.' },
  { n: 2, title: 'Brief the studio', body: 'Describe the asset you want. Upload brand references, scripts, or source footage.' },
  { n: 3, title: 'Ship the asset', body: 'Download, post to socials, or drop into your product — with history you can revisit.' },
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
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#deploy" className="hover:text-white">Self-host</a>
            <a href="https://github.com/goatstarter/goat-ugc-ai" target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="h-9 px-4 rounded-md text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 flex items-center">
              Dashboard
            </Link>
            <Link href="/studio" className="h-9 px-4 rounded-md text-xs font-semibold bg-[#d9ff00] text-black hover:bg-[#e5ff33] flex items-center">
              Open Studio →
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d9ff00]/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/60 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d9ff00] animate-pulse" />
            Open-source &middot; Cloud-ready on Vercel &middot; Local-ready on your own GPU
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl">
            Creative AI studio for
            <span className="text-[#d9ff00]"> apps and agencies</span>
            <span className="text-white/30">.</span>
          </h1>
          <p className="mt-6 text-lg text-white/60 max-w-2xl">
            Ship product UGC, founder reels, ad creative, and on-brand imagery without juggling fifteen tabs.
            One studio, every major model, your choice of provider.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/studio" className="h-12 px-6 rounded-md text-sm font-semibold bg-[#d9ff00] text-black hover:bg-[#e5ff33] flex items-center shadow-lg shadow-[#d9ff00]/10">
              Open Studio →
            </Link>
            <Link href="/dashboard" className="h-12 px-6 rounded-md text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 flex items-center">
              View Dashboard
            </Link>
            <a href="#deploy" className="h-12 px-6 rounded-md text-sm font-semibold text-white/60 hover:text-white flex items-center">
              Run it locally
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.04]">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
              <div className="text-[#d9ff00] text-2xl mb-4">{f.icon}</div>
              <div className="font-semibold mb-1">{f.title}</div>
              <div className="text-sm text-white/50 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.04]">
        <h2 className="text-3xl font-bold tracking-tight mb-2">How it works</h2>
        <p className="text-white/50 max-w-2xl mb-10">
          Built for app founders and creative agencies who need to turn briefs into polished assets — fast.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-6">
              <div className="text-xs font-bold text-[#d9ff00] mb-3">STEP {s.n}</div>
              <div className="font-semibold mb-1">{s.title}</div>
              <div className="text-sm text-white/50 leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="deploy" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.04]">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[#d9ff00]/20 bg-[#d9ff00]/[0.03] p-8">
            <div className="text-xs font-bold text-[#d9ff00] mb-3">CLOUD</div>
            <div className="text-xl font-bold mb-2">Deploy to Vercel in 2 minutes</div>
            <div className="text-sm text-white/60 leading-relaxed mb-6">
              Drop a <code className="text-[#d9ff00]">FAL_KEY</code> in your Vercel env, push to production, and you&apos;re live.
              Your team gets a shared studio URL and per-brand workspaces.
            </div>
            <Link href="/dashboard" className="text-[#d9ff00] text-sm font-semibold hover:underline">
              Provision now →
            </Link>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8">
            <div className="text-xs font-bold text-white/50 mb-3">LOCAL</div>
            <div className="text-xl font-bold mb-2">Run on your own GPU</div>
            <div className="text-sm text-white/60 leading-relaxed mb-6">
              Point <code className="text-white/80">AI_PROVIDER=local</code> at your Ollama, ComfyUI or sd.cpp runtime.
              Zero data leaves your box. Ideal for regulated industries and heavy-duty agencies.
            </div>
            <a href="https://github.com/goatstarter/goat-ugc-ai#local-models" className="text-white/80 text-sm font-semibold hover:underline">
              Read the setup guide →
            </a>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-4 text-xs text-white/40">
        <div>
          © {new Date().getFullYear()} GOAT UGC AI · Open source (MIT) · Built on Open Generative AI + fal.ai
        </div>
        <div className="flex gap-4">
          <Link href="/studio" className="hover:text-white">Studio</Link>
          <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
          <a href="https://github.com/goatstarter/goat-ugc-ai" target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a>
        </div>
      </footer>
    </div>
  );
}
