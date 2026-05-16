export type Action = 'ATTACK' | 'DEFEND' | 'HEAL' | 'CHARGE' | 'SPECIAL';

export interface PlayerState {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  lastAction: Action | null;
}

export interface TurnResult {
  turn: number;
  p1Action: Action;
  p2Action: Action;
  p1Hp: number;
  p2Hp: number;
  p1Energy: number;
  p2Energy: number;
  p1Damage: number;
  p2Damage: number;
  message: string;
  p1Coded: boolean;
  p2Coded: boolean;
}

export interface BattleResult {
  turns: TurnResult[];
  winner: 1 | 2 | 0;
  reason: string;
  p1FinalHp: number;
  p2FinalHp: number;
}

export function createPlayerState(): PlayerState {
  return { hp: 20, maxHp: 20, energy: 3, maxEnergy: 5, lastAction: null };
}

const ENERGY_COST: Record<Action, number> = {
  ATTACK: 1, DEFEND: 0, HEAL: 2, CHARGE: 0, SPECIAL: 4,
};

function getValidAction(energy: number, desired: string): Action {
  const a = desired.toUpperCase() as Action;
  if (!['ATTACK', 'DEFEND', 'HEAL', 'CHARGE', 'SPECIAL'].includes(a)) return 'ATTACK';
  if (energy < ENERGY_COST[a]) return 'ATTACK';
  return a;
}

export function executeCode(
  code: string,
  state: Record<string, unknown>,
): string {
  const trimmed = code.trim();
  if (!trimmed) return 'ATTACK';
  const fnBody = `
    var myHealth = state.myHealth;
    var myMaxHealth = state.myMaxHealth;
    var myEnergy = state.myEnergy;
    var myMaxEnergy = state.myMaxEnergy;
    var opponentHealth = state.opponentHealth;
    var opponentMaxHealth = state.opponentMaxHealth;
    var opponentEnergy = state.opponentEnergy;
    var lastOpponentAction = state.lastOpponentAction;
    var lastMyAction = state.lastMyAction;
    var round = state.round;
    ${trimmed}
  `;
  try {
    const fn = new Function('state', fnBody) as (state: Record<string, unknown>) => unknown;
    const start = performance.now();
    const result = fn(state);
    const elapsed = performance.now() - start;
    if (elapsed > 100) return 'ATTACK';
    return typeof result === 'string' ? result.trim() : 'ATTACK';
  } catch {
    return 'ATTACK';
  }
}

export function resolveSingleTurn(
  p1: PlayerState,
  p2: PlayerState,
  p1ActionStr: string,
  p2ActionStr: string,
): { p1Damage: number; p2Damage: number; message: string } {
  const p1Action = getValidAction(p1.energy, p1ActionStr);
  const p2Action = getValidAction(p2.energy, p2ActionStr);

  let p1Damage = 0, p2Damage = 0;

  p1.energy = Math.max(0, p1.energy - ENERGY_COST[p1Action]);
  p2.energy = Math.max(0, p2.energy - ENERGY_COST[p2Action]);

  p1.energy = Math.min(p1.maxEnergy, p1.energy + 1);
  p2.energy = Math.min(p2.maxEnergy, p2.energy + 1);

  if (p1Action === 'CHARGE') p1.energy = Math.min(p1.maxEnergy, p1.energy + 2);
  if (p2Action === 'CHARGE') p2.energy = Math.min(p2.maxEnergy, p2.energy + 2);

  if (p1Action === 'HEAL') {
    const heal = 6 + Math.floor(Math.random() * 3);
    p1.hp = Math.min(p1.maxHp, p1.hp + heal);
  }
  if (p2Action === 'HEAL') {
    const heal = 6 + Math.floor(Math.random() * 3);
    p2.hp = Math.min(p2.maxHp, p2.hp + heal);
  }

  if (p1Action === 'SPECIAL') p1Damage = p2Action === 'DEFEND' ? 4 : 8;
  else if (p1Action === 'ATTACK') p1Damage = p2Action === 'DEFEND' ? 1 : 4;

  if (p2Action === 'SPECIAL') p2Damage = p1Action === 'DEFEND' ? 4 : 8;
  else if (p2Action === 'ATTACK') p2Damage = p1Action === 'DEFEND' ? 1 : 4;

  if (p1Action === 'HEAL' && p2Action === 'ATTACK') {
    const interrupt = Math.floor(Math.random() * 3) + 1;
    p1.hp -= interrupt;
    p2Damage = interrupt;
  }
  if (p2Action === 'HEAL' && p1Action === 'ATTACK') {
    const interrupt = Math.floor(Math.random() * 3) + 1;
    p2.hp -= interrupt;
    p1Damage = interrupt;
  }

  p2.hp = Math.max(0, p2.hp - p1Damage);
  p1.hp = Math.max(0, p1.hp - p2Damage);

  let message: string;
  if (p1Action === p2Action) {
    if (p1Action === 'ATTACK') message = `Both attack! P1 deals ${p1Damage}, P2 deals ${p2Damage}`;
    else if (p1Action === 'DEFEND') message = 'Both defend — no damage';
    else if (p1Action === 'HEAL') message = 'Both heal';
    else if (p1Action === 'CHARGE') message = 'Both charge energy';
    else message = `Both use SPECIAL! P1 deals ${p1Damage}, P2 deals ${p2Damage}`;
  } else {
    const parts: string[] = [];
    if (p1Action === 'SPECIAL') parts.push(`P1 fires SPECIAL (${p1Damage} dmg)`);
    else if (p1Action === 'ATTACK') parts.push(`P1 attacks (${p2Damage > 0 ? p1Damage : 0} dmg)`);
    else if (p1Action === 'DEFEND') parts.push('P1 defends');
    else if (p1Action === 'HEAL') parts.push('P1 heals');
    else if (p1Action === 'CHARGE') parts.push('P1 charges');

    if (p2Action === 'SPECIAL') parts.push(`P2 fires SPECIAL (${p2Damage} dmg)`);
    else if (p2Action === 'ATTACK') parts.push(`P2 attacks (${p1Damage > 0 ? p1Damage : 0} dmg)`);
    else if (p2Action === 'DEFEND') parts.push('P2 defends');
    else if (p2Action === 'HEAL') parts.push('P2 heals');
    else if (p2Action === 'CHARGE') parts.push('P2 charges');

    message = parts.join(' | ') || 'Nothing happens';
  }

  p1.lastAction = p1Action;
  p2.lastAction = p2Action;

  return { p1Damage, p2Damage, message };
}
