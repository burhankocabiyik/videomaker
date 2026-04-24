'use client';

import { useEffect, useState } from 'react';

const HISTORY_KEY = 'goat_create_history_v1';

function loadHistory() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function CreateClient({ summary, models, imageSizes }) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(models[0]?.id || '');
  const [size, setSize] = useState(imageSizes[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          image_size: size,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed');
      setResult(data);
      if (data.url) {
        const entry = {
          id: Math.random().toString(36).slice(2),
          prompt: prompt.trim(),
          url: data.url,
          model,
          size,
          at: Date.now(),
        };
        const next = [entry, ...history].slice(0, 24);
        setHistory(next);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      {/* Prompt panel */}
      <form onSubmit={submit} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 flex flex-col gap-5 h-fit">
        <div>
          <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Cinematic close-up of a female founder holding our app on her iPhone, golden hour lighting, 35mm film grain..."
            className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Aspect</label>
          <div className="grid grid-cols-5 gap-1">
            {imageSizes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSize(s.id)}
                className={`text-[10px] font-semibold py-2 rounded-md border transition-colors ${
                  size === s.id
                    ? 'bg-[#d9ff00]/10 border-[#d9ff00]/40 text-[#d9ff00]'
                    : 'bg-white/[0.02] border-white/10 text-white/60 hover:text-white'
                }`}
              >
                {s.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="h-11 rounded-md bg-[#d9ff00] text-black text-sm font-bold hover:bg-[#e5ff33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>

        {!summary.serverKeyConfigured ? (
          <div className="text-[11px] text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-md p-3">
            No server key configured for <b>{summary.label}</b>. Set <code>FAL_KEY</code> (or <code>MUAPI_KEY</code>) in your env — see README.
          </div>
        ) : null}

        {error ? (
          <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-md p-3">{error}</div>
        ) : null}
      </form>

      {/* Canvas panel */}
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 min-h-[500px] flex flex-col">
        {result?.url ? (
          <div className="flex-1 flex flex-col">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Latest output</div>
            <div className="relative flex-1 min-h-[400px] bg-black/40 rounded-lg overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.url} alt="Generated output" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/40">
              <span>Provider: <span className="text-white/70">{result.provider}</span></span>
              <span>·</span>
              <span>Model: <span className="text-white/70">{result.model || result.endpoint}</span></span>
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                download
                className="ml-auto h-7 px-3 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 flex items-center font-semibold text-white/80"
              >
                Open asset ↗
              </a>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-white/30">
            {loading ? 'Crafting your asset…' : 'Your generation will appear here.'}
          </div>
        )}

        {history.length > 0 ? (
          <div className="mt-6">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Recent</div>
            <div className="grid grid-cols-6 gap-2">
              {history.slice(0, 12).map((h) => (
                <a
                  key={h.id}
                  href={h.url}
                  target="_blank"
                  rel="noreferrer"
                  title={h.prompt}
                  className="aspect-square rounded-md overflow-hidden bg-black/40 border border-white/5 hover:border-white/20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={h.url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
