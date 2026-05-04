import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
  });
  const db = drizzle(pool);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      workos_id VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255),
      currency INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS player_positions (
      user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id),
      x DECIMAL(10,2) NOT NULL,
      y DECIMAL(10,2) NOT NULL,
      map VARCHAR(255) NOT NULL DEFAULT 'default',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS houses (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id VARCHAR(36) NOT NULL REFERENCES users(id),
      plot_x INTEGER NOT NULL,
      plot_y INTEGER NOT NULL,
      style_json VARCHAR(2048),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventory (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(36) NOT NULL REFERENCES users(id),
      item_type VARCHAR(255) NOT NULL,
      item_id VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      acquired_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS concepts_unlocked (
      user_id VARCHAR(36) NOT NULL REFERENCES users(id),
      concept VARCHAR(255) NOT NULL,
      unlocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, concept)
    );
  `);

  console.log('Migration complete');
  await pool.end();
}

migrate().catch(console.error);
