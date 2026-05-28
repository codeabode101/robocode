import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, tutorialProgress, playerPositions, userXp } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

function calcLevel(xp: number) {
  const xpForLevel = (lvl: number) => 50 * lvl * (lvl + 1);
  let level = 1;
  while (xp >= xpForLevel(level)) level++;
  const currentLevelXp = xpForLevel(level - 1);
  const nextLevelXp = xpForLevel(level);
  return {
    level: level - 1,
    xp,
    xpToNext: nextLevelXp - xp,
    xpForCurrent: currentLevelXp,
    xpForNext: nextLevelXp,
    progress: (xp - currentLevelXp) / (nextLevelXp - currentLevelXp),
  };
}

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

    // Ensure position row exists (eliminates separate /api/join call)
    const pos = await db.select({ x: playerPositions.x, y: playerPositions.y, rotation: playerPositions.rotation, map: playerPositions.map })
      .from(playerPositions).where(eq(playerPositions.user_id, userId)).limit(1).then(r => r[0]);
    if (!pos) {
      await db.run(sql`INSERT INTO player_positions (user_id, x, y, rotation, map, updated_at) VALUES (${userId}, 0, 0, 0, 'outside', ${new Date().toISOString()})`);
    }

    // Load XP/level (avoids separate /api/xp fetch from modal/profile page)
    let xpRecord = await db.select({ xp: userXp.xp }).from(userXp).where(eq(userXp.user_id, userId)).limit(1).then(r => r[0]);
    if (!xpRecord) {
      xpRecord = await db.insert(userXp).values({ user_id: userId }).returning({ xp: userXp.xp }).then(r => r[0]);
    }
    const xpData = calcLevel(xpRecord.xp);

    return NextResponse.json({
      name: user.name,
      email: user.email,
      currency: user.currency,
      playtime_seconds: user.playtime_seconds,
      tutorials: concepts,
      questStage,
      workshopIntroDone: concepts.includes('_workshop_intro'),
      backpack,
      position: pos ? { x: pos.x, y: pos.y, room: pos.map, rotation: pos.rotation } : null,
      xp: xpData,
    });
  } catch (err) {
    console.error('Profile load error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
