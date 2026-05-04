
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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

  try {
    const { env } = await getCloudflareContext({ async: true }) as any;
    const db = env.DB;

    // Upsert player position
    await db.prepare(`
      INSERT INTO player_positions (user_id, x, y, map, updated_at) 
      VALUES (?, ?, ?, 'default', ?) 
      ON CONFLICT(user_id) DO UPDATE SET x=?, y=?, updated_at=?
    `).bind(userId, x, y, new Date().toISOString(), x, y, new Date().toISOString()).run();

    // Publish to Apinator via REST API
    await fetch('https://api.apinator.io/v1/publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.APINATOR_SECRET!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'robocode-live',
        name: 'player-move',
        data: JSON.stringify({ userId, x: Number(x), y: Number(y) }),
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Move error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
