import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    userId = payload.sub as string;
  } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }
  const { stage } = await request.json();
  if (!stage) return NextResponse.json({ error: 'Missing stage' }, { status: 400 });
  try {
    await db.execute(sql`
      INSERT INTO tutorial_progress (user_id, concept, completed, completed_at)
      VALUES (${userId}, ${'_quest_' + stage}, 1, ${new Date().toISOString()})
      ON CONFLICT (user_id, concept) DO UPDATE SET completed_at = ${new Date().toISOString()}
    `);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Quest save error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
