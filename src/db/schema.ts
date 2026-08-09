import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name'),
  password_hash: text('password_hash').notNull(),
  currency: integer('currency').notNull().default(0),
  backpack_json: text('backpack_json').notNull().default('[]'),
  playtime_seconds: integer('playtime_seconds').notNull().default(0),
  cutscene_done: integer('cutscene_done').notNull().default(0),
  battery_installed: integer('battery_installed').notNull().default(0),
  pending_battery_cutscene: integer('pending_battery_cutscene').notNull().default(0),
  created_at: text('created_at').notNull().default("datetime('now')"),
});

export const playerPositions = sqliteTable('player_positions', {
  user_id: text('user_id')
    .primaryKey()
    .references(() => users.id),
  x: real('x').notNull(),
  y: real('y').notNull(),
  rotation: real('rotation').default(0),
  map: text('map').notNull().default('default'),
  updated_at: text('updated_at').notNull().default("datetime('now')"),
});

export const houses = sqliteTable('houses', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  owner_id: text('owner_id')
    .notNull()
    .references(() => users.id),
  plot_x: integer('plot_x').notNull(),
  plot_y: integer('plot_y').notNull(),
  style_json: text('style_json'),
  created_at: text('created_at').notNull().default("datetime('now')"),
});

export const inventory = sqliteTable('inventory', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id),
  item_type: text('item_type').notNull(),
  item_id: text('item_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  acquired_at: text('acquired_at').notNull().default("datetime('now')"),
});

export const conceptsUnlocked = sqliteTable('concepts_unlocked', {
  user_id: text('user_id')
    .notNull()
    .references(() => users.id),
  concept: text('concept').notNull(),
  unlocked_at: text('unlocked_at').notNull().default("datetime('now')"),
}, (table) => ({
  pk: primaryKey(table.user_id, table.concept),
}));

export const friendRequests = sqliteTable('friend_requests', {
  sender_id: text('sender_id')
    .notNull()
    .references(() => users.id),
  receiver_id: text('receiver_id')
    .notNull()
    .references(() => users.id),
  status: text('status').notNull().default('pending'),
  created_at: text('created_at').notNull().default("datetime('now')"),
  updated_at: text('updated_at').notNull().default("datetime('now')"),
}, (table) => ({
  pk: primaryKey({ columns: [table.sender_id, table.receiver_id] }),
  receiverIdx: index('receiver_idx').on(table.receiver_id),
  senderIdx: index('sender_idx').on(table.sender_id),
}));

export const arenaPresence = sqliteTable('arena_presence', {
  user_id: text('user_id').primaryKey().references(() => users.id),
  joined_at: text('joined_at').notNull().default("datetime('now')"),
});

export const arenaChallenges = sqliteTable('arena_challenges', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  challenger_id: text('challenger_id').notNull().references(() => users.id),
  opponent_id: text('opponent_id').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'),
  problem: text('problem'),
  winner_id: text('winner_id').references(() => users.id),
  created_at: text('created_at').notNull().default("datetime('now')"),
  completed_at: text('completed_at'),
});

export const userXp = sqliteTable('user_xp', {
  user_id: text('user_id')
    .primaryKey()
    .references(() => users.id),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  updated_at: text('updated_at').notNull().default("datetime('now')"),
});

export const guilds = sqliteTable('guilds', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  owner_id: text('owner_id')
    .notNull()
    .references(() => users.id),
  description: text('description'),
  min_level: integer('min_level').notNull().default(1),
  created_at: text('created_at').notNull().default("datetime('now')"),
});

export const guildMembers = sqliteTable('guild_members', {
  guild_id: text('guild_id')
    .notNull()
    .references(() => guilds.id),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id),
  role: text('role').notNull().default('member'),
  joined_at: text('joined_at').notNull().default("datetime('now')"),
}, (table) => ({
  pk: primaryKey({ columns: [table.guild_id, table.user_id] }),
}));

export const guildChat = sqliteTable('guild_chat', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  guild_id: text('guild_id')
    .notNull()
    .references(() => guilds.id),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id),
  message: text('message').notNull(),
  created_at: text('created_at').notNull().default("datetime('now')"),
});

export const tutorialProgress = sqliteTable('tutorial_progress', {
  user_id: text('user_id')
    .notNull()
    .references(() => users.id),
  concept: text('concept').notNull(),
  completed: integer('completed').notNull().default(1),
  completed_at: text('completed_at').notNull().default("datetime('now')"),
}, (table) => ({
  pk: primaryKey(table.user_id, table.concept),
}));
