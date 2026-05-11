import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { guilds, guildMembers, userXp, guildChat } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    return payload.sub as string;
  } catch { return null; }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const guild = await db.select().from(guilds).where(eq(guilds.id, id)).limit(1).then(r => r[0]);
  if (!guild) return NextResponse.json({ error: 'Guild not found' }, { status: 404 });

  const members = await db.select({
    user_id: guildMembers.user_id,
    role: guildMembers.role,
    joined_at: guildMembers.joined_at,
    name: sql<string>`(SELECT name FROM users WHERE users.id = guild_members.user_id)`,
    level: sql<number>`(SELECT COALESCE(level, 1) FROM user_xp WHERE user_xp.user_id = guild_members.user_id)`,
  }).from(guildMembers).where(eq(guildMembers.guild_id, id));

  const memberCount = members.length;
  const myRole = members.find(m => m.user_id === userId)?.role || null;

  return NextResponse.json({ ...guild, members, memberCount, myRole });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const guild = await db.select().from(guilds).where(eq(guilds.id, id)).limit(1).then(r => r[0]);
  if (!guild) return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  if (guild.owner_id !== userId) return NextResponse.json({ error: 'Only owner can edit' }, { status: 403 });

  const { name, description, minLevel } = await request.json();
  await db.update(guilds).set({
    ...(name ? { name: name.trim() } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(minLevel ? { min_level: Math.max(1, Math.min(100, minLevel)) } : {}),
  }).where(eq(guilds.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const guild = await db.select().from(guilds).where(eq(guilds.id, id)).limit(1).then(r => r[0]);
  if (!guild) return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  if (guild.owner_id !== userId) return NextResponse.json({ error: 'Only owner can disband' }, { status: 403 });

  await db.delete(guildChat).where(eq(guildChat.guild_id, id));
  await db.delete(guildMembers).where(eq(guildMembers.guild_id, id));
  await db.delete(guilds).where(eq(guilds.id, id));

  return NextResponse.json({ ok: true });
}
