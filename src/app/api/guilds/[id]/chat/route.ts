import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { guildChat, guildMembers } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    return payload.sub as string;
  } catch { return null; }
}

async function checkMember(guildId: string, userId: string) {
  const member = await db.select().from(guildMembers)
    .where(sql`${guildMembers.guild_id} = ${guildId} AND ${guildMembers.user_id} = ${userId}`)
    .limit(1).then(r => r[0]);
  return !!member;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: guildId } = await params;

  const isMember = await checkMember(guildId, userId);
  if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const messages = await db.select({
    id: guildChat.id,
    user_id: guildChat.user_id,
    message: guildChat.message,
    created_at: guildChat.created_at,
    name: sql<string>`(SELECT name FROM users WHERE users.id = guild_chat.user_id)`,
  }).from(guildChat)
    .where(eq(guildChat.guild_id, guildId))
    .orderBy(desc(guildChat.created_at))
    .limit(50);

  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: guildId } = await params;

  const isMember = await checkMember(guildId, userId);
  if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const { message } = await request.json();
  if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  const msg = await db.insert(guildChat).values({
    guild_id: guildId,
    user_id: userId,
    message: message.trim(),
  }).returning().then(r => r[0]);

  return NextResponse.json(msg);
}
