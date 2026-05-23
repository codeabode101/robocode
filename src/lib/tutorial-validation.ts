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
  'expression-add': (c) => /^int\s+powerNeeded\s*=\s*batteryLevel\s*\+\s*\d+\s*;\s*$/.test(c),
  'expression-multiply': (c) => /^int\s+totalPower\s*=\s*powerNeeded\s*\*\s*\d+\s*;\s*$/.test(c),
  'expression-modulo': (c) => /^int\s+sector\s*=\s*\d+\s*%\s*\d+\s*;\s*$/.test(c),
  'compound-op': (c) => /^(batteryLevel|temperature)\s*\+?=\s*-?\d+(\.?\d*)?\s*;\s*$/.test(c),
  'cast-explicit': (c) => /^int\s+rounded\s*=\s*\(int\)\s*temperature\s*;\s*$/.test(c),
  'cast-implicit': (c) => /^double\s+precise\s*=\s*batteryLevel\s*;\s*$/.test(c),
  'math-random': (c) => /^double\s+rand\s*=\s*Math\.random\s*\(\s*\)\s*;\s*$/.test(c),
  'math-abs': (c) => /^int\s+absolute\s*=\s*Math\.abs\s*\(\s*-?\d+\s*\)\s*;\s*$/.test(c),
  'math-pow': (c) => /^double\s+squared\s*=\s*Math\.pow\s*\(\s*\d+\s*,\s*\d+\s*\)\s*;\s*$/.test(c),
  'math-sqrt': (c) => /^double\s+root\s*=\s*Math\.sqrt\s*\(\s*\d+\s*\)\s*;\s*$/.test(c),
  'promotion-mixed': (c) => /^double\s+result\s*=\s*\d+\s*\+\s*\d+\.?\d*\s*;\s*$/.test(c),
  'string-length': (c) => /^String\s+word\s*=\s*"[^"]*"\s*;\s*int\s+wordLen\s*=\s*word\.length\s*\(\s*\)\s*;\s*$/.test(c),
  'string-indexof': (c) => /^int\s+pos\s*=\s*word\.indexOf\s*\(\s*["'].*["']\s*\)\s*;\s*$/.test(c),
  'string-substring': (c) => /^String\s+part\s*=\s*word\.substring\s*\(\s*\d+\s*,\s*\d+\s*\)\s*;\s*$/.test(c),
  'string-equals': (c) => /^boolean\s+match\s*=\s*word\.equals\s*\(\s*"[^"]*"\s*\)\s*;\s*$/.test(c),
  'string-compareto': (c) => /^int\s+cmp\s*=\s*word\.compareTo\s*\(\s*"[^"]*"\s*\)\s*;\s*$/.test(c),
  'string-concat': (c) => /^String\s+scrapSays\s*=\s*"[^"]*"\s*\+\s*"[^"]*"\s*\+\s*"[^"]*"\s*;\s*$/.test(c),
  'scanner-int': (c) => /^Scanner\s+scan\s*=\s*new\s+Scanner\s*\(\s*System\.in\s*\)\s*;\s*int\s+n\s*=\s*scan\.nextInt\s*\(\s*\)\s*;\s*$/.test(c),
  'wrapper-parse': (c) => /^int\s+val\s*=\s*Integer\.parseInt\s*\(\s*"[^"]*"\s*\)\s*;\s*$/.test(c),
  'equals-vs-ref': (c) => /^boolean\s+same\s*=\s*str1\.equals\s*\(\s*str2\s*\)\s*;\s*$/.test(c),
};

export function validateTutorialCode(code: string, concept: string): ValidationResult {
  const normalized = String(code || '').replace(/\s+/g, ' ').trim();
  const valid = validators[concept]?.(normalized) ?? false;
  return { valid, error: valid ? '' : 'Code does not match the expected shape. Check the hint.' };
}

export function getConceptErrorHint(concept: string, code: string): string {
  const normalized = String(code || '').replace(/\s+/g, ' ').trim();
  const varNameMatch = normalized.match(/^(String|int|double|boolean|char)\s+([A-Za-z_][A-Za-z0-9_]*)/);

  switch (concept) {
    case 'string-name': {
      if (!normalized.includes('String')) return 'Start with the type: use String at the beginning.';
      if (!normalized.includes(';')) return 'Add a semicolon at the end (;).';
      if (!normalized.includes('=')) return 'Use = to assign a value.';
      if (!/"[^"\n]*"/.test(normalized)) return 'Put the value in double quotes, like "Scrap".';
      if (varNameMatch && !/^name$/.test(varNameMatch[2])) return 'Use the exact variable name: <code>name</code>.';
      return 'Check the shape: <code>String name = "Scrap";</code>';
    }
    case 'string-robot-name': {
      if (!normalized.includes('String')) return 'Start with String at the beginning.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      if (!normalized.includes('=')) return 'Use = to assign a value.';
      if (!/"[^"\n]*"/.test(normalized)) return 'Put the value in double quotes.';
      if (varNameMatch && !/^robotName$/.test(varNameMatch[2])) return 'Use the exact variable name: <code>robotName</code>.';
      return 'Check the shape: <code>String robotName = "Scrap";</code>';
    }
    case 'int-battery': {
      if (!/\bint\b/.test(normalized)) return 'Start with int at the beginning.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      if (!normalized.includes('=')) return 'Use = to assign a value.';
      if (varNameMatch && !/^batteryLevel$/.test(varNameMatch[2])) return 'Use the exact variable name: <code>batteryLevel</code>.';
      return 'Check the shape: <code>int batteryLevel = 0;</code>';
    }
    case 'double-temperature': {
      if (!/\bdouble\b/.test(normalized)) return 'Start with double at the beginning.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      if (!normalized.includes('=')) return 'Use = to assign a value.';
      if (varNameMatch && !/^temperature$/.test(varNameMatch[2])) return 'Use the exact variable name: <code>temperature</code>.';
      return 'Check the shape: <code>double temperature = 25.5;</code>';
    }
    case 'boolean-online': {
      if (!/\bboolean\b/.test(normalized)) return 'Start with boolean at the beginning.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      if (!normalized.includes('=')) return 'Use = to assign a value.';
      if (varNameMatch && !/^isOnline$/.test(varNameMatch[2])) return 'Use the exact variable name: <code>isOnline</code>.';
      return 'Check the shape: <code>boolean isOnline = false;</code>';
    }
    case 'expression-add': {
      if (!/\bint\b/.test(normalized)) return 'Start with int.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      if (!normalized.includes('batteryLevel')) return 'Use <code>batteryLevel</code> in your expression.';
      if (!normalized.includes('+')) return 'Use the + operator to add.';
      return 'Check the shape: <code>int powerNeeded = batteryLevel + 50;</code>';
    }
    case 'expression-multiply': {
      if (!/\bint\b/.test(normalized)) return 'Start with int.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      if (!normalized.includes('powerNeeded')) return 'Use <code>powerNeeded</code> in your expression.';
      if (!normalized.includes('*')) return 'Use the * operator to multiply.';
      return 'Check the shape: <code>int totalPower = powerNeeded * 2;</code>';
    }
    case 'expression-modulo': {
      if (!/\bint\b/.test(normalized)) return 'Start with int.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      if (!normalized.includes('%')) return 'Use the % (modulo) operator.';
      return 'Check the shape: <code>int sector = 17 % 3;</code>';
    }
    case 'compound-op': {
      if (!normalized.includes('+=') && !normalized.includes('-=')) return 'Use a compound operator like <code>+=</code> or <code>-=</code>.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      return 'Check the shape: <code>batteryLevel += 10;</code>';
    }
    case 'cast-explicit': {
      if (!/\bint\b/.test(normalized)) return 'Store the result in an int.';
      if (!normalized.includes('(int)')) return 'Cast with <code>(int)</code>.';
      if (!normalized.includes('temperature')) return 'Cast <code>temperature</code>.';
      return 'Check the shape: <code>int rounded = (int) temperature;</code>';
    }
    case 'cast-implicit': {
      if (!/\bdouble\b/.test(normalized)) return 'Store the result in a double.';
      if (!normalized.includes('batteryLevel')) return 'Use <code>batteryLevel</code>.';
      return 'Check the shape: <code>double precise = batteryLevel;</code> — Java promotes int to double automatically.';
    }
    case 'math-abs': {
      if (!/\bint\b/.test(normalized)) return 'Store the result in an int.';
      if (!normalized.includes('Math.abs(')) return 'Call <code>Math.abs(value)</code>.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      return 'Check the shape: <code>int absolute = Math.abs(-5);</code>';
    }
    case 'math-pow': {
      if (!/\bdouble\b/.test(normalized)) return 'Store the result in a double.';
      if (!normalized.includes('Math.pow(')) return 'Call <code>Math.pow(base, exp)</code>.';
      if (!normalized.includes(',')) return 'Pass base and exponent separated by a comma.';
      return 'Check the shape: <code>double squared = Math.pow(3, 2);</code>';
    }
    case 'math-sqrt': {
      if (!/\bdouble\b/.test(normalized)) return 'Store the result in a double.';
      if (!normalized.includes('Math.sqrt(')) return 'Call <code>Math.sqrt(value)</code>.';
      return 'Check the shape: <code>double root = Math.sqrt(16);</code>';
    }
    case 'promotion-mixed': {
      if (!/\bdouble\b/.test(normalized)) return 'Store the result in a double.';
      if (!normalized.includes('+')) return 'Use the + operator.';
      return 'Check the shape: <code>double result = 5 + 2.5;</code>';
    }
    case 'string-length': {
      if (!/\bint\b/.test(normalized)) return 'Store the result in an int: use <code>int wordLen</code>.';
      if (!normalized.includes('wordLen')) return 'Name the variable <code>wordLen</code>.';
      if (!normalized.includes('.length()')) return 'Call <code>.length()</code> on the word variable.';
      if (!normalized.includes('word')) return 'Use the <code>word</code> variable.';
      return 'Check the shape: <code>int wordLen = word.length();</code>';
    }
    case 'string-indexof': {
      if (!/\bint\b/.test(normalized)) return 'Store the result in an int: <code>int pos</code>.';
      if (!normalized.includes('pos')) return 'Name the variable <code>pos</code>.';
      if (!normalized.includes('.indexOf(')) return 'Call <code>.indexOf(character)</code>.';
      return 'Check the shape: <code>int pos = word.indexOf("l");</code>';
    }
    case 'string-substring': {
      if (!/\bString\b/.test(normalized)) return 'Store the result in a String: <code>String part</code>.';
      if (!normalized.includes('part')) return 'Name the variable <code>part</code>.';
      if (!normalized.includes('.substring(')) return 'Call <code>.substring(start, end)</code>.';
      return 'Check the shape: <code>String part = word.substring(1, 4);</code>';
    }
    case 'string-equals': {
      if (!/\bboolean\b/.test(normalized)) return 'Store the result in a boolean.';
      if (!normalized.includes('match')) return 'Name the variable <code>match</code>.';
      if (!normalized.includes('.equals(')) return 'Call <code>.equals(other)</code> to compare strings.';
      return 'Check the shape: <code>boolean match = word.equals("Hello");</code>';
    }
    case 'string-compareto': {
      if (!/\bint\b/.test(normalized)) return 'Store the result in an int.';
      if (!normalized.includes('cmp')) return 'Name the variable <code>cmp</code>.';
      if (!normalized.includes('.compareTo(')) return 'Call <code>.compareTo(other)</code>.';
      return 'Check the shape: <code>int cmp = word.compareTo("Apple");</code>';
    }
    case 'string-concat': {
      if (!/\bString\b/.test(normalized)) return 'Store the result in a String: <code>String scrapSays</code>.';
      if (!normalized.includes('scrapSays')) return 'Name the variable <code>scrapSays</code>.';
      if (!normalized.includes('"Beep"') || !normalized.includes('"boop"')) return 'Use "Beep" and "boop".';
      if (!normalized.includes('" "') && !normalized.includes('"  "')) return 'Add a space " " between them.';
      return 'Check the shape: <code>String scrapSays = "Beep" + " " + "boop";</code>';
    }
    case 'scanner-int': {
      if (!normalized.includes('Scanner')) return 'Declare a Scanner variable.';
      if (!normalized.includes('new Scanner')) return 'Create a new Scanner with <code>new Scanner(System.in)</code>.';
      if (!normalized.includes('System.in')) return 'Pass <code>System.in</code> to the Scanner constructor.';
      if (!normalized.includes('.nextInt()')) return 'Call <code>scan.nextInt()</code> to read an int.';
      return 'Check the shape: <code>Scanner scan = new Scanner(System.in); int n = scan.nextInt();</code>';
    }
    case 'wrapper-parse': {
      if (!/\bint\b/.test(normalized)) return 'Store the result in an int.';
      if (!normalized.includes('Integer.parseInt(')) return 'Use <code>Integer.parseInt(string)</code> to convert.';
      if (!normalized.includes('"')) return 'Pass a string value in double quotes.';
      return 'Check the shape: <code>int val = Integer.parseInt("42");</code>';
    }
    case 'equals-vs-ref': {
      if (!/\bboolean\b/.test(normalized)) return 'Store the result in a boolean.';
      if (!normalized.includes('.equals(')) return 'Use <code>.equals()</code> to compare strings.';
      return 'Check the shape: <code>boolean same = str1.equals(str2);</code>';
    }
    default:
      return 'Something went wrong. Check the code shape.';
  }
}

export type { TutorialConcept };
