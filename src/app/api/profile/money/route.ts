import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    userId = payload.sub as string;
  } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }
  const { amount } = await request.json();
  if (typeof amount !== 'number') return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  try {
    await db.update(users).set({ currency: amount }).where(eq(users.id, userId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Money save error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
