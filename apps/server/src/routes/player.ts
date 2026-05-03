import { Router, Request, Response } from 'express'
import { query } from '../db/client'

const router = Router()

// Get player profile
router.get('/profile', async (req: Request, res: Response) => {
  const userId = (req as any).userId
  
  try {
    const result = await query(
      'SELECT * FROM player_profiles WHERE user_id = $1',
      [userId]
    )
    
    return res.json({ profile: result.rows[0] })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

// Update profile
router.patch('/profile', async (req: Request, res: Response) => {
  const userId = (req as any).userId
  const { display_name, robot_name, robot_model } = req.body
  
  try {
    const result = await query(
      `UPDATE player_profiles 
       SET display_name = COALESCE($1, display_name),
           robot_name = COALESCE($2, robot_name),
           robot_model = COALESCE($3, robot_model),
           updated_at = now()
       WHERE user_id = $4
       RETURNING *`,
      [display_name, robot_name, robot_model, userId]
    )
    
    return res.json({ profile: result.rows[0] })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

// Get concept mastery
router.get('/concept-mastery', async (req: Request, res: Response) => {
  const userId = (req as any).userId
  
  try {
    const result = await query(
      'SELECT * FROM concept_mastery WHERE user_id = $1',
      [userId]
    )
    
    return res.json({ mastery: result.rows })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

export default router
