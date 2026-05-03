import { query } from './client'

const ITEMS = [
  // Cosmetics
  { id: 'hat_basic', name: 'Basic Visor', desc: 'Simple protective visor', type: 'cosmetic', cost_coins: 200, cost_gems: 0, rarity: 'common', unlocks_at_level: 1 },
  { id: 'hat_neon', name: 'Neon Crown', desc: 'Glows in the dark', type: 'cosmetic', cost_coins: 500, cost_gems: 0, rarity: 'rare', unlocks_at_level: 5 },
  { id: 'hat_royal', name: 'Royal Crown', desc: 'Fit for a champion', type: 'cosmetic', cost_coins: 1000, cost_gems: 2, rarity: 'epic', unlocks_at_level: 10 },
  { id: 'hat_legendary', name: 'Legendary Halo', desc: 'Ultimate prestige', type: 'cosmetic', cost_coins: 2000, cost_gems: 5, rarity: 'legendary', unlocks_at_level: 20 },
  
  // Accessories
  { id: 'wings_jet', name: 'Jet Wings', desc: 'Looks fast, is fast', type: 'cosmetic', cost_coins: 600, cost_gems: 0, rarity: 'epic', unlocks_at_level: 8 },
  { id: 'wings_dragon', name: 'Dragon Wings', desc: 'Fiery and fierce', type: 'cosmetic', cost_coins: 1200, cost_gems: 3, rarity: 'legendary', unlocks_at_level: 15 },
  { id: 'armor_light', name: 'Light Plating', desc: '+5 shield bonus', type: 'upgrade', cost_coins: 300, cost_gems: 0, rarity: 'common', unlocks_at_level: 3 },
  { id: 'armor_heavy', name: 'Heavy Armor', desc: '+15 shield bonus', type: 'upgrade', cost_coins: 800, cost_gems: 0, rarity: 'epic', unlocks_at_level: 10 },
  { id: 'armor_energy', name: 'Energy Shield', desc: '+10 shield, +10 mana', type: 'upgrade', cost_coins: 1000, cost_gems: 2, rarity: 'epic', unlocks_at_level: 12 },
  
  // Weapons
  { id: 'weapon_laser', name: 'Laser Beam', desc: 'Special: 30 dmg', type: 'upgrade', cost_coins: 1000, cost_gems: 3, rarity: 'legendary', unlocks_at_level: 15 },
  { id: 'weapon_ion', name: 'Ion Blaster', desc: 'Attack: 12-18 dmg', type: 'upgrade', cost_coins: 600, cost_gems: 0, rarity: 'rare', unlocks_at_level: 8 },
  { id: 'weapon_plasma', name: 'Plasma Cannon', desc: 'Special: 35 dmg, costs 50 mana', type: 'upgrade', cost_coins: 1500, cost_gems: 4, rarity: 'legendary', unlocks_at_level: 18 },
  
  // House themes
  { id: 'theme_starter', name: 'Starter Cave', desc: 'Basic dwelling', type: 'cosmetic', cost_coins: 0, cost_gems: 0, rarity: 'common', unlocks_at_level: 1 },
  { id: 'theme_neon', name: 'Neon City', desc: 'Cyberpunk style', type: 'cosmetic', cost_coins: 800, cost_gems: 0, rarity: 'rare', unlocks_at_level: 10 },
  { id: 'theme_forest', name: 'Forest Temple', desc: 'Nature-inspired', type: 'cosmetic', cost_coins: 600, cost_gems: 0, rarity: 'rare', unlocks_at_level: 8 },
  { id: 'theme_space', name: 'Space Station', desc: 'Out of this world', type: 'cosmetic', cost_coins: 1200, cost_gems: 3, rarity: 'epic', unlocks_at_level: 15 },
  { id: 'theme_volcano', name: 'Lava Forge', desc: 'Intense heat', type: 'cosmetic', cost_coins: 1500, cost_gems: 4, rarity: 'legendary', unlocks_at_level: 20 },
  
  // Consumables
  { id: 'potion_heal', name: 'Heal Potion', desc: 'Instant +20 HP', type: 'consumable', cost_coins: 100, cost_gems: 0, rarity: 'common', unlocks_at_level: 1 },
  { id: 'potion_mana', name: 'Mana Potion', desc: 'Instant +30 mana', type: 'consumable', cost_coins: 150, cost_gems: 0, rarity: 'common', unlocks_at_level: 3 },
  { id: 'potion_boost', name: 'Boost Potion', desc: '+50% attack next battle', type: 'consumable', cost_coins: 300, cost_gems: 0, rarity: 'rare', unlocks_at_level: 8 },
  { id: 'potion_shield', name: 'Shield Potion', desc: 'Instant +25 shield', type: 'consumable', cost_coins: 200, cost_gems: 0, rarity: 'common', unlocks_at_level: 5 },
  
  // Profile frames
  { id: 'frame_basic', name: 'Basic Frame', desc: 'Simple border', type: 'cosmetic', cost_coins: 100, cost_gems: 0, rarity: 'common', unlocks_at_level: 1 },
  { id: 'frame_gold', name: 'Gold Frame', desc: 'Shimmering gold', type: 'cosmetic', cost_coins: 500, cost_gems: 0, rarity: 'rare', unlocks_at_level: 10 },
  { id: 'frame_diamond', name: 'Diamond Frame', desc: 'Sparkles forever', type: 'cosmetic', cost_coins: 1000, cost_gems: 2, rarity: 'epic', unlocks_at_level: 15 },
  
  // Name card styles
  { id: 'namecard_classic', name: 'Classic Font', desc: 'Traditional style', type: 'cosmetic', cost_coins: 100, cost_gems: 0, rarity: 'common', unlocks_at_level: 1 },
  { id: 'namecard_neon', name: 'Neon Glow', desc: 'Glowing text', type: 'cosmetic', cost_coins: 400, cost_gems: 0, rarity: 'rare', unlocks_at_level: 5 },
  { id: 'namecard_cyber', name: 'Cyber Glitch', desc: 'Glitch effect', type: 'cosmetic', cost_coins: 800, cost_gems: 2, rarity: 'epic', unlocks_at_level: 12 },
  
  // Battle arena skins
  { id: 'arena_default', name: 'Default Arena', desc: 'Standard battlefield', type: 'cosmetic', cost_coins: 0, cost_gems: 0, rarity: 'common', unlocks_at_level: 1 },
  { id: 'arena_cyber', name: 'Cyber Coliseum', desc: 'Neon battleground', type: 'cosmetic', cost_coins: 600, cost_gems: 0, rarity: 'rare', unlocks_at_level: 8 },
  { id: 'arena_volcano', name: 'Volcanic Arena', desc: 'Lava surroundings', type: 'cosmetic', cost_coins: 1000, cost_gems: 3, rarity: 'epic', unlocks_at_level: 15 },
]

async function seed() {
  console.log('Seeding item catalog...')
  
  for (const item of ITEMS) {
    await query(
      `INSERT INTO item_catalog (item_id, name, description, item_type, cost_coins, cost_gems, rarity, unlocks_at_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (item_id) DO NOTHING`,
      [item.id, item.name, item.desc, item.type, item.cost_coins, item.cost_gems, item.rarity, item.unlocks_at_level]
    )
  }
  
  console.log(`Seeded ${ITEMS.length} items successfully!`)
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed error:', err)
  process.exit(1)
})
