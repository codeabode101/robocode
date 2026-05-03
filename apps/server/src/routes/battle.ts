import { Router, Request, Response } from 'express'
import { parseScript } from '../services/scriptParser'
import { simulateBattle } from '../services/battleEngine'
import { query } from '../db/client'

const router = Router()

// Validate battle script
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { scriptBody } = req.body
    
    if (!scriptBody) {
      return res.status(400).json({ valid: false, errors: ['No script provided'] })
    }

    const { ast, errors } = parseScript(scriptBody)
    
    return res.json({ 
      valid: ast !== null, 
      errors,
      warnings: []
    })
  } catch (error: any) {
    return res.status(500).json({ valid: false, errors: [error.message] })
  }
})

// Submit script for battle
router.post('/:matchId/submit', async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params
    const { scriptBody, userId } = req.body

    // Parse and validate script
    const { ast, errors } = parseScript(scriptBody)
    if (!ast) {
      return res.status(400).json({ error: 'Invalid script', details: errors })
    }

    // In production: store in DB, notify opponent via WebSocket
    // Mock response for now
    return res.json({ success: true, message: 'Script submitted' })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

// Get battle replay
router.get('/:matchId/replay', async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params

    // In production: fetch from DB
    // Mock response
    return res.json({
      matchId,
      replay: {
        ticks: [],
        winner: 1,
        totalTicks: 0
      }
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

// Simulate battle (for testing)
router.post('/simulate', async (req: Request, res: Response) => {
  try {
    const { script1, script2 } = req.body

    const { ast: ast1 } = parseScript(script1)
    const { ast: ast2 } = parseScript(script2)

    if (!ast1 || !ast2) {
      return res.status(400).json({ error: 'Invalid script(s)' })
    }

    const replay = simulateBattle(ast1, ast2, Date.now())
    
    return res.json({ success: true, replay })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

export default router
