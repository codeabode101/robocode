# Robocode: Story & Concepts

## The World

You are a coder on a small island city built around a plaza. The city has roads, buildings, bazaars (Masala Chai, Code Bazaar, Snack Stop), and several key locations: Sparky's Apartment, Rafiq's Robots workshop, the Spare Parts Shop, and an Arena. You explore the world in a top-down 3D view with your keyboard (WASD/arrows).

## The Premise

A rusty robot named **Scrap** has been sitting motionless for years in Sparky's apartment (on the workbench), with no name, no memory, no power, and no voice. **Sparky** — a cheerful yellow robot who lives in the apartment and roams the plaza outside — has taken an interest in Scrap and recruits you to help bring them back to life. You learn Java step by step, each unit restoring a new capability to Scrap.

---

## Quest Stages & Flow

```
intro  ──[talk to Sparky]──▶  enter apartment
  │                                  │
  │                             tutorial auto-starts (Unit 1)
  │                                  │
  │                          [complete all challenges]
  │                                  │
  └──────▶  unit1-done  ◀────────────┘
                │
          [earn $5 at Rafiq's workshop]
          [buy Sensor Part at shop]
          [give Sensor to Sparky in apartment]
                │
                ▼
            unit2
                │
          [complete tutorial (Unit 2)]
                │
                ▼
          unit2-done
                │
          [earn $10 at workshop]
          [buy Voice Module at shop]
          [give to Sparky]
                │
                ▼
            unit3  *(not yet built)*
```

## The Characters

- **You (the coder):** Player avatar, third-person view. You enter code challenges, earn money, buy parts, and install them.
- **Sparky:** A yellow robot who lives in the apartment and hangs out in the plaza. Your guide. He talks you through the story, gives tutorials, and installs parts onto Scrap.
- **Scrap:** A brown/gray robot on the workbench in Sparky's apartment. Initially dead — no power, no eyes, no movement. As you complete challenges, Scrap gradually wakes up (eyes glow brighter, antenna lights up, body straightens). Fully repaired by the end.
- **Rafiq:** Owner of the workshop ("Rafiq's Robots"). Customers come in with robot requests. You complete Java coding orders to earn money.
- **Shopkeeper:** A robot at the Spare Parts Shop who sells replacement parts for Scrap.
- **Workshop customers:** Named NPCs (Aarav, Anaya, Rohan, Isha, etc.) who walk in with pet robot requests. Later, data-processing customers (Priya, Arjun, et al.) may appear with expression-based coding tasks.

---

## Unit 1: Primitive Types — Scrap's Awakening

**5 Acts, 12 challenges + dialogue. Covers AP CS A Unit 1.**

### Act 1: Identity
Sparky introduces Scrap — a nameless, lifeless bot. First step: give it a name.

| # | Concept | Challenge | Code to Write |
|---|---------|-----------|---------------|
| 1 | (dialogue) | Sparky explains the situation | — |
| 2 | `string-name` | Give it a name | `String name = "Scrap";` |
| 3 | (dialogue) | Sparky explains data types | — |
| 4 | `string-robot-name` | Declare model name | `String robotName = "Scrap";` |

### Act 2: Diagnostics
Check Scrap's vital signs — battery, temperature, and whether systems are online.

| # | Concept | Challenge | Code to Write |
|---|---------|-----------|---------------|
| 5 | (dialogue) | "Scrap's been dormant for years" | — |
| 6 | `int-battery` | Battery status | `int batteryLevel = 0;` |
| 7 | `double-temperature` | Temperature sensor | `double temperature = 25.5;` |
| 8 | `boolean-online` | Power state | `boolean isOnline = false;` |

### Act 3: Boot Sequence
Calculate power needed to boot. Java arithmetic operators: +, -, *, /, %.

| # | Concept | Challenge | Code to Write |
|---|---------|-----------|---------------|
| 9 | (dialogue) | Intro to math operators | — |
| 10 | `expression-add` | Boot power | `int powerNeeded = batteryLevel + 50;` |
| 11 | `expression-multiply` | Safety reserve | `int totalPower = powerNeeded * 2;` |
| 12 | (dialogue) | Modulo for memory sectors | — |
| 13 | `expression-modulo` | Memory sector | `int sector = 17 % 3;` |
| 14 | (dialogue) | Compound operators (+=, -=, etc.) | — |
| 15 | `compound-op` | Jump start | `batteryLevel += 10;` |

### Act 4: Calibration
Convert between types (casting). Explicit (int) and implicit widening.

| # | Concept | Challenge | Code to Write |
|---|---------|-----------|---------------|
| 16 | (dialogue) | Intro to casting | — |
| 17 | `cast-explicit` | Thermal truncation | `int rounded = (int) temperature;` |
| 18 | `cast-implicit` | Precision reading | `double precise = batteryLevel;` |
| 19 | (dialogue) | Type promotion in mixed expressions | — |
| 20 | `promotion-mixed` | Mixed-type math | `double result = 5 + 2.5;` |

### Act 5: Math Utilities
Java's Math class — abs, pow, sqrt, random.

| # | Concept | Challenge | Code to Write |
|---|---------|-----------|---------------|
| 21 | (dialogue) | Intro to Math class | — |
| 22 | `math-abs` | Absolute orientation | `int absolute = Math.abs(-5);` |
| 23 | `math-pow` | Signal strength | `double squared = Math.pow(3, 2);` |
| 24 | `math-sqrt` | Distance calculation | `double root = Math.sqrt(16);` |
| 25 | `math-random` | Random spark | `double rand = Math.random();` |

**Outcome:** Scrap's diagnostics are online! But the sensor is fried. Sparky sends you to earn $5 at the workshop and buy a **Sensor Part** from the Parts Shop.

---

## Unit 2: Using Objects — Scrap Learns to Speak

**13 phases — String methods, Scanner, Wrapper classes, == vs .equals(). Covers AP CS A Unit 2.**

After installing the sensor, Scrap can feel the world but can't talk back. Sparky found an old voice module.

| # | Concept | Challenge | Code to Write |
|---|---------|-----------|---------------|
| 1 | (dialogue) | "String is an object, not a primitive" | — |
| 2 | `string-length` | Word length | `String word = "Hello"; int wordLen = word.length();` |
| 3 | `string-indexof` | Find the letter | `int pos = word.indexOf("l");` |
| 4 | (dialogue) | Substrings explained | — |
| 5 | `string-substring` | Syllable slice | `String part = word.substring(1, 4);` |
| 6 | `string-equals` | Voice match | `boolean match = word.equals("Hello");` |
| 7 | `string-compareto` | Lexicographic order | `int cmp = word.compareTo("Apple");` |
| 8 | (dialogue) | Concatenation explained | — |
| 9 | `string-concat` | Scrap speaks! | `String scrapSays = "Beep" + " " + "boop";` |
| 10 | (dialogue) | Scanner for reading input | — |
| 11 | `scanner-int` | Read a number | `Scanner scan = new Scanner(System.in); int n = scan.nextInt();` |
| 12 | (dialogue) | Wrapper classes (Integer.parseInt) | — |
| 13 | `wrapper-parse` | Parse a number | `int val = Integer.parseInt("42");` |
| 14 | (dialogue) | == vs .equals() explained | — |
| 15 | `equals-vs-ref` | Proper comparison | `boolean same = str1.equals(str2);` |

**Outcome:** Scrap's voice module is operational (says "Beep boop")! But it's glitchy — needs a replacement. Sparky sends you to earn $10 and buy a **Voice Module**.

---

## The Workshop Economy (Side Content)

### Rafiq's Robots ("Rafiq's Robots")
A pet robot customization shop. Standard customers walk in with requests to set properties on robot pets:

- **Name** (String), **Color** (String), **Size** (int)
- You write variable declarations that match
- Correct code → customer follows you to the register → **$2 reward**
- Bonus timer ticks down for fast completion

### Data-Processing Orders (Unlocked after Sensor Part)
After giving Scrap the sensor, 45% of customers bring **data-processing** requests instead:

**Type A — Expression only** (6 templates):
- `int foodPortion = age + 3;`
- `boolean isAdult = age >= 18;`
- `int score = age * 2;`
- `int rounded = (int) temp;`
- `int bigger = Math.max(a, b);`
- `int totalFood = dogs * portion;`

**Type B — Full declaration** (4 templates):
- Declare age + compute food portion
- Declare temperature + cast to int
- Declare score + compute sqrt
- Declare boolean + int

### Spare Parts Shop
Located near the lake. Buy parts for Scrap:
- **Sensor Part** — $5 (for unit1-done)
- **Voice Module** — $10 (for unit2-done)
- **Navigation Chip** — $20 (for unit3-done, not yet used)

## Part Installation (Apartment)

When you bring a part to Sparky in the apartment, he walks to the workbench, welds it onto Scrap (with a sparkle burst effect and wobbling animation), and the part appears as a 3D mesh on Scrap's body:

- **Sensor Part** → blue glowing sphere on chest
- **Voice Module** → green glowing cylinder on neck
- **Navigation Chip** → gold glowing chip on back

After installation, the next unit's tutorial auto-starts.

---

## Visual Progression of Scrap

As you complete challenges, Scrap's appearance changes:
- Challenges 1-3: Eyes start dark (0x222222)
- Challenge 4+: Eyes gradually brighten (green glow)
- Challenge 6+: Antenna tip turns green
- Challenge 8+: Body straightens (rotation.z → 0)
- Challenge 10+: Antenna tip brightens further
- After parts installed: 3D part meshes appear on body
- (Eventual) Fully repaired → Arena unlocked

---

## Future Content

- **Unit 3** (Navigation Chip, $20): Planned — Boolean Expressions, if/else, control flow
- **Unit 4** (placeholder): Planned
- **Arena mode**: PvP Java coding battles (partially implemented)
- **Friends/Guilds**: Social features stubs exist
