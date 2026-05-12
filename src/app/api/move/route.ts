import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, playerPositions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { Apinator } from '@apinator/server';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    userId = payload.sub as string;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const { x, y } = await request.json();

  try {
    const now = new Date().toISOString();

    const safeX = Math.max(-50, Math.min(50, Number(x) || 0));
    const safeY = Math.max(-50, Math.min(50, Number(y) || 0));

    const user = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1).then(rows => rows[0]);

    await db.execute(sql`
      INSERT INTO player_positions (user_id, x, y, map, updated_at)
      VALUES (${userId}, ${safeX}, ${safeY}, 'default', ${new Date(now).toISOString()})
      ON CONFLICT (user_id) DO UPDATE SET x = ${safeX}, y = ${safeY}, updated_at = ${new Date(now).toISOString()}
    `);

    try {
      const apinator = new Apinator({
        appId: '6f9eb36b9dd488e2fef9ddf0cee08a2d4db8026f',
        key: process.env.NEXT_PUBLIC_APINATOR_APP_KEY!,
        secret: process.env.APINATOR_SECRET!,
        cluster: process.env.NEXT_PUBLIC_APINATOR_CLUSTER || 'us',
      });
      await apinator.trigger({
        name: 'player-move',
        channel: 'robocode-live',
        data: JSON.stringify({
          userId,
          x: safeX,
          y: safeY,
          name: (user as { name?: string } | null)?.name || 'Robot',
        }),
      });
    } catch (e) {
      console.error('Apinator publish error:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Move error:', error);
    const message = error instanceof Error ? error.message : 'Unknown move error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
