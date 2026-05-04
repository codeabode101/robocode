import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

function getConnectionString() {
  if (process.env.HYPERDRIVE) {
    return (process.env.HYPERDRIVE as any).connectionString;
  }
  return process.env.DATABASE_URL!;
}

async function migrate() {
  const sqlClient = postgres(getConnectionString(), { max: 1 });
  const db = drizzle(sqlClient);

  await db.execute(sql`
    DROP TABLE IF EXISTS player_positions CASCADE;
    DROP TABLE IF EXISTS houses CASCADE;
    DROP TABLE IF EXISTS inventory CASCADE;
    DROP TABLE IF EXISTS concepts_unlocked CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);

  await db.execute(sql`
    CREATE TABLE users (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255),
      password_hash VARCHAR(255) NOT NULL,
      currency INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE player_positions (
      user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id),
      x DECIMAL(10,2) NOT NULL,
      y DECIMAL(10,2) NOT NULL,
      map VARCHAR(255) NOT NULL DEFAULT 'default',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE houses (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id VARCHAR(36) NOT NULL REFERENCES users(id),
      plot_x INTEGER NOT NULL,
      plot_y INTEGER NOT NULL,
      style_json VARCHAR(2048),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE inventory (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(36) NOT NULL REFERENCES users(id),
      item_type VARCHAR(255) NOT NULL,
      item_id VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      acquired_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE concepts_unlocked (
      user_id VARCHAR(36) NOT NULL REFERENCES users(id),
      concept VARCHAR(255) NOT NULL,
      unlocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, concept)
    );
  `);

  console.log('Migration complete');
  await sqlClient.end();
}

migrate().catch(console.error);
