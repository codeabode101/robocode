import Link from 'next/link'

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050510] text-white">
      {/* Animated background layers */}
      <div className="absolute inset-0">
        {/* Base dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e] via-[#050510] to-[#0f0a1a]" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,212,170,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.08) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Center glow */}
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[150px]" />

        {/* Corner glows */}
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-rose-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />

        {/* Scanlines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(transparent, transparent 2px, white 2px, white 4px)',
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[
          { x: '10%', y: '20%', delay: '0s', dur: '6s', size: 'w-1 h-1' },
          { x: '85%', y: '15%', delay: '1s', dur: '8s', size: 'w-1.5 h-1.5' },
          { x: '30%', y: '70%', delay: '2s', dur: '7s', size: 'w-1 h-1' },
          { x: '70%', y: '80%', delay: '0.5s', dur: '9s', size: 'w-2 h-2' },
          { x: '50%', y: '10%', delay: '3s', dur: '6s', size: 'w-1 h-1' },
          { x: '20%', y: '50%', delay: '1.5s', dur: '10s', size: 'w-1.5 h-1.5' },
          { x: '90%', y: '60%', delay: '2.5s', dur: '7s', size: 'w-1 h-1' },
          { x: '40%', y: '90%', delay: '0.8s', dur: '8s', size: 'w-2 h-2' },
        ].map((p, i) => (
          <div
            key={i}
            className={`absolute ${p.size} rounded-full bg-emerald-400/30`}
            style={{
              left: p.x,
              top: p.y,
              animation: `particleFloat ${p.dur} ease-in-out ${p.delay} infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        {/* Top badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-mono tracking-wider text-emerald-400">
            NOW IN BETA
          </span>
        </div>

        {/* Logo / Robot */}
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-[0_0_40px_rgba(0,212,170,0.15)]">
          <span className="text-5xl">🤖</span>
        </div>

        {/* Title */}
        <h1 className="mb-4 font-display text-center text-6xl font-black leading-none tracking-tighter md:text-8xl lg:text-9xl">
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            ROBOCODE
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mb-10 max-w-lg text-center text-lg font-mono text-gray-400 md:text-xl">
          Write code. Build robots.{' '}
          <span className="text-amber-400 font-semibold">Battle your friends.</span>
          <br />
          <span className="text-sm text-gray-500">Learn APCSA through play.</span>
        </p>

        {/* CTA Button */}
        <Link href="/onboarding">
          <button className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-emerald-500 px-10 py-4 text-lg font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_50px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95">
            <span className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 transition-opacity group-hover:opacity-100" />
            <span className="relative font-mono text-base tracking-wide">
              Enter the Dojo
            </span>
            <svg
              className="relative h-5 w-5 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </Link>

        {/* Feature cards */}
        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {[
            {
              icon: '⚔️',
              title: 'Battle',
              desc: 'Write scripts and watch robots fight in real-time.',
              border: 'border-emerald-500/20',
              bg: 'bg-emerald-500/5',
              text: 'text-emerald-400',
            },
            {
              icon: '📚',
              title: 'Learn',
              desc: 'Master variables, loops, and conditionals.',
              border: 'border-amber-500/20',
              bg: 'bg-amber-500/5',
              text: 'text-amber-400',
            },
            {
              icon: '🏆',
              title: 'Compete',
              desc: 'Climb leaderboards and earn rewards.',
              border: 'border-rose-500/20',
              bg: 'bg-rose-500/5',
              text: 'text-rose-400',
            },
          ].map((card) => (
            <div
              key={card.title}
              className={`rounded-xl border ${card.border} ${card.bg} p-5 backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-white/10`}
            >
              <div className="mb-3 text-3xl">{card.icon}</div>
              <h3 className={`font-mono font-bold ${card.text} mb-1`}>
                {card.title}
              </h3>
              <p className="text-sm text-gray-500">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer line */}
        <div className="mt-16 flex items-center gap-4 text-[11px] font-mono tracking-[0.2em] text-gray-600 uppercase">
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-gray-700" />
          Code · Fight · Learn
          <span className="h-px w-12 bg-gradient-to-l from-transparent to-gray-700" />
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes particleFloat {
          0% { transform: translateY(0px) scale(1); opacity: 0.2; }
          100% { transform: translateY(-30px) scale(1.5); opacity: 0.6; }
        }
      `}</style>
    </main>
  )
}
