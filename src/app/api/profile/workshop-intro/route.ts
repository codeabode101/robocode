import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { tutorialProgress } from '@/db/schema';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    userId = payload.sub as string;
  } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }
  try {
    await db.execute(sql`
      INSERT INTO tutorial_progress (user_id, concept, completed, completed_at)
      VALUES (${userId}, '_workshop_intro', 1, ${new Date().toISOString()})
      ON CONFLICT (user_id, concept) DO NOTHING
    `);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Workshop intro save error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
