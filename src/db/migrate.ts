import { Pool } from "pg";

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workos_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    currency INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS player_positions (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    x REAL DEFAULT 0,
    y REAL DEFAULT 0,
    map TEXT DEFAULT 'island',
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    plot_x INTEGER NOT NULL,
    plot_y INTEGER NOT NULL,
    style_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    item_type TEXT NOT NULL DEFAULT 'cosmetic',
    item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    acquired_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS concepts_unlocked (
    user_id UUID NOT NULL REFERENCES users(id),
    concept TEXT NOT NULL DEFAULT 'variables',
    unlocked_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, concept)
  );
`;

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: true,
    },
  });

  try {
    await pool.query(schema);
    console.log("Database schema created successfully");
  } catch (error) {
    console.error("Error creating schema:", error);
  } finally {
    await pool.end();
  }
}

main();
