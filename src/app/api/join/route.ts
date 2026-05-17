import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, playerPositions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userId: string;
  let payload: any;
  try {
    const result = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.WORKOS_API_KEY!)
    );
    payload = result.payload;
    userId = payload.sub as string;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  try {
    const { x, y } = await request.json();
    const now = new Date().toISOString();
    const safeX = Number(x) || 0;
    const safeY = Number(y) || 0;

    await db.run(sql`
      INSERT INTO player_positions (user_id, x, y, map, updated_at)
      VALUES (${userId}, ${safeX}, ${safeY}, 'default', ${now})
      ON CONFLICT (user_id) DO UPDATE SET x = ${safeX}, y = ${safeY}, updated_at = ${now}
    `);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Join error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
