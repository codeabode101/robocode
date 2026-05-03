'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateQuestion, generateLoopQuestion, generateConditionalQuestion, generateArrayQuestion } from '@/lib/questionGen'
import { Card } from '@/components/ui/Card'
import { usePlayerStore } from '@/stores/playerStore'

const CONCEPTS = ['variables', 'loops', 'conditionals', 'methods', 'arrays', 'oop', 'recursion']
const DIFFICULTIES = ['easy', 'medium', 'hard', 'ap_exam'] as const

export default function Sandbox() {
  const [selectedConcept, setSelectedConcept] = useState('variables')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'ap_exam'>('easy')
  const [question, setQuestion] = useState(() => generateQuestion('variables', 'easy'))
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [streak, setStreak] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const { addCoins, addXP } = usePlayerStore()

  const handleAnswer = (answer: string) => {
    if (selectedAnswer) return
    
    setSelectedAnswer(answer)
    const correct = answer === question.correctAnswer
    setIsCorrect(correct)

    if (correct) {
      const newStreak = streak + 1
      setStreak(newStreak)
      const multiplier = newStreak >= 20 ? 3 : newStreak >= 10 ? 2 : newStreak >= 5 ? 1.5 : 1
      const coins = Math.floor(10 * multiplier)
      const xp = Math.floor(15 * multiplier)
      addCoins(coins)
      addXP(xp)
      setTotalEarned(prev => prev + coins)
    } else {
      setStreak(0)
    }
  }

  const nextQuestion = () => {
    setQuestion(generateQuestion(selectedConcept, difficulty))
    setSelectedAnswer(null)
    setIsCorrect(null)
  }

  const getStreakColor = () => {
    if (streak >= 20) return 'text-red-500'
    if (streak >= 10) return 'text-purple-500'
    if (streak >= 5) return 'text-[#f5a623]'
    return 'text-[#8892a4]'
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-display font-black text-[#00d4aa] mb-8">Sandbox Mode</h1>

        {/* Controls */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm text-[#8892a4] mb-2">Concept</label>
            <div className="flex flex-wrap gap-2">
              {CONCEPTS.map((concept) => (
                <button
                  key={concept}
                  onClick={() => {
                    setSelectedConcept(concept)
                    setQuestion(generateQuestion(concept, difficulty))
                    setSelectedAnswer(null)
                    setIsCorrect(null)
                  }}
                  className={`px-4 py-2 rounded-[8px] text-sm font-display transition-colors ${
                    selectedConcept === concept
                      ? 'bg-[#00d4aa] text-[#0f0f1a]'
                      : 'bg-[#1a1a2e] text-[#e8eaf0] hover:bg-[#16213e]'
                  }`}
                >
                  {concept.charAt(0).toUpperCase() + concept.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#8892a4] mb-2">Difficulty</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff}
                  onClick={() => {
                    setDifficulty(diff)
                    setQuestion(generateQuestion(selectedConcept, diff))
                    setSelectedAnswer(null)
                    setIsCorrect(null)
                  }}
                  className={`px-4 py-2 rounded-[8px] text-sm font-display transition-colors ${
                    difficulty === diff
                      ? 'bg-[#e94560] text-white'
                      : 'bg-[#1a1a2e] text-[#e8eaf0] hover:bg-[#16213e]'
                  }`}
                >
                  {diff === 'ap_exam' ? 'AP Exam' : diff.charAt(0).toUpperCase() + diff.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Streak & Stats */}
        <div className="flex gap-6 mb-6">
          <Card className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-2xl ${getStreakColor()}`}>🔥</span>
              <div>
                <div className={`text-2xl font-bold ${getStreakColor()}`}>{streak}</div>
                <div className="text-xs text-[#8892a4]">Streak</div>
              </div>
            </div>
          </Card>
          <Card className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl text-[#f5a623]">💰</span>
              <div>
                <div className="text-2xl font-bold text-[#f5a623]">{totalEarned}</div>
                <div className="text-xs text-[#8892a4]">Earned today</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={question.prompt}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="mb-6">
              <div className="bg-[#0f0f1a] p-4 rounded-[8px] mb-6 font-mono text-sm text-[#00d4aa] whitespace-pre-wrap">
                {question.prompt}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {question.choices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(choice)}
                    disabled={selectedAnswer !== null}
                    className={`p-4 rounded-[8px] text-left transition-all font-mono ${
                      selectedAnswer === choice
                        ? isCorrect
                          ? 'bg-[#00d4aa]/20 border-[#00d4aa] border-2'
                          : 'bg-[#e94560]/20 border-[#e94560] border-2'
                        : selectedAnswer !== null && choice === question.correctAnswer
                        ? 'bg-[#00d4aa]/20 border-[#00d4aa] border-2'
                        : 'bg-[#16213e] hover:bg-[#1a1a2e] border border-white/10'
                    }`}
                  >
                    <span className="text-[#8892a4] mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {choice}
                  </button>
                ))}
              </div>

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
                      <span className="text-[#8892a4] ml-2">+{Math.floor(10 * (streak >= 20 ? 3 : streak >= 10 ? 2 : streak >= 5 ? 1.5 : 1))} coins, +{Math.floor(15 * (streak >= 20 ? 3 : streak >= 10 ? 2 : streak >= 5 ? 1.5 : 1))} XP</span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-bold">Incorrect ✗</span>
                      <p className="mt-2 text-[#8892a4]">{question.explanation}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>

        {selectedAnswer && (
          <button onClick={nextQuestion} className="btn-primary w-full py-3 text-lg">
            Next Question →
          </button>
        )}
      </div>
    </main>
  )
}
