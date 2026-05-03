import { Router, Request, Response } from 'express'
import { generateQuestion } from '../services/questionGen'

const router = Router()

// Generate a question
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { concept = 'variables', difficulty = 'easy' } = req.body
    
    const question = generateQuestion(concept, difficulty as any)
    
    return res.json({ success: true, question })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

// Submit answer
router.post('/answer', async (req: Request, res: Response) => {
  try {
    const { questionId, answer, correctAnswer } = req.body
    
    const isCorrect = answer === correctAnswer
    
    return res.json({
      success: true,
      correct: isCorrect,
      correctAnswer,
      explanation: isCorrect ? 'Great job!' : 'Try again!'
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

export default router
