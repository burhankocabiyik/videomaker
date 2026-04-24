'use client';

import { useEffect, useState } from 'react';

const KEY = 'goat_projects_v1';

function loadProjects() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export default function ProjectsClient() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  const save = (next) => {
    setProjects(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const p = {
      id: Math.random().toString(36).slice(2),
      name: name.trim(),
      brand: brand.trim(),
      createdAt: Date.now(),
    };
    save([p, ...projects]);
    setName('');
    setBrand('');
  };

  const remove = (id) => save(projects.filter((p) => p.id !== id));

  return (
    <>
      <form onSubmit={add} className="grid md:grid-cols-3 gap-3 mb-8">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name (e.g. Acme app launch)"
          className="bg-white/5 border border-white/10 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
        />
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand / client (optional)"
          className="bg-white/5 border border-white/10 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
        />
        <button type="submit" className="h-10 rounded-md bg-[#d9ff00] text-black text-xs font-bold hover:bg-[#e5ff33]">
          Create project
        </button>
      </form>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
          No projects yet. Spin up your first one above.
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-5 flex flex-col">
              <div className="text-xs font-bold text-[#d9ff00] mb-2">{p.brand || 'Workspace'}</div>
              <div className="font-semibold mb-1">{p.name}</div>
              <div className="text-[11px] text-white/40 mb-4">
                Created {new Date(p.createdAt).toLocaleDateString()}
              </div>
              <div className="mt-auto flex gap-2">
                <a
                  href="/create"
                  className="flex-1 h-8 rounded-md text-[11px] font-semibold bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center"
                >
                  Create
                </a>
                <button
                  onClick={() => remove(p.id)}
                  className="h-8 px-3 rounded-md text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
