import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { arenaChallenges } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    return payload.sub as string;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { challengeId, code } = await request.json();

  const challenge = await db.select().from(arenaChallenges)
    .where(and(
      eq(arenaChallenges.id, challengeId),
      eq(arenaChallenges.status, 'active'),
      or(eq(arenaChallenges.challenger_id, userId), eq(arenaChallenges.opponent_id, userId))
    ))
    .limit(1).then(r => r[0]);

  if (!challenge) return NextResponse.json({ error: 'No active challenge found' }, { status: 404 });

  const problem = JSON.parse(challenge.problem!);
  const answerRegex = new RegExp(problem.answer);
  const valid = answerRegex.test(code.replace(/\s+/g, ' ').trim());

  if (!valid) return NextResponse.json({ valid: false, error: 'Wrong answer, try again!' });

  await db.update(arenaChallenges).set({
    status: 'completed',
    winner_id: userId,
    completed_at: new Date().toISOString(),
  }).where(eq(arenaChallenges.id, challengeId));

  return NextResponse.json({
    valid: true,
    winner: true,
    message: 'Correct! You won the battle!'
  });
}
