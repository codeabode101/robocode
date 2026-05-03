import { Router, Request, Response } from 'express'
import { query } from '../db/client'

const router = Router()

// Get story progress
router.get('/progress', async (req: Request, res: Response) => {
  const userId = (req as any).userId
  
  try {
    const result = await query(
      'SELECT * FROM story_progress WHERE user_id = $1 ORDER BY chapter, quest',
      [userId]
    )
    
    return res.json({ progress: result.rows })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

// Complete a quest
router.post('/complete', async (req: Request, res: Response) => {
  const userId = (req as any).userId
  const { chapter, quest, score } = req.body
  
  try {
    await query('BEGIN')
    
    // Mark quest as completed
    await query(
      `INSERT INTO story_progress (user_id, chapter, quest, completed, completed_at, attempts)
       VALUES ($1, $2, $3, true, now(), 1)
       ON CONFLICT (user_id, chapter, quest)
       DO UPDATE SET completed = true, completed_at = now()`,
      [userId, chapter, quest]
    )
    
    // Award XP and coins
    const xpReward = 30
    const coinReward = 25
    
    await query(
      'UPDATE player_profiles SET xp = xp + $1, coins = coins + $2 WHERE user_id = $3',
      [xpReward, coinReward, userId]
    )
    
    // Log coin transaction
    await query(
      'INSERT INTO coin_transactions (user_id, delta, reason, metadata) VALUES ($1, $2, $3, $4)',
      [userId, coinReward, 'story_quest', JSON.stringify({ chapter, quest })]
    )
    
    // Update concept mastery
    const concept = chapter <= 2 ? 'variables' : chapter <= 4 ? 'loops' : 'conditionals'
    await query(
      `INSERT INTO concept_mastery (user_id, concept, questions_seen, questions_correct, mastery_level)
       VALUES ($1, $2, 1, 1, 1)
       ON CONFLICT (user_id, concept)
       DO UPDATE SET questions_seen = concept_mastery.questions_seen + 1,
                       questions_correct = concept_mastery.questions_correct + 1`,
      [userId, concept]
    )
    
    await query('COMMIT')
    
    return res.json({
      success: true,
      rewards: { xp: xpReward, coins: coinReward }
    })
  } catch (error: any) {
    await query('ROLLBACK')
    return res.status(500).json({ error: error.message })
  }
})

export default router
