import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, tutorialProgress } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    const userId = payload.sub as string;

    const user = await db.select({ name: users.name, email: users.email, currency: users.currency })
      .from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);

    const tutorials = await db.select({ concept: tutorialProgress.concept })
      .from(tutorialProgress).where(eq(tutorialProgress.user_id, userId));

    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const concepts = tutorials.map(t => t.concept);
    const questStage = concepts.find(c => c.startsWith('_quest_'))?.replace('_quest_', '') || 'intro';

    return NextResponse.json({
      name: user.name,
      email: user.email,
      currency: user.currency,
      tutorials: concepts,
      questStage,
      workshopIntroDone: concepts.includes('_workshop_intro'),
    });
  } catch (err) {
    console.error('Profile load error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
