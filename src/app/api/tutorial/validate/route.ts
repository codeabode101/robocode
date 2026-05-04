import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    userId = payload.sub as string;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const { code, concept } = await request.json();

  try {
    // Simple validation for string variable declaration
    let valid = false;
    let error = '';

    if (concept === 'string-variable') {
      // Check for: String robotName = "Sparky";
      const normalized = code.replace(/\s+/g, ' ').trim();
      const pattern = /String\s+robotName\s*=\s*"Sparky"\s*;/;
      
      if (pattern.test(normalized)) {
        valid = true;
      } else if (!code.includes('String')) {
        error = 'Missing: You need to declare the type (String)';
      } else if (!code.includes('robotName')) {
        error = 'Missing: Variable name should be "robotName"';
      } else if (!code.includes('"Sparky"')) {
        error = 'Missing: Value should be "Sparky" (with quotes)';
      } else if (!code.includes(';')) {
        error = 'Missing: Dont forget the semicolon (;)';
      } else {
        error = 'Try again! Make sure its exactly: String robotName = "Sparky";';
      }
    }

    if (valid) {
      // Mark concept as completed
      const { env } = await getCloudflareContext({ async: true }) as any;
      const db = env.DB;
      
      await db.prepare(`
        INSERT INTO tutorial_progress (user_id, concept, completed, completed_at)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(user_id, concept) DO UPDATE SET completed=1, completed_at=?
      `).bind(userId, concept, new Date().toISOString(), new Date().toISOString()).run();
    }

    return NextResponse.json({ valid, error });
  } catch (error: any) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
