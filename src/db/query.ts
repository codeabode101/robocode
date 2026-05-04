const ACCOUNT_ID = '0bfab51e8cc50b91033dc21005e8cabc';
const DATABASE_ID = 'e38992dc-81cf-476e-bd60-c2911cfb88a7';

export async function queryD1(sql: string, params: any[] = []) {
  const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
  
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    }
  );
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}
