'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import CodeEditor from '@/components/game/CodeEditor'

export default function BattleLobby() {
  const router = useRouter()
  const [script, setScript] = useState(`if (myHP < 30) {
  heal();
} else if (lastEnemyMove == "ATTACK") {
  defend();
} else {
  attack();
}`)
  const [isLocked, setIsLocked] = useState(false)

  const handleSubmit = () => {
    setIsLocked(true)
    // TODO: Submit to API and redirect to battle room
    router.push('/battle/room/123')
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-display font-black text-[#e94560] mb-2">Battle Arena</h1>
        <p className="text-[#8892a4] mb-8">Program your robot. Fight enemies.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Code Editor */}
          <div className="lg:col-span-2">
            <CodeEditor
              value={script}
              onChange={setScript}
              onSubmit={handleSubmit}
              disabled={isLocked}
            />
          </div>

          {/* Right - Battle Info */}
          <div className="space-y-6">
            {/* Quick Match */}
            <Card>
              <h3 className="font-display text-xl mb-4 text-[#00d4aa]">Quick Match</h3>
              <button className="btn-primary w-full py-3 mb-3">
                Find Opponent
              </button>
              <p className="text-xs text-[#8892a4] text-center">
                Average wait: ~30 seconds
              </p>
            </Card>

            {/* Active Lobbies */}
            <Card>
              <h3 className="font-display text-xl mb-4">Open Lobbies</h3>
              <div className="space-y-3">
                {[
                  { name: 'CodeWizard99', wager: 50, players: '1/2' },
                  { name: 'JavaJungle', wager: 100, players: '1/2' },
                  { name: 'LoopMaster', wager: 200, players: '1/2' },
                ].map((lobby, idx) => (
                  <div key={idx} className="p-3 bg-[#16213e] rounded-[8px] flex justify-between items-center hover:bg-[#1a1a2e] cursor-pointer">
                    <div>
                      <div className="font-bold text-sm">{lobby.name}</div>
                      <div className="text-xs text-[#8892a4]">{lobby.players} • {lobby.wager} coins</div>
                    </div>
                    <button className="btn-primary text-xs py-1 px-3">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Your Scripts */}
            <Card>
              <h3 className="font-display text-xl mb-4">My Scripts</h3>
              <div className="space-y-2">
                {[
                  { name: 'Aggressive Bot', wins: 12 },
                  { name: 'Defensive Tank', wins: 8 },
                  { name: 'Mana Charger', wins: 5 },
                ].map((script, idx) => (
                  <div key={idx} className="p-3 bg-[#16213e] rounded-[8px] cursor-pointer hover:bg-[#1a1a2e]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{script.name}</span>
                      <span className="text-xs text-[#00d4aa]">{script.wins} wins</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
