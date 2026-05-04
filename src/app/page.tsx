export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Robocode</h1>
        <p className="text-lg">Learn Java. Battle friends. Build a world.</p>
        <div className="mt-6 flex flex-col space-x-4 space-y-4 sm:flex-row">
          <a
            href="/login"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-white transition-colors hover:bg-blue-700 sm:w-auto"
          >
            Sign in
          </a>
          <a
            href="/signup"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/[.08] px-5 text-white transition-colors hover:border-transparent hover:bg-white/[.04] sm:w-auto"
          >
            Sign up
          </a>
        </div>
      </div>
    </div>
  );
}
