export function cockroachNow() {
  return new Date().toISOString();
}

export interface ValidationResult {
  valid: boolean;
  error: string;
}

/**
 * Validate a Java-like code snippet for a given tutorial concept.
 *
 * All validation is regex-based (no actual Java execution).
 * Concepts: string-variable, string-name, string-color, int-age
 */
export function validateTutorialCode(code: string, concept: string): ValidationResult {
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

  return { valid, error };
}
