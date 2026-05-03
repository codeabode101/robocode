'use client'

import { Card } from '@/components/ui/Card'

const LEADERBOARD = [
  { rank: 1, name: 'CodeWizard99', robot: 'Robo Pup', score: 2450, wins: 42, level: 15 },
  { rank: 2, name: 'JavaJungle', robot: 'Pixel Dragon', score: 2200, wins: 38, level: 14 },
  { rank: 3, name: 'LoopMaster', robot: 'Circuit Cat', score: 2150, wins: 35, level: 13 },
  { rank: 4, name: 'ArrayAce', robot: 'Robo Pup', score: 1980, wins: 30, level: 12 },
  { rank: 5, name: 'RecursionKing', robot: 'Pixel Dragon', score: 1850, wins: 28, level: 11 },
  { rank: 6, name: 'OOPQueen', robot: 'Circuit Cat', score: 1720, wins: 25, level: 10 },
  { rank: 7, name: 'SyntaxSlayer', robot: 'Robo Pup', score: 1650, wins: 23, level: 10 },
  { rank: 8, name: 'BugHunter', robot: 'Pixel Dragon', score: 1500, wins: 20, level: 9 },
  { rank: 9, name: 'AlgoAdept', robot: 'Circuit Cat', score: 1380, wins: 18, level: 8 },
  { rank: 10, name: 'StackSmash', robot: 'Robo Pup', score: 1250, wins: 15, level: 7 },
]

export default function Leaderboard() {
  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-display font-black text-[#f5a623] mb-2">Leaderboard</h1>
        <p className="text-[#8892a4] mb-8">Top robot trainers this week</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button className="px-6 py-2 rounded-[8px] font-display text-sm bg-[#00d4aa] text-[#0f0f1a]">
            Weekly
          </button>
          <button className="px-6 py-2 rounded-[8px] font-display text-sm bg-[#1a1a2e] text-[#e8eaf0] hover:bg-[#16213e]">
            All-Time
          </button>
          <button className="px-6 py-2 rounded-[8px] font-display text-sm bg-[#1a1a2e] text-[#e8eaf0] hover:bg-[#16213e]">
            Friends
          </button>
        </div>

        {/* Leaderboard Table */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 bg-[#0f0f1a] font-display text-sm text-[#8892a4]">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-2 text-center">Score</div>
            <div className="col-span-2 text-center">Wins</div>
            <div className="col-span-2 text-center">Level</div>
          </div>

          <div className="divide-y divide-white/5">
            {LEADERBOARD.map((entry) => (
              <div
                key={entry.rank}
                className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#16213e]/50 transition-colors ${
                  entry.rank <= 3 ? 'bg-[#1a1a2e]/50' : ''
                }`}
              >
                <div className="col-span-1">
                  {entry.rank === 1 && <span className="text-2xl">🥇</span>}
                  {entry.rank === 2 && <span className="text-2xl">🥈</span>}
                  {entry.rank === 3 && <span className="text-2xl">🥉</span>}
                  {entry.rank > 3 && <span className="text-[#8892a4] font-bold">{entry.rank}</span>}
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <span className="text-2xl">
                    {entry.robot === 'Robo Pup' ? '🤖' : entry.robot === 'Circuit Cat' ? '🐱' : '🐉'}
                  </span>
                  <div>
                    <div className="font-bold">{entry.name}</div>
                    <div className="text-xs text-[#8892a4]">{entry.robot}</div>
                  </div>
                </div>
                <div className="col-span-2 text-center font-bold text-[#f5a623]">{entry.score}</div>
                <div className="col-span-2 text-center text-[#00d4aa]">{entry.wins}</div>
                <div className="col-span-2 text-center">Lv. {entry.level}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Your Rank */}
        <Card className="mt-6 border-[#00d4aa]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <div className="font-bold">You</div>
                <div className="text-xs text-[#8892a4]">Robo Pup</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[#f5a623] font-bold">Rank #42</div>
              <div className="text-xs text-[#8892a4]">Score: 680</div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
