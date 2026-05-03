// Battle Engine - Deterministic simulation of robot battles
import { ASTNode } from './scriptParser'

interface PlayerState {
  hp: number
  shield: number
  mana: number
  lastMove: string
}

interface BattleState {
  tick: number
  p1: PlayerState
  p2: PlayerState
  over: boolean
  winner: 1 | 2 | null
}

interface TickRecord {
  tick: number
  p1Action: string
  p2Action: string
  p1HpBefore: number
  p2HpBefore: number
  p1HpAfter: number
  p2HpAfter: number
  p1ShieldAfter: number
  p2ShieldAfter: number
  p1ManaAfter: number
  p2ManaAfter: number
  narrative: string
}

interface ReplayLog {
  ticks: TickRecord[]
  winner: 1 | 2 | null
  totalTicks: number
}

// Mulberry32 PRNG for deterministic randomness
function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function simulateBattle(
  ast1: ASTNode, 
  ast2: ASTNode, 
  seed: number = Date.now()
): ReplayLog {
  const log: TickRecord[] = []
  const state: BattleState = {
    tick: 1,
    p1: { hp: 100, shield: 0, mana: 50, lastMove: 'CHARGE' },
    p2: { hp: 100, shield: 0, mana: 50, lastMove: 'CHARGE' },
    over: false,
    winner: null
  }
  
  const prng = mulberry32(seed)
  
  for (let tick = 1; tick <= 50 && !state.over; tick++) {
    state.tick = tick
    
    const env1 = buildEnv(state, 1)
    const env2 = buildEnv(state, 2)
    
    const action1 = evaluateScript(ast1, env1)
    const action2 = evaluateScript(ast2, env2)
    
    const result = resolveActions(action1, action2, state, prng)
    
    log.push({
      tick,
      p1Action: action1,
      p2Action: action2,
      p1HpBefore: state.p1.hp,
      p2HpBefore: state.p2.hp,
      p1HpAfter: result.p1HpAfter,
      p2HpAfter: result.p2HpAfter,
      p1ShieldAfter: result.p1ShieldAfter,
      p2ShieldAfter: result.p2ShieldAfter,
      p1ManaAfter: result.p1ManaAfter,
      p2ManaAfter: result.p2ManaAfter,
      narrative: generateNarrative(action1, action2, result)
    })
    
    applyResult(state, result)
    
    // Update lastMove
    state.p1.lastMove = action1.toUpperCase()
    state.p2.lastMove = action2.toUpperCase()
    
    // Check win condition
    if (state.p1.hp <= 0 && state.p2.hp <= 0) {
      state.over = true
      state.winner = null
    } else if (state.p1.hp <= 0) {
      state.over = true
      state.winner = 2
    } else if (state.p2.hp <= 0) {
      state.over = true
      state.winner = 1
    }
  }
  
  // If no one died in 50 ticks → higher HP wins
  if (!state.over) {
    state.winner = state.p1.hp >= state.p2.hp ? 1 : 2
    state.over = true
  }
  
  return { ticks: log, winner: state.winner, totalTicks: log.length }
}

function buildEnv(state: BattleState, playerNum: 1 | 2): Record<string, any> {
  const player = playerNum === 1 ? state.p1 : state.p2
  const enemy = playerNum === 1 ? state.p2 : state.p1
  
  return {
    myHP: player.hp,
    enemyHP: enemy.hp,
    myShield: player.shield,
    enemyShield: enemy.shield,
    lastEnemyMove: enemy.lastMove,
    tickNumber: state.tick,
    myMana: player.mana
  }
}

interface ActionResult {
  p1HpAfter: number
  p2HpAfter: number
  p1ShieldAfter: number
  p2ShieldAfter: number
  p1ManaAfter: number
  p2ManaAfter: number
}

function resolveActions(
  action1: string,
  action2: string,
  state: BattleState,
  prng: () => number
): ActionResult {
  const p1 = { ...state.p1 }
  const p2 = { ...state.p2 }
  
  // Process actions simultaneously
  const r1 = processAction(action1, p1, p2, prng)
  const r2 = processAction(action2, p2, p1, prng)
  
  // Apply damage to each other
  p1.hp = Math.max(0, p1.hp - r2.damageToEnemy)
  p2.hp = Math.max(0, p2.hp - r1.damageToEnemy)
  
  // Shield resets each tick (only lasts during the tick it was used)
  if (action1 !== 'defend') p1.shield = 0
  if (action2 !== 'defend') p2.shield = 0
  
  return {
    p1HpAfter: p1.hp,
    p2HpAfter: p2.hp,
    p1ShieldAfter: action1 === 'defend' ? p1.shield : 0,
    p2ShieldAfter: action2 === 'defend' ? p2.shield : 0,
    p1ManaAfter: p1.mana,
    p2ManaAfter: p2.mana
  }
}

interface ProcessResult {
  damageToEnemy: number
}

function processAction(
  action: string,
  player: PlayerState,
  enemy: PlayerState,
  prng: () => number
): ProcessResult {
  let damageToEnemy = 0
  
  switch (action) {
    case 'attack': {
      const dmg = Math.floor(prng() * 6) + 10 // 10-15
      const actualDmg = Math.max(0, dmg - enemy.shield)
      damageToEnemy = actualDmg
      break
    }
    case 'defend':
      player.shield = 15
      break
    case 'heal':
      if (player.mana >= 20) {
        player.hp = Math.min(100, player.hp + 12)
        player.mana -= 20
      } else {
        // Not enough mana, becomes charge
        player.mana = Math.min(100, player.mana + 25)
      }
      break
    case 'special':
      if (player.mana >= 40) {
        damageToEnemy = 25
        player.mana -= 40
      } else {
        // Not enough mana, weak attack
        damageToEnemy = 5
      }
      break
    case 'charge':
      player.mana = Math.min(100, player.mana + 25)
      break
  }
  
  return { damageToEnemy }
}

function applyResult(state: BattleState, result: ActionResult) {
  state.p1.hp = result.p1HpAfter
  state.p2.hp = result.p2HpAfter
  state.p1.shield = result.p1ShieldAfter
  state.p2.shield = result.p2ShieldAfter
  state.p1.mana = result.p1ManaAfter
  state.p2.mana = result.p2ManaAfter
}

function generateNarrative(action1: string, action2: string, result: ActionResult): string {
  const narratives: string[] = []
  
  if (action1 === 'attack') {
    narratives.push(`Player 1 attacks! Player 2 takes ${result.p2HpBefore - result.p2HpAfter} damage.`)
  } else if (action1 === 'defend') {
    narratives.push(`Player 1 raises shield (+15 defense).`)
  } else if (action1 === 'heal') {
    narratives.push(`Player 1 heals for 12 HP.`)
  } else if (action1 === 'special') {
    narratives.push(`Player 1 uses special attack! Deals 25 damage.`)
  } else if (action1 === 'charge') {
    narratives.push(`Player 1 charges mana (+25).`)
  }
  
  if (action2 === 'attack') {
    narratives.push(`Player 2 attacks! Player 1 takes ${result.p1HpBefore - result.p1HpAfter} damage.`)
  } else if (action2 === 'defend') {
    narratives.push(`Player 2 raises shield (+15 defense).`)
  } else if (action2 === 'heal') {
    narratives.push(`Player 2 heals for 12 HP.`)
  } else if (action2 === 'special') {
    narratives.push(`Player 2 uses special attack! Deals 25 damage.`)
  } else if (action2 === 'charge') {
    narratives.push(`Player 2 charges mana (+25).`)
  }
  
  return narratives.join(' ')
}

// Re-export evaluateScript from scriptParser
export { evaluateScript } from './scriptParser'
