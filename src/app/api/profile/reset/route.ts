import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, tutorialProgress, userXp, playerPositions, inventory, conceptsUnlocked } from '@/db/schema';
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
  try {
    await db.delete(tutorialProgress).where(eq(tutorialProgress.user_id, userId));
    await db.delete(userXp).where(eq(userXp.user_id, userId));
    await db.delete(playerPositions).where(eq(playerPositions.user_id, userId));
    await db.delete(inventory).where(eq(inventory.user_id, userId));
    await db.delete(conceptsUnlocked).where(eq(conceptsUnlocked.user_id, userId));
    await db.run(sql`UPDATE users SET currency = 0, backpack_json = '[]', playtime_seconds = 0, cutscene_done = 0, battery_installed = 0 WHERE id = ${userId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
