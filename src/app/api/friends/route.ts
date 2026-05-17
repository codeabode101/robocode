import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, friendRequests } from '@/db/schema';
import { eq, or, and, sql, not, like } from 'drizzle-orm';

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    return payload.sub as string;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (q) {
    const results = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(and(
        not(eq(users.id, userId)),
        like(users.name, `%${q}%`)
      ))
      .limit(10);
    return NextResponse.json({ users: results });
  }

  const sent = await db.select({
    receiverId: friendRequests.receiver_id,
    status: friendRequests.status,
    name: users.name,
  }).from(friendRequests)
    .innerJoin(users, eq(friendRequests.receiver_id, users.id))
    .where(eq(friendRequests.sender_id, userId));

  const received = await db.select({
    senderId: friendRequests.sender_id,
    status: friendRequests.status,
    name: users.name,
  }).from(friendRequests)
    .innerJoin(users, eq(friendRequests.sender_id, users.id))
    .where(eq(friendRequests.receiver_id, userId));

  return NextResponse.json({ sent, received });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { friendId, action } = await request.json();
  if (!friendId || !action) return NextResponse.json({ error: 'Missing friendId or action' }, { status: 400 });

  try {
    switch (action) {
      case 'send': {
        if (friendId === userId) return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 });
        await db.insert(friendRequests).values({
          sender_id: userId,
          receiver_id: friendId,
          status: 'pending',
        });
        return NextResponse.json({ ok: true });
      }
      case 'accept': {
        await db.update(friendRequests).set({ status: 'accepted', updated_at: new Date().toISOString() })
          .where(and(
            eq(friendRequests.sender_id, friendId),
            eq(friendRequests.receiver_id, userId),
            eq(friendRequests.status, 'pending')
          ));
        return NextResponse.json({ ok: true });
      }
      case 'reject': {
        await db.update(friendRequests).set({ status: 'rejected', updated_at: new Date().toISOString() })
          .where(and(
            eq(friendRequests.sender_id, friendId),
            eq(friendRequests.receiver_id, userId),
            eq(friendRequests.status, 'pending')
          ));
        return NextResponse.json({ ok: true });
      }
      case 'remove': {
        await db.delete(friendRequests)
          .where(or(
            and(eq(friendRequests.sender_id, userId), eq(friendRequests.receiver_id, friendId)),
            and(eq(friendRequests.sender_id, friendId), eq(friendRequests.receiver_id, userId))
          ));
        return NextResponse.json({ ok: true });
      }
      case 'cancel': {
        await db.delete(friendRequests)
          .where(and(
            eq(friendRequests.sender_id, userId),
            eq(friendRequests.receiver_id, friendId),
            eq(friendRequests.status, 'pending')
          ));
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    if (error?.code === '23505') return NextResponse.json({ error: 'Request already sent' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
