import { NextRequest, NextResponse } from 'next/server';
import { workos } from '@/lib/workos';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login', request.url));

  const { user } = await workos.userManagement.authenticateWithCode({
    clientId: process.env.WORKOS_CLIENT_ID!,
    code,
  });

  const existing = await db.select().from(users).where(eq(users.workos_id, user.id));
  if (existing.length === 0) {
    await db.insert(users).values({
      workos_id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
    });
  }

  const token = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(new TextEncoder().encode(process.env.WORKOS_API_KEY!));

  const response = NextResponse.redirect(new URL('/game', request.url));
  response.cookies.set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 86400 });
  return response;
}
