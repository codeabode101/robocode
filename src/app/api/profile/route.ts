import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    const userId = payload.sub as string;

    const user = await db.select({ name: users.name, email: users.email, currency: users.currency })
      .from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);

    return NextResponse.json(user ?? { error: 'Not found' }, { status: user ? 200 : 404 });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
