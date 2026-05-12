import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { createHmac } from 'crypto';

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

  const secret = process.env.APINATOR_SECRET!;
  const key = process.env.NEXT_PUBLIC_APINATOR_APP_KEY!;
  const signature = createHmac('sha256', secret)
    .update(`${socketId}:${channelName}`)
    .digest('hex');

  return NextResponse.json({ auth: `${key}:${signature}` });
}
