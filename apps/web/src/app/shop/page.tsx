'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { usePlayerStore } from '@/stores/playerStore'

const ITEMS = [
  { id: 'hat_basic', name: 'Basic Visor', type: 'cosmetic', cost: 200, rarity: 'common', desc: 'Simple protective visor' },
  { id: 'hat_neon', name: 'Neon Crown', type: 'cosmetic', cost: 500, rarity: 'rare', desc: 'Glows in the dark' },
  { id: 'armor_light', name: 'Light Plating', type: 'upgrade', cost: 300, rarity: 'common', desc: '+5 shield bonus' },
  { id: 'armor_heavy', name: 'Heavy Armor', type: 'upgrade', cost: 800, rarity: 'epic', desc: '+15 shield bonus' },
  { id: 'weapon_laser', name: 'Laser Beam', type: 'upgrade', cost: 1000, rarity: 'legendary', desc: 'Special: 30 dmg' },
  { id: 'skin_forest', name: 'Forest Theme', type: 'cosmetic', cost: 400, rarity: 'rare', desc: 'Nature-inspired armor' },
  { id: 'pet_accessory_wings', name: 'Jet Wings', type: 'cosmetic', cost: 600, rarity: 'epic', desc: 'Looks fast, is fast' },
  { id: 'consumable_heal', name: 'Heal Potion', type: 'consumable', cost: 100, rarity: 'common', desc: 'Instant +20 HP' },
]

export default function Shop() {
  const [activeTab, setActiveTab] = useState<'cosmetic' | 'upgrade' | 'consumable'>('cosmetic')
  const [showOnlyAffordable, setShowOnlyAffordable] = useState(false)
  const { coins, gems } = usePlayerStore()

  const filteredItems = ITEMS.filter(item => {
    if (item.type !== activeTab) return false
    if (showOnlyAffordable && item.cost > coins) return false
    return true
  })

  const rarityColors: Record<string, string> = {
    common: 'text-gray-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400'
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-display font-black text-[#f5a623] mb-2">Shop</h1>
        <p className="text-[#8892a4] mb-6">Upgrade your robot</p>

        {/* Currency Display */}
        <div className="flex gap-6 mb-8">
          <Card className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <div>
                <div className="text-2xl font-bold text-[#f5a623]">{coins.toLocaleString()}</div>
                <div className="text-xs text-[#8892a4]">Coins</div>
              </div>
            </div>
          </Card>
          <Card className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💎</span>
              <div>
                <div className="text-2xl font-bold text-purple-400">{gems}</div>
                <div className="text-xs text-[#8892a4]">Gems</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['cosmetic', 'upgrade', 'consumable'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-[8px] font-display text-sm transition-colors ${
                activeTab === tab
                  ? 'bg-[#f5a623] text-[#0f0f1a]'
                  : 'bg-[#1a1a2e] text-[#e8eaf0] hover:bg-[#16213e]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}s
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              id="affordable"
              checked={showOnlyAffordable}
              onChange={(e) => setShowOnlyAffordable(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="affordable" className="text-sm text-[#8892a4]">Affordable only</label>
          </div>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="hover:border-[#f5a623] transition-colors">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-display text-lg">{item.name}</h3>
                <span className={`text-xs font-bold ${rarityColors[item.rarity]}`}>
                  {item.rarity.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-[#8892a4] mb-4">{item.desc}</p>
              <div className="flex justify-between items-center">
                <span className="text-[#f5a623] font-bold">💰 {item.cost}</span>
                <button
                  className="btn-primary py-1 px-4 text-sm disabled:opacity-50"
                  disabled={coins < item.cost}
                >
                  Buy
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
