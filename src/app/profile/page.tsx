'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email?: string; currency?: number } | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => { if (r.status === 401) router.push('/login'); return r.json(); })
      .then((d) => setUser(d))
      .catch(() => {});
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-8">Profile</h1>
        {user ? (
          <div className="bg-gray-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold">
                {(user.name || '?')[0]}
              </div>
              <div>
                <p className="text-xl font-semibold">{user.name || 'Unnamed'}</p>
                <p className="text-gray-400">{user.email}</p>
              </div>
            </div>
            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-400">Currency</p>
              <p className="text-2xl font-bold text-emerald-400">${user.currency ?? 0}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Loading...</p>
        )}
        <button onClick={() => router.push('/game')} className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg">
          Back to Game
        </button>
      </div>
    </div>
  );
}
