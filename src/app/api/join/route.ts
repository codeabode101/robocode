import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userId: string;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.WORKOS_API_KEY!)
    );
    userId = payload.sub as string;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  try {
    const { x, y } = await request.json();
    const { env } = await getCloudflareContext({ async: true }) as any;
    const db = env.DB;
    const now = new Date().toISOString();
    const safeX = Number(x) || 0;
    const safeY = Number(y) || 0;

    const user = await db
      .prepare('SELECT name FROM users WHERE id = ?')
      .bind(userId)
      .first();

    await db.prepare(`
      INSERT INTO player_positions (user_id, x, y, map, updated_at)
      VALUES (?, ?, ?, 'default', ?)
      ON CONFLICT(user_id) DO UPDATE SET x=?, y=?, updated_at=?
    `).bind(userId, safeX, safeY, now, safeX, safeY, now).run();

    const publishResponse = await fetch('https://api.apinator.io/v1/publish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.APINATOR_SECRET!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'robocode-live',
        name: 'player-join',
        data: JSON.stringify({
          userId,
          x: safeX,
          y: safeY,
          name: (user as { name?: string } | null)?.name || 'Unknown',
        }),
      }),
    });

    if (!publishResponse.ok) {
      const body = await publishResponse.text();
      throw new Error(`Apinator publish failed: ${publishResponse.status} ${body}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Join error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
