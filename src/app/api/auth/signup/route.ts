import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1).then(rows => rows[0]);
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(users).values({
      id: userId,
      email,
      name: name || '',
      password_hash,
      currency: 0,
      created_at: new Date(now),
    });

    const token = await new SignJWT({ sub: userId, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(process.env.WORKOS_API_KEY!));

    const response = NextResponse.json({ success: true, user: { id: userId, email, name } });
    response.cookies.set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 86400 });
    return response;
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
