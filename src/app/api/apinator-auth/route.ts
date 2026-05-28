import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { authenticateChannel } from '@apinator/server';

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

  const { socket_id: socketId, channel_name: channelName } = await request.json();

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
  }

  const secret = process.env.APINATOR_SECRET;
  const key = process.env.NEXT_PUBLIC_APINATOR_APP_KEY;

  if (!secret || !key) {
    console.error('Auth config missing:', { hasSecret: !!secret, hasKey: !!key });
    return NextResponse.json({ error: 'Server config error' }, { status: 500 });
  }

  const result = authenticateChannel(secret, key, socketId, channelName);

  return NextResponse.json({ auth: result.auth });
}
