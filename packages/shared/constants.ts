// Shared constants

export const ROBOT_MODELS = {
  robo_pup: { name: 'Robo Pup', description: 'Loyal and quick learner' },
  circuit_cat: { name: 'Circuit Cat', description: 'Agile and clever' },
  pixel_dragon: { name: 'Pixel Dragon', description: 'Powerful and rare' },
} as const;

export const RARITY_COLORS = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
} as const;

export const CONCEPTS = [
  'variables',
  'loops',
  'conditionals',
  'methods',
  'arrays',
  'oop',
  'recursion',
] as const;

export const XP_PER_LEVEL = 500;

export const BATTLE_TICK_MAX = 50;
export const BATTLE_SCRIPT_MAX_LINES = 15;
export const BATTLE_SCRIPT_MAX_CHARS = 1000;

export const STREAK_MULTIPLIERS = [
  { min: 1, max: 4, multiplier: 1 },
  { min: 5, max: 9, multiplier: 1.5 },
  { min: 10, max: 19, multiplier: 2 },
  { min: 20, max: Infinity, multiplier: 3 },
] as const;
