import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Robocode</h1>
        <p className="mb-6">Learn Java. Battle friends. Build a world.</p>
        <Link
          href="/api/auth/login"
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded text-lg"
        >
          Sign up / Login
        </Link>
      </div>
    </div>
  );
}
