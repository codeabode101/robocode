import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || process.env.COCKROACHDB_CONNECTION_STRING!;
const sqlClient = postgres(connectionString, {
  connect_timeout: 15,
  max: 3,
  idle_timeout: 10,
  max_lifetime: 30,
});
export const db = drizzle(sqlClient, { schema });

export * from './schema';
