import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    const apiKey = process.env.WORKOS_API_KEY!;
    const clientId = process.env.WORKOS_CLIENT_ID!;

    const tokenRes = await fetch('https://api.workos.com/user_management/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: apiKey,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('WorkOS token exchange failed:', tokenRes.status, errText);
      return NextResponse.redirect(new URL('/login?error=token_exchange', request.url));
    }

    const data = await tokenRes.json() as { user?: { id: string; email: string; first_name?: string; last_name?: string } };
    const profile = data.user;

    if (!profile?.email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url));
    }

    const email = profile.email;
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || email.split('@')[0];

    let user = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(rows => rows[0]);

    if (!user) {
      const userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email,
        name,
        password_hash: '',
        currency: 0,
        created_at: new Date().toISOString(),
      });
      user = { id: userId };
    }

    const jwt = await new SignJWT({ sub: user.id, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(new TextEncoder().encode(apiKey));

    const response = NextResponse.redirect(new URL('/game', request.url));
    response.headers.set('Set-Cookie', `session=${jwt}; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; Path=/`);
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=oauth', request.url));
  }
}
