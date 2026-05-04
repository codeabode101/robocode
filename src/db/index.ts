import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function getConnectionString() {
  if (process.env.HYPERDRIVE) {
    return (process.env.HYPERDRIVE as any).connectionString;
  }
  return process.env.DATABASE_URL!;
}

const sql = postgres(getConnectionString());
export const db = drizzle(sql, { schema });
export * from './schema';
