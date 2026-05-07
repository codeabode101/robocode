import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

type PreparedStatement = {
  bind: (...params: unknown[]) => {
    run: () => Promise<unknown>;
  };
};

type D1DatabaseLike = {
  prepare: (query: string) => PreparedStatement;
};

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
    // Validation for beginner-friendly String variable declarations
    let valid = false;
    let error = '';

    if (concept === 'string-variable') {
      const normalized = code.replace(/\s+/g, ' ').trim();
      const declarationPattern = /^String\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"\n]+)"\s*;\s*$/;
      const match = normalized.match(declarationPattern);

      if (match) {
        valid = true;
      } else if (!code.includes('String')) {
        error = 'Start with the type: use String at the beginning.';
      } else if (!code.includes(';')) {
        error = 'Add a semicolon at the end (;).';
      } else if (!code.includes('=')) {
        error = 'Use = to assign a text value to your variable.';
      } else if (!/String\s+[A-Za-z_][A-Za-z0-9_]*/.test(normalized)) {
        error = 'Give your variable a valid name, like favoriteColor or botMood.';
      } else if (!/"[^"\n]+"/.test(normalized)) {
        error = 'Put a text value in quotes, like "teal" or "happy".';
      } else {
        error = 'Try the shape: String favoriteColor = "teal"; then make it your own.';
      }
    }

    if (valid) {
      // Mark concept as completed
      const { env } = (await getCloudflareContext({ async: true })) as unknown as { env: { DB: D1DatabaseLike } };
      const db = env.DB;
      
      await db.prepare(`
        INSERT INTO tutorial_progress (user_id, concept, completed, completed_at)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(user_id, concept) DO UPDATE SET completed=1, completed_at=?
      `).bind(userId, concept, new Date().toISOString(), new Date().toISOString()).run();
    }

    return NextResponse.json({ valid, error });
  } catch (error) {
    console.error('Validation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown validation error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
