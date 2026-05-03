import { NextRequest, NextResponse } from 'next/server'
import { parseScript } from '@/lib/battleParser'

export async function POST(request: NextRequest) {
  try {
    const { scriptBody } = await request.json()
    
    if (!scriptBody) {
      return NextResponse.json({ valid: false, errors: ['No script provided'] })
    }

    // Basic validation
    const lines = scriptBody.split('\n').filter(l => l.trim())
    if (lines.length > 15) {
      return NextResponse.json({ 
        valid: false, 
        errors: [`Script exceeds 15 line limit (${lines.length} lines)`] 
      })
    }

    // Check for forbidden patterns
    const forbiddenPatterns = [
      /while\s*\(/,
      /for\s*\(/,
      /import\s/,
      /System\./,
      /new\s+/,
      /\bclass\b/,
    ]

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(scriptBody)) {
        return NextResponse.json({ 
          valid: false, 
          errors: [`Forbidden pattern detected: ${pattern.source}`] 
        })
      }
    }

    // Check for at least one action
    const hasAction = /(attack|defend|heal|special|charge)\s*\(\)\s*;/.test(scriptBody)
    if (!hasAction) {
      return NextResponse.json({ 
        valid: false, 
        errors: ['Script must contain at least one action (attack/defend/heal/special/charge)'] 
      })
    }

    return NextResponse.json({ valid: true, errors: [] })
  } catch (error: any) {
    return NextResponse.json({ 
      valid: false, 
      errors: [error.message || 'Validation failed'] 
    })
  }
}
