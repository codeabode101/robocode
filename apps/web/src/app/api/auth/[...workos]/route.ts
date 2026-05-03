import { NextRequest, NextResponse } from 'next/server'
import { WorkOS } from '@workos-inc/node'
import { createHash, randomBytes } from 'crypto'

function getWorkOS() {
  return new WorkOS(process.env.WORKOS_API_KEY || 'sk_placeholder')
}

async function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'login') {
    const { challenge } = await generatePKCE()
    const workos = getWorkOS()
    const authUrl = workos.sso.getAuthorizationUrl({
      clientId: process.env.WORKOS_CLIENT_ID!,
      redirectUri: process.env.WORKOS_REDIRECT_URI!,
      provider: 'authkit',
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
    })
    return NextResponse.redirect(authUrl)
  }

  if (action === 'callback') {
    const code = searchParams.get('code')
    if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 })

    try {
      const workos = getWorkOS()
      const { user } = await workos.userManagement.authenticateWithCode({ code, clientId: process.env.WORKOS_CLIENT_ID! })
      
      // TODO: Create/lookup user in DB
      const token = 'dummy-jwt-token' // In production, sign a JWT
      
      const response = NextResponse.redirect(new URL('/dashboard', request.url))
      response.cookies.set('robocode-token', token, { httpOnly: true })
      return response
    } catch (error) {
      return NextResponse.json({ error: 'Auth failed' }, { status: 401 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  
  if (body.action === 'logout') {
    const response = NextResponse.json({ success: true })
    response.cookies.delete('robocode-token')
    return response
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
