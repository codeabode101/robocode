import { Router, Request, Response } from 'express'
import { query } from '../db/client'

const router = Router()

// Get item catalog
router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM item_catalog ORDER BY cost_coins ASC')
    return res.json({ items: result.rows })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

// Get player inventory
router.get('/inventory', async (req: Request, res: Response) => {
  const userId = (req as any).userId
  
  try {
    const result = await query(
      `SELECT ii.*, ic.name, ic.description, ic.item_type, ic.rarity
       FROM inventory_items ii
       JOIN item_catalog ic ON ii.item_id = ic.item_id
       WHERE ii.user_id = $1`,
      [userId]
    )
    
    return res.json({ inventory: result.rows })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

// Purchase item
router.post('/purchase', async (req: Request, res: Response) => {
  const userId = (req as any).userId
  const { itemId } = req.body
  
  try {
    // Get item details
    const itemResult = await query(
      'SELECT * FROM item_catalog WHERE item_id = $1',
      [itemId]
    )
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }
    
    const item = itemResult.rows[0]
    
    // Get player coins
    const playerResult = await query(
      'SELECT coins FROM player_profiles WHERE user_id = $1',
      [userId]
    )
    
    const playerCoins = playerResult.rows[0]?.coins || 0
    
    if (playerCoins < item.cost_coins) {
      return res.status(400).json({ error: 'Insufficient coins' })
    }
    
    // Process purchase in transaction
    await query('BEGIN')
    
    try {
      // Deduct coins
      await query(
        'UPDATE player_profiles SET coins = coins - $1 WHERE user_id = $2',
        [item.cost_coins, userId]
      )
      
      // Add to inventory
      await query(
        'INSERT INTO inventory_items (user_id, item_id, item_type) VALUES ($1, $2, $3)',
        [userId, itemId, item.item_type]
      )
      
      // Log transaction
      await query(
        'INSERT INTO coin_transactions (user_id, delta, reason, metadata) VALUES ($1, $2, $3, $4)',
        [userId, -item.cost_coins, 'shop_purchase', JSON.stringify({ itemId })]
      )
      
      await query('COMMIT')
      
      return res.json({ success: true, message: `Purchased ${item.name}` })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

export default router
