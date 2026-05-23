import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { users } from '@/db/schema';
import { db } from '@/db';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    const userId = payload.sub as string;
    const { items } = await request.json() as { items: string[] };
    const json = JSON.stringify(items);

    await db.run(sql`
      UPDATE users SET backpack_json = ${json} WHERE id = ${userId}
    `);

    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error('Inventory save error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
