export const ISLAND_RADIUS = 40;
export const PLAYER_RADIUS = 0.48;
export const MOVE_SPEED = 7.4;
export const NETWORK_SYNC_MS = 50;
export const NPC_POSITION = { x: 3.6, y: 1.8 };
export const ROOM_SPAWN = { x: 0, y: -3.7 };
export const ARENA_ROOM_SPAWN = { x: 0, y: -3.7 };
export const ROOM_OWNER_POS = { x: 2.35, y: 1.95 };
export const ROOM_COUNTER_POS = { x: 2.35, y: 2.25 };
export const CUSTOMER_TALK_DISTANCE = 1.25;
export const REGISTER_ZONE_RADIUS = 2.1;
export const REGISTER_NPC_RADIUS = 1.35;
export const ROOM_CUSTOMER_EXIT_POS = { x: -5.35, y: -4.55 };
export const ROOM_PET_BROWSE_POINTS = [
  { stand: { x: -2.35, y: 1.2 }, look: { x: -1.9, y: 0.5 } },
  { stand: { x: -2.9, y: 3.7 }, look: { x: -3.2, y: 3.25 } },
  { stand: { x: 2.7, y: -1.75 }, look: { x: 3.4, y: -2.4 } },
  { stand: { x: -1.3, y: -0.2 }, look: { x: -1.9, y: 0.5 } },
];
export const SPARKY_INTERACTION_DISTANCE = 1.7;
export const SCRAP_PART_COSTS: Record<string, number> = {
  'intro': 0,
  'unit1': 0,
  'unit1-done': 5,
  'unit2': 0,
  'unit2-done': 10,
  'unit3': 0,
  'unit3-done': 20,
  'unit4': 0,
  'all-done': 0,
};
export const CUSTOMER_NAMES = ['Aarav', 'Anaya', 'Rohan', 'Isha', 'Kabir', 'Meera', 'Vihaan', 'Diya'];
export const PET_NAMES = ['Bolt', 'Pixel', 'Nano', 'Mochi', 'Orbit', 'Zippy', 'Luna', 'Rex'];
export const PET_COLORS = ['red', 'blue', 'green', 'gold', 'teal', 'violet', 'orange', 'silver'];
export const REQUEST_PATTERNS = [
  ['name'], ['color'], ['size'], ['name', 'color'], ['name', 'size'], ['color', 'size'],
] as const;
export const WORKSHOP_INTRO_PAGES = [
  { title: "Welcome to Rafiq's Robots", body: 'Customers browse robots here. Walk up and press Space to start a job.' },
  { title: 'Do the Java task', body: 'Each customer asks for properties (name, color, size). Write code that matches.' },
  { title: 'Get paid at register', body: 'Correct code makes them follow you. Lead them to the register for $2.' },
] as const;

export const DATA_CUSTOMER_NAMES = ['Priya', 'Arjun', 'Kavya', 'Ravi', 'Neha', 'Vikram', 'Anjali', 'Deepak'];

export interface Vec2 { x: number; y: number }

export type CustomerProperty = 'name' | 'color' | 'size';

export type RequestType = 'standard' | 'data-processing';

export interface DataProcessingStep {
  givenInfo: string[];
  expectedCode: string[];
  description: string;
}

export interface CustomerRequest {
  customerName: string;
  petName: string;
  petColor: string;
  petSize: number;
  required: CustomerProperty[];
  requestType: RequestType;
  dataSteps?: DataProcessingStep[];
}

export type SparkyQuestStage = 'intro' | 'intro-done' | 'unit1' | 'unit1-done' | 'unit2' | 'unit2-done' | 'unit3' | 'unit3-done' | 'unit4' | 'all-done';

export type ScrapPartId = 'sensor' | 'voice' | 'navigation' | 'letter' | 'battery';

export type ScrapPart = {
  id: ScrapPartId;
  name: string;
  cost: number;
  questStage: SparkyQuestStage;
  description: string;
};

export const PARTS_CATALOG: ScrapPart[] = [
  { id: 'sensor', name: 'Sensor Part', cost: 5, questStage: 'unit1-done', description: 'A basic motion sensor for Scrap.' },
  { id: 'voice', name: 'Voice Module', cost: 10, questStage: 'unit2-done', description: 'A speech synthesizer module.' },
  { id: 'navigation', name: 'Navigation Chip', cost: 20, questStage: 'unit3-done', description: 'A GPS navigation chip.' },
  { id: 'battery', name: 'Battery Pack', cost: 10, questStage: 'intro', description: 'A fresh battery to power Scrap up.' },
];

export const PART_FOR_STAGE: Record<string, ScrapPartId> = {
  'unit1-done': 'sensor',
  'unit2-done': 'voice',
  'unit3-done': 'navigation',
};

export interface CustomerNpc {
  id: string;
  position: Vec2;
  target: Vec2;
  spotIndex: number;
  browseSpot: Vec2;
  speed: number;
  request: CustomerRequest;
  stage: 'walking-to-browse' | 'browsing' | 'awaiting-code' | 'follow-to-counter' | 'leaving';
}

export type TutorialConcept =
  | 'string-name'
  | 'string-robot-name'
  | 'int-battery'
  | 'double-temperature'
  | 'boolean-online'
  | 'expression-add'
  | 'expression-multiply'
  | 'expression-modulo'
  | 'compound-op'
  | 'cast-explicit'
  | 'cast-implicit'
  | 'math-random'
  | 'math-abs'
  | 'math-pow'
  | 'math-sqrt'
  | 'promotion-mixed'
  | 'string-length'
  | 'string-indexof'
  | 'string-substring'
  | 'string-equals'
  | 'string-compareto'
  | 'string-concat'
  | 'scanner-int'
  | 'wrapper-parse'
  | 'equals-vs-ref';

export type TutorialChallenge = {
  concept: TutorialConcept;
  title: string;
  prompt: string;
  hint: string;
  starterCode: string;
};

export type TutorialPhase =
  | { kind: 'dialogue'; npcText: string }
  | ({ kind: 'challenge'; npcText: string } & TutorialChallenge);

export type Hitbox = 
  | { shape: 'circle'; center: Vec2; radius: number }
  | { shape: 'box'; center: Vec2; halfWidth: number; halfHeight: number };
