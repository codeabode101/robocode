'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

type Member = { user_id: string; role: string; name: string | null; level: number; joined_at: string };
type ChatMsg = { id: string; user_id: string; message: string; created_at: string; name: string | null };

export default function GuildDetailPage() {
  const router = useRouter();
  const params = useParams();
  const guildId = params.id as string;

  const [guild, setGuild] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadGuild = useCallback(async () => {
    const res = await fetch(`/api/guilds/${guildId}`);
    if (res.status === 401) { router.push('/login'); return; }
    if (!res.ok) { router.push('/guilds'); return; }
    const data = await res.json();
    setGuild(data);
    setMembers(data.members ?? []);
    setMyRole(data.myRole);
  }, [guildId, router]);

  const loadChat = useCallback(async () => {
    const res = await fetch(`/api/guilds/${guildId}/chat`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
  }, [guildId]);

  useEffect(() => {
    Promise.all([loadGuild(), loadChat()]).then(() => setLoading(false));
  }, [loadGuild, loadChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!guild) return;
    const interval = setInterval(loadChat, 5000);
    return () => clearInterval(interval);
  }, [guild, loadChat]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const res = await fetch(`/api/guilds/${guildId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: chatInput }),
    });
    if (res.ok) {
      setChatInput('');
      loadChat();
    }
  };

  const handleAction = async (action: string, targetId?: string) => {
    const res = await fetch(`/api/guilds/${guildId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, targetId }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    if (data.disbanded) { router.push('/guilds'); return; }
    setError('');
    loadGuild();
  };

  const handleDisband = async () => {
    if (!confirm('Disband this guild? This cannot be undone.')) return;
    const res = await fetch(`/api/guilds/${guildId}`, { method: 'DELETE' });
    if (res.ok) router.push('/guilds');
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center"><p>Loading...</p></div>;
  if (!guild) return null;

  const isOwner = myRole === 'owner';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{guild.name}</h1>
            <p className="text-gray-400 mt-1">{guild.description || 'No description'}</p>
            <p className="text-gray-500 text-sm mt-1">Min level: {guild.min_level} • {members.length} members</p>
          </div>
          <div className="flex gap-3">
            {!myRole && <button onClick={() => handleAction('join')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold">Join</button>}
            {myRole === 'member' && <button onClick={() => handleAction('leave')} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold">Leave</button>}
            {isOwner && <button onClick={handleDisband} className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg font-semibold">Disband</button>}
          </div>
        </div>
        {error && <p className="text-red-400 mb-4">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-gray-800 rounded-xl p-4 h-[400px] flex flex-col">
              <h2 className="text-lg font-semibold mb-3">Chat</h2>
              <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                {messages.length === 0 && <p className="text-gray-500 text-center mt-8">No messages yet</p>}
                {messages.map(m => (
                  <div key={m.id} className="bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-emerald-400 font-semibold text-sm">{m.name || 'Unknown'}</span>
                    <span className="text-gray-500 text-xs ml-2">{new Date(m.created_at).toLocaleTimeString()}</span>
                    <p className="text-sm mt-0.5">{m.message}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {myRole && (
                <div className="flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..." className="flex-1 bg-gray-700 rounded-lg p-2 text-sm text-white" />
                  <button onClick={sendMessage} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold">Send</button>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="text-lg font-semibold mb-3">Members ({members.length})</h2>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm">{m.name || 'Unknown'}</span>
                      <span className="text-xs text-gray-500 ml-2">Lv.{m.level}</span>
                      {m.role === 'owner' && <span className="text-amber-400 text-xs ml-1">👑</span>}
                    </div>
                    {isOwner && m.role !== 'owner' && (
                      <button onClick={() => handleAction('kick', m.user_id)} className="text-xs text-red-400 hover:text-red-300">Kick</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <button onClick={() => router.push('/game')} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg">
            Back to Game
          </button>
        </div>
      </div>
    </div>
  );
}
