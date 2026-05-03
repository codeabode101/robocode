import { pgTable, uuid, text, integer, timestamp, real, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workosId: text("workos_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  currency: integer("currency").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerPositions = pgTable("player_positions", {
  userId: uuid("user_id").references(() => users.id).primaryKey(),
  x: real("x").default(0),
  y: real("y").default(0),
  map: text("map").default("island"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const houses = pgTable("houses", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  plotX: integer("plot_x").notNull(),
  plotY: integer("plot_y").notNull(),
  styleJson: jsonb("style_json").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  itemType: text("item_type").default("cosmetic"),
  itemId: text("item_id").notNull(),
  quantity: integer("quantity").default(1),
  acquiredAt: timestamp("acquired_at").defaultNow(),
});

export const conceptsUnlocked = pgTable(
  "concepts_unlocked",
  {
    userId: uuid("user_id").references(() => users.id),
    concept: text("concept").default("variables"),
    unlockedAt: timestamp("unlocked_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.concept] }),
  })
);
