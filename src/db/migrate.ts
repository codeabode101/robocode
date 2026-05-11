import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

async function migrate() {
  const sqlClient = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(sqlClient);

  await db.execute(sql`
    DROP TABLE IF EXISTS player_positions CASCADE;
    DROP TABLE IF EXISTS houses CASCADE;
    DROP TABLE IF EXISTS inventory CASCADE;
    DROP TABLE IF EXISTS arena_challenges CASCADE;
    DROP TABLE IF EXISTS arena_presence CASCADE;
    DROP TABLE IF EXISTS friend_requests CASCADE;
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

  await db.execute(sql`
    CREATE TABLE arena_presence (
      user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id),
      joined_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE arena_challenges (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      challenger_id VARCHAR(36) NOT NULL REFERENCES users(id),
      opponent_id VARCHAR(36) NOT NULL REFERENCES users(id),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      problem TEXT,
      winner_id VARCHAR(36) REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
    );

    CREATE TABLE friend_requests (
      sender_id VARCHAR(36) NOT NULL REFERENCES users(id),
      receiver_id VARCHAR(36) NOT NULL REFERENCES users(id),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (sender_id, receiver_id)
    );
    CREATE INDEX IF NOT EXISTS friend_requests_receiver_idx ON friend_requests(receiver_id);
    CREATE INDEX IF NOT EXISTS friend_requests_sender_idx ON friend_requests(sender_id);

    CREATE TABLE tutorial_progress (
      user_id VARCHAR(36) NOT NULL REFERENCES users(id),
      concept VARCHAR(255) NOT NULL,
      completed INTEGER NOT NULL DEFAULT 1,
      completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, concept)
    );
  `);

  console.log('Migration complete');
  await sqlClient.end();
}

migrate().catch(console.error);
