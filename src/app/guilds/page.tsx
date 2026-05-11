'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Guild = {
  id: string;
  name: string;
  owner_id: string;
  description: string | null;
  min_level: number;
  member_count: number;
  created_at: string;
};

export default function GuildsPage() {
  const router = useRouter();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [myGuildIds, setMyGuildIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minLevel, setMinLevel] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadGuilds = useCallback(async () => {
    try {
      const res = await fetch('/api/guilds');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setGuilds(data.guilds ?? []);
      setMyGuildIds(data.myGuildIds ?? []);
    } catch {}
    setLoading(false);
  }, [router]);

  useEffect(() => { loadGuilds(); }, [loadGuilds]);

  const handleCreate = async () => {
    setError('');
    const res = await fetch('/api/guilds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, minLevel }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    setShowCreate(false);
    setName('');
    setDescription('');
    setMinLevel(1);
    loadGuilds();
    router.push(`/guilds/${data.id}`);
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Guilds</h1>
          <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg font-semibold">
            {showCreate ? 'Cancel' : 'Create Guild'}
          </button>
        </div>

        {showCreate && (
          <div className="bg-gray-800 rounded-xl p-6 mb-8 space-y-4">
            <h2 className="text-xl font-semibold">Create a Guild</h2>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Guild name" className="w-full bg-gray-700 rounded-lg p-3 text-white" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full bg-gray-700 rounded-lg p-3 text-white" rows={3} />
            <div>
              <label className="text-gray-400 text-sm">Minimum level to join</label>
              <input type="number" value={minLevel} onChange={e => setMinLevel(Number(e.target.value))} min={1} max={100} className="w-full bg-gray-700 rounded-lg p-3 text-white mt-1" />
            </div>
            {error && <p className="text-red-400">{error}</p>}
            <button onClick={handleCreate} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg font-semibold">Create (costs 50 XP)</button>
          </div>
        )}

        {guilds.length === 0 ? (
          <p className="text-gray-500 text-center mt-12">No guilds yet. Create the first one!</p>
        ) : (
          <div className="space-y-4">
            {guilds.map(g => (
              <div key={g.id} className="bg-gray-800 rounded-xl p-5 flex items-center justify-between cursor-pointer hover:bg-gray-750" onClick={() => router.push(`/guilds/${g.id}`)}>
                <div>
                  <h3 className="text-lg font-semibold">{g.name}</h3>
                  <p className="text-gray-400 text-sm">{g.description || 'No description'}</p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span>👥 {g.member_count} members</span>
                    <span>⭐ Min level {g.min_level}</span>
                    {myGuildIds.includes(g.id) && <span className="text-emerald-400">✓ Member</span>}
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-8 text-center">
          <button onClick={() => router.push('/game')} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg">
            Back to Game
          </button>
        </div>
      </div>
    </div>
  );
}
