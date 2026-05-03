'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { generateQuestion } from '@/lib/questionGen'
import { Card } from '@/components/ui/Card'

// Mock quest data
const QUEST_DATA = {
  chapter: 1,
  quest: 1,
  title: 'The ATM',
  cutscene: [
    'The bank\'s ATM is frozen. The system can\'t compute balances.',
    'You must trace the code manually to fix it.',
    'Your robot assists by executing the logic step by step.'
  ],
  concept: 'variables',
  questions: [
    {
      prompt: `What is the value of x after this code runs?\n\nint x = 10;\nx += 2 % 4;`,
      correctAnswer: '12',
      choices: ['10', '12', '8', '14'],
      explanation: 'The modulo operator % gives the remainder of 2/4, which is 2. So x = 10 + 2 = 12.'
    },
    {
      prompt: `What is printed?\n\nint a = 5, b = 3;\nSystem.out.println(a * b - 2);`,
      correctAnswer: '13',
      choices: ['13', '15', '17', '6'],
      explanation: 'a * b = 15, then 15 - 2 = 13.'
    },
    {
      prompt: `Which line has a syntax error?\n\n1: int count = 0;\n2: count = count + 1\n3: System.out.println(count);`,
      correctAnswer: 'Line 2',
      choices: ['Line 1', 'Line 2', 'Line 3', 'No error'],
      explanation: 'Line 2 is missing a semicolon at the end.'
    }
  ],
  rewards: { xp: 30, coins: 25 }
}

export default function QuestPage() {
  const router = useRouter()
  const [currentQ, setCurrentQ] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [completed, setCompleted] = useState(false)
  const [attempts, setAttempts] = useState(0)

  const question = QUEST_DATA.questions[currentQ]

  const handleAnswer = (answer: string) => {
    if (selectedAnswer) return
    
    setSelectedAnswer(answer)
    const correct = answer === question.correctAnswer
    setIsCorrect(correct)

    if (!correct) {
      setAttempts(prev => prev + 1)
    }
  }

  const nextQuestion = () => {
    if (currentQ < QUEST_DATA.questions.length - 1) {
      setCurrentQ(prev => prev + 1)
      setSelectedAnswer(null)
      setIsCorrect(null)
    } else {
      setCompleted(true)
    }
  }

  if (completed) {
    return (
      <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="text-8xl mb-6">🎉</div>
          <h1 className="text-5xl font-display font-black text-[#00d4aa] mb-4">Quest Complete!</h1>
          <Card className="mb-6 text-left">
            <h3 className="font-display text-xl mb-3 text-[#f5a623]">Rewards Earned:</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>XP:</span>
                <span className="text-[#00d4aa] font-bold">+{QUEST_DATA.rewards.xp}</span>
              </div>
              <div className="flex justify-between">
                <span>Coins:</span>
                <span className="text-[#f5a623] font-bold">+{QUEST_DATA.rewards.coins}</span>
              </div>
            </div>
          </Card>
          <button
            onClick={() => router.push('/story')}
            className="btn-primary text-lg px-8 py-3"
          >
            Continue Story →
          </button>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-[#e8eaf0] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.back()} className="text-[#8892a4] hover:text-[#e8eaf0] mb-2">
            ← Back to Chapter {QUEST_DATA.chapter}
          </button>
          <h1 className="text-4xl font-display font-bold text-[#00d4aa]">
            Quest {QUEST_DATA.quest}: {QUEST_DATA.title}
          </h1>
        </div>

        {/* Cutscene */}
        {currentQ === 0 && (
          <Card className="mb-6">
            <h3 className="font-display text-lg mb-3 text-[#f5a623]">Cutscene</h3>
            {QUEST_DATA.cutscene.map((panel, idx) => (
              <p key={idx} className="text-sm text-[#8892a4] mb-2">{panel}</p>
            ))}
          </Card>
        )}

        {/* Concept Explainer */}
        {currentQ === 0 && (
          <Card className="mb-6 border-[#00d4aa]">
            <h3 className="font-display text-lg mb-3 text-[#00d4aa]">Concept: {QUEST_DATA.concept.charAt(0).toUpperCase() + QUEST_DATA.concept.slice(1)}</h3>
            <p className="text-sm text-[#8892a4] mb-2">
              Variables store information in memory. Each variable has a type (int for whole numbers, String for text).
            </p>
            <p className="text-sm text-[#8892a4] mb-2">
              Use = to assign values. Compound operators like +=, -=, *= modify values in place.
            </p>
            <div className="bg-[#0f0f1a] p-3 rounded-[8px] font-mono text-[#00d4aa] text-sm mt-3">
              {`int score = 100;  // declares and initializes\nString name = "Sparky";  // String variable\nscore += 50;  // score is now 150`}
            </div>
            <button className="btn-primary mt-4">Got it!</button>
          </Card>
        )}

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-[#8892a4]">Question {currentQ + 1} of {QUEST_DATA.questions.length}</span>
                <span className="text-sm text-[#f5a623]">Attempts: {attempts}/2</span>
              </div>

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
            {currentQ < QUEST_DATA.questions.length - 1 ? 'Next Question →' : 'Complete Quest 🎉'}
          </button>
        )}
      </div>
    </main>
  )
}
