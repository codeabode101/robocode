import { NextRequest, NextResponse } from 'next/server'
import { WorkOS } from '@workos/nodejs'

const workos = new WorkOS(process.env.WORKOS_API_KEY!)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'login') {
    const authUrl = workos.sso.getAuthorizationURL({
      clientId: process.env.WORKOS_CLIENT_ID!,
      redirectURI: process.env.WORKOS_REDIRECT_URI!,
    })
    return NextResponse.redirect(authUrl)
  }

  if (action === 'callback') {
    const code = searchParams.get('code')
    if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 })

    try {
      const { profile } = await workos.sso.getProfile({ code })
      
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
