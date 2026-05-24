import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, tutorialProgress, playerPositions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    const userId = payload.sub as string;

    let user = await db.select({
      name: users.name,
      email: users.email,
      currency: users.currency,
      playtime_seconds: users.playtime_seconds,
      backpack_json: users.backpack_json,
    }).from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);

    // Auto-create user record if missing (e.g., after migration reset)
    if (!user) {
      const email = (payload.email as string) || `${userId}@temp`;
      const name = (payload.name as string) || null;
      await db.run(sql`
        INSERT INTO users (id, email, name, password_hash, currency)
        VALUES (${userId}, ${email}, ${name}, 'migrated', 0)
        ON CONFLICT (id) DO NOTHING
      `);
      user = { name, email, currency: 0, playtime_seconds: 0, backpack_json: '[]' };
    }

    const tutorials = await db.select({ concept: tutorialProgress.concept })
      .from(tutorialProgress).where(eq(tutorialProgress.user_id, userId));

    const concepts = tutorials.map(t => t.concept);
    let questStage = concepts.find(c => c.startsWith('_quest_'))?.replace('_quest_', '') || 'intro';

    // Server-side reset for old/migrated quest stages — happens before returning data
    const resetStages = ['earn-money', 'buy-chai', 'gift-ready', 'done', 'grind1', 'grind2', 'grind3', 'arena-ready'];
    if (resetStages.includes(questStage)) {
      await db.delete(tutorialProgress).where(eq(tutorialProgress.user_id, userId));
      await db.run(sql`UPDATE users SET currency = 0, backpack_json = '[]' WHERE id = ${userId}`);
      user.currency = 0;
      user.backpack_json = '[]';
      questStage = 'unit1-done';
    }

    let backpack: string[] = [];
    try { backpack = JSON.parse(user.backpack_json || '[]'); } catch { backpack = []; }

    const pos = await db.select({ x: playerPositions.x, y: playerPositions.y, map: playerPositions.map })
      .from(playerPositions).where(eq(playerPositions.user_id, userId)).limit(1).then(r => r[0]);

    return NextResponse.json({
      name: user.name,
      email: user.email,
      currency: user.currency,
      playtime_seconds: user.playtime_seconds,
      tutorials: concepts,
      questStage,
      workshopIntroDone: concepts.includes('_workshop_intro'),
      backpack,
      position: pos ? { x: pos.x, y: pos.y, room: pos.map } : null,
    });
  } catch (err) {
    console.error('Profile load error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
