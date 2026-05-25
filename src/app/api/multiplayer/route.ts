import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { Apinator } from '@apinator/server';

const CHANNEL = 'private-robocode-live';

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

  let event: string, data: Record<string, unknown>;
  try {
    const body = await request.json();
    event = body.event;
    data = body.data || {};
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request body' });
  }

  if (typeof event !== 'string' || event.length === 0) {
    return NextResponse.json({ error: 'Missing event name' }, { status: 400 });
  }

  try {
    const appId = process.env.APINATOR_APP_ID;
    const key = process.env.NEXT_PUBLIC_APINATOR_APP_KEY;
    const secret = process.env.APINATOR_SECRET;
    const cluster = 'us';

    if (!appId || !key || !secret) {
      console.error('Missing Apinator server config');
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    let playerName = data.name as string | undefined;
    if (!playerName) {
      try {
        const { db } = await import('@/db');
        const { users } = await import('@/db/schema');
        const { eq } = await import('drizzle-orm');
        const rows = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
        if (rows.length > 0 && rows[0].name) playerName = rows[0].name;
      } catch { /* name not critical */ }
    }

    const client = new Apinator({ appId, key, secret, cluster });
    const enriched = { ...data, userId, name: playerName || '' };

    await client.trigger({
      name: event,
      channel: CHANNEL,
      data: JSON.stringify(enriched),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Multiplayer trigger error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
