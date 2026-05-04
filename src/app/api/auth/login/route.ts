import { NextResponse } from 'next/server';
import { workos, clientId } from '@/lib/workos';

export async function GET(req: Request) {
  try {
    const redirectURI = process.env.WORKOS_REDIRECT_URI;
    if (!redirectURI) {
      return NextResponse.json({ error: 'WORKOS_REDIRECT_URI not set' }, { status: 500 });
    }
    if (!clientId) {
      return NextResponse.json({ error: 'WORKOS_CLIENT_ID not set' }, { status: 500 });
    }
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      clientId,
      redirectUri: redirectURI,
    });
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error('Auth login error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
