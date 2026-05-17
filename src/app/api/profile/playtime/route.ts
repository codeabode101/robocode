import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    userId = payload.sub as string;
  } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }

  try {
    const { seconds } = await request.json();
    if (typeof seconds !== 'number') return NextResponse.json({ error: 'Invalid' }, { status: 400 });
    await db.run(sql`
      INSERT INTO users (id, email, name, password_hash, currency, playtime_seconds)
      VALUES (${userId}, ${userId + '@playtime'}, NULL, 'migrated', 0, ${Math.max(0, Math.round(seconds))})
      ON CONFLICT (id) DO UPDATE SET playtime_seconds = ${Math.max(0, Math.round(seconds))}
    `);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Playtime save error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
