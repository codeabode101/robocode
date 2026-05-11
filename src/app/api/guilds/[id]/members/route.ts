import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { guilds, guildMembers, guildChat, userXp } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    return payload.sub as string;
  } catch { return null; }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: guildId } = await params;
  const { action } = await request.json();

  const guild = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1).then(r => r[0]);
  if (!guild) return NextResponse.json({ error: 'Guild not found' }, { status: 404 });

  if (action === 'join') {
    const existing = await db.select().from(guildMembers)
      .where(and(eq(guildMembers.guild_id, guildId), eq(guildMembers.user_id, userId)))
      .limit(1).then(r => r[0]);
    if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 400 });

    const membershipCount = await db.select({ count: sql<number>`COUNT(*)` })
      .from(guildMembers).where(eq(guildMembers.user_id, userId))
      .then(r => r[0].count);
    if (membershipCount >= 3) return NextResponse.json({ error: 'Max 3 guilds' }, { status: 400 });

    const xpRecord = await db.select().from(userXp).where(eq(userXp.user_id, userId)).limit(1).then(r => r[0]);
    const userLevel = xpRecord?.level ?? 1;
    if (userLevel < guild.min_level) {
      return NextResponse.json({ error: `Need level ${guild.min_level}+ to join` }, { status: 400 });
    }

    await db.insert(guildMembers).values({ guild_id: guildId, user_id: userId });
    return NextResponse.json({ ok: true });
  }

  if (action === 'leave') {
    if (guild.owner_id === userId) {
      const memberCount = await db.select({ count: sql<number>`COUNT(*)` })
        .from(guildMembers).where(eq(guildMembers.guild_id, guildId))
        .then(r => r[0].count);
      if (memberCount <= 1) {
        await db.delete(guildChat).where(eq(guildChat.guild_id, guildId));
        await db.delete(guildMembers).where(eq(guildMembers.guild_id, guildId));
        await db.delete(guilds).where(eq(guilds.id, guildId));
        return NextResponse.json({ ok: true, disbanded: true });
      }
      return NextResponse.json({ error: 'Transfer ownership or disband the guild' }, { status: 400 });
    }
    await db.delete(guildMembers).where(and(eq(guildMembers.guild_id, guildId), eq(guildMembers.user_id, userId)));
    return NextResponse.json({ ok: true });
  }

  if (action === 'kick' && guild.owner_id === userId) {
    const { targetId } = await request.json();
    if (targetId === userId) return NextResponse.json({ error: 'Cannot kick yourself' }, { status: 400 });
    await db.delete(guildMembers)
      .where(and(eq(guildMembers.guild_id, guildId), eq(guildMembers.user_id, targetId)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
