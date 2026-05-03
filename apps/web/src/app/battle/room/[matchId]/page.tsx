'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { usePlayerStore } from '@/stores/playerStore'

// Mock replay data
const MOCK_REPLAY = {
  ticks: [
    {
      tick: 1,
      p1Action: 'attack',
      p2Action: 'defend',
      p1HpAfter: 100,
      p2HpAfter: 90,
      p1ShieldAfter: 0,
      p2ShieldAfter: 15,
      narrative: 'Sparky attacks! Shadow defends (+15 shield). Shadow takes 10 damage.'
    },
    {
      tick: 2,
      p1Action: 'attack',
      p2Action: 'attack',
      p1HpAfter: 88,
      p2HpAfter: 90,
      p1ShieldAfter: 0,
      p2ShieldAfter: 0,
      narrative: 'Sparky attacks! Deals 12 damage. Shadow attacks! Sparky takes 12 damage.'
    },
  ],
  winner: 1,
  totalTicks: 2
}

export default function BattleRoom({ params }: { params: { matchId: string }}) {
  const router = useRouter()
  const { robotName, robotModel } = usePlayerStore()
  const [phase, setPhase] = useState<'prep' | 'waiting' | 'replay' | 'results'>('prep')
  const [script, setScript] = useState(`if (myHP < 30) {\n  heal();\n} else if (lastEnemyMove == "ATTACK") {\n  defend();\n} else {\n  attack();\n}`)
  const [isLocked, setIsLocked] = useState(false)
  const [currentTick, setCurrentTick] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const playInterval = useRef<NodeJS.Timer>()

  const handleLockIn = () => {
    setIsLocked(true)
    setPhase('waiting')
    // Mock: simulate after 2 seconds
    setTimeout(() => {
      setPhase('replay')
    }, 2000)
  }

  const togglePlay = () => {
    if (isPlaying) {
      clearInterval(playInterval.current)
      setIsPlaying(false)
    } else {
      setIsPlaying(true)
      playInterval.current = setInterval(() => {
        setCurrentTick(prev => {
          if (prev >= MOCK_REPLAY.ticks.length - 1) {
            clearInterval(playInterval.current)
            setIsPlaying(false)
            setTimeout(() => setPhase('results'), 1500)
            return prev
          }
          return prev + 1
        })
      }, 1500 / speed)
    }
  }

  const tick = MOCK_REPLAY.ticks[currentTick]

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-6xl mx-auto">
        {phase === 'prep' && (
          <div>
            <h1 className="text-3xl font-display font-bold mb-6">Prepare for Battle</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  disabled={isLocked}
                  className="w-full h-64 bg-[#1a1a2e] border border-white/10 rounded-[8px] p-4 font-mono text-[#00d4aa] text-sm"
                />
                <button
                  onClick={handleLockIn}
                  disabled={isLocked}
                  className="btn-primary mt-4 disabled:opacity-50"
                >
                  {isLocked ? 'Locked ✓' : 'Lock In Script'}
                </button>
              </div>
              <Card>
                <h3 className="font-display mb-3">Battle Info</h3>
                <p className="text-sm text-[#8892a4] mb-4">Waiting for opponent...</p>
              </Card>
            </div>
          </div>
        )}

        {phase === 'waiting' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⚔️</div>
            <h2 className="text-3xl font-display mb-2">Both Scripts Locked!</h2>
            <p className="text-[#8892a4]">Simulating battle...</p>
          </div>
        )}

        {phase === 'replay' && tick && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="text-center">
                <div className="text-4xl mb-2">🤖</div>
                <div className="font-display">{robotName}</div>
                <div className="text-sm text-[#8892a4]">Lv. 3</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-display text-[#f5a623]">Tick {tick.tick}/{MOCK_REPLAY.ticks.length}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">🐉</div>
                <div className="font-display">Shadow</div>
                <div className="text-sm text-[#8892a4]">Lv. 3</div>
              </div>
            </div>

            {/* HP Bars */}
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>{robotName}</span>
                  <span>{tick.p1HpAfter} HP</span>
                </div>
                <div className="w-full bg-[#0f0f1a] rounded-full h-4">
                  <div className="bg-[#00d4aa] h-4 rounded-full transition-all" style={{ width: `${tick.p1HpAfter}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Shadow</span>
                  <span>{tick.p2HpAfter} HP</span>
                </div>
                <div className="w-full bg-[#0f0f1a] rounded-full h-4">
                  <div className="bg-[#e94560] h-4 rounded-full transition-all" style={{ width: `${tick.p2HpAfter}%` }} />
                </div>
              </div>
            </div>

            {/* Narrative */}
            <Card className="mb-6">
              <p className="text-sm">{tick.narrative}</p>
            </Card>

            {/* Controls */}
            <div className="flex justify-center gap-4">
              <button onClick={() => setCurrentTick(Math.max(0, currentTick - 1))} className="btn-secondary py-1 px-4">
                ◀ Prev
              </button>
              <button onClick={togglePlay} className="btn-primary py-1 px-4">
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button onClick={() => setCurrentTick(Math.min(MOCK_REPLAY.ticks.length - 1, currentTick + 1))} className="btn-secondary py-1 px-4">
                Next ▶
              </button>
              <button onClick={() => setSpeed(speed === 2 ? 1 : 2)} className="btn-secondary py-1 px-4">
                {speed}x Speed
              </button>
            </div>
          </div>
        )}

        {phase === 'results' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">{MOCK_REPLAY.winner === 1 ? '🎉' : '😢'}</div>
            <h2 className="text-4xl font-display font-bold mb-2">
              {MOCK_REPLAY.winner === 1 ? 'Victory!' : 'Defeat!'}
            </h2>
            <p className="text-[#8892a4] mb-8">
              {MOCK_REPLAY.winner === 1 ? '+80 coins, +50 XP' : '-20 coins'}
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={() => router.push('/battle')} className="btn-primary py-2 px-6">
                Return to Lobby
              </button>
              <button className="btn-secondary py-2 px-6">
                Rematch
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
