'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { usePlayerStore } from '@/stores/playerStore'

const CHALLENGES = [
  {
    id: 1,
    type: 'Code Trace Sprint',
    description: 'Trace 5 snippets in under 3 minutes',
    completed: false,
    reward: 75
  },
  {
    id: 2,
    type: 'Bug Hunt',
    description: 'Find bugs in 3 programs',
    completed: false,
    reward: 75
  },
  {
    id: 3,
    type: 'Output Predict',
    description: 'Predict output of 3 complex programs',
    completed: false,
    reward: 75
  }
]

export default function DailyChallenge() {
  const [challenges, setChallenges] = useState(CHALLENGES)
  const [timeLeft] = useState('3h 24m')
  const { addCoins, addXP, gems, coins } = usePlayerStore()

  const completedCount = challenges.filter(c => c.completed).length
  const allCompleted = completedCount === challenges.length

  const handleComplete = (id: number) => {
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, completed: true } : c))
    const challenge = challenges.find(c => c.id === id)
    if (challenge) {
      addCoins(challenge.reward)
      addXP(50)
    }
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-5xl font-display font-black text-[#f5a623]">Daily Challenge</h1>
          <div className="text-right">
            <div className="text-sm text-[#8892a4]">Time Left</div>
            <div className="text-2xl font-display text-[#e94560]">{timeLeft}</div>
          </div>
        </div>
        <p className="text-[#8892a4] mb-8">Complete all 3 for bonus rewards!</p>

        {/* Progress */}
        <Card className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="font-display">Progress: {completedCount}/3</span>
            <span className="text-[#f5a623] font-bold">+200 coins bonus if all complete</span>
          </div>
          <div className="w-full bg-[#0f0f1a] rounded-full h-4">
            <div 
              className="bg-[#f5a623] h-4 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 3) * 100}%` }}
            />
          </div>
        </Card>

        {/* Streak Info */}
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🔥</span>
            <div>
              <div className="font-display text-xl">7-Day Streak!</div>
              <div className="text-sm text-[#8892a4]">Complete today to earn 500 coins + 3 gems</div>
            </div>
          </div>
        </Card>

        {/* Challenges */}
        <div className="space-y-4">
          {challenges.map((challenge) => (
            <Card key={challenge.id} className={challenge.completed ? 'opacity-60' : ''}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className={`text-3xl ${challenge.completed ? 'grayscale' : ''}`}>
                    {challenge.type === 'Code Trace Sprint' ? '⚡' : 
                     challenge.type === 'Bug Hunt' ? '🐛' : '🎯'}
                  </span>
                  <div>
                    <h3 className="font-display text-lg">{challenge.type}</h3>
                    <p className="text-sm text-[#8892a4]">{challenge.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[#f5a623] font-bold mb-2">💰 {challenge.reward}</div>
                  {challenge.completed ? (
                    <span className="text-[#00d4aa]">✓ Complete</span>
                  ) : (
                    <button
                      onClick={() => handleComplete(challenge.id)}
                      className="btn-primary py-1 px-4 text-sm"
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* All Complete Bonus */}
        {allCompleted && (
          <Card className="mt-6 border-[#f5a623]">
            <div className="text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="font-display text-2xl text-[#f5a623] mb-2">All Challenges Complete!</h3>
              <p className="text-[#8892a4] mb-4">+200 coins + 1 gem bonus awarded!</p>
              <div className="flex justify-center gap-4">
                <span className="text-[#f5a623] font-bold">💰 +200</span>
                <span className="text-purple-400 font-bold">💎 +1</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </main>
  )
}
