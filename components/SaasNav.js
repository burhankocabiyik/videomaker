'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard',          label: 'Dashboard' },
  { href: '/video',              label: 'Video' },
  { href: '/create',             label: 'Image' },
  { href: '/dashboard/projects', label: 'Projects' },
];

export default function SaasNav({ provider }) {
  const pathname = usePathname() || '';
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.04] bg-black/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#d9ff00] flex items-center justify-center text-black font-black">G</div>
            <span className="font-bold tracking-tight hidden sm:block">GOAT UGC AI</span>
          </Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((l) => {
              const isActive = pathname === l.href || (l.href !== '/dashboard' && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-xs font-semibold px-3 h-9 rounded-md flex items-center transition-colors ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {provider ? (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d9ff00] animate-pulse" />
              <span>Provider: <span className="text-white/90 font-semibold">{provider}</span></span>
            </div>
          ) : null}
          <a
            href="https://github.com/goatstarter/goat-ugc-ai"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-white/60 hover:text-white h-9 px-3 rounded-md flex items-center"
          >
            GitHub
          </a>
          <a
            href="https://burhankocabiyik.com"
            target="_blank"
            rel="noreferrer"
            className="h-9 px-4 rounded-md text-xs font-semibold bg-[#d9ff00] text-black hover:bg-[#e5ff33] flex items-center shadow-lg shadow-[#d9ff00]/10"
          >
            burhankocabiyik.com ↗
          </a>
        </div>
      </div>
    </header>
  );
}
