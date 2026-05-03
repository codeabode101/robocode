'use client'

import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'

export default function Dashboard() {
  const { robotName, robotModel, level, xp, coins, gems, battleWins, battleLosses, storyChapter } = usePlayerStore()
  const { user } = useAuthStore()
  const router = useRouter()

  const xpForNextLevel = level * 500
  const xpProgress = (xp % 500) / 500 * 100

  const conceptMastery = [
    { name: 'Variables', stars: 4 },
    { name: 'Loops', stars: 2 },
    { name: 'Arrays', stars: 1 },
    { name: 'Conditionals', stars: 3 },
    { name: 'Methods', stars: 0 },
    { name: 'OOP', stars: 0 },
    { name: 'Recursion', stars: 0 },
  ]

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Navigation */}
        <nav className="flex gap-4 mb-8 font-display text-sm">
          <button onClick={() => router.push('/dashboard')} className="text-[#00d4aa]">🏠 House</button>
          <button onClick={() => router.push('/story')} className="hover:text-[#00d4aa]">🗺️ Story</button>
          <button onClick={() => router.push('/battle')} className="hover:text-[#00d4aa]">⚔️ Battle</button>
          <button onClick={() => router.push('/shop')} className="hover:text-[#00d4aa]">🛒 Shop</button>
          <button onClick={() => router.push('/leaderboard')} className="hover:text-[#00d4aa]">🏆 Leaderboard</button>
          <button onClick={() => router.push('/daily')} className="hover:text-[#00d4aa]">🎯 Daily</button>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Robot & Stats */}
          <div className="lg:col-span-1">
            <Card className="text-center mb-6">
              <div className="text-8xl mb-4">
                {robotModel === 'robo_pup' ? '🤖' : robotModel === 'circuit_cat' ? '🐱' : '🐉'}
              </div>
              <h2 className="text-2xl font-display font-bold mb-1">{robotName}</h2>
              <p className="text-[#8892a4] mb-4">
                {robotModel === 'robo_pup' ? 'Robo Pup' : robotModel === 'circuit_cat' ? 'Circuit Cat' : 'Pixel Dragon'}
              </p>
              <div className="text-[#f5a623] font-display font-bold mb-2">Lv. {level}</div>
              
              {/* XP Bar */}
              <div className="w-full bg-[#0f0f1a] rounded-full h-4 mb-2">
                <div 
                  className="bg-[#00d4aa] h-4 rounded-full transition-all duration-500"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <p className="text-xs text-[#8892a4]">XP: {xp % 500}/500</p>
            </Card>

            {/* Currency */}
            <Card className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#f5a623] font-display">💰 Coins:</span>
                <span className="font-bold">{coins.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-400 font-display">💎 Gems:</span>
                <span className="font-bold">{gems}</span>
              </div>
            </Card>

            {/* Concept Mastery */}
            <Card>
              <h3 className="font-display text-lg mb-4">Concept Mastery</h3>
              <div className="space-y-3">
                {conceptMastery.map((concept) => (
                  <div key={concept.name} className="flex justify-between items-center">
                    <span className="text-sm">{concept.name}</span>
                    <div className="text-[#f5a623]">
                      {'★'.repeat(concept.stars)}{'☆'.repeat(5 - concept.stars)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Middle & Right - Main Content */}
          <div className="lg:col-span-2">
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card 
                className="cursor-pointer hover:border-[#00d4aa] transition-colors"
                onClick={() => router.push('/story')}
              >
                <h3 className="font-display text-xl text-[#00d4aa] mb-2">📖 Continue Story</h3>
                <p className="text-[#8892a4] text-sm">Chapter {storyChapter}: The Variable Vault</p>
              </Card>

              <Card 
                className="cursor-pointer hover:border-[#e94560] transition-colors"
                onClick={() => router.push('/battle')}
              >
                <h3 className="font-display text-xl text-[#e94560] mb-2">⚔️ Quick Battle</h3>
                <p className="text-[#8892a4] text-sm">Find opponent</p>
              </Card>

              <Card 
                className="cursor-pointer hover:border-[#f5a623] transition-colors"
                onClick={() => router.push('/daily')}
              >
                <h3 className="font-display text-xl text-[#f5a623] mb-2">🎯 Daily Challenge</h3>
                <p className="text-[#8892a4] text-sm">"Trace this loop" • 3h left</p>
              </Card>

              <Card 
                className="cursor-pointer hover:border-purple-400 transition-colors"
                onClick={() => router.push('/sandbox')}
              >
                <h3 className="font-display text-xl text-purple-400 mb-2">🔄 Sandbox</h3>
                <p className="text-[#8892a4] text-sm">Practice any concept</p>
              </Card>
            </div>

            {/* Recent Battles */}
            <Card className="mb-6">
              <h3 className="font-display text-lg mb-4">Recent Battles</h3>
              <div className="space-y-3">
                {[
                  { opponent: 'CodeWizard99', result: 'WIN', coins: 80 },
                  { opponent: 'JavaJungle', result: 'LOSS', coins: -20 },
                  { opponent: 'LoopMaster', result: 'WIN', coins: 100 },
                ].map((battle, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={battle.result === 'WIN' ? 'text-[#00d4aa]' : 'text-[#e94560]'}>
                        {battle.result}
                      </span>
                      <span className="text-sm">vs. {battle.opponent}</span>
                    </div>
                    <span className={battle.coins > 0 ? 'text-[#f5a623]' : 'text-[#e94560]'}>
                      {battle.coins > 0 ? '+' : ''}{battle.coins} coins
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="text-center">
                <div className="text-3xl font-display font-bold text-[#00d4aa]">{battleWins}</div>
                <div className="text-sm text-[#8892a4]">Wins</div>
              </Card>
              <Card className="text-center">
                <div className="text-3xl font-display font-bold text-[#e94560]">{battleLosses}</div>
                <div className="text-sm text-[#8892a4]">Losses</div>
              </Card>
              <Card className="text-center">
                <div className="text-3xl font-display font-bold text-[#f5a623]">{storyChapter}</div>
                <div className="text-sm text-[#8892a4]">Chapter</div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
