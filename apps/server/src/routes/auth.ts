import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../db/client'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  // In production: integrate with WorkOS
  const { email, workos_user_id } = req.body
  
  try {
    // Check if user exists
    const result = await query(
      'SELECT * FROM users WHERE workos_user_id = $1',
      [workos_user_id]
    )
    
    let user = result.rows[0]
    
    if (!user) {
      // Create new user
      const newUser = await query(
        'INSERT INTO users (workos_user_id, email, username) VALUES ($1, $2, $3) RETURNING *',
        [workos_user_id, email, `user_${Date.now()}`]
      )
      user = newUser.rows[0]
      
      // Create player profile
      await query(
        'INSERT INTO player_profiles (user_id, display_name, robot_name) VALUES ($1, $2, $3)',
        [user.id, 'New Trainer', 'Robo Pup']
      )
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )
    
    return res.json({ success: true, token, user })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

router.post('/logout', (req: Request, res: Response) => {
  return res.json({ success: true })
})

router.get('/profile', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) return res.status(401).json({ error: 'No token' })
  
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!)
    
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.userId]
    )
    
    const profileResult = await query(
      'SELECT * FROM player_profiles WHERE user_id = $1',
      [decoded.userId]
    )
    
    return res.json({
      user: userResult.rows[0],
      profile: profileResult.rows[0]
    })
  } catch (error: any) {
    return res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
