import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, playerPositions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  try {
    const players = await db.select({
      user_id: playerPositions.user_id,
      x: playerPositions.x,
      y: playerPositions.y,
      name: sql`COALESCE(${users.name}, 'Robot')`,
    }).from(playerPositions)
      .leftJoin(users, eq(users.id, playerPositions.user_id));

    return NextResponse.json({ players });
  } catch (error: any) {
    console.error('Players error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
