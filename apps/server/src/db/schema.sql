-- USERS & AUTH
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workos_user_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PLAYER PROFILE (one-to-one with users) - ROBOT THEMED
CREATE TABLE IF NOT EXISTS player_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  robot_name TEXT NOT NULL,                  -- Named during onboarding (was pet_name)
  robot_model TEXT NOT NULL DEFAULT 'robo_pup', -- (was pet_species)
  avatar_url TEXT,
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  coins INT NOT NULL DEFAULT 100,
  gems INT NOT NULL DEFAULT 0,             -- Premium currency (earned only, never purchased)
  house_theme TEXT NOT NULL DEFAULT 'starter_base',
  battle_wins INT NOT NULL DEFAULT 0,
  battle_losses INT NOT NULL DEFAULT 0,
  story_chapter INT NOT NULL DEFAULT 1,
  story_quest INT NOT NULL DEFAULT 1,
  last_daily_claim DATE,
  streak_days INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- APCSA CONCEPT MASTERY (per-concept progress)
CREATE TABLE IF NOT EXISTS concept_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,                   -- e.g. 'variables', 'loops', 'arrays'
  questions_seen INT NOT NULL DEFAULT 0,
  questions_correct INT NOT NULL DEFAULT 0,
  mastery_level INT NOT NULL DEFAULT 0,    -- 0-5
  last_practiced TIMESTAMPTZ,
  UNIQUE(user_id, concept)
);

-- INVENTORY
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,                   -- references item catalog
  item_type TEXT NOT NULL,                 -- 'cosmetic', 'upgrade', 'consumable'
  equipped BOOLEAN NOT NULL DEFAULT false,
  acquired_at TIMESTAMPTZ DEFAULT now()
);

-- ITEM CATALOG (static seed data) - ROBOT ACCESSORIES
CREATE TABLE IF NOT EXISTS item_catalog (
  item_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  item_type TEXT NOT NULL,
  cost_coins INT NOT NULL DEFAULT 0,
  cost_gems INT NOT NULL DEFAULT 0,
  rarity TEXT NOT NULL DEFAULT 'common',   -- common, rare, epic, legendary
  unlocks_at_level INT NOT NULL DEFAULT 1,
  preview_url TEXT
);

-- BATTLE SCRIPTS (player-written pre-battle code)
CREATE TABLE IF NOT EXISTS battle_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  script_name TEXT NOT NULL DEFAULT 'My Script',
  script_body TEXT NOT NULL,               -- raw DSL text, max 1000 chars
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- MATCHES
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES users(id),
  player2_id UUID NOT NULL REFERENCES users(id),
  winner_id UUID REFERENCES users(id),
  player1_script_snapshot TEXT NOT NULL,  -- copy at time of battle
  player2_script_snapshot TEXT NOT NULL,
  replay_log JSONB NOT NULL,              -- full tick-by-tick battle log
  coins_wagered INT NOT NULL DEFAULT 0,
  duration_ticks INT NOT NULL,
  played_at TIMESTAMPTZ DEFAULT now()
);

-- STORY PROGRESS
CREATE TABLE IF NOT EXISTS story_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter INT NOT NULL,
  quest INT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  UNIQUE(user_id, chapter, quest)
);

-- DAILY CHALLENGE LOG
CREATE TABLE IF NOT EXISTS daily_challenge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  score INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, challenge_date)
);

-- LEADERBOARD (materialized weekly snapshot, refreshed via cron)
CREATE TABLE IF NOT EXISTS leaderboard_weekly (
  rank INT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  username TEXT NOT NULL,
  robot_name TEXT NOT NULL,               -- (was pet_name)
  score INT NOT NULL,                      -- composite: wins + xp gained this week
  week_start DATE NOT NULL,
  PRIMARY KEY (week_start, user_id)
);

-- TRANSACTION LOG (immutable audit trail for economy)
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  delta INT NOT NULL,                      -- positive = earned, negative = spent
  reason TEXT NOT NULL,                    -- 'story_quest', 'pvp_win', 'shop_purchase', etc.
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
