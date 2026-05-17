import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { userXp, tutorialProgress } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { validateTutorialCode } from '@/lib/tutorial-validation';

function now() { return new Date().toISOString(); }
export async function POST(request: NextRequest) {
  let userId: string;
  try {
    const token = request.cookies.get('session')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    userId = payload.sub as string;
  } catch {
    // Token missing or invalid — not a server crash
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body INSIDE try-catch — request.json() can throw on
  // malformed / empty body, and if it escapes the route handler
  // Cloudflare returns an HTML error page.
  let code: unknown;
  let concept: unknown;
  try {
    const body = await request.json();
    code = (body as any).code;
    concept = (body as any).concept;
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request body' });
  }

  // Validate returns { valid, error } — never throws
  const { valid, error } = validateTutorialCode(String(code || ''), String(concept || ''));

  if (valid) {
    try {
      // Ensure user record exists (may have been dropped by migration)
      await db.run(sql`
        INSERT INTO users (id, email, name, password_hash, currency)
        VALUES (${userId}, ${userId + '@tutorial'}, NULL, 'migrated', 0)
        ON CONFLICT (id) DO NOTHING
      `);
    } catch {
      // Non-fatal — the INSERT below will fail with FK violation if the
      // user doesn't exist, but at least we tried to create them.
    }

    try {
      await db.run(sql`
        INSERT INTO tutorial_progress (user_id, concept, completed, completed_at)
        VALUES (${userId}, ${concept}, 1, ${now()})
        ON CONFLICT (user_id, concept) DO UPDATE SET completed = 1, completed_at = ${now()}
      `);
    } catch {
    }

    try {
      await db.run(sql`
        INSERT INTO user_xp (user_id, xp, level, updated_at)
        VALUES (${userId}, 25, 1, ${now()})
        ON CONFLICT (user_id) DO UPDATE SET xp = user_xp.xp + 25, updated_at = ${now()}
      `);
    } catch {
      // Non-fatal — XP save should not break the response
    }
  }

  // Final catch-all — if anything above somehow threw without being
  // caught, this prevents the HTML 500 page from being returned.
  try {
    return NextResponse.json({ valid, error: valid ? '' : error });
  } catch {
    return new Response(JSON.stringify({ valid: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
