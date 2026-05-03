// Client-side simplified battle script validator
// Full parsing happens on server

export function parseScript(scriptBody: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check line count
  const lines = scriptBody.split('\n').filter(l => l.trim())
  if (lines.length > 15) {
    errors.push(`Script exceeds 15 line limit (${lines.length} lines)`)
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
      errors.push(`Forbidden pattern detected: ${pattern.source}`)
      break
    }
  }

  // Check for valid actions
  const actions = scriptBody.match(/(attack|defend|heal|special|charge)\s*\(\)\s*;/g)
  if (!actions || actions.length === 0) {
    errors.push('Script must contain at least one action')
  }

  return { valid: errors.length === 0, errors }
}

export function validateScript(scriptBody: string): boolean {
  const { valid } = parseScript(scriptBody)
  return valid
}
