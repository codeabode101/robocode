import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(D1: any) {
  return drizzle(D1, { schema });
}

export * from './schema';
