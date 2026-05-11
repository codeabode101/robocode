import { pgTable, varchar, text, integer, timestamp, numeric, primaryKey, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  currency: integer('currency').notNull().default(0),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const playerPositions = pgTable('player_positions', {
  user_id: varchar('user_id', { length: 36 })
    .primaryKey()
    .references(() => users.id),
  x: numeric('x', { precision: 10, scale: 2 }).notNull(),
  y: numeric('y', { precision: 10, scale: 2 }).notNull(),
  map: varchar('map', { length: 255 }).notNull().default('default'),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const houses = pgTable('houses', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  owner_id: varchar('owner_id', { length: 36 })
    .notNull()
    .references(() => users.id),
  plot_x: integer('plot_x').notNull(),
  plot_y: integer('plot_y').notNull(),
  style_json: text('style_json'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const inventory = pgTable('inventory', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.id),
  item_type: varchar('item_type', { length: 255 }).notNull(),
  item_id: varchar('item_id', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  acquired_at: timestamp('acquired_at').notNull().defaultNow(),
});

export const conceptsUnlocked = pgTable('concepts_unlocked', {
  user_id: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.id),
  concept: varchar('concept', { length: 255 }).notNull(),
  unlocked_at: timestamp('unlocked_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey(table.user_id, table.concept),
}));

export const friendRequests = pgTable('friend_requests', {
  sender_id: varchar('sender_id', { length: 36 })
    .notNull()
    .references(() => users.id),
  receiver_id: varchar('receiver_id', { length: 36 })
    .notNull()
    .references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.sender_id, table.receiver_id] }),
  receiverIdx: index().on(table.receiver_id),
  senderIdx: index().on(table.sender_id),
}));

export const tutorialProgress = pgTable('tutorial_progress', {
  user_id: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.id),
  concept: varchar('concept', { length: 255 }).notNull(),
  completed: integer('completed').notNull().default(1),
  completed_at: timestamp('completed_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey(table.user_id, table.concept),
}));
