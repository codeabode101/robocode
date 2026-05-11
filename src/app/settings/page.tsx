'use client';

import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        <div className="bg-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <p className="text-gray-400 mb-2">Account</p>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-left font-semibold"
            >
              Log Out
            </button>
          </div>
        </div>
        <button onClick={() => router.push('/game')} className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg">
          Back to Game
        </button>
      </div>
    </div>
  );
}
