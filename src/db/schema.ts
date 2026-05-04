import { sql } from 'drizzle-orm';
import { pgTable, varchar, timestamp, integer, decimal, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workos_id: varchar('workos_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  currency: integer('currency').notNull().default(0),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const playerPositions = pgTable('player_positions', {
  user_id: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  x: decimal('x', { precision: 10, scale: 2 }).notNull(),
  y: decimal('y', { precision: 10, scale: 2 }).notNull(),
  map: varchar('map', { length: 255 }).notNull().default('default'),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey(table.user_id),
}));

export const houses = pgTable('houses', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  owner_id: varchar('owner_id', { length: 36 }).notNull().references(() => users.id),
  plot_x: integer('plot_x').notNull(),
  plot_y: integer('plot_y').notNull(),
  style_json: varchar('style_json', { length: 2048 }),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const inventory = pgTable('inventory', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  item_type: varchar('item_type', { length: 255 }).notNull(),
  item_id: varchar('item_id', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  acquired_at: timestamp('acquired_at').notNull().defaultNow(),
});

export const conceptsUnlocked = pgTable('concepts_unlocked', {
  user_id: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  concept: varchar('concept', { length: 255 }).notNull(),
  unlocked_at: timestamp('unlocked_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey(table.user_id, table.concept),
}));
