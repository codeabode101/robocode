'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'

type OnboardingStep = 'welcome' | 'name' | 'age' | 'species' | 'starter' | 'summary'

const steps: OnboardingStep[] = ['welcome', 'name', 'age', 'species', 'starter', 'summary']

export default function Onboarding() {
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [robotName, setRobotName] = useState('')
  const [robotAge, setRobotAge] = useState<number>(1)
  const [selectedSpecies, setSelectedSpecies] = useState<'robo_pup' | 'circuit_cat' | 'pixel_dragon'>('robo_pup')
  const { setRobot, addCoins } = usePlayerStore()

  const stepIndex = steps.indexOf(step)

  const handleComplete = () => {
    setRobot(robotName, selectedSpecies)
    addCoins(50)
    window.location.href = '/dashboard'
  }

  const speciesInfo = {
    robo_pup: { emoji: '🤖', name: 'Robo Pup', desc: 'Loyal & fast' },
    circuit_cat: { emoji: '🐱', name: 'Circuit Cat', desc: 'Sneaky & smart' },
    pixel_dragon: { emoji: '🐉', name: 'Pixel Dragon', desc: 'Powerful & fierce' },
  }

  return (
    <main className="relative min-h-screen bg-[#050510] text-white flex items-center justify-center p-4 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e] via-[#050510] to-[#0f0a1a]" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,212,170,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.06) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                idx <= stepIndex ? 'w-8 bg-emerald-500' : 'w-4 bg-white/10'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm shadow-2xl text-center"
            >
              <div className="text-7xl mb-6">🤖</div>
              <h1 className="text-4xl font-display font-black mb-3 bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Welcome to Robocode!
              </h1>
              <p className="text-lg text-gray-400 mb-8">
                Program your robot. Master coding. Battle friends.
              </p>
              <button
                onClick={() => setStep('name')}
                className="bg-emerald-500 text-black font-bold text-lg px-8 py-3 rounded-xl hover:bg-emerald-400 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95"
              >
                Start Your Journey →
              </button>
            </motion.div>
          )}

          {step === 'name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm shadow-2xl"
            >
              <div className="text-4xl mb-4">✏️</div>
              <h2 className="text-3xl font-display font-bold mb-2">Name Your Robot</h2>
              <p className="text-gray-500 mb-6 text-sm">Every great robot needs a legendary name</p>
              <div className="rounded-xl border border-white/5 bg-black/40 p-5 mb-6 font-mono text-lg">
                <span className="text-purple-400">String</span> robotName = <span className="text-amber-400">"</span>
                <input
                  type="text"
                  value={robotName}
                  onChange={(e) => setRobotName(e.target.value)}
                  className="bg-transparent border-none outline-none text-emerald-400 w-40 font-bold placeholder-white/20"
                  placeholder="Sparky"
                  autoFocus
                  maxLength={20}
                />
                <span className="text-amber-400">"</span>;
              </div>
              <button
                onClick={() => setStep('age')}
                disabled={!robotName.trim()}
                className="w-full bg-emerald-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-30 disabled:hover:bg-emerald-500 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </motion.div>
          )}

          {step === 'age' && (
            <motion.div
              key="age"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm shadow-2xl"
            >
              <div className="text-4xl mb-4">📅</div>
              <h2 className="text-3xl font-display font-bold mb-2">Set Robot Age</h2>
              <p className="text-gray-500 mb-6 text-sm">Younger robots learn faster!</p>
              <div className="rounded-xl border border-white/5 bg-black/40 p-5 mb-4 font-mono text-lg">
                <span className="text-purple-400">int</span> robotAge =
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={robotAge}
                  onChange={(e) => setRobotAge(parseInt(e.target.value) || 1)}
                  className="bg-white/5 border border-white/10 rounded-lg ml-2 px-3 py-1 w-20 text-emerald-400 text-center font-bold"
                />
                <span className="text-gray-600 ml-2">// 1-10 years</span>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 mb-6 text-sm">
                <span className="text-emerald-400 font-bold">Tip:</span>{' '}
                <span className="text-gray-400">
                  <span className="text-purple-400">int</span> stores whole numbers.{' '}
                  <span className="text-purple-400">String</span> stores text.
                </span>
              </div>
              <button
                onClick={() => setStep('species')}
                className="w-full bg-emerald-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-emerald-400 transition-all"
              >
                Continue →
              </button>
            </motion.div>
          )}

          {step === 'species' && (
            <motion.div
              key="species"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm shadow-2xl"
            >
              <div className="text-4xl mb-4">⚙️</div>
              <h2 className="text-3xl font-display font-bold mb-2">Choose Robot Model</h2>
              <div className="rounded-xl border border-white/5 bg-black/40 p-4 mb-6 font-mono text-xs text-gray-400">
                <span className="text-purple-400">if</span> (choice == <span className="text-amber-400">&quot;robo_pup&quot;</span>) robot = <span className="text-purple-400">new</span> <span className="text-emerald-400">RoboPup</span>();
                <br />
                <span className="text-purple-400">else</span> robot = <span className="text-purple-400">new</span> <span className="text-emerald-400">PixelDragon</span>();
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {(['robo_pup', 'circuit_cat', 'pixel_dragon'] as const).map((species) => (
                  <button
                    key={species}
                    onClick={() => setSelectedSpecies(species)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedSpecies === species
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                        : 'border-white/10 bg-black/40 hover:border-white/20'
                    }`}
                  >
                    <div className="text-4xl mb-2">{speciesInfo[species].emoji}</div>
                    <div className="font-display text-sm font-bold">{speciesInfo[species].name}</div>
                    <div className="text-xs text-gray-500 mt-1">{speciesInfo[species].desc}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep('starter')}
                className="w-full bg-emerald-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-emerald-400 transition-all"
              >
                Continue →
              </button>
            </motion.div>
          )}

          {step === 'starter' && (
            <motion.div
              key="starter"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm shadow-2xl"
            >
              <div className="text-4xl mb-4">🎒</div>
              <h2 className="text-3xl font-display font-bold mb-2">Collect Starter Kit</h2>
              <div className="rounded-xl border border-white/5 bg-black/40 p-4 mb-6 font-mono text-sm">
                <span className="text-purple-400">String</span>[] starterItems = {`{"WoodSword", "HealPotion", "BasicShield"}`};
                <br />
                <span className="text-gray-600">// [0] = Sword, [1] = Potion, [2] = Shield</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { icon: '⚔️', name: 'WoodSword', idx: 0 },
                  { icon: '💊', name: 'HealPotion', idx: 1 },
                  { icon: '🛡️', name: 'BasicShield', idx: 2 },
                ].map((item) => (
                  <div key={item.name} className="rounded-xl border border-white/10 bg-black/40 p-4 text-center hover:border-emerald-500/50 transition-colors">
                    <div className="text-3xl mb-2">{item.icon}</div>
                    <div className="text-sm font-bold">{item.name}</div>
                    <div className="text-xs text-emerald-400 font-mono mt-1">[{item.idx}]</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-6 text-sm">
                <span className="text-amber-400 font-bold">Arrays:</span>{' '}
                <span className="text-gray-400">Store lists of things. Each item has an index starting at 0.</span>
              </div>
              <button
                onClick={() => setStep('summary')}
                className="w-full bg-emerald-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-emerald-400 transition-all"
              >
                Continue →
              </button>
            </motion.div>
          )}

          {step === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-3xl font-display font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Ready to Go!
                </h2>
              </div>

              <div className="rounded-xl border border-white/5 bg-black/40 p-5 mb-6">
                <h3 className="font-display font-bold text-amber-400 mb-3 flex items-center gap-2">
                  📚 What you learned
                </h3>
                <div className="space-y-2">
                  {[
                    { icon: '📝', text: 'Variables (String, int)' },
                    { icon: '🔀', text: 'If/Else (conditional logic)' },
                    { icon: '📦', text: 'Arrays (indexed lists)' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-emerald-400">✓</span>
                      <span className="text-sm">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-black/40 p-5 mb-6">
                <h3 className="font-display font-bold text-amber-400 mb-3 flex items-center gap-2">
                  🤖 Your Robot
                </h3>
                <div className="flex items-center gap-4 bg-white/5 rounded-lg p-4">
                  <div className="text-5xl">{speciesInfo[selectedSpecies].emoji}</div>
                  <div>
                    <div className="font-display text-lg font-bold">{robotName || 'Sparky'}</div>
                    <div className="text-gray-500 text-sm">
                      {speciesInfo[selectedSpecies].name} • Age {robotAge}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center mb-6">
                <span className="text-2xl">🪙</span>
                <span className="text-amber-400 font-display font-bold text-xl ml-2">+50 coins</span>
              </div>

              <button
                onClick={handleComplete}
                className="w-full bg-emerald-500 text-black font-bold text-lg px-8 py-4 rounded-xl hover:bg-emerald-400 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95"
              >
                Enter Robocode →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
