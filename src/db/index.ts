import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    const { env } = getCloudflareContext();
    _db = drizzle((env as any).DB, { schema });
  }
  return _db;
}

type DrizzleWithRun = ReturnType<typeof drizzle> & {
  run: (query: any, ...params: any[]) => any;
};

export const db: DrizzleWithRun = new Proxy({} as any, {
  get(_, prop) {
    const d = getDb();
    const val = (d as any)[prop];
    if (typeof val === 'function') {
      return (...args: any[]) => (val as Function).apply(d, args);
    }
    return val;
  },
});

export * from './schema';
