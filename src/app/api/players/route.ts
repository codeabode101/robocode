import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  try {
    const { env } = await getCloudflareContext({ async: true }) as any;
    const db = env.DB;

    const players = await db.prepare(
      'SELECT user_id, x, y FROM player_positions'
    ).all();

    return NextResponse.json({ players: players.results || [] });
  } catch (error: any) {
    console.error('Players error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
