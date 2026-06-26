'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SparkyQuestStage } from '@/components/game/types';

const STAGE_TELEPORT: Record<SparkyQuestStage, { x: number; y: number; room: string; cutsceneDone: boolean; batteryInstalled: boolean }> = {
  'intro':          { x: 0, y: -1.5, room: 'apartment', cutsceneDone: false, batteryInstalled: false },
  'intro-done':     { x: 0, y: -7, room: 'outside', cutsceneDone: true, batteryInstalled: false },
  'unit1':          { x: 0, y: -3.7, room: 'workshop', cutsceneDone: true, batteryInstalled: false },
  'unit1-done':     { x: 0, y: -7, room: 'outside', cutsceneDone: true, batteryInstalled: false },
  'unit2':          { x: 0, y: -3.7, room: 'workshop', cutsceneDone: true, batteryInstalled: true },
  'unit2-done':     { x: 0, y: -7, room: 'outside', cutsceneDone: true, batteryInstalled: true },
  'unit3':          { x: 0, y: -3.7, room: 'workshop', cutsceneDone: true, batteryInstalled: true },
  'unit3-done':     { x: 0, y: -7, room: 'outside', cutsceneDone: true, batteryInstalled: true },
  'unit4':          { x: 0, y: -3.7, room: 'workshop', cutsceneDone: true, batteryInstalled: true },
  'all-done':       { x: 0, y: -7, room: 'outside', cutsceneDone: true, batteryInstalled: true },
};

type Guild = { id: string; name: string; owner_id: string; description: string | null; min_level: number; member_count: number; created_at: string };
type RequestItem = { senderId?: string; receiverId?: string; status: string; name: string | null };

export default function ModalShell({ activeModal, setActiveModal, userId, debugMode, setDebugMode }: { activeModal: string; setActiveModal: (v: string | null) => void; userId: string; debugMode: boolean; setDebugMode: (v: boolean) => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setActiveModal(null)}>
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-600/50 shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4 shrink-0">
          <h2 className="text-xl font-bold text-white capitalize">{activeModal}</h2>
          <button onClick={() => setActiveModal(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors">✕</button>
        </div>
        <div className="p-6 text-slate-300 overflow-y-auto">
          {activeModal === 'profile' && <ProfileModal />}
          {activeModal === 'settings' && <SettingsModal userId={userId} debugMode={debugMode} setDebugMode={setDebugMode} />}
          {activeModal === 'friends' && <FriendsModal />}
          {activeModal === 'guilds' && <GuildsModal />}
        </div>
      </div>
    </div>
  );
}

function ProfileModal() {
  const [user, setUser] = useState<{ name?: string; email?: string; currency?: number; playtime_seconds?: number; xp?: { level: number; xp: number; xpToNext: number; progress: number } } | null>(null);
  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => setUser(d)).catch(() => {});
  }, []);
  if (!user) return <p className="text-slate-400">Loading...</p>;
  const fmtPlaytime = (s: number = 0) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white">{(user.name || '?')[0]}</div>
        <div>
          <p className="text-lg font-semibold text-white">{user.name || 'Unnamed'}</p>
          <p className="text-slate-400 text-sm">{user.email}</p>
        </div>
      </div>
      {user.xp && (
        <div className="border-t border-slate-700 pt-4">
          <p className="text-slate-400 text-sm">Level {user.xp.level}</p>
          <div className="w-full bg-slate-700 rounded-full h-2.5 mt-1.5">
            <div className="bg-amber-500 h-2.5 rounded-full transition-all" style={{ width: `${user.xp.progress * 100}%` }} />
          </div>
          <p className="text-slate-500 text-xs mt-1">{user.xp.xp} XP &bull; {user.xp.xpToNext} XP to next level</p>
        </div>
      )}
      <div className="border-t border-slate-700 pt-4">
        <p className="text-slate-400 text-sm">Currency</p>
        <p className="text-2xl font-bold text-emerald-400">${user.currency ?? 0}</p>
      </div>
      <div className="border-t border-slate-700 pt-4">
        <p className="text-slate-400 text-sm">Playtime</p>
        <p className="text-lg font-semibold text-white">{fmtPlaytime(user.playtime_seconds)}</p>
      </div>
    </div>
  );
}

function SettingsModal({ userId, debugMode, setDebugMode }: { userId: string; debugMode: boolean; setDebugMode: (v: boolean) => void }) {
  const [questStage, setQuestStage] = useState<SparkyQuestStage | ''>('');

  const handleLogout = async () => {
    await fetch('/api/auth/logout');
    window.location.href = '/login';
  };
  const handleReset = async () => {
    if (!confirm('This will delete all your progress (tutorial, XP, money). Are you sure?')) return;
    if (!confirm('Really? This cannot be undone.')) return;
    const r = await fetch('/api/profile/reset', { method: 'POST' });
    if (r.ok) {
      try { localStorage.removeItem('rb_robot_name'); localStorage.removeItem('rb_first_tx_done'); } catch {}
      alert('Progress reset. Reload to start fresh.'); window.location.reload();
    }
    else { const d = await r.json(); alert(d.error || 'Failed to reset progress.'); }
  };
  const handleQuestChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stage = e.target.value as SparkyQuestStage;
    setQuestStage(stage);
    const tp = STAGE_TELEPORT[stage];
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questStage: stage,
          cutsceneDone: tp.cutsceneDone,
          batteryInstalled: tp.batteryInstalled,
          position: { x: tp.x, y: tp.y, room: tp.room },
        }),
      });
    } catch {}
    window.location.reload();
  };
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500" />
        <span className="text-slate-200">Debug Mode (coords &amp; FPS)</span>
      </label>
      {debugMode && (
        <div className="border-t border-slate-700 pt-4 space-y-3">
          <p className="text-amber-400 text-sm font-semibold">Debug Tools</p>
          <div>
            <label className="text-slate-400 text-xs block mb-1.5">Quest Stage</label>
            <select value={questStage} onChange={handleQuestChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white text-sm">
              <option value="" disabled>Select stage...</option>
              <option value="intro">intro (cutscene)</option>
              <option value="intro-done">intro-done</option>
              <option value="unit1">unit1 (workshop)</option>
              <option value="unit1-done">unit1-done (buy battery)</option>
              <option value="unit2">unit2</option>
              <option value="unit2-done">unit2-done</option>
              <option value="unit3">unit3</option>
              <option value="unit3-done">unit3-done</option>
              <option value="unit4">unit4</option>
              <option value="all-done">all-done</option>
            </select>
            <p className="text-slate-500 text-xs mt-1.5">Teleports you to the right location and reloads.</p>
          </div>
        </div>
      )}
      <div className="border-t border-slate-700 pt-4">
        <p className="text-slate-400 text-sm mb-2">Account</p>
        <button onClick={handleLogout} className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-left font-semibold text-white">Log Out</button>
      </div>
      <div className="border-t border-slate-700 pt-4">
        <p className="text-slate-400 text-sm mb-2">Danger Zone</p>
        <button onClick={handleReset} className="w-full px-4 py-3 bg-red-900/50 border border-red-700 hover:bg-red-900 rounded-lg text-left font-semibold text-red-400">Reset Progress</button>
      </div>
    </div>
  );
}

function FriendsModal() {
  const [friends, setFriends] = useState<RequestItem[]>([]);
  const [incoming, setIncoming] = useState<RequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<RequestItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string | null }[]>([]);

  const loadFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/friends');
      const data = await res.json();
      setFriends(data.received?.filter((r: RequestItem) => r.status === 'accepted') ?? []);
      setIncoming(data.received?.filter((r: RequestItem) => r.status === 'pending') ?? []);
      setOutgoing(data.sent ?? []);
    } catch {}
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const doAction = async (friendId: string, action: string) => {
    await fetch('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friendId, action }) });
    loadFriends();
  };

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    const res = await fetch(`/api/friends?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data.users ?? []);
  };

  return (
    <div className="space-y-4">
      <div>
        <input value={searchQuery} onChange={(e) => searchUsers(e.target.value)} placeholder="Search users by name..." className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm" />
        {searchResults.length > 0 && (
          <div className="mt-1 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-2.5 hover:bg-slate-700 text-sm">
                <span>{u.name || 'Unknown'}</span>
                <button onClick={() => doAction(u.id, 'send')} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs">Add</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {incoming.length > 0 && (
        <div>
          <p className="text-yellow-400 text-sm font-semibold mb-2">Incoming Requests ({incoming.length})</p>
          {incoming.map((r) => (
            <div key={r.senderId} className="flex items-center justify-between bg-slate-800 p-2.5 rounded-lg mb-1.5 text-sm">
              <span>{r.name || 'Unknown'}</span>
              <div className="flex gap-1.5">
                <button onClick={() => doAction(r.senderId!, 'accept')} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs">Accept</button>
                <button onClick={() => doAction(r.senderId!, 'reject')} className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {friends.length > 0 && (
        <div>
          <p className="text-emerald-400 text-sm font-semibold mb-2">Friends ({friends.length})</p>
          {friends.map((r) => (
            <div key={r.senderId} className="flex items-center justify-between bg-slate-800 p-2.5 rounded-lg mb-1.5 text-sm">
              <span>{r.name || 'Unknown'}</span>
              <button onClick={() => doAction(r.senderId!, 'remove')} className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs">Remove</button>
            </div>
          ))}
        </div>
      )}
      {outgoing.length > 0 && (
        <div>
          <p className="text-blue-400 text-sm font-semibold mb-2">Sent Requests ({outgoing.length})</p>
          {outgoing.map((r) => (
            <div key={r.receiverId} className="flex items-center justify-between bg-slate-800 p-2.5 rounded-lg mb-1.5 text-sm">
              <span>{r.name || 'Unknown'} <span className="text-slate-500 text-xs">({r.status})</span></span>
              {r.status === 'pending' && <button onClick={() => doAction(r.receiverId!, 'cancel')} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs">Cancel</button>}
            </div>
          ))}
        </div>
      )}
      {friends.length === 0 && incoming.length === 0 && outgoing.length === 0 && <p className="text-slate-500 text-center pt-4">No friends yet. Search for users above to add them!</p>}
    </div>
  );
}

function GuildsModal() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [myGuildIds, setMyGuildIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minLevel, setMinLevel] = useState(1);
  const [error, setError] = useState('');

  const loadGuilds = useCallback(async () => {
    try {
      const res = await fetch('/api/guilds');
      const data = await res.json();
      setGuilds(data.guilds ?? []);
      setMyGuildIds(data.myGuildIds ?? []);
    } catch {}
  }, []);

  useEffect(() => { loadGuilds(); }, [loadGuilds]);

  const handleCreate = async () => {
    setError('');
    const res = await fetch('/api/guilds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, minLevel }) });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    setShowCreate(false); setName(''); setDescription(''); setMinLevel(1);
    loadGuilds();
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setShowCreate(!showCreate)} className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg font-semibold text-sm">{showCreate ? 'Cancel' : 'Create Guild'}</button>
      {showCreate && (
        <div className="bg-slate-800 rounded-xl p-4 space-y-3 border border-slate-700">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Guild name" className="w-full bg-slate-700 rounded-lg p-2.5 text-white text-sm" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full bg-slate-700 rounded-lg p-2.5 text-white text-sm" rows={2} />
          <div>
            <label className="text-slate-400 text-xs">Min level to join</label>
            <input type="number" value={minLevel} onChange={e => setMinLevel(Number(e.target.value))} min={1} max={100} className="w-full bg-slate-700 rounded-lg p-2.5 text-white text-sm mt-1" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleCreate} className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg font-semibold text-sm">Create (costs 50 XP)</button>
        </div>
      )}
      {guilds.length === 0 ? (
        <p className="text-slate-500 text-center pt-4">No guilds yet.</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {guilds.map(g => (
            <div key={g.id} className="bg-slate-800 rounded-xl p-3.5 border border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{g.name}</p>
                  <p className="text-slate-400 text-xs">{g.description || 'No description'}</p>
                  <div className="flex gap-3 mt-1.5 text-xs text-slate-500">
                    <span>👥 {g.member_count}</span>
                    <span>⭐ Lv.{g.min_level}</span>
                    {myGuildIds.includes(g.id) && <span className="text-emerald-400">✓ Member</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
