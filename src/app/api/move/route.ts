
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

type PreparedStatement = {
  bind: (...params: unknown[]) => {
    run: () => Promise<unknown>;
    first: () => Promise<unknown>;
  };
};

type D1DatabaseLike = {
  prepare: (query: string) => PreparedStatement;
};

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
    const { env } = (await getCloudflareContext({ async: true })) as unknown as { env: { DB: D1DatabaseLike } };
    const db = env.DB;
    const now = new Date().toISOString();

    const safeX = Math.max(-50, Math.min(50, Number(x) || 0));
    const safeY = Math.max(-50, Math.min(50, Number(y) || 0));

    const user = await db
      .prepare('SELECT name FROM users WHERE id = ?')
      .bind(userId)
      .first();

    // Upsert player position
    await db.prepare(`
      INSERT INTO player_positions (user_id, x, y, map, updated_at) 
      VALUES (?, ?, ?, 'default', ?) 
      ON CONFLICT(user_id) DO UPDATE SET x=?, y=?, updated_at=?
    `).bind(userId, safeX, safeY, now, safeX, safeY, now).run();

    // Publish to Apinator via REST API
    const publishResponse = await fetch('https://api.apinator.io/v1/publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.APINATOR_SECRET!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'robocode-live',
        name: 'player-move',
        data: JSON.stringify({
          userId,
          x: safeX,
          y: safeY,
          name: (user as { name?: string } | null)?.name || 'Robot',
        }),
      }),
    });

    if (!publishResponse.ok) {
      const body = await publishResponse.text();
      throw new Error(`Apinator publish failed: ${publishResponse.status} ${body}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Move error:', error);
    const message = error instanceof Error ? error.message : 'Unknown move error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
