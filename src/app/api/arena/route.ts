import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, arenaPresence, arenaChallenges } from '@/db/schema';
import { eq, or, and, isNull, sql } from 'drizzle-orm';

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    return payload.sub as string;
  } catch { return null; }
}

const PROBLEMS = [
  { prompt: 'Declare a String variable named "botName" with value "Challenger"', answer: /String\s+botName\s*=\s*"Challenger"\s*;/ },
  { prompt: 'Declare an int variable named "score" with value 100', answer: /int\s+score\s*=\s*100\s*;/ },
  { prompt: 'Write a for loop that prints numbers 1 to 5', answer: /for\s*\(/ },
  { prompt: 'Declare a boolean named "isReady" set to true', answer: /boolean\s+isReady\s*=\s*true\s*;/ },
  { prompt: 'Write an if statement checking if x > 5', answer: /if\s*\(/ },
];

function pickProblem() {
  const p = PROBLEMS[Math.floor(Math.random() * PROBLEMS.length)];
  return { prompt: p.prompt, answer: p.answer.source };
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  if (action === 'players') {
    const players = await db.select({ id: users.id, name: users.name })
      .from(arenaPresence)
      .innerJoin(users, eq(arenaPresence.user_id, users.id));
    return NextResponse.json({ players });
  }

  if (action === 'my-challenge') {
    const challenge = await db.select()
      .from(arenaChallenges)
      .where(or(
        eq(arenaChallenges.challenger_id, userId),
        eq(arenaChallenges.opponent_id, userId),
      ))
      .orderBy(sql`created_at DESC`)
      .limit(1)
      .then(r => r[0] || null);
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, opponentId } = await request.json();

  try {
    switch (action) {
      case 'join': {
        await db.insert(arenaPresence).values({ user_id: userId }).onConflictDoNothing();
        return NextResponse.json({ ok: true });
      }
      case 'leave': {
        await db.delete(arenaPresence).where(eq(arenaPresence.user_id, userId));
        return NextResponse.json({ ok: true });
      }
      case 'challenge': {
        const existing = await db.select()
          .from(arenaChallenges)
          .where(and(
            or(eq(arenaChallenges.challenger_id, userId), eq(arenaChallenges.opponent_id, userId)),
            eq(arenaChallenges.status, 'pending')
          ))
          .limit(1).then(r => r[0]);
        if (existing) return NextResponse.json({ error: 'You already have a pending challenge' }, { status: 400 });

        const problem = pickProblem();
        await db.insert(arenaChallenges).values({
          challenger_id: userId,
          opponent_id: opponentId,
          status: 'pending',
          problem: JSON.stringify(problem),
        });
        return NextResponse.json({ ok: true });
      }
      case 'accept': {
        const challenge = await db.select().from(arenaChallenges)
          .where(and(
            eq(arenaChallenges.opponent_id, userId),
            eq(arenaChallenges.status, 'pending')
          ))
          .limit(1).then(r => r[0]);
        if (!challenge) return NextResponse.json({ error: 'No challenge found' }, { status: 404 });

        await db.update(arenaChallenges).set({ status: 'active' })
          .where(eq(arenaChallenges.id, challenge.id));
        return NextResponse.json({
          ok: true,
          challenge: { id: challenge.id, problem: JSON.parse(challenge.problem!) }
        });
      }
      case 'decline': {
        await db.update(arenaChallenges).set({ status: 'declined', completed_at: new Date() })
          .where(and(
            eq(arenaChallenges.opponent_id, userId),
            eq(arenaChallenges.status, 'pending')
          ));
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
