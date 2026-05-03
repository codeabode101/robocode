'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { usePlayerStore } from '@/stores/playerStore'

const HOUSE_THEMES = [
  { id: 'starter_base', name: 'Starter Cave', unlocked: true, cost: 0 },
  { id: 'neon_city', name: 'Neon City', unlocked: false, cost: 800 },
  { id: 'forest_temple', name: 'Forest Temple', unlocked: false, cost: 600 },
  { id: 'space_station', name: 'Space Station', unlocked: false, cost: 1200 },
]

const FURNITURE = [
  { id: 'bed_basic', name: 'Basic Cot', emoji: '🛏️', placed: false },
  { id: 'desk_coding', name: 'Coding Desk', emoji: '💻', placed: false },
  { id: 'shelf_books', name: 'Book Shelf', emoji: '📚', placed: false },
  { id: 'plant_robot', name: 'Robot Plant', emoji: '🤖', placed: false },
]

export default function HouseView() {
  const { robotName, robotModel, level, coins } = usePlayerStore()
  const [selectedTheme, setSelectedTheme] = useState('starter_base')
  const [placedFurniture, setPlacedFurniture] = useState<string[]>([])

  const robotEmoji = robotModel === 'robo_pup' ? '🤖' : robotModel === 'circuit_cat' ? '🐱' : '🐉'

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-display font-black text-[#00d4aa] mb-2">My House</h1>
        <p className="text-[#8892a4] mb-8">Customize your robot's home</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* House Preview */}
          <div className="lg:col-span-2">
            <Card className="min-h-[400px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a]">
                {/* Floor */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-[#2d2d44]" />
                
                {/* Furniture */}
                {placedFurniture.map((id, idx) => {
                  const item = FURNITURE.find(f => f.id === id)
                  return item ? (
                    <div key={idx} className="absolute bottom-32 left-1/2 transform -translate-x-1/2 text-4xl">
                      {item.emoji}
                    </div>
                  ) : null
                })}
                
                {/* Robot */}
                <div className="absolute bottom-36 left-1/2 transform -translate-x-1/2 text-center">
                  <div className="text-8xl">{robotEmoji}</div>
                  <div className="text-sm text-[#8892a4] mt-2">{robotName}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Customization Panel */}
          <div className="space-y-6">
            {/* Themes */}
            <Card>
              <h3 className="font-display text-lg mb-4">Themes</h3>
              <div className="space-y-2">
                {HOUSE_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => theme.unlocked && setSelectedTheme(theme.id)}
                    disabled={!theme.unlocked}
                    className={`w-full p-3 rounded-[8px] text-left transition-colors ${
                      selectedTheme === theme.id
                        ? 'bg-[#00d4aa]/20 border-[#00d4aa] border'
                        : theme.unlocked
                        ? 'bg-[#16213e] hover:bg-[#1a1a2e]'
                        : 'bg-[#16213e]/50 opacity-50'
                    }`}
                  >
                    <div className="font-bold text-sm">{theme.name}</div>
                    {!theme.unlocked && (
                      <div className="text-xs text-[#f5a623]">🔒 {theme.cost} coins</div>
                    )}
                  </button>
                ))}
              </div>
            </Card>

            {/* Furniture */}
            <Card>
              <h3 className="font-display text-lg mb-4">Furniture</h3>
              <div className="grid grid-cols-2 gap-2">
                {FURNITURE.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (placedFurniture.includes(item.id)) {
                        setPlacedFurniture(prev => prev.filter(id => id !== item.id))
                      } else {
                        setPlacedFurniture(prev => [...prev, item.id])
                      }
                    }}
                    className={`p-3 rounded-[8px] text-center transition-colors ${
                      placedFurniture.includes(item.id)
                        ? 'bg-[#00d4aa]/20 border-[#00d4aa] border'
                        : 'bg-[#16213e] hover:bg-[#1a1a2e]'
                    }`}
                  >
                    <div className="text-2xl mb-1">{item.emoji}</div>
                    <div className="text-xs">{item.name}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Robot Accessories */}
            <Card>
              <h3 className="font-display text-lg mb-4">Robot Accessories</h3>
              <div className="space-y-2">
                {[
                  { name: 'Basic Visor', equipped: true, emoji: '👓' },
                  { name: 'Jet Wings', equipped: false, emoji: '🪽' },
                  { name: 'Neon Crown', equipped: false, emoji: '👑' },
                ].map((acc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-[#16213e] rounded-[8px]">
                    <div className="flex items-center gap-2">
                      <span>{acc.emoji}</span>
                      <span className="text-sm">{acc.name}</span>
                    </div>
                    {acc.equipped && <span className="text-[#00d4aa] text-xs">✓ Equipped</span>}
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
