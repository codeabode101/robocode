import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

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
    const normalized = String(code || '').replace(/\s+/g, ' ').trim();

    if (concept === 'string-variable' || concept === 'string-name' || concept === 'string-color') {
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
    } else if (concept === 'int-age') {
      const declarationPattern = /^int\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)\s*;\s*$/;
      const match = normalized.match(declarationPattern);

      if (match) {
        valid = true;
      } else if (!/\bint\b/.test(normalized)) {
        error = 'Use int at the start for age values.';
      } else if (!/;/.test(normalized)) {
        error = 'Add a semicolon at the end (;).';
      } else if (!/=/.test(normalized)) {
        error = 'Use = to assign a number.';
      } else if (!/\bint\s+[A-Za-z_][A-Za-z0-9_]*/.test(normalized)) {
        error = 'Give your age variable a valid name, like petAge.';
      } else if (!/\d+/.test(normalized)) {
        error = 'Age should be a whole number like 2 or 7 (no quotes).';
      } else {
        error = 'Try the shape: int petAge = 2;';
      }
    }

    if (valid) {
      // Mark concept as completed
      await db.execute(sql`
        INSERT INTO tutorial_progress (user_id, concept, completed, completed_at)
        VALUES (${userId}, ${concept}, 1, ${new Date().toISOString()})
        ON CONFLICT(user_id, concept) DO UPDATE SET completed=1, completed_at=${new Date().toISOString()}
      `);
    }

    return NextResponse.json({ valid, error });
  } catch (error) {
    console.error('Validation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown validation error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
