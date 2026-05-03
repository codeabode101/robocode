'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'

const CHAPTERS = [
  { 
    number: 1, 
    title: 'The Variable Vault',
    concepts: 'primitive types, assignment, expressions',
    quests: 5,
    unlocked: true
  },
  { 
    number: 2, 
    title: 'The Loop Forge',
    concepts: 'for loops, while loops, do-while, loop tracing',
    quests: 5,
    unlocked: true
  },
  { 
    number: 3, 
    title: 'The Decision Dungeon',
    concepts: 'if/else, nested conditions, switch, boolean logic',
    quests: 5,
    unlocked: false
  },
  { 
    number: 4, 
    title: 'The Method Mountains',
    concepts: 'methods, parameters, return types, scope',
    quests: 5,
    unlocked: false
  },
  { 
    number: 5, 
    title: 'The Array Archipelago',
    concepts: '1D arrays, traversal, 2D arrays',
    quests: 5,
    unlocked: false
  },
  { 
    number: 6, 
    title: 'The Object Observatory',
    concepts: 'classes, constructors, instance variables, inheritance',
    quests: 5,
    unlocked: false
  },
  { 
    number: 7, 
    title: 'The Recursive Ruins',
    concepts: 'recursion, base case, call stack tracing',
    quests: 5,
    unlocked: false
  },
]

export default function StoryMode() {
  const router = useRouter()
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-display font-black text-[#00d4aa] mb-2">Story Mode</h1>
        <p className="text-[#8892a4] mb-8">The Great Crash - Fix the world's computer systems</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CHAPTERS.map((chapter) => (
            <Card
              key={chapter.number}
              className={`${!chapter.unlocked ? 'opacity-50' : 'hover:border-[#00d4aa]'} transition-colors`}
              onClick={() => chapter.unlocked && setSelectedChapter(chapter.number)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="text-3xl">
                  {chapter.number === 1 ? '🔐' : 
                   chapter.number === 2 ? '🔥' :
                   chapter.number === 3 ? '🏰' :
                   chapter.number === 4 ? '⛰️' :
                   chapter.number === 5 ? '🏝️' :
                   chapter.number === 6 ? '🔭' : '♻️'}
                </div>
                <div>
                  <h3 className="font-display text-lg">Chapter {chapter.number}</h3>
                  <p className="text-[#00d4aa] text-sm">{chapter.title}</p>
                </div>
              </div>
              
              <p className="text-xs text-[#8892a4] mb-3">{chapter.concepts}</p>
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8892a4]">{chapter.quests} quests</span>
                {!chapter.unlocked && <span className="text-xs text-[#e94560]">🔒 Locked</span>}
                {chapter.unlocked && selectedChapter === chapter.number && (
                  <span className="text-xs text-[#00d4aa]">Selected ✓</span>
                )}
              </div>

              {/* Progress bar - show partial progress if started */}
              <div className="w-full bg-[#0f0f1a] rounded-full h-2 mt-3">
                <div 
                  className="bg-[#00d4aa] h-2 rounded-full"
                  style={{ width: chapter.number === 1 ? '40%' : '0%' }}
                />
              </div>
            </Card>
          ))}
        </div>

        {selectedChapter && (
          <div className="mt-8">
            <Card>
              <h2 className="font-display text-2xl mb-4">
                Chapter {selectedChapter}: {CHAPTERS.find(c => c.number === selectedChapter)?.title}
              </h2>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((questNum) => (
                  <div
                    key={questNum}
                    className="flex items-center justify-between p-3 bg-[#0f0f1a] rounded-[8px] cursor-pointer hover:bg-[#16213e] transition-colors"
                    onClick={() => router.push(`/story/chapter/${selectedChapter}/quest/${questNum}`)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[#f5a623]">Quest {questNum}</span>
                      <span className="text-sm text-[#8892a4]">
                        {questNum === 1 ? 'The ATM' : 
                         questNum === 2 ? 'Bank Interest' :
                         questNum === 3 ? 'Variable Swap' :
                         questNum === 4 ? 'Expression Evaluator' : 'Type Converter'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {questNum <= 2 && <span className="text-[#00d4aa] text-sm">✓ Complete</span>}
                      <span className="text-[#8892a4]">→</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
