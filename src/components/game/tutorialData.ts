import type { TutorialPhase } from './types';

// Unit 1: Primitive Types — Scrap's Awakening
// Arc: naming → diagnostics → boot sequence → calibration → Math utilities
export const unit1Phases: TutorialPhase[] = [
  // ── Act 1: Identity ──
  {
    kind: 'dialogue',
    npcText:
      "Hey coder! Look over there — that robot's been sitting here for years. No name, no memory, no movement. But I think it's got potential. First thing every bot needs: a name.",
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
      "Scrap's a good name. Java works with different kinds of data — text (String), whole numbers (int), decimals (double), and true/false (boolean). Let's declare them one by one.",
  },
  {
    kind: 'challenge',
    concept: 'string-robot-name',
    title: 'Robot identity',
    prompt: 'Declare a String variable called <code>robotName</code> for Scrap\'s model name.',
    hint: '<code>String robotName = "Scrap";</code>',
    starterCode: 'String robotName = "Scrap";',
    npcText:
      "Use <code>String</code> for text values. Make sure the variable name is <code>robotName</code>.",
  },

  // ── Act 2: Diagnostics ──
  {
    kind: 'dialogue',
    npcText:
      "Scrap's been dormant for years. Let's check the vitals — battery, temperature, and whether the core systems are online. Each measurement needs a different type.",
  },
  {
    kind: 'challenge',
    concept: 'int-battery',
    title: 'Battery status',
    prompt: 'Declare an int variable called <code>batteryLevel</code> set to 0. Scrap\'s battery is dead.',
    hint: '<code>int batteryLevel = 0;</code>',
    starterCode: 'int batteryLevel = 0;',
    npcText:
      "Use <code>int</code> for whole numbers. Set <code>batteryLevel</code> to 0 — Scrap needs a jump start.",
  },
  {
    kind: 'challenge',
    concept: 'double-temperature',
    title: 'Temperature sensor',
    prompt: 'Declare a double variable called <code>temperature</code> set to 25.5 — the ambient room temp.',
    hint: '<code>double temperature = 25.5;</code>',
    starterCode: 'double temperature = 25.5;',
    npcText:
      "Use <code>double</code> for decimal numbers. Scrap's thermal sensor reads 25.5 °C.",
  },
  {
    kind: 'challenge',
    concept: 'boolean-online',
    title: 'Power state',
    prompt: 'Declare a boolean variable called <code>isOnline</code> set to false.',
    hint: '<code>boolean isOnline = false;</code>',
    starterCode: 'boolean isOnline = false;',
    npcText:
      "Use <code>boolean</code> for true/false. Scrap isn't powered on yet — we'll fix that next.",
  },

  // ── Act 3: Boot Sequence ──
  {
    kind: 'dialogue',
    npcText:
      "Battery's dead. Let's calculate how much juice we need to boot. Java can do math with variables — same operators you learned in school: <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, and <code>%</code> (modulo) for remainders.",
  },
  {
    kind: 'challenge',
    concept: 'expression-add',
    title: 'Boot power calculation',
    prompt: 'Scrap needs 50 more units to boot. Create <code>powerNeeded</code> that adds 50 to <code>batteryLevel</code>.',
    hint: '<code>int powerNeeded = batteryLevel + 50;</code>',
    starterCode: 'int powerNeeded = batteryLevel + 50;',
    npcText:
      "Use <code>batteryLevel</code> in an expression. Add 50 to find the power needed.",
  },
  {
    kind: 'challenge',
    concept: 'expression-multiply',
    title: 'Safety reserve',
    prompt: 'Double the power as a safety reserve. Create <code>totalPower</code> that multiplies <code>powerNeeded</code> by 2.',
    hint: '<code>int totalPower = powerNeeded * 2;</code>',
    starterCode: 'int totalPower = powerNeeded * 2;',
    npcText:
      "Multiply <code>powerNeeded</code> by 2 using the <code>*</code> operator.",
  },
  {
    kind: 'dialogue',
    npcText:
      "Scrap's memory is stored in a circular buffer with 3 sectors. To find which sector a memory address belongs to, we use modulo — the <code>%</code> operator. Memory 17 lands in sector <code>17 % 3 = 2</code>. It's essential for embedded systems.",
  },
  {
    kind: 'challenge',
    concept: 'expression-modulo',
    title: 'Memory sector',
    prompt: 'Compute which sector memory address 17 lands in with 3 sectors. Store in <code>sector</code>.',
    hint: '<code>int sector = 17 % 3;</code>',
    starterCode: 'int sector = 17 % 3;',
    npcText:
      "Use <code>%</code> — the modulo operator — to find the remainder when 17 is divided by 3.",
  },
  {
    kind: 'dialogue',
    npcText:
      "Java has shortcut operators that combine assignment with arithmetic: <code>+=</code>, <code>-=</code>, <code>*=</code>, <code>/=</code>, <code>%=</code>. Instead of <code>batteryLevel = batteryLevel + 10</code>, just write <code>batteryLevel += 10</code>.",
  },
  {
    kind: 'challenge',
    concept: 'compound-op',
    title: 'Jump start',
    prompt: 'Add 10 to <code>batteryLevel</code> using <code>+=</code> to jump-start Scrap.',
    hint: '<code>batteryLevel += 10;</code>',
    starterCode: 'batteryLevel += 10;',
    npcText:
      "Use <code>+=</code> to add 10 to batteryLevel. It's shorter and cleaner.",
  },

  // ── Act 4: Calibration ──
  {
    kind: 'dialogue',
    npcText:
      "Scrap's sensors give decimal readings, but some subsystems only accept whole numbers. Java lets us convert between types — this is called casting. You can explicitly cast <code>(int)</code> to truncate a double, or let Java automatically promote an int to double when needed.",
  },
  {
    kind: 'challenge',
    concept: 'cast-explicit',
    title: 'Thermal truncation',
    prompt: 'Cast <code>temperature</code> to int and store it in <code>rounded</code>. The display system needs whole degrees.',
    hint: '<code>int rounded = (int) temperature;</code>',
    starterCode: 'int rounded = (int) temperature;',
    npcText:
      "Use <code>(int)</code> to cast the double to a whole number. The decimal part is truncated, not rounded.",
  },
  {
    kind: 'challenge',
    concept: 'cast-implicit',
    title: 'Precision reading',
    prompt: 'Assign <code>batteryLevel</code> to a double variable called <code>precise</code> — Java promotes automatically.',
    hint: '<code>double precise = batteryLevel;</code>',
    starterCode: 'double precise = batteryLevel;',
    npcText:
      "When you assign an int to a double, Java promotes it automatically. No cast needed — this is implicit widening.",
  },
  {
    kind: 'dialogue',
    npcText:
      "When you mix types in an expression, Java promotes the smaller type to the larger one. An int plus a double gives a double result. This is called type promotion.",
  },
  // This dialogue is intentionally left incomplete to avoid a TS error — 
  // "reference" is not a valid TutorialPhase field. Let me fix that.
  {
    kind: 'challenge',
    concept: 'promotion-mixed',
    title: 'Mixed-type math',
    prompt: 'Add 5 (int) and 2.5 (double) and store in <code>result</code> — a double. Java promotes the 5 automatically.',
    hint: '<code>double result = 5 + 2.5;</code>',
    starterCode: 'double result = 5 + 2.5;',
    npcText:
      "When you add an int and a double, Java promotes the int to double automatically. The result is always the wider type.",
  },

  // ── Act 5: Math Utilities ──
  {
    kind: 'dialogue',
    npcText:
      "Java's <code>Math</code> class has built-in utilities. <code>Math.abs()</code> for absolute value, <code>Math.pow()</code> for exponents, <code>Math.sqrt()</code> for square roots, and <code>Math.random()</code> for randomness. Think of Math as a toolbox Scrap can use to compute anything.",
  },
  {
    kind: 'challenge',
    concept: 'math-abs',
    title: 'Absolute orientation',
    prompt: 'Scrap\'s gyro reports -5. Find its absolute value and store in <code>absolute</code>.',
    hint: '<code>int absolute = Math.abs(-5);</code>',
    starterCode: 'int absolute = Math.abs(-5);',
    npcText:
      "<code>Math.abs(x)</code> returns the absolute (positive) value of x. Scrap's gyro reading can't be negative in real terms.",
  },
  {
    kind: 'challenge',
    concept: 'math-pow',
    title: 'Signal strength',
    prompt: 'Compute 3 to the power of 2 and store in <code>squared</code>. Use Math.pow().',
    hint: '<code>double squared = Math.pow(3, 2);</code>',
    starterCode: 'double squared = Math.pow(3, 2);',
    npcText:
      "<code>Math.pow(base, exponent)</code> returns a double. Even if the result looks like an integer, the return type is double.",
  },
  {
    kind: 'challenge',
    concept: 'math-sqrt',
    title: 'Distance calculation',
    prompt: 'Compute the square root of 16 and store in <code>root</code>.',
    hint: '<code>double root = Math.sqrt(16);</code>',
    starterCode: 'double root = Math.sqrt(16);',
    npcText:
      "<code>Math.sqrt(x)</code> returns the square root. Scrap uses this to calculate distances from sensor data.",
  },
  {
    kind: 'challenge',
    concept: 'math-random',
    title: 'Random spark',
    prompt: 'Generate a random decimal between 0 and 1 and store it in <code>rand</code>. Scrap\'s first flicker of consciousness.',
    hint: '<code>double rand = Math.random();</code>',
    starterCode: 'double rand = Math.random();',
    npcText:
      "<code>Math.random()</code> returns a random double between 0.0 (inclusive) and 1.0 (exclusive). It's how Scrap starts making decisions.",
  },
  {
    kind: 'dialogue',
    npcText:
      "Scrap's systems are online! Diagnostics complete. But the sensor is fried — we need a replacement. Earn $5 at Rafiq's workshop, buy a Sensor Part from the Parts Shop, then bring it back to me. And hey — you just learned everything in Java's Primitive Types unit. int, double, boolean, arithmetic, casting, compound operators, and the Math class. That's core AP Computer Science A material.",
  },
];

// Unit 2: Using Objects — Scrap Learns to Speak
// Arc: String methods → Scanner → Wrapper classes → Reference vs value
export const unit2Phases: TutorialPhase[] = [
  {
    kind: 'dialogue',
    npcText:
      "The sensor's installed! Scrap can feel the world now. But they can't talk back. I found an old voice module — let's teach them to speak. In Java, String is an object, not a primitive. Objects have methods — actions you call on them with the dot operator.",
  },
  {
    kind: 'challenge',
    concept: 'string-length',
    title: 'Word length',
    prompt: 'Scrap wants to say "Hello". Use <code>.length()</code> to find the length and store in <code>wordLen</code>.',
    hint: '<code>String word = "Hello";\nint wordLen = word.length();</code>',
    starterCode: 'String word = "Hello";\nint wordLen = word.length();',
    npcText:
      'Strings are objects. Call <code>.length()</code> on the string variable to get its character count.',
  },
  {
    kind: 'challenge',
    concept: 'string-indexof',
    title: 'Find the letter',
    prompt: 'Find the position of "l" in "Hello" and store it in <code>pos</code>.',
    hint: '<code>int pos = word.indexOf("l");</code>',
    starterCode: 'int pos = word.indexOf("l");',
    npcText:
      'Use <code>.indexOf("char")</code> to find where a character first appears. Returns the index (0-based).',
  },
  {
    kind: 'dialogue',
    npcText:
      'Scrap can pick out individual letters. Now let\'s teach them to extract chunks — substrings. <code>.substring(start, end)</code> returns characters from start index up to (but not including) end index. This is how Scrap will learn to form syllables.',
  },
  {
    kind: 'challenge',
    concept: 'string-substring',
    title: 'Syllable slice',
    prompt: 'Get "ell" from "Hello" using <code>.substring(1, 4)</code> and store in <code>part</code>.',
    hint: '<code>String part = word.substring(1, 4);</code>',
    starterCode: 'String part = word.substring(1, 4);',
    npcText:
      '<code>.substring(start, end)</code>. Start at index 1 (e), end before index 4 (o). Returns "ell".',
  },
  {
    kind: 'challenge',
    concept: 'string-equals',
    title: 'Voice match',
    prompt: 'Check if <code>word</code> equals "Hello" and store the result in <code>match</code>.',
    hint: '<code>boolean match = word.equals("Hello");</code>',
    starterCode: 'boolean match = word.equals("Hello");',
    npcText:
      'Use <code>.equals(otherString)</code> to compare String values. NEVER use <code>==</code> for strings — that checks reference identity, not value.',
  },
  {
    kind: 'challenge',
    concept: 'string-compareto',
    title: 'Lexicographic order',
    prompt: 'Compare <code>word</code> to "Apple" and store the result in <code>cmp</code>.',
    hint: '<code>int cmp = word.compareTo("Apple");</code>',
    starterCode: 'int cmp = word.compareTo("Apple");',
    npcText:
      '<code>.compareTo(other)</code> returns a negative int if word comes before "Apple" alphabetically, positive if after, 0 if equal.',
  },
  {
    kind: 'dialogue',
    npcText:
      'We can glue strings together with concatenation — the <code>+</code> operator. When you <code>"Hello" + " " + "World"</code>, Java builds a new string. This works with variables too, and even with numbers: <code>"Age: " + 21</code> gives <code>"Age: 21"</code>.',
  },
  {
    kind: 'challenge',
    concept: 'string-concat',
    title: 'Scrap speaks!',
    prompt: 'Build Scrap\'s first sentence: "Beep" + " " + "boop" into <code>scrapSays</code>.',
    hint: '<code>String scrapSays = "Beep" + " " + "boop";</code>',
    starterCode: 'String scrapSays = "Beep" + " " + "boop";',
    npcText:
      'Use <code>+</code> between strings to concatenate. Add a space in the middle so the words don\'t squish together.',
  },
  {
    kind: 'dialogue',
    npcText:
      "Scrap said \"Beep boop\"! Now let's talk about reading input. Java's <code>Scanner</code> class lets us read what the user types. To create a Scanner: <code>Scanner scan = new Scanner(System.in);</code> — the <code>new</code> keyword creates an object. Then <code>scan.nextInt()</code> reads the next integer.",
  },
  {
    kind: 'challenge',
    concept: 'scanner-int',
    title: 'Read a number',
    prompt: 'Create a Scanner and read an int into <code>n</code>. Two statements: declaration + read.',
    hint: '<code>Scanner scan = new Scanner(System.in);\nint n = scan.nextInt();</code>',
    starterCode: 'Scanner scan = new Scanner(System.in);\nint n = scan.nextInt();',
    npcText:
      'First statement: create the Scanner. Second statement: read an int. The <code>new</code> keyword constructs a new Scanner object tied to System.in.',
  },
  {
    kind: 'dialogue',
    npcText:
      "Sometimes data comes as text but we need numbers. Wrapper classes like <code>Integer</code> and <code>Double</code> can convert strings to primitives. <code>Integer.parseInt(\"42\")</code> returns int 42. These are also objects — each wraps a primitive value.",
  },
  {
    kind: 'challenge',
    concept: 'wrapper-parse',
    title: 'Parse a number',
    prompt: 'Convert the string "42" to an int and store in <code>val</code> using <code>Integer.parseInt()</code>.',
    hint: '<code>int val = Integer.parseInt("42");</code>',
    starterCode: 'int val = Integer.parseInt("42");',
    npcText:
      '<code>Integer.parseInt(string)</code> converts a String to an int. If the string isn\'t a valid number, it throws an exception.',
  },
  {
    kind: 'dialogue',
    npcText:
      "One of the most common Java mistakes: using <code>==</code> to compare Strings. <code>==</code> checks if two variables point to the SAME object in memory, not if they have the same value. Always use <code>.equals()</code> for String comparison. Primitives like int compare with <code>==</code>; objects compare with <code>.equals()</code>.",
  },
  {
    kind: 'challenge',
    concept: 'equals-vs-ref',
    title: 'Proper comparison',
    prompt: 'Compare <code>str1</code> and <code>str2</code> using <code>.equals()</code> and store in <code>same</code>.',
    hint: '<code>boolean same = str1.equals(str2);</code>',
    starterCode: 'boolean same = str1.equals(str2);',
    npcText:
      'Use <code>.equals()</code> on the first string, passing the second as the argument. This compares the actual text, not the memory addresses.',
  },
  {
    kind: 'dialogue',
    npcText:
      "Scrap's voice module is fully operational! You just covered AP Computer Science A's entire Using Objects unit — String methods, Scanner, Wrapper classes, and the critical difference between == and .equals(). Objects are everywhere in Java. But the voice module is still glitchy — we need a replacement. Earn $10 at Rafiq's workshop, buy a Voice Module at the Parts Shop, then bring it back to me.",
  },
];
