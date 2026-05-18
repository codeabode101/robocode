import type { TutorialConcept } from '@/components/game/types';

export function cockroachNow() {
  return new Date().toISOString();
}

export interface ValidationResult {
  valid: boolean;
  error: string;
}

const validators: Record<string, (code: string) => boolean> = {
  'string-name': (c) => /^String\s+name\s*=\s*"[^"\n]*"\s*;\s*$/.test(c),
  'string-robot-name': (c) => /^String\s+robotName\s*=\s*"[^"\n]*"\s*;\s*$/.test(c),
  'int-battery': (c) => /^int\s+batteryLevel\s*=\s*\d+\s*;\s*$/.test(c),
  'double-temperature': (c) => /^double\s+temperature\s*=\s*\d+\.?\d*\s*;\s*$/.test(c),
  'boolean-online': (c) => /^boolean\s+isOnline\s*=\s*(true|false)\s*;\s*$/.test(c),
  'expression-power': (c) => /^int\s+powerNeeded\s*=\s*batteryLevel\s*\+\s*\d+\s*;\s*$/.test(c),
  'expression-total': (c) => /^int\s+totalPower\s*=\s*powerNeeded\s*\*\s*\d+\s*;\s*$/.test(c),
  'compound-charge': (c) => /^batteryLevel\s*\+=\s*\d+\s*;\s*$/.test(c),
  'compound-discharge': (c) => /^batteryLevel\s*-=\s*\d+\s*;\s*$/.test(c),
  'cast-double-to-int': (c) => /^int\s+roundedTemp\s*=\s*\(int\)\s*temperature\s*;\s*$/.test(c),
  'cast-int-to-double': (c) => /^double\s+preciseBattery\s*=\s*\(double\)\s*batteryLevel\s*;\s*$/.test(c),
  'string-length': (c) => /^String\s+word\s*=\s*"[^"]*"\s*;\s*int\s+wordLen\s*=\s*word\.length\s*\(\s*\)\s*;\s*$/.test(c),
  'string-charat': (c) => /^char\s+firstChar\s*=\s*word\.charAt\s*\(\s*0\s*\)\s*;\s*$/.test(c),
  'string-substring': (c) => /^String\s+part\s*=\s*word\.substring\s*\(\s*1\s*,\s*4\s*\)\s*;\s*$/.test(c),
  'string-indexof': (c) => /^int\s+pos\s*=\s*word\.indexOf\s*\(\s*["']l["']\s*\)\s*;\s*$/.test(c),
  'math-random': (c) => /^double\s+rand\s*=\s*Math\.random\s*\(\s*\)\s*;\s*$/.test(c),
  'math-max': (c) => /^int\s+stronger\s*=\s*Math\.max\s*\(\s*7\s*,\s*12\s*\)\s*;\s*$/.test(c),
  'string-concat': (c) => /^String\s+scrapSays\s*=\s*"Beep"\s*\+\s*"\s?"\s*\+\s*"boop"\s*;\s*$/.test(c),
};

export function validateTutorialCode(code: string, concept: string): ValidationResult {
  const normalized = String(code || '').replace(/\s+/g, ' ').trim();
  const valid = validators[concept]?.(normalized) ?? false;
  return { valid, error: valid ? '' : 'Code does not match the expected shape. Check the hint.' };
}

export type { TutorialConcept };
