import type { TutorialPhase } from './types';

export const tutorialPhases: TutorialPhase[] = [
  {
    kind: 'dialogue',
    npcText:
      "Hey coder! I'm Sparky 🤖. Let's unlock your first job by learning variables.",
  },
  {
    kind: 'dialogue',
    npcText:
      'First quick demo: <code>String robotName = "Sparky";</code>. Now you will do your own in 3 short rounds.',
  },
  {
    kind: 'challenge',
    concept: 'string-name',
    title: 'Round 1: Name a pet',
    prompt: 'Create a String for a pet name.',
    hint: 'Hint: Strings are text, so put the value in double quotes.',
    starterCode: 'String petName = "Milo";',
    npcText:
      'Now you try! Make a pet name String. You can change both variable name and value.',
  },
  {
    kind: 'challenge',
    concept: 'string-color',
    title: 'Round 2: Set a color',
    prompt: 'Make a String for color.',
    hint: 'Hint: use this shape → <code>String petColor = "blue";</code> (color must stay in quotes).',
    starterCode: 'String petColor = "blue";',
    npcText:
      'Great! Next make a color String. Keep <code>String</code>, add a variable name, then a quoted color value.',
  },
  {
    kind: 'challenge',
    concept: 'int-age',
    title: 'Round 3: Add age with int',
    prompt: 'Now make an int for age.',
    hint: 'Hint: use a whole number with no quotes: <code>int petAge = 2;</code>',
    starterCode: 'int petAge = 2;',
    npcText:
      'Final round! Make an <code>int</code> variable for age. Use a number (no quotes).',
  },
];
