import { Question } from '@shared/types'

export function generateVariableQuestion(difficulty: 'easy' | 'medium' | 'hard'): Question {
  const a = Math.floor(Math.random() * 10) + 1
  const b = Math.floor(Math.random() * 10) + 1
  const op = ['+', '-', '*', '%'][Math.floor(Math.random() * 4)]
  
  let result: number
  switch(op) {
    case '+': result = a + b; break
    case '-': result = a - b; break
    case '*': result = a * b; break
    case '%': result = a % b; break
    default: result = 0
  }

  const correctAnswer = `${a} ${op} ${b} = ${result}`
  
  return {
    concept: 'variables',
    difficulty,
    prompt: `What is the value of x after this code runs?\n\nint x = ${a};\nx ${op}= ${b};`,
    correctAnswer: `${result}`,
    choices: shuffle([
      `${result}`,
      `${op === '+' ? a - b : a + b}`,
      `${op === '*' ? a + b : a * b}`,
      `${Math.floor(Math.random() * 20)}`
    ]),
    explanation: `The ${op === '+' ? 'addition' : op === '-' ? 'subtraction' : op === '*' ? 'multiplication' : 'modulo'} assignment operator ${op}= updates x to x ${op} ${b}, which equals ${result}.`
  }
}

export function generateLoopQuestion(difficulty: 'easy' | 'medium' | 'hard'): Question {
  const start = Math.floor(Math.random() * 3)
  const end = start + Math.floor(Math.random() * 4) + 2
  const step = difficulty === 'easy' ? 1 : Math.floor(Math.random() * 2) + 1
  const multiplier = Math.floor(Math.random() * 5) + 1

  const output: number[] = []
  for (let i = start; i < end; i += step) {
    output.push(i * multiplier)
  }

  const correctOutput = output.join(', ')

  return {
    concept: 'loops',
    difficulty,
    prompt: `What is printed?\n\nfor (int i = ${start}; i < ${end}; i += ${step}) {\n  System.out.println(i * ${multiplier});\n}`,
    correctAnswer: correctOutput,
    choices: shuffle([
      correctOutput,
      output.map(v => v + 1).join(', '),
      `${start * multiplier}, ${end * multiplier}`,
      Array.from({length: end - start}, (_, idx) => (start + idx) * multiplier).join(', ')
    ]),
    explanation: `The loop runs from i=${start} to i=${end-1}, stepping by ${step}. Each iteration prints i * ${multiplier}.`
  }
}

export function generateConditionalQuestion(difficulty: 'easy' | 'medium' | 'hard'): Question {
  const x = Math.floor(Math.random() * 10) + 1
  const y = Math.floor(Math.random() * 10) + 1
  const condition = ['>', '<', '=='][Math.floor(Math.random() * 3)]
  
  let result: string
  switch(condition) {
    case '>': result = x > y ? 'A' : 'B'; break
    case '<': result = x < y ? 'A' : 'B'; break
    case '==': result = x === y ? 'A' : 'B'; break
    default: result = 'B'
  }

  return {
    concept: 'conditionals',
    difficulty,
    prompt: `What is printed?\n\nint x = ${x};\nint y = ${y};\nif (x ${condition} y) {\n  System.out.println("A");\n} else {\n  System.out.println("B");\n}`,
    correctAnswer: result,
    choices: shuffle(['A', 'B', 'C', 'D']),
    explanation: `Since ${x} ${condition} ${y} is ${x > y ? 'true' : 'false'} (${x} ${condition === '>' ? '>' : condition === '<' ? '<' : '=='} ${y}), the code prints "${result}".`
  }
}

export function generateArrayQuestion(difficulty: 'easy' | 'medium' | 'hard'): Question {
  const arr = Array.from({length: 4}, () => Math.floor(Math.random() * 10))
  const idx = Math.floor(Math.random() * arr.length)
  
  return {
    concept: 'arrays',
    difficulty,
    prompt: `What is printed?\n\nint[] nums = {${arr.join(', ')}};\nSystem.out.println(nums[${idx}]);`,
    correctAnswer: `${arr[idx]}`,
    choices: shuffle([
      `${arr[idx]}`,
      `${arr[(idx + 1) % arr.length]}`,
      `${arr[0]}`,
      `${Math.floor(Math.random() * 10)}`
    ]),
    explanation: `nums[${idx}] accesses the element at index ${idx}, which is ${arr[idx]}.`
  }
}

export function generateQuestion(concept: string, difficulty: 'easy' | 'medium' | 'hard' | 'ap_exam' = 'easy'): Question {
  const safeDifficulty = difficulty === 'ap_exam' ? 'hard' : difficulty
  switch(concept) {
    case 'variables': return generateVariableQuestion(safeDifficulty)
    case 'loops': return generateLoopQuestion(safeDifficulty)
    case 'conditionals': return generateConditionalQuestion(safeDifficulty)
    case 'arrays': return generateArrayQuestion(safeDifficulty)
    default: return generateVariableQuestion(safeDifficulty)
  }
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
