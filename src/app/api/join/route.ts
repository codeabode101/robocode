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
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.WORKOS_API_KEY!)
    );
    userId = payload.sub as string;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  try {
    const { x, y } = await request.json();
    const now = new Date().toISOString();
    const safeX = Number(x) || 0;
    const safeY = Number(y) || 0;

    const user = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1).then(rows => rows[0]);

    await db.execute(sql`
      INSERT INTO player_positions (user_id, x, y, map, updated_at)
      VALUES (${userId}, ${safeX}, ${safeY}, 'default', ${new Date(now).toISOString()})
      ON CONFLICT (user_id) DO UPDATE SET x = ${safeX}, y = ${safeY}, updated_at = ${new Date(now).toISOString()}
    `);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Join error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
