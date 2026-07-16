import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, playerPositions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
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

  let x: unknown, y: unknown, room: string = 'outside', rotation: number | null = null;
  try {
    const body = await request.json();
    x = (body as any).x;
    y = (body as any).y;
    if (typeof (body as any).room === 'string') room = (body as any).room;
    if (typeof (body as any).rotation === 'number') rotation = (body as any).rotation;
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request body' });
  }

  try {
    const now = new Date().toISOString();
    const safeX = Math.max(-50, Math.min(50, Number(x) || 0));
    const safeY = Math.max(-50, Math.min(50, Number(y) || 0));
    const safeRoom = ['outside', 'workshop', 'apartment'].includes(room) ? room : 'outside';

    // Ensure user exists
    await db.run(sql`
      INSERT INTO users (id, email, name, password_hash, currency)
      VALUES (${userId}, ${userId + '@move'}, NULL, 'migrated', 0)
      ON CONFLICT (id) DO NOTHING
    `);

    await db.run(sql`
      INSERT INTO player_positions (user_id, x, y, rotation, map, updated_at)
      VALUES (${userId}, ${safeX}, ${safeY}, ${rotation}, ${safeRoom}, ${now})
      ON CONFLICT (user_id) DO UPDATE SET x = ${safeX}, y = ${safeY}, rotation = COALESCE(${rotation}, rotation), map = ${safeRoom}, updated_at = ${now}
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Move error:', error);
    const message = error instanceof Error ? error.message : 'Unknown move error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
