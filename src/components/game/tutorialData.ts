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

export function getConceptErrorHint(concept: string, code: string): string {
  const normalized = String(code || '').replace(/\s+/g, ' ').trim();
  const varNameMatch = normalized.match(/^(String|int|double|boolean)\s+([A-Za-z_][A-Za-z0-9_]*)/);

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
    default:
      return 'Something went wrong. Check the code shape.';
  }
}
