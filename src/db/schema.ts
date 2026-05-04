import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password_hash: text('password_hash').notNull(),
  currency: integer('currency').notNull().default(0),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const playerPositions = sqliteTable('player_positions', {
  user_id: text('user_id').primaryKey().references(() => users.id),
  x: real('x').notNull(),
  y: real('y').notNull(),
  map: text('map').notNull().default('default'),
  updated_at: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const houses = sqliteTable('houses', {
  id: text('id').primaryKey(),
  owner_id: text('owner_id').notNull().references(() => users.id),
  plot_x: integer('plot_x').notNull(),
  plot_y: integer('plot_y').notNull(),
  style_json: text('style_json'),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const inventory = sqliteTable('inventory', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id),
  item_type: text('item_type').notNull(),
  item_id: text('item_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  acquired_at: text('acquired_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const conceptsUnlocked = sqliteTable('concepts_unlocked', {
  user_id: text('user_id').notNull().references(() => users.id),
  concept: text('concept').notNull(),
  unlocked_at: text('unlocked_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  pk: primaryKey(table.user_id, table.concept),
}));
