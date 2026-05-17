import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, tutorialProgress } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    const userId = payload.sub as string;

    let user = await db.select({ name: users.name, email: users.email, currency: users.currency, playtime_seconds: users.playtime_seconds })
      .from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);

    // Auto-create user record if missing (e.g., after migration reset)
    if (!user) {
      const email = (payload.email as string) || `${userId}@temp`;
      const name = (payload.name as string) || null;
      await db.run(sql`
        INSERT INTO users (id, email, name, password_hash, currency)
        VALUES (${userId}, ${email}, ${name}, 'migrated', 0)
        ON CONFLICT (id) DO NOTHING
      `);
      user = { name, email, currency: 0, playtime_seconds: 0 };
    }

    const tutorials = await db.select({ concept: tutorialProgress.concept })
      .from(tutorialProgress).where(eq(tutorialProgress.user_id, userId));

    const concepts = tutorials.map(t => t.concept);
    const questStage = concepts.find(c => c.startsWith('_quest_'))?.replace('_quest_', '') || 'intro';

    return NextResponse.json({
      name: user.name,
      email: user.email,
      currency: user.currency,
      playtime_seconds: user.playtime_seconds,
      tutorials: concepts,
      questStage,
      workshopIntroDone: concepts.includes('_workshop_intro'),
    });
  } catch (err) {
    console.error('Profile load error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
