import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { userXp } from '@/db/schema';
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

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    return payload.sub as string;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let record = await db.select().from(userXp).where(eq(userXp.user_id, userId)).limit(1).then(r => r[0]);
  if (!record) {
    record = await db.insert(userXp).values({ user_id: userId }).returning().then(r => r[0]);
  }

  return NextResponse.json(calcLevel(record.xp));
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount } = await request.json();
  if (!amount || typeof amount !== 'number') return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

  const record = await db.insert(userXp)
    .values({ user_id: userId, xp: amount })
    .onConflictDoUpdate({ target: userXp.user_id, set: { xp: sql`user_xp.xp + ${amount}`, updated_at: new Date().toISOString() } })
    .returning()
    .then(r => r[0]);

  return NextResponse.json(calcLevel(record.xp));
}
