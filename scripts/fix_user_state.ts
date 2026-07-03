import { Pool } from 'pg';

const DB_URL = 'postgresql://code:gFEiFrv4EqU3VdlO7_lNtw@canine-mouse-25718.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=require';

async function main() {
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, email, currency, backpack_json FROM users WHERE currency > 0 ORDER BY currency DESC LIMIT 20');
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => console.error(e));
