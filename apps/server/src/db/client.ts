import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.COCKROACHDB_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false
  }
})

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params)
  return res
}

export async function getClient() {
  return await pool.connect()
}

export default pool
