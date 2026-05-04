import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(process.env.WORKOS_API_KEY!));

    const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    response.cookies.set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 86400 });
    return response;
  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
