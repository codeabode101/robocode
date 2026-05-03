'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'

type OnboardingStep = 'welcome' | 'name' | 'age' | 'species' | 'starter' | 'summary'

export default function Onboarding() {
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [robotName, setRobotName] = useState('')
  const [robotAge, setRobotAge] = useState<number>(1)
  const [selectedSpecies, setSelectedSpecies] = useState<'robo_pup' | 'circuit_cat' | 'pixel_dragon'>('robo_pup')
  const { setRobot, addCoins } = usePlayerStore()

  const handleComplete = () => {
    setRobot(robotName, selectedSpecies)
    addCoins(50)
    // TODO: Save to DB and redirect to dashboard
    window.location.href = '/dashboard'
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="text-6xl mb-6">🤖</div>
              <h1 className="text-5xl font-display font-black text-[#00d4aa] mb-4">
                Welcome to Robocode, Trainer!
              </h1>
              <p className="text-xl text-[#8892a4] mb-8 font-body">
                Program your robot. Master coding. Battle friends.
              </p>
              <button
                onClick={() => setStep('name')}
                className="btn-primary text-lg px-8 py-3"
              >
                Start Your Journey
              </button>
            </motion.div>
          )}

          {step === 'name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="card"
            >
              <h2 className="text-3xl font-display mb-6">Name Your Robot</h2>
              <div className="bg-[#0f0f1a] p-4 rounded-[8px] mb-4 font-mono text-[#00d4aa]">
                <span className="text-[#8892a4]">String</span> robotName = <span className="text-[#f5a623]">"</span>
                <input
                  type="text"
                  value={robotName}
                  onChange={(e) => setRobotName(e.target.value)}
                  className="bg-transparent border-none outline-none text-[#f5a623] w-40"
                  placeholder="Sparky"
                  autoFocus
                />
                <span className="text-[#f5a623]">"</span>;
              </div>
              <button
                onClick={() => setStep('age')}
                disabled={!robotName}
                className="btn-primary disabled:opacity-50"
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
              className="card"
            >
              <h2 className="text-3xl font-display mb-6">Set Robot Age</h2>
              <div className="bg-[#0f0f1a] p-4 rounded-[8px] mb-4 font-mono text-[#00d4aa]">
                <span className="text-[#8892a4]">int</span> robotAge = 
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={robotAge}
                  onChange={(e) => setRobotAge(parseInt(e.target.value) || 1)}
                  className="bg-[#16213e] border border-white/10 rounded ml-2 px-3 py-1 w-20 text-[#f5a623]"
                />
                <span className="text-[#8892a4]">  // Robot age (1-10)</span>
              </div>
              <p className="text-[#8892a4] mb-4 text-sm">
                <span className="text-[#00d4aa]">int</span> stores whole numbers. 
                <span className="text-[#f5a623]"> String</span> stores words.
              </p>
              <button onClick={() => setStep('species')} className="btn-primary">
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
              className="card"
            >
              <h2 className="text-3xl font-display mb-6">Choose Robot Model</h2>
              <div className="bg-[#0f0f1a] p-4 rounded-[8px] mb-6 font-mono text-[#00d4aa] text-sm">
                {`if (choice == "robo_pup") {\n  robot = new RoboPup(robotName);\n} else if (choice == "circuit_cat") {\n  robot = new CircuitCat(robotName);\n} else {\n  robot = new PixelDragon(robotName);\n}`}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {(['robo_pup', 'circuit_cat', 'pixel_dragon'] as const).map((species) => (
                  <button
                    key={species}
                    onClick={() => setSelectedSpecies(species)}
                    className={`card p-4 ${selectedSpecies === species ? 'border-[#00d4aa]' : ''}`}
                  >
                    <div className="text-4xl mb-2">
                      {species === 'robo_pup' ? '🤖' : species === 'circuit_cat' ? '🐱' : '🐉'}
                    </div>
                    <div className="font-display">
                      {species === 'robo_pup' ? 'Robo Pup' : species === 'circuit_cat' ? 'Circuit Cat' : 'Pixel Dragon'}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('starter')} className="btn-primary">
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
              className="card"
            >
              <h2 className="text-3xl font-display mb-6">Collect Starter Kit</h2>
              <div className="bg-[#0f0f1a] p-4 rounded-[8px] mb-4 font-mono text-[#00d4aa] text-sm">
                {`String[] starterItems = {"WoodSword", "HealPotion", "BasicShield"};\n// Your inventory has 3 slots: [0], [1], [2]`}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {['WoodSword', 'HealPotion', 'BasicShield'].map((item, idx) => (
                  <div key={item} className="card p-3 text-center cursor-pointer hover:border-[#00d4aa]">
                    <div className="text-2xl mb-1">{idx === 0 ? '⚔️' : idx === 1 ? '💊' : '🛡️'}</div>
                    <div className="text-sm">{item}</div>
                    <div className="text-xs text-[#8892a4] mt-1">[{idx}]</div>
                  </div>
                ))}
              </div>
              <p className="text-[#8892a4] mb-4 text-sm">
                Arrays store lists of things. Each item has an index number starting at 0.
              </p>
              <button onClick={() => setStep('summary')} className="btn-primary">
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
              className="card"
            >
              <h2 className="text-3xl font-display mb-6 text-[#00d4aa]">Ready to Go!</h2>
              
              <div className="mb-6">
                <h3 className="text-xl font-display mb-3 text-[#f5a623]">What you learned:</h3>
                <div className="space-y-2">
                  {['Variables (String, int)', 'If/Else (conditional logic)', 'Arrays (indexed lists)'].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[#00d4aa]">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-display mb-3 text-[#f5a623]">Your Robot:</h3>
                <div className="card bg-[#0f0f1a] p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">
                      {selectedSpecies === 'robo_pup' ? '🤖' : selectedSpecies === 'circuit_cat' ? '🐱' : '🐉'}
                    </span>
                    <div>
                      <div className="font-display text-lg">{robotName}</div>
                      <div className="text-[#8892a4] text-sm">
                        {selectedSpecies === 'robo_pup' ? 'Robo Pup' : selectedSpecies === 'circuit_cat' ? 'Circuit Cat' : 'Pixel Dragon'} • Age {robotAge}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6 text-[#f5a623]">
                +50 coins awarded!
              </div>

              <button onClick={handleComplete} className="btn-primary text-lg px-8 py-3">
                Enter Robocode →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
