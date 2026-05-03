// Shared types between web and server

export interface User {
  id: string;
  workos_user_id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface PlayerProfile {
  user_id: string;
  display_name: string;
  robot_name: string;          // was pet_name
  robot_model: string;         // was pet_species
  avatar_url?: string;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  house_theme: string;
  battle_wins: number;
  battle_losses: number;
  story_chapter: number;
  story_quest: number;
  last_daily_claim?: string;
  streak_days: number;
}

export interface ConceptMastery {
  id: string;
  user_id: string;
  concept: string;
  questions_seen: number;
  questions_correct: number;
  mastery_level: number;
  last_practiced?: string;
}

export interface ItemCatalog {
  item_id: string;
  name: string;
  description: string;
  item_type: string;
  cost_coins: number;
  cost_gems: number;
  rarity: string;
  unlocks_at_level: number;
  preview_url?: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  item_id: string;
  item_type: string;
  equipped: boolean;
  acquired_at: string;
}

export interface BattleScript {
  id: string;
  user_id: string;
  script_name: string;
  script_body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id?: string;
  player1_script_snapshot: string;
  player2_script_snapshot: string;
  replay_log: ReplayLog;
  coins_wagered: number;
  duration_ticks: number;
  played_at: string;
}

export interface ReplayLog {
  ticks: TickRecord[];
  winner: 1 | 2 | null;
  totalTicks: number;
}

export interface TickRecord {
  tick: number;
  p1Action: string;
  p2Action: string;
  p1HpBefore: number;
  p2HpBefore: number;
  p1HpAfter: number;
  p2HpAfter: number;
  p1ShieldAfter: number;
  p2ShieldAfter: number;
  p1ManaAfter: number;
  p2ManaAfter: number;
  narrative: string;
}

export interface Question {
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'ap_exam';
  prompt: string;
  correctAnswer: string;
  choices: string[];
  explanation: string;
}

export interface StoryQuest {
  chapter: number;
  quest: number;
  title: string;
  cutscene: string[];
  concept: string;
  questions: Question[];
  rewards: {
    xp: number;
    coins: number;
  };
}

export type RobotModel = 'robo_pup' | 'circuit_cat' | 'pixel_dragon';
