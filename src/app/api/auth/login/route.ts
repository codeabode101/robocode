import { NextResponse } from 'next/server';
import { workos, clientId } from '@/lib/workos';

export async function GET(req: Request) {
  const redirectURI = process.env.WORKOS_REDIRECT_URI!;
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    clientId,
    redirectUri: redirectURI,
  });
  return NextResponse.redirect(authorizationUrl);
}
