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
export const MASALA_CHAI_SHOP_POS = { x: -3.85, y: -1.8 };
export const SPARKY_INTERACTION_DISTANCE = 1.7;
export const CUSTOMER_NAMES = ['Aarav', 'Anaya', 'Rohan', 'Isha', 'Kabir', 'Meera', 'Vihaan', 'Diya'];
export const PET_NAMES = ['Bolt', 'Pixel', 'Nano', 'Mochi', 'Orbit', 'Zippy', 'Luna', 'Rex'];
export const PET_COLORS = ['red', 'blue', 'green', 'gold', 'teal', 'violet', 'orange', 'silver'];
export const REQUEST_PATTERNS = [
  ['name'], ['color'], ['size'], ['name', 'color'], ['name', 'size'], ['color', 'size'],
] as const;
export const WORKSHOP_INTRO_PAGES = [
  { title: "Welcome to Rafiq's Workshop", body: 'Customers browse robo-pets here. Walk up and press Space to start a job.' },
  { title: 'Do the Java task', body: 'Each customer asks for properties (name, color, size). Write code that matches.' },
  { title: 'Get paid at register', body: 'Correct code makes them follow you. Lead them to the register for $2.' },
] as const;

export interface Vec2 { x: number; y: number }

export type CustomerProperty = 'name' | 'color' | 'size';

export interface CustomerRequest {
  customerName: string;
  petName: string;
  petColor: string;
  petSize: number;
  required: CustomerProperty[];
}

export type SparkyQuestStage = 'intro' | 'earn-money' | 'buy-chai' | 'gift-ready' | 'done';

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

export type TutorialChallenge = {
  concept: 'string-name' | 'string-color' | 'int-age';
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
