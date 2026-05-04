import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { playerPositions } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

  const { x, y } = await request.json();

  // Publish to Apinator
  const apinatorRes = await fetch('https://api.apinator.io/v1/publish', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.APINATOR_SECRET!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: 'robocode-live',
      event: 'player-move',
      data: { userId, x: Number(x), y: Number(y) },
    }),
  });

  if (!apinatorRes.ok) {
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
  }

  // Update player position in DB
  await db.insert(playerPositions)
    .values({ user_id: userId, x, y, map: 'default' })
    .onConflictDoUpdate({
      target: playerPositions.user_id,
      set: { x, y, updated_at: new Date() },
    });

  return NextResponse.json({ success: true });
}
