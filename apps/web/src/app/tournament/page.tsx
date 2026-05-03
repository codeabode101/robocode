'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'

const TOURNAMENT = {
  name: 'Weekly Robot Championship',
  status: 'registerin', // registering, in_progress, completed
  entryFee: 100,
  prize: 1000,
  players: [
    { name: 'CodeWizard99', robot: 'Robo Pup', seed: 1, eliminated: false },
    { name: 'JavaJungle', robot: 'Pixel Dragon', seed: 2, eliminated: false },
    { name: 'LoopMaster', robot: 'Circuit Cat', seed: 3, eliminated: false },
    { name: 'ArrayAce', robot: 'Robo Pup', seed: 4, eliminated: false },
    { name: 'OOPQueen', robot: 'Circuit Cat', seed: 5, eliminated: false },
    { name: 'RecursionKing', robot: 'Pixel Dragon', seed: 6, eliminated: false },
    { name: 'BugHunter', robot: 'Robo Pup', seed: 7, eliminated: false },
    { name: 'You', robot: 'Robo Pup', seed: 8, eliminated: false },
  ],
  matches: [
    { round: 1, p1: 'CodeWizard99', p2: 'You', p1Score: 1, p2Score: 0, winner: 'CodeWizard99' },
    { round: 1, p1: 'JavaJungle', p2: 'LoopMaster', p1Score: 1, p2Score: 0, winner: 'JavaJungle' },
    { round: 1, p1: 'ArrayAce', p2: 'OOPQueen', p1Score: 0, p2Score: 1, winner: 'OOPQueen' },
    { round: 1, p1: 'RecursionKing', p2: 'BugHunter', p1Score: 1, p2Score: 0, winner: 'RecursionKing' },
    { round: 2, p1: 'CodeWizard99', p2: 'JavaJungle', p1Score: 0, p2Score: 1, winner: 'JavaJungle' },
    { round: 2, p1: 'OOPQueen', p2: 'RecursionKing', p1Score: 0, p2Score: 1, winner: 'RecursionKing' },
    { round: 3, p1: 'JavaJungle', p2: 'RecursionKing', p1Score: 0, p2Score: 0, winner: null },
  ]
}

export default function Tournament() {
  const [isRegistered, setIsRegistered] = useState(false)

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-display font-black text-[#f5a623] mb-2">Tournament</h1>
        <p className="text-[#8892a4] mb-8">Weekly single elimination bracket</p>

        {/* Tournament Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <div className="text-center">
              <div className="text-3xl mb-2">💰</div>
              <div className="text-[#f5a623] font-bold text-2xl">1,000</div>
              <div className="text-xs text-[#8892a4]">Grand Prize (coins)</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-3xl mb-2">💎</div>
              <div className="text-purple-400 font-bold text-2xl">5</div>
              <div className="text-xs text-[#8892a4]">Bonus Gems</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-3xl mb-2">🏆</div>
              <div className="text-[#00d4aa] font-bold text-xl">Exclusive Skin</div>
              <div className="text-xs text-[#8892a4]">Winner Reward</div>
            </div>
          </Card>
        </div>

        {/* Entry Fee & Register */}
        <Card className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-display text-xl mb-1">Entry Fee: 100 coins</h3>
              <p className="text-sm text-[#8892a4]">Returned if you win at least 1 match</p>
            </div>
            {!isRegistered ? (
              <button
                onClick={() => setIsRegistered(true)}
                className="btn-primary py-2 px-6"
              >
                Register Now
              </button>
            ) : (
              <span className="text-[#00d4aa] font-bold">✓ Registered!</span>
            )}
          </div>
        </Card>

        {/* Bracket Visualization */}
        <Card>
          <h3 className="font-display text-lg mb-6">Bracket</h3>
          <div className="space-y-6">
            {[1, 2, 3].map((round) => (
              <div key={round}>
                <h4 className="text-sm text-[#8892a4] mb-3">Round {round}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {TOURNAMENT.matches.filter(m => m.round === round).map((match, idx) => (
                    <div key={idx} className={`p-3 rounded-[8px] ${
                      match.winner ? 'bg-[#1a1a2e]' : 'bg-[#0f0f1a] animate-pulse'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div className={`${match.winner === match.p1 ? 'text-[#00d4aa] font-bold' : ''}`}>
                          {match.p1}
                        </div>
                        <div className="text-[#8892a4] text-sm">vs</div>
                        <div className={`${match.winner === match.p2 ? 'text-[#00d4aa] font-bold' : ''}`}>
                          {match.p2}
                        </div>
                      </div>
                      {match.winner && (
                        <div className="text-center text-xs text-[#f5a623] mt-2">
                          Winner: {match.winner}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Players List */}
        <Card className="mt-6">
          <h3 className="font-display text-lg mb-4">Participants ({TOURNAMENT.players.length}/8)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TOURNAMENT.players.map((player, idx) => (
              <div key={idx} className={`p-3 rounded-[8px] text-center ${
                player.eliminated ? 'bg-[#1a1a2e]/50 opacity-50' : 'bg-[#1a1a2e]'
              }`}>
                <div className="text-2xl mb-1">
                  {player.robot === 'Robo Pup' ? '🤖' : player.robot === 'Circuit Cat' ? '🐱' : '🐉'}
                </div>
                <div className="text-sm font-bold">{player.name}</div>
                <div className="text-xs text-[#8892a4]">Seed #{player.seed}</div>
                {player.eliminated && <div className="text-xs text-[#e94560] mt-1">Eliminated</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  )
}
