'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SettingsPage() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout');
    router.push('/login');
  };

  const handleReset = async () => {
    if (!confirm('This will delete all your progress (tutorial, XP, money). Are you sure?')) return;
    if (!confirm('Really? This cannot be undone.')) return;
    setResetting(true);
    try {
      const r = await fetch('/api/profile/reset', { method: 'POST' });
      if (r.ok) alert('Progress reset. Reload the game to start fresh.');
      else alert('Failed to reset progress.');
    } catch { alert('Network error.'); }
    setResetting(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        <div className="bg-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <p className="text-gray-400 mb-2">Account</p>
            <button onClick={handleLogout} className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-left font-semibold">Log Out</button>
          </div>
          <div className="pt-4 border-t border-gray-700">
            <p className="text-gray-400 mb-2">Danger Zone</p>
            <button onClick={handleReset} disabled={resetting} className="w-full px-4 py-3 bg-red-900/50 border border-red-700 hover:bg-red-900 rounded-lg text-left font-semibold text-red-400 disabled:opacity-40">
              {resetting ? 'Resetting...' : 'Reset Progress'}
            </button>
          </div>
        </div>
        <button onClick={() => router.push('/game')} className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg">Back to Game</button>
      </div>
    </div>
  );
}
