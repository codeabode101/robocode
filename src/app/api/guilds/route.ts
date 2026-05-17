import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { guilds, guildMembers, userXp } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    return payload.sub as string;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allGuilds = await db.select({
    id: guilds.id,
    name: guilds.name,
    owner_id: guilds.owner_id,
    description: guilds.description,
    min_level: guilds.min_level,
    member_count: sql<number>`(SELECT COUNT(*) FROM guild_members WHERE guild_members.guild_id = guilds.id)`,
    created_at: guilds.created_at,
  }).from(guilds).orderBy(guilds.created_at);

  const myMemberships = await db.select({ guild_id: guildMembers.guild_id })
    .from(guildMembers).where(eq(guildMembers.user_id, userId));

  const myGuildIds = new Set(myMemberships.map(m => m.guild_id));

  return NextResponse.json({ guilds: allGuilds, myGuildIds: [...myGuildIds] });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, description, minLevel } = await request.json();
  if (!name || name.trim().length < 2) return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });

  const membershipCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(guildMembers).where(eq(guildMembers.user_id, userId))
    .then(r => r[0].count);

  if (membershipCount >= 3) return NextResponse.json({ error: 'You can only be in up to 3 guilds' }, { status: 400 });

  const xpRecord = await db.select().from(userXp).where(eq(userXp.user_id, userId)).limit(1).then(r => r[0]);
  const userLevel = xpRecord?.level ?? 1;

  const cost = 50;
  if ((xpRecord?.xp ?? 0) < cost) return NextResponse.json({ error: `Need ${cost} XP to create a guild` }, { status: 400 });

  await db.insert(userXp).values({ user_id: userId, xp: -cost }).onConflictDoUpdate({
    target: userXp.user_id,
    set: { xp: sql`user_xp.xp - ${cost}`, updated_at: new Date().toISOString() },
  });

  const guild = await db.insert(guilds).values({
    name: name.trim(),
    owner_id: userId,
    description: description || null,
    min_level: Math.max(1, Math.min(100, minLevel ?? 1)),
  }).returning().then(r => r[0]);

  await db.insert(guildMembers).values({ guild_id: guild.id, user_id: userId, role: 'owner' });

  return NextResponse.json(guild);
}
