import type { TutorialPhase } from './types';

export const unit1Phases: TutorialPhase[] = [
  {
    kind: 'dialogue',
    npcText:
      "Hey coder! Look over there — that robot's been sitting here for years. No name, no memory, no movement. But I think it's got potential. Let's run diagnostics and bring it online.",
  },
  {
    kind: 'challenge',
    concept: 'string-name',
    title: 'Give it a name',
    prompt: 'Every robot needs a name. Create a String variable to name this bot.',
    hint: '<code>String name = "Scrap";</code>',
    starterCode: 'String name = "Scrap";',
    npcText:
      "Type the code to give your robot a name. Use <code>String</code>, then a name, an <code>=</code>, and a value in double quotes.",
  },
  {
    kind: 'dialogue',
    npcText:
      'Robocode runs on Java. It powers every bot in this world. Java is strict — that\'s what makes it reliable. Let\'s learn the data types you\'ll need.',
  },
  {
    kind: 'dialogue',
    npcText:
      "Scrap needs to track its own status. Different kinds of data need different types. Let's declare variables for everything we can measure.",
  },
  {
    kind: 'challenge',
    concept: 'string-robot-name',
    title: 'Robot identity',
    prompt: 'Declare a String variable called <code>robotName</code> for Scrap\'s name.',
    hint: '<code>String robotName = "Scrap";</code>',
    starterCode: 'String robotName = "Scrap";',
    npcText:
      "Use <code>String</code> for text values. Make sure the variable name is <code>robotName</code>.",
  },
  {
    kind: 'challenge',
    concept: 'int-battery',
    title: 'Battery status',
    prompt: 'Declare an int variable called <code>batteryLevel</code> set to 0. Scrap\'s battery is dead.',
    hint: '<code>int batteryLevel = 0;</code>',
    starterCode: 'int batteryLevel = 0;',
    npcText:
      "Use <code>int</code> for whole numbers. Set <code>batteryLevel</code> to 0.",
  },
  {
    kind: 'challenge',
    concept: 'double-temperature',
    title: 'Temperature sensor',
    prompt: 'Declare a double variable called <code>temperature</code> set to 25.5.',
    hint: '<code>double temperature = 25.5;</code>',
    starterCode: 'double temperature = 25.5;',
    npcText:
      "Use <code>double</code> for decimal numbers. Set <code>temperature</code> to 25.5.",
  },
  {
    kind: 'challenge',
    concept: 'boolean-online',
    title: 'Power state',
    prompt: 'Declare a boolean variable called <code>isOnline</code> set to false.',
    hint: '<code>boolean isOnline = false;</code>',
    starterCode: 'boolean isOnline = false;',
    npcText:
      "Use <code>boolean</code> for true/false. Scrap isn't powered on yet.",
  },
  {
    kind: 'dialogue',
    npcText:
      "Now let's calculate how much power Scrap needs to boot up. We can use expressions — math with variables.",
  },
  {
    kind: 'challenge',
    concept: 'expression-power',
    title: 'Boot power calculation',
    prompt: 'Scrap needs 50 more units. Create <code>powerNeeded</code> that adds 50 to <code>batteryLevel</code>.',
    hint: '<code>int powerNeeded = batteryLevel + 50;</code>',
    starterCode: 'int powerNeeded = batteryLevel + 50;',
    npcText:
      "Use <code>batteryLevel</code> in an expression. Add 50 to find the power needed.",
  },
  {
    kind: 'challenge',
    concept: 'expression-total',
    title: 'Reserve power',
    prompt: 'Double the power as a safety reserve. Create <code>totalPower</code> that multiplies <code>powerNeeded</code> by 2.',
    hint: '<code>int totalPower = powerNeeded * 2;</code>',
    starterCode: 'int totalPower = powerNeeded * 2;',
    npcText:
      "Multiply <code>powerNeeded</code> by 2 using the <code>*</code> operator.",
  },
  {
    kind: 'dialogue',
    npcText:
      "Let's charge Scrap's battery. Instead of writing <code>batteryLevel = batteryLevel + 10</code>, Java lets us use compound operators — shorter and cleaner.",
  },
  {
    kind: 'challenge',
    concept: 'compound-charge',
    title: 'Charge the battery',
    prompt: 'Add 10 to <code>batteryLevel</code> using <code>+=</code>.',
    hint: '<code>batteryLevel += 10;</code>',
    starterCode: 'batteryLevel += 10;',
    npcText:
      "Use <code>+=</code> to add 10. It's shorter than <code>batteryLevel = batteryLevel + 10</code>.",
  },
  {
    kind: 'challenge',
    concept: 'compound-discharge',
    title: 'Power test',
    prompt: 'Subtract 3 from <code>batteryLevel</code> using <code>-=</code>. Scrap\'s motor drew power.',
    hint: '<code>batteryLevel -= 3;</code>',
    starterCode: 'batteryLevel -= 3;',
    npcText:
      "Use <code>-=</code> to subtract 3 from <code>batteryLevel</code>.",
  },
  {
    kind: 'dialogue',
    npcText:
      "Scrap's sensors give decimal readings, but some systems only accept whole numbers. We need to cast — convert — between types.",
  },
  {
    kind: 'challenge',
    concept: 'cast-double-to-int',
    title: 'Round the temperature',
    prompt: 'Cast <code>temperature</code> to int and store it in <code>roundedTemp</code>.',
    hint: '<code>int roundedTemp = (int) temperature;</code>',
    starterCode: 'int roundedTemp = (int) temperature;',
    npcText:
      "Use <code>(int)</code> to cast the double to a whole number.",
  },
  {
    kind: 'challenge',
    concept: 'cast-int-to-double',
    title: 'Precise battery reading',
    prompt: 'Convert <code>batteryLevel</code> to double and store in <code>preciseBattery</code>.',
    hint: '<code>double preciseBattery = (double) batteryLevel;</code>',
    starterCode: 'double preciseBattery = (double) batteryLevel;',
    npcText:
      "Use <code>(double)</code> to convert <code>batteryLevel</code> to a decimal value.",
  },
];

export const unit2Phases: TutorialPhase[] = [
  {
    kind: 'dialogue',
    npcText:
      "I found a voice module in the back! Scrap's sensor is installed and working. Now let's teach them to speak. Objects in Java let us interact with things — like Scrap's new voice module.",
  },
  {
    kind: 'challenge',
    concept: 'string-length',
    title: 'Word length',
    prompt: 'Scrap wants to say "Hello". Use <code>.length()</code> to find the length of the word and store it in <code>wordLen</code>.',
    hint: '<code>String word = "Hello";\nint wordLen = word.length();</code>',
    starterCode: 'String word = "Hello";\nint wordLen = word.length();',
    npcText:
      'Strings are objects. Call <code>.length()</code> on the string variable to get its length.',
  },
  {
    kind: 'challenge',
    concept: 'string-charat',
    title: 'First letter',
    prompt: 'Get the first character of the word and store it in <code>firstChar</code>.',
    hint: '<code>char firstChar = word.charAt(0);</code>',
    starterCode: 'char firstChar = word.charAt(0);',
    npcText:
      'Use <code>.charAt(index)</code> to get a character at a position. Index 0 is the first letter.',
  },
  {
    kind: 'dialogue',
    npcText:
      'Scrap can pick out letters. Now let\'s teach them to grab chunks of words — substrings. This is how Scrap will learn to form syllables.',
  },
  {
    kind: 'challenge',
    concept: 'string-substring',
    title: 'Syllable slice',
    prompt: 'Get the first 3 letters of "Hello" (from index 1 to 4, which is "ell") and store in <code>part</code>.',
    hint: '<code>String part = word.substring(1, 4);</code>',
    starterCode: 'String part = word.substring(1, 4);',
    npcText:
      'Use <code>.substring(start, end)</code>. It returns the characters from start index up to (but not including) end index.',
  },
  {
    kind: 'challenge',
    concept: 'string-indexof',
    title: 'Find the letter',
    prompt: 'Find the position of "l" in "Hello" and store it in <code>pos</code>.',
    hint: '<code>int pos = word.indexOf("l");</code>',
    starterCode: 'int pos = word.indexOf("l");',
    npcText:
      'Use <code>.indexOf("char")</code> to find where a character first appears. It returns the index number.',
  },
  {
    kind: 'dialogue',
    npcText:
      'Scrap can read! Now let\'s give them a brain — the Math class. Math is a built-in Java object with useful methods. No need to create it, just use it.',
  },
  {
    kind: 'challenge',
    concept: 'math-random',
    title: 'Random thought',
    prompt: 'Generate a random decimal between 0 and 1 and store it in <code>rand</code>.',
    hint: '<code>double rand = Math.random();</code>',
    starterCode: 'double rand = Math.random();',
    npcText:
      '<code>Math.random()</code> returns a random double between 0.0 and 1.0. It\'s how Scrap will make choices.',
  },
  {
    kind: 'challenge',
    concept: 'math-max',
    title: 'Which is stronger?',
    prompt: 'Find the larger of 7 and 12 using <code>Math.max()</code>. Store it in <code>stronger</code>.',
    hint: '<code>int stronger = Math.max(7, 12);</code>',
    starterCode: 'int stronger = Math.max(7, 12);',
    npcText:
      '<code>Math.max(a, b)</code> returns the bigger of two values. Scrap uses it to compare options.',
  },
  {
    kind: 'dialogue',
    npcText:
      'One last thing — concatenation. We can glue strings together with <code>+</code>. Scrap\'s first sentence will be built from pieces.',
  },
  {
    kind: 'challenge',
    concept: 'string-concat',
    title: 'Scrap speaks!',
    prompt: 'Join the words together with a space: "Beep" + " " + "boop" into <code>scrapSays</code>.',
    hint: '<code>String scrapSays = "Beep" + " " + "boop";</code>',
    starterCode: 'String scrapSays = "Beep" + " " + "boop";',
    npcText:
      'Use <code>+</code> between strings to concatenate. Add a space in the middle so the words don\'t squish together.',
  },
  {
    kind: 'dialogue',
    npcText:
      'Scrap said "Beep boop"! The voice module works. Objects are everywhere in Java — Strings, Math, arrays, and more. You\'ll use them constantly.',
  },
];

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
    case 'expression-power': {
      if (!/\bint\b/.test(normalized)) return 'Start with int.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      if (!normalized.includes('batteryLevel')) return 'Use <code>batteryLevel</code> in your expression.';
      if (!normalized.includes('+')) return 'Use the + operator to add.';
      return 'Check the shape: <code>int powerNeeded = batteryLevel + 50;</code>';
    }
    case 'expression-total': {
      if (!/\bint\b/.test(normalized)) return 'Start with int.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      if (!normalized.includes('powerNeeded')) return 'Use <code>powerNeeded</code> in your expression.';
      if (!normalized.includes('*')) return 'Use the * operator to multiply.';
      return 'Check the shape: <code>int totalPower = powerNeeded * 2;</code>';
    }
    case 'compound-charge': {
      if (!normalized.includes('batteryLevel')) return 'Use <code>batteryLevel</code>.';
      if (!normalized.includes('+=')) return 'Use the <code>+=</code> operator.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      return 'Check the shape: <code>batteryLevel += 10;</code>';
    }
    case 'compound-discharge': {
      if (!normalized.includes('batteryLevel')) return 'Use <code>batteryLevel</code>.';
      if (!normalized.includes('-=')) return 'Use the <code>-=</code> operator.';
      if (!normalized.includes(';')) return 'Add a semicolon (;).';
      return 'Check the shape: <code>batteryLevel -= 3;</code>';
    }
    case 'cast-double-to-int': {
      if (!/\bint\b/.test(normalized)) return 'Start with int.';
      if (!normalized.includes('(int)')) return 'Cast with <code>(int)</code>.';
      if (!normalized.includes('temperature')) return 'Cast <code>temperature</code>.';
      return 'Check the shape: <code>int roundedTemp = (int) temperature;</code>';
    }
    case 'cast-int-to-double': {
      if (!/\bdouble\b/.test(normalized)) return 'Start with double.';
      if (!normalized.includes('(double)')) return 'Cast with <code>(double)</code>.';
      if (!normalized.includes('batteryLevel')) return 'Cast <code>batteryLevel</code>.';
      return 'Check the shape: <code>double preciseBattery = (double) batteryLevel;</code>';
    }
    case 'string-length': {
      if (!/\bint\b/.test(normalized)) return 'Store the result in an int: use <code>int wordLen</code>.';
      if (!normalized.includes('wordLen')) return 'Name the variable <code>wordLen</code>.';
      if (!normalized.includes('.length()')) return 'Call <code>.length()</code> on the word variable.';
      if (!normalized.includes('word')) return 'Use the <code>word</code> variable.';
      return 'Check the shape: <code>int wordLen = word.length();</code>';
    }
    case 'string-charat': {
      if (!/\bchar\b/.test(normalized)) return 'Store the result in a char: use <code>char firstChar</code>.';
      if (!normalized.includes('firstChar')) return 'Name the variable <code>firstChar</code>.';
      if (!normalized.includes('.charAt(')) return 'Call <code>.charAt(index)</code> on the word.';
      if (!normalized.includes('0')) return 'Use index 0 for the first character.';
      return 'Check the shape: <code>char firstChar = word.charAt(0);</code>';
    }
    case 'string-substring': {
      if (!/\bString\b/.test(normalized)) return 'Store the result in a String: <code>String part</code>.';
      if (!normalized.includes('part')) return 'Name the variable <code>part</code>.';
      if (!normalized.includes('.substring(')) return 'Call <code>.substring(start, end)</code>.';
      if (!normalized.includes('1') || !normalized.includes('4')) return 'Use substring(1, 4) to get "ell".';
      return 'Check the shape: <code>String part = word.substring(1, 4);</code>';
    }
    case 'string-indexof': {
      if (!/\bint\b/.test(normalized)) return 'Store the result in an int: <code>int pos</code>.';
      if (!normalized.includes('pos')) return 'Name the variable <code>pos</code>.';
      if (!normalized.includes('.indexOf(')) return 'Call <code>.indexOf("char")</code>.';
      if (!/["']l["']/.test(normalized) && !normalized.includes('.indexOf("l")')) return 'Search for "l" (lowercase L).';
      return 'Check the shape: <code>int pos = word.indexOf("l");</code>';
    }
    case 'math-random': {
      if (!/\bdouble\b/.test(normalized)) return 'Store the result in a double: <code>double rand</code>.';
      if (!normalized.includes('rand')) return 'Name the variable <code>rand</code>.';
      if (!normalized.includes('Math.random()')) return 'Call <code>Math.random()</code>.';
      return 'Check the shape: <code>double rand = Math.random();</code>';
    }
    case 'math-max': {
      if (!/\bint\b/.test(normalized)) return 'Store the result in an int: <code>int stronger</code>.';
      if (!normalized.includes('stronger')) return 'Name the variable <code>stronger</code>.';
      if (!normalized.includes('Math.max(')) return 'Call <code>Math.max(a, b)</code>.';
      if (!normalized.includes('7') || !normalized.includes('12')) return 'Pass 7 and 12 as arguments.';
      return 'Check the shape: <code>int stronger = Math.max(7, 12);</code>';
    }
    case 'string-concat': {
      if (!/\bString\b/.test(normalized)) return 'Store the result in a String: <code>String scrapSays</code>.';
      if (!normalized.includes('scrapSays')) return 'Name the variable <code>scrapSays</code>.';
      if (!normalized.includes('"Beep"') || !normalized.includes('"boop"')) return 'Use "Beep" and "boop".';
      if (!normalized.includes('" "') && !normalized.includes('"  "')) return 'Add a space " " between them.';
      return 'Check the shape: <code>String scrapSays = "Beep" + " " + "boop";</code>';
    }
    default:
      return 'Something went wrong. Check the code shape.';
  }
}
