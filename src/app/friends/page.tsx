'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type RequestItem = {
  senderId?: string;
  receiverId?: string;
  status: string;
  name: string | null;
};

export default function FriendsPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<RequestItem[]>([]);
  const [incoming, setIncoming] = useState<RequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<RequestItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/friends');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setFriends(data.received?.filter((r: RequestItem) => r.status === 'accepted') ?? []);
      setIncoming(data.received?.filter((r: RequestItem) => r.status === 'pending') ?? []);
      setOutgoing(data.sent ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [router]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const doAction = async (friendId: string, action: string) => {
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId, action }),
    });
    loadFriends();
  };

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    const res = await fetch(`/api/friends?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data.users ?? []);
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Friends</h1>

        <div className="mb-8">
          <input
            value={searchQuery}
            onChange={(e) => searchUsers(e.target.value)}
            placeholder="Search users by name..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 bg-gray-800 rounded-lg overflow-hidden">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 hover:bg-gray-700">
                  <span>{u.name || 'Unknown'}</span>
                  <button onClick={() => doAction(u.id, 'send')} className="px-4 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm">
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {incoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-yellow-400">Incoming Requests</h2>
            {incoming.map((r) => (
              <div key={r.senderId} className="flex items-center justify-between bg-gray-800 p-3 rounded-lg mb-2">
                <span>{r.name || 'Unknown'}</span>
                <div className="flex gap-2">
                  <button onClick={() => doAction(r.senderId!, 'accept')} className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-sm">Accept</button>
                  <button onClick={() => doAction(r.senderId!, 'reject')} className="px-4 py-1 bg-red-600 hover:bg-red-500 rounded text-sm">Reject</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {friends.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-emerald-400">Your Friends ({friends.length})</h2>
            {friends.map((r) => (
              <div key={r.senderId} className="flex items-center justify-between bg-gray-800 p-3 rounded-lg mb-2">
                <span>{r.name || 'Unknown'}</span>
                <button onClick={() => doAction(r.senderId!, 'remove')} className="px-4 py-1 bg-red-700 hover:bg-red-600 rounded text-sm">Remove</button>
              </div>
            ))}
          </section>
        )}

        {outgoing.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-blue-400">Sent Requests ({outgoing.length})</h2>
            {outgoing.map((r) => (
              <div key={r.receiverId} className="flex items-center justify-between bg-gray-800 p-3 rounded-lg mb-2">
                <span>{r.name || 'Unknown'} <span className="text-gray-500 text-sm">({r.status})</span></span>
                {r.status === 'pending' && (
                  <button onClick={() => doAction(r.receiverId!, 'cancel')} className="px-4 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">Cancel</button>
                )}
              </div>
            ))}
          </section>
        )}

        {friends.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
          <p className="text-gray-500 text-center mt-12">No friends yet. Search for users above to add them!</p>
        )}
      </div>
    </div>
  );
}
