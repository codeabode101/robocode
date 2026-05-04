// Extend CloudflareEnv to include custom bindings
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}
