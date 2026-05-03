'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
}

export default function CodeEditor({ value, onChange, onSubmit, disabled = false }: CodeEditorProps) {
  const [lineCount, setLineCount] = useState(1)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLineCount(value.split('\n').length)
  }, [value])

  // Real-time validation (simplified - would call API in production)
  useEffect(() => {
    if (!value.trim()) {
      setIsValid(null)
      return
    }
    
    const lines = value.split('\n').filter(l => l.trim())
    if (lines.length > 15) {
      setIsValid(false)
      return
    }
    
    // Basic syntax check
    const hasValidAction = /(attack|defend|heal|special|charge)\s*\(\)\s*;/.test(value)
    setIsValid(hasValidAction)
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newValue)
      
      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2
        }
      }, 0)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display text-lg">Battle Script</h3>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${lineCount > 15 ? 'text-[#e94560]' : 'text-[#8892a4]'}`}>
            {lineCount}/15 lines
          </span>
          {isValid !== null && (
            <span className={isValid ? 'text-[#00d4aa]' : 'text-[#e94560]'}>
              {isValid ? '✓ Valid' : '✗ Invalid'}
            </span>
          )}
        </div>
      </div>

      <div className="relative bg-[#0f0f1a] rounded-[8px] p-4 font-mono text-sm">
        {/* Line numbers */}
        <div className="absolute left-2 top-4 text-[#8892a4] select-none">
          {Array.from({ length: Math.max(lineCount, 15) }, (_, i) => (
            <div key={i} className="h-6 leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="w-full min-h-[300px] bg-transparent text-[#00d4aa] font-mono text-sm pl-8 outline-none resize-none leading-6"
          style={{ lineHeight: '24px' }}
          placeholder={`// Write your battle script here\n// Example:\nif (myHP < 30) {\n  heal();\n} else {\n  attack();\n}`}
          maxLength={1000}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={onSubmit}
          disabled={!isValid || disabled}
          className="btn-primary flex-1 py-2 disabled:opacity-50"
        >
          Lock In Script
        </button>
        <button
          onClick={() => onChange('')}
          disabled={disabled}
          className="btn-secondary py-2 px-4 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {/* Quick reference */}
      <div className="mt-4 p-3 bg-[#16213e] rounded-[8px] text-xs text-[#8892a4]">
        <div className="font-bold text-[#e8eaf0] mb-2">Available Actions:</div>
        <div className="grid grid-cols-2 gap-1">
          <span><span className="text-[#f5a623]">attack()</span> - 10-15 dmg</span>
          <span><span className="text-[#00d4aa]">defend()</span> - +15 shield</span>
          <span><span className="text-[#e94560]">heal()</span> - +12 HP (20 mana)</span>
          <span><span className="text-purple-400">special()</span> - 25 dmg (40 mana)</span>
          <span><span className="text-[#8892a4]">charge()</span> - +25 mana</span>
        </div>
        <div className="mt-2">
          <span className="font-bold text-[#e8eaf0]">Variables:</span>
          <span className="ml-1">myHP, enemyHP, myShield, enemyShield, lastEnemyMove, tickNumber, myMana</span>
        </div>
      </div>
    </motion.div>
  )
}
