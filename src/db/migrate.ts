/**
 * Database migration.
 *
 * The app now uses Cloudflare D1 (SQLite). Run migrations via:
 *   wrangler d1 execute robocode --file=migrations/<<file>>.sql
 *
 * To add a column:
 *   1. Add it to src/db/schema.ts
 *   2. Create a new SQL file in migrations/ with ALTER TABLE ADD COLUMN
 *   3. Run: wrangler d1 execute robocode --file=migrations/<<file>>.sql
 *
 * This file is kept for reference but no longer runs the migration.
 * D1 tables are created via migrations/001_init.sql (already applied).
 */

console.log('Migrate is no longer used. Apply D1 migrations with wrangler d1 execute.');
