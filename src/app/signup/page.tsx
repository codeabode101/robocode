'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password }),
    });

    if (res.ok) {
      window.location.href = '/game';
    } else {
      const data = await res.json();
      setError(data.error || 'Sign up failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg">
        <h1 className="text-4xl font-bold text-center">Robocode</h1>
        <p className="text-center text-gray-300">Create your account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 text-black rounded"
            />
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-black rounded"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 mt-1 text-black rounded"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-semibold">
            Sign Up
          </button>
        </form>
        <p className="text-center text-sm">
          Already have an account?{' '}
          <a href="/login" className="text-blue-400 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
