import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.WORKOS_CLIENT_ID!;
  const redirectUri = process.env.WORKOS_REDIRECT_URI!;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    provider: 'GoogleOAuth',
  });

  return NextResponse.redirect(`https://api.workos.com/user_management/authorize?${params}`);
}
