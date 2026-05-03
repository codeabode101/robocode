'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'

export default function BattleAnalyzer() {
  const [selectedTick, setSelectedTick] = useState(0)

  // Mock battle data
  const battleData = {
    script: `if (myHP < 30) {
  heal();
} else if (lastEnemyMove == "ATTACK") {
  defend();
} else {
  attack();
}`,
    ticks: [
      { tick: 1, action: 'attack', enemyAction: 'defend', branch: 'else' },
      { tick: 2, action: 'attack', enemyAction: 'attack', branch: 'else' },
      { tick: 3, action: 'defend', enemyAction: 'attack', branch: 'else if' },
      { tick: 4, action: 'attack', enemyAction: 'charge', branch: 'else' },
      { tick: 5, action: 'heal', enemyAction: 'special', branch: 'if (false)' },
    ],
    stats: {
      attacks: 3,
      defends: 1,
      heals: 1,
      charges: 0,
      specials: 0,
    },
    suggestions: [
      'You used defend() when enemy used attack(), but your shield was at 0. Consider saving defend for when enemy has low shield.',
      'You never used special() despite having enough mana. Adding special() when myMana >= 40 could deal more damage.',
      'Consider: if (enemyShield < 5) { attack(); } to maximize damage when enemy shield is low.',
    ]
  }

  const tick = battleData.ticks[selectedTick]

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-display font-black text-[#00d4aa] mb-2">Battle Analyzer</h1>
        <p className="text-[#8892a4] mb-8">Deep analysis of your battle script</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Script with annotations */}
          <Card>
            <h3 className="font-display text-lg mb-4">Your Script</h3>
            <div className="bg-[#0f0f1a] p-4 rounded-[8px] font-mono text-sm">
              {battleData.script.split('\n').map((line, idx) => {
                const tickCount = battleData.ticks.filter(t => 
                  (line.includes('if') && t.branch.includes('if')) ||
                  (line.includes('defend') && t.action === 'defend') ||
                  (line.includes('attack') && t.action === 'attack') ||
                  (line.includes('heal') && t.action === 'heal')
                ).length

                const isHighlighted = selectedTick >= 0 && (
                  (line.includes('heal') && tick.action === 'heal') ||
                  (line.includes('defend') && tick.action === 'defend') ||
                  (line.includes('attack') && tick.action === 'attack')
                )

                return (
                  <div key={idx} className={`${isHighlighted ? 'bg-[#00d4aa]/20 -mx-4 px-4' : ''} py-1`}>
                    <span className="text-[#8892a4] mr-2">{idx + 1}</span>
                    <span className={isHighlighted ? 'text-[#00d4aa]' : 'text-[#e8eaf0]'}>
                      {line || ' '}
                    </span>
                    {tickCount > 0 && (
                      <span className="text-[#f5a623] text-xs ml-2">({tickCount}x)</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Stats & Suggestions */}
          <div className="space-y-6">
            <Card>
              <h3 className="font-display text-lg mb-4">Action Distribution</h3>
              <div className="space-y-3">
                {Object.entries(battleData.stats).map(([action, count]) => (
                  <div key={action} className="flex justify-between items-center">
                    <span className="capitalize">{action}:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-[#0f0f1a] rounded-full h-3">
                        <div 
                          className="bg-[#00d4aa] h-3 rounded-full"
                          style={{ width: `${(count / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="font-display text-lg mb-4 text-[#f5a623]">Suggestions</h3>
              <div className="space-y-3">
                {battleData.suggestions.map((suggestion, idx) => (
                  <div key={idx} className="p-3 bg-[#16213e] rounded-[8px] text-sm">
                    <span className="text-[#f5a623] mr-2">💡</span>
                    {suggestion}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Tick Selector */}
        <Card className="mt-6">
          <h3 className="font-display text-lg mb-4">Tick-by-Tick Breakdown</h3>
          <div className="grid grid-cols-5 gap-2">
            {battleData.ticks.map((t, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedTick(idx)}
                className={`p-3 rounded-[8px] text-center transition-colors ${
                  selectedTick === idx
                    ? 'bg-[#00d4aa] text-[#0f0f1a]'
                    : 'bg-[#16213e] hover:bg-[#1a1a2e]'
                }`}
              >
                <div className="font-bold text-sm">Tick {t.tick}</div>
                <div className="text-xs mt-1">{t.action}</div>
                <div className="text-xs text-[#8892a4]">vs {t.enemyAction}</div>
              </button>
            ))}
          </div>

          {tick && (
            <div className="mt-4 p-3 bg-[#0f0f1a] rounded-[8px]">
              <div className="text-sm">
                <span className="text-[#8892a4]">Branch executed:</span>
                <span className="text-[#00d4aa] ml-2">{tick.branch}</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}
