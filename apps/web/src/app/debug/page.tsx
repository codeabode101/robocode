'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/Card'

const BUG_FLOORS = [
  {
    floor: 1,
    title: 'Off-by-One Errors',
    bugs: [
      {
        code: `for (int i = 0; i <= 5; i++) {
  System.out.println(i);
}`,
        buggyLine: 1,
        fix: `for (int i = 0; i < 5; i++) {
  System.out.println(i);
}`,
        explanation: 'The condition i <= 5 prints 0-5 (6 numbers). Should be i < 5 to print 0-4.'
      }
    ]
  },
  {
    floor: 2,
    title: 'Missing Semicolons',
    bugs: [
      {
        code: `int x = 10
x = x + 5
System.out.println(x)`,
        buggyLine: 1,
        fix: `int x = 10;
x = x + 5;
System.out.println(x);`,
        explanation: 'Each statement needs a semicolon at the end.'
      }
    ]
  }
]

export default function DebugDungeon() {
  const [currentFloor, setCurrentFloor] = useState(0)
  const [currentBug, setCurrentBug] = useState(0)
  const [userFix, setUserFix] = useState('')
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [completedFloors, setCompletedFloors] = useState<number[]>([])

  const floor = BUG_FLOORS[currentFloor]
  const bug = floor.bugs[currentBug]

  const handleSubmit = () => {
    const correct = userFix.trim() === bug.fix.trim()
    setIsCorrect(correct)
    
    if (correct && !completedFloors.includes(currentFloor)) {
      setCompletedFloors(prev => [...prev, currentFloor])
    }
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-display font-black text-[#e94560] mb-2">Debug Dungeon</h1>
        <p className="text-[#8892a4] mb-8">Find and fix bugs to proceed</p>

        {/* Floor Selector */}
        <div className="flex gap-3 mb-8">
          {BUG_FLOORS.map((f, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentFloor(idx)
                setCurrentBug(0)
                setUserFix('')
                setIsCorrect(null)
              }}
              className={`px-4 py-2 rounded-[8px] font-display text-sm transition-colors ${
                currentFloor === idx
                  ? 'bg-[#e94560] text-white'
                  : completedFloors.includes(idx)
                  ? 'bg-[#00d4aa]/20 text-[#00d4aa]'
                  : 'bg-[#1a1a2e] text-[#e8eaf0] hover:bg-[#16213e]'
              }`}
            >
              Floor {f.floor}
              {completedFloors.includes(idx) && ' ✓'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buggy Code */}
          <Card>
            <h3 className="font-display text-lg mb-4 text-[#e94560]">
              Buggy Code - {floor.title}
            </h3>
            <div className="bg-[#0f0f1a] p-4 rounded-[8px] font-mono text-sm">
              {bug.code.split('\n').map((line, idx) => (
                <div key={idx} className={`${idx + 1 === bug.buggyLine ? 'text-[#e94560] bg-[#e94560]/10' : 'text-[#00d4aa]'}`}>
                  <span className="text-[#8892a4] mr-2">{idx + 1}</span>
                  {line}
                </div>
              ))}
            </div>
          </Card>

          {/* Fix Area */}
          <Card>
            <h3 className="font-display text-lg mb-4 text-[#00d4aa]">Your Fix</h3>
            <textarea
              value={userFix}
              onChange={(e) => setUserFix(e.target.value)}
              className="w-full h-40 bg-[#0f0f1a] text-[#00d4aa] font-mono text-sm p-4 rounded-[8px] border border-white/10 focus:border-[#00d4aa] outline-none"
              placeholder="Type the corrected code here..."
            />
            <button
              onClick={handleSubmit}
              className="btn-primary w-full mt-4 py-2"
            >
              Submit Fix
            </button>

            {isCorrect !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-3 rounded-[8px] text-sm ${
                  isCorrect ? 'bg-[#00d4aa]/10 text-[#00d4aa]' : 'bg-[#e94560]/10 text-[#e94560]'
                }`}
              >
                {isCorrect ? (
                  <div>
                    <span className="font-bold">Correct! ✓</span>
                    <p className="mt-2 text-[#8892a4]">{bug.explanation}</p>
                  </div>
                ) : (
                  <div>
                    <span className="font-bold">Not quite right ✗</span>
                    <p className="mt-2">Try again!</p>
                  </div>
                )}
              </motion.div>
            )}
          </Card>
        </div>

        {/* Correct Fix (shown after correct answer) */}
        {isCorrect && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Card className="border-[#f5a623]">
              <h3 className="font-display text-lg text-[#f5a623] mb-3">Correct Fix:</h3>
              <div className="bg-[#0f0f1a] p-4 rounded-[8px] font-mono text-sm text-[#00d4aa] whitespace-pre-wrap">
                {bug.fix}
              </div>
              <div className="mt-4 flex gap-4">
                <span className="text-[#f5a623] font-bold">+50 coins</span>
                <span className="text-[#00d4aa] font-bold">+30 XP</span>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </main>
  )
}
