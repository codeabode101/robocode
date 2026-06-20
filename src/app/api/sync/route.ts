import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let userId: string;
  let payload: any;
  try {
    const result = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    payload = result.payload;
    userId = payload.sub as string;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { questStage, backpack, money, position, playtime, cutsceneDone, batteryInstalled } = body;

  try {
    const email = (payload.email as string) || `${userId}@sync`;
    const name = (payload.name as string) || null;

    await db.run(sql`
      INSERT INTO users (id, email, name, password_hash, currency, playtime_seconds)
      VALUES (${userId}, ${email}, ${name}, 'migrated', 0, 0)
      ON CONFLICT (id) DO NOTHING
    `);

    if (typeof money === 'number') {
      await db.run(sql`
        UPDATE users SET currency = ${money} WHERE id = ${userId}
      `);
    }

    if (Array.isArray(backpack)) {
      await db.run(sql`
        UPDATE users SET backpack_json = ${JSON.stringify(backpack)} WHERE id = ${userId}
      `);
    }

    if (typeof playtime === 'number') {
      await db.run(sql`
        UPDATE users SET playtime_seconds = ${Math.max(0, Math.round(playtime))} WHERE id = ${userId}
      `);
    }

    if (typeof cutsceneDone === 'boolean') {
      await db.run(sql`
        UPDATE users SET cutscene_done = ${cutsceneDone ? 1 : 0} WHERE id = ${userId}
      `);
    }

    if (typeof batteryInstalled === 'boolean') {
      await db.run(sql`
        UPDATE users SET battery_installed = ${batteryInstalled ? 1 : 0} WHERE id = ${userId}
      `);
    }

    if (questStage && typeof questStage === 'string') {
      await db.run(sql`
        INSERT INTO tutorial_progress (user_id, concept, completed, completed_at)
        VALUES (${userId}, ${'_quest_' + questStage}, 1, ${new Date().toISOString()})
        ON CONFLICT (user_id, concept) DO UPDATE SET completed_at = ${new Date().toISOString()}
      `);
    }

    if (position && typeof position === 'object') {
      const safeX = Math.max(-50, Math.min(50, Number(position.x) || 0));
      const safeY = Math.max(-50, Math.min(50, Number(position.y) || 0));
      const safeRoom = ['outside', 'workshop', 'arena', 'apartment', 'shop'].includes(position.room) ? position.room : 'outside';
      const safeRotation = typeof position.rotation === 'number' ? position.rotation : null;

      await db.run(sql`
        INSERT INTO player_positions (user_id, x, y, rotation, map, updated_at)
        VALUES (${userId}, ${safeX}, ${safeY}, ${safeRotation}, ${safeRoom}, ${new Date().toISOString()})
        ON CONFLICT (user_id) DO UPDATE SET x = ${safeX}, y = ${safeY}, rotation = COALESCE(${safeRotation}, rotation), map = ${safeRoom}, updated_at = ${new Date().toISOString()}
      `);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
