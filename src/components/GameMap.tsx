'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { SparkyQuestStage, CustomerRequest, TutorialPhase } from '@/components/game/types';
import Editor from '@/components/game/Editor';
import TutorialOverlay from '@/components/game/TutorialOverlay';
import ArenaOverlay from '@/components/game/ArenaOverlay';
import ModalShell from './ModalShell';
import WorkshopPanel from '@/components/game/WorkshopPanel';
import type { RobotVisual, HumanVisual } from '@/components/game/scene';
import {
  createLabelSprite, createNameSprite, createGradientTexture, getTileTexture,
  createToonMaterial, createTexturedToonMaterial,
  createGrid, createPalmTree, createBazaarShop, createRangoli, addWindows, addOutline, applyShadows, disposeObject,
  createRobotVisual, buildPlayerVisual, createHumanVisual, createPartsShop, createPartModel, createApartmentBuilding, animateRobotVisual, LABEL_BUILD_TAG, WALK_BOB_SPEED,
  addExclamationMarker, createRepairKiosk, animateRepairKiosk, animateRepairSparky, animateSparkyWave,
} from '@/components/game/scene';
import { pickRandom, hashColor, getWorkshopRequestSignature, validateWorkshopCode, createPartIcon, createDataRequest, computeCameraZoom, createCardboardBox, createLaptop, createWire, createWireCoil, animateWirePulse, openBoxLid, isInsideHitbox, collidesWithAny, escapeHtml, highlightJava } from '@/components/game/helpers';
import type { BuildingFootprint } from '@/components/game/helpers';
import { buildObstacles } from '@/components/game/city';
import { unit1Phases, unit2Phases } from '@/components/game/tutorialData';
import { PARTS_CATALOG, PART_FOR_STAGE, DATA_CUSTOMER_NAMES } from '@/components/game/types';
import type { ScrapPartId } from '@/components/game/types';
import { gameStore, useGameStoreKey } from '@/store/useGameState';

// If URL contains ?nocache=1 and no cache-bust, unregister service workers and reload
if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('nocache') && !params.has('cb')) {
      // unregister existing service workers then reload with cache-bust param
      navigator.serviceWorker
        ?.getRegistrations()
        .then((regs) => {
          regs.forEach((r) => r.unregister());
          console.log('Robocode: unregistered service workers to bypass cache');
          params.set('cb', String(Date.now()));
          const newUrl = window.location.pathname + '?' + params.toString();
          window.location.replace(newUrl);
        })
        .catch((err) => {
          console.warn('Robocode: failed to unregister service worker', err);
          params.set('cb', String(Date.now()));
          const newUrl = window.location.pathname + '?' + params.toString();
          window.location.replace(newUrl);
        });
    }
  } catch (e) {
    // ignore parsing errors
    // eslint-disable-next-line no-console
    console.warn('Robocode: nocache handler error', e);
  }

  // show a small build banner so users can verify bundle version visually
  try {
    const bannerId = 'label-build-banner';
    let banner = document.getElementById(bannerId);
    if (!banner) {
      banner = document.createElement('div');
      banner.id = bannerId;
      banner.style.position = 'fixed';
      banner.style.right = '8px';
      banner.style.bottom = '8px';
      banner.style.padding = '6px 8px';
      banner.style.background = 'rgba(0,0,0,0.7)';
      banner.style.color = '#fff';
      banner.style.fontSize = '12px';
      banner.style.zIndex = '2147483647';
      banner.style.borderRadius = '6px';
      document.body.appendChild(banner);
    }
    // LABEL_BUILD_TAG is inserted elsewhere in this file
    // @ts-ignore
    banner.textContent = (typeof LABEL_BUILD_TAG !== 'undefined' ? LABEL_BUILD_TAG : 'no-tag') + ' — ' + new Date().toLocaleTimeString();
  } catch (e) {
    // ignore
  }
}

interface GameMapProps {
  userId: string;
  apinatorAppKey: string;
  apinatorCluster: 'us' | 'eu';
}

  const ISLAND_RADIUS = 40;
  const SPARKY_PATH = [
    { x: -2.87, y: -6.1 }, { x: -2.87, y: -6.9 }, { x: -2.87, y: -6.1 },
  ];
const PLAYER_RADIUS = 0.48;
const MOVE_SPEED = 7.4;
const NETWORK_SYNC_MS = 50;
const NPC_POSITION = new THREE.Vector2(-2.87, -6.1);

const REMOTE_LERP = 0.35;
const SPARKY_INTRO_CONVO = [
  {
    text: "Woah! Hey there! Can you help me? I found something amazing in my apartment!",
    choices: [{ label: 'Sure thing!', next: 2 }, { label: 'No...', next: 1 }],
  },
  {
    text: "I really need your help, please. So here's what we do...",
    choices: [{ label: "Okay, let's go!", next: 2 }],
  },
  {
    text: "I found an old robot in my apartment — just sitting there, dusty, no name. I think we can bring it back to life!",
    choices: [{ label: 'Continue', next: 3 }],
  },
  {
    text: "Follow me upstairs — I'll show you! Door's right over here ↖️",
    choices: [{ label: "Let's go!", next: -1 }],
  },
];
const BATTERY_DLG_STEPS = [
  { speaker: 'Sparky', text: "Oh no! The battery's completely dead... we need a new one." },
  { speaker: 'Sparky', text: "I've written a letter to Rafiq at the robot shop. Take this to him — he'll sort you out with a job so you can earn enough for a battery." },
  { speaker: 'Sparky', text: "Rafiq's shop is just outside, down the street. Show him my letter and he'll know what to do. Good luck!" },
];
const RAFIQ_LETTER_STEPS = [
  { speaker: 'Rafiq', text: "Let's see here... 'Sparky sent me'... Ah, that old bot finally gave up, eh?" },
  { speaker: 'Rafiq', text: "Well, I could use a hand around the shop. Help my customers with their robot requests — write some Java code for 'em — and I'll pay you. Fair?" },
];
const PLAYER_EYE_HEIGHT = 1.5;
const ROOM_SPAWN = new THREE.Vector2(0, -3.7);
const ARENA_ROOM_SPAWN = new THREE.Vector2(0, 3.7);
const APARTMENT_SPAWN = new THREE.Vector2(0, -1.5);
const APARTMENT_EXIT = new THREE.Vector2(-8.5, -5.8);
const ROOM_OWNER_POS = new THREE.Vector2(2.35, 1.95);
const ROOM_COUNTER_POS = new THREE.Vector2(2.35, 2.25);
const CUSTOMER_TALK_DISTANCE = 1.25;
const REGISTER_ZONE_RADIUS = 2.1;
const REGISTER_NPC_RADIUS = 1.35;
const ROOM_CUSTOMER_EXIT_POS = new THREE.Vector2(-5.35, -4.55);
const ROOM_PET_BROWSE_POINTS = [
  { stand: new THREE.Vector2(-2.35, 1.2), look: new THREE.Vector2(-1.9, 0.5) },
  { stand: new THREE.Vector2(-2.9, 3.7), look: new THREE.Vector2(-3.2, 3.25) },
  { stand: new THREE.Vector2(2.7, -1.75), look: new THREE.Vector2(3.4, -2.4) },
  { stand: new THREE.Vector2(-1.3, -0.2), look: new THREE.Vector2(-1.9, 0.5) },
];

const SPARKY_INTERACTION_DISTANCE = 1.7;
const CUSTOMER_NAMES = ['Aarav', 'Anaya', 'Rohan', 'Isha', 'Kabir', 'Meera', 'Vihaan', 'Diya'];
const PET_NAMES = ['Bolt', 'Pixel', 'Nano', 'Mochi', 'Orbit', 'Zippy', 'Luna', 'Rex'];
const PET_COLORS = ['red', 'blue', 'green', 'gold', 'teal', 'violet', 'orange', 'silver'];
const REQUEST_PATTERNS = [
  ['name'],
  ['color'],
  ['size'],
  ['name', 'color'],
  ['name', 'size'],
  ['color', 'size'],
] as const;
const WORKSHOP_INTRO_STEPS = [
  { speaker: 'Rafiq', text: "Welcome! Customers browse robots here. Walk up to one and press Space to start a job." },
  { speaker: 'Rafiq', text: "Each customer asks for different properties (name, color, size). Write code that matches exactly." },
  { speaker: 'Rafiq', text: "After correct code, they follow you. Lead them to the register to collect your money." },
] as const;

type CircleHitbox = {
  shape: 'circle';
  center: { x: number; y: number };
  radius: number;
};

type BoxHitbox = {
  shape: 'box';
  center: { x: number; y: number };
  halfWidth: number;
  halfHeight: number;
};

type Hitbox = CircleHitbox | BoxHitbox;

type ArenaPlayer = {
  id: string;
  name: string;
};

  type RemoteAvatar = {
    root: THREE.Group;
    nameSprite: THREE.Sprite;
    target: THREE.Vector2;
    name: string;
    walkTime: number;
    room: string;
    leftLegPivot: THREE.Group;
    rightLegPivot: THREE.Group;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    facingRotation: number;
  };

type CustomerNpc = {
  id: string;
  visual: HumanVisual & { marker?: THREE.Sprite };
  position: THREE.Vector2;
  target: THREE.Vector2;
  spotIndex: number;
  browseSpot: THREE.Vector2;
  petLookTarget: THREE.Vector2;
  speed: number;
  request: CustomerRequest;
  stage: 'walking-to-browse' | 'browsing' | 'awaiting-code' | 'follow-to-counter' | 'leaving';
};

export default function GameMap({ userId, apinatorAppKey, apinatorCluster }: GameMapProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLTextAreaElement>(null);
  const codePreviewRef = useRef<HTMLPreElement>(null);
  const mp = useMultiplayer(userId, apinatorAppKey, apinatorCluster);
  const { players, connected, playerCount, sendPosition, triggerEvent, positionBroadcastRef } = mp;
  positionBroadcastRef.current = () => {
    const room = inArenaRoomRef.current ? 'arena' : inWorkshopRoomRef.current ? 'workshop' : inApartmentRoomRef.current ? 'apartment' : inShopRoomRef.current ? 'shop' : 'outside';
    const spawns: Record<string, { x: number; y: number }> = { workshop: ROOM_SPAWN, arena: ARENA_ROOM_SPAWN, apartment: APARTMENT_SPAWN, shop: { x: 0, y: 1.2 } };
    const pos = room !== 'outside' ? spawns[room] : { x: localPositionRef.current.x, y: localPositionRef.current.y };
    sendPosition(pos.x, pos.y, room, yawRef.current);
  };

  const localPositionRef = useRef(new THREE.Vector2(0, 0));
  const localRobotRef = useRef<RobotVisual | null>(null);
  const leftLegPivotRef = useRef<THREE.Group | null>(null);
  const rightLegPivotRef = useRef<THREE.Group | null>(null);
  const remoteAvatarsRef = useRef<Record<string, RemoteAvatar>>({});
  const keyStateRef = useRef<Set<string>>(new Set());
  const tutorialPhasesRef = useRef<TutorialPhase[]>(unit1Phases);
  const tutorialStepRef = useRef(0);
  const robotNameRef = useRef('Scrap');
  const showTutorialRef = useRef(false);
  const tutorialCompleteRef = useRef(false);
  const shopUnlockedRef = useRef(false);
  const inWorkshopRoomRef = useRef(false);
  const inArenaRoomRef = useRef(false);
  const inApartmentRoomRef = useRef(false);
  const sendAtRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const petShopRef = useRef<THREE.Group | null>(null);
  const obstacleHitboxesRef = useRef<Hitbox[]>([]);
  const yawRef = useRef(0);
  const cameraPitchRef = useRef(0.8);
  const zoomOffsetRef = useRef(0);
  const roomObstacleHitboxesRef = useRef<Hitbox[]>([]);
  const workshopObstaclesRef = useRef<Hitbox[]>([]);
  const shopObstaclesRef = useRef<Hitbox[]>([]);
  const workshopDoorHitboxRef = useRef<CircleHitbox | null>(null);
  const workshopDoorArmedRef = useRef(true);
  const workshopCustomersRef = useRef<CustomerNpc[]>([]);
  const lastWorkshopRequestSigRef = useRef<string | null>(null);
  const customerSpawnTimerRef = useRef(0);
  const currentCustomerIdRef = useRef<string | null>(null);
  const interactionRequestedRef = useRef(false);
  const worldInteractionRequestedRef = useRef(false);
  const interactionCandidateIdRef = useRef<string | null>(null);
  const workshopIntroSeenRef = useRef(false);
  const roomOwnerVisualRef = useRef<RobotVisual | null>(null);
  const roomPetVisualRef = useRef<RobotVisual | null>(null);
  const roomCustomerGroupRef = useRef<THREE.Group | null>(null);
  const roomEntryFlashTimeoutRef = useRef<number | null>(null);
  const scrapRobotRef = useRef<ReturnType<typeof createRobotVisual> | null>(null);
  const scrapChallengesDoneRef = useRef(0);
  const miniRobotRefs = useRef<ReturnType<typeof createRobotVisual>[]>([]);
  const sceneBgOverrideRef = useRef<number | null>(null);

  const outdoorGroupRef = useRef<THREE.Group | null>(null);
  const workshopRoomGroupRef = useRef<THREE.Group | null>(null);
  const arenaRoomGroupRef = useRef<THREE.Group | null>(null);
  const apartmentRoomGroupRef = useRef<THREE.Group | null>(null);
  const arenaBuildingRef = useRef<THREE.Group | null>(null);
  const arenaDoorHitboxRef = useRef<CircleHitbox | null>(null);
  const arenaDoorArmedRef = useRef(true);
  const apartmentDoorHitboxRef = useRef<CircleHitbox | null>(null);
  const apartmentDoorArmedRef = useRef(false);
  const apartmentDoorMarkerRef = useRef<THREE.Sprite | null>(null);
  const apartmentSparkyRef = useRef<ReturnType<typeof createRobotVisual> | null>(null);
  const sparkyQuestMarkerRef = useRef<THREE.Sprite | null>(null);
  const workshopDoorMarkerRef = useRef<THREE.Sprite | null>(null);
  const shopDoorMarkerRef = useRef<THREE.Sprite | null>(null);
  const shopDoorHitboxRef = useRef<CircleHitbox | null>(null);
  const shopDoorArmedRef = useRef(true);
  const shopRoomGroupRef = useRef<THREE.Group | null>(null);
  const shopNpcRef = useRef<ReturnType<typeof createRobotVisual> | null>(null);
  const transportHitboxRef = useRef<CircleHitbox | null>(null);
  const sparkyPathIndexRef = useRef(0);
  const sparkyWaitTimerRef = useRef(0);
  const outdoorSparkyRef = useRef<ReturnType<typeof createRobotVisual> | null>(null);
  const scrapPartMeshRef = useRef<THREE.Mesh | null>(null);
  const sparkyInstallPhaseRef = useRef<'walk-to-bench' | 'weld' | 'attach-part' | 'walk-back' | 'done' | null>(null);
  const sparkyInstallTimerRef = useRef(0);
  const sparkyInstallPartIdRef = useRef<ScrapPartId | null>(null);
  const sparkyInstallNextStageRef = useRef<SparkyQuestStage | null>(null);
  const installBatteryPhaseRef = useRef<'idle' | 'walk-to-scrap' | 'open-chest' | 'place-battery' | 'chest-glow' | 'done'>(null);
  const installBatteryTimerRef = useRef(0);
  const batteryInstalledRef = useRef(false);
  const batteryGlowRef = useRef<THREE.Mesh | null>(null);
  const sparkyEventTriggeredRef = useRef(false);
  const sparkyAcknowledgedRef = useRef(false);
  const repairTimerRef = useRef(0);
  const repairKioskRef = useRef<THREE.Group | null>(null);
  const eventParticlesRef = useRef<THREE.Group | null>(null);
  const cameraTargetPosRef = useRef(new THREE.Vector3());
  const cameraLookTargetRef = useRef(new THREE.Vector3());
  const speechBubbleRef = useRef<HTMLDivElement>(null);
  const sparkyBaseQuatRef = useRef<THREE.Quaternion | null>(null);
  const sparkyFacingRef = useRef(0);

  const aptCutscenePhaseRef = useRef<'idle' | 'walk-west' | 'open-box' | 'lift-rise' | 'lift-carry' | 'lift-lower' | 'fetch-laptop' | 'link-computer' | 'electrocute' | 'walk-to-laptop' | 'string-tutorial' | 'laptop-ui' | 'antenna-glow' | 'date-coding' | 'reboot' | 'version-coding' | 'pre-boot' | 'boot-coding' | 'boot' | 'battery-scene' | 'done'>('idle');
  const aptSparkyFacingRef = useRef(0);
  const aptCutsceneTimerRef = useRef(0);
  const cutsceneBoxRef = useRef<THREE.Group | null>(null);
  const cutsceneBoxLidRef = useRef<THREE.Mesh | null>(null);

  const computerRef = useRef<THREE.Group | null>(null);
  const wireRef = useRef<THREE.Mesh | null>(null);
  const coilRef = useRef<THREE.Object3D | null>(null);
  const tackFxRef = useRef<THREE.Group | null>(null);
  const tackFxPhaseRef = useRef(0);
  const cinemCamActiveRef = useRef(false);
  const cutsceneDoneRef = useRef(false);
  const sparkyGoHomeRef = useRef(false);
  const sparkyHomeArrivedRef = useRef(false);
  const sparkyHomeTargetRef = useRef(new THREE.Vector2(-9.6, -5.7));
  const sparkyHomeWaypointsRef = useRef<THREE.Vector2[]>([]);
  const sparkyHomeWaypointIdxRef = useRef(0);
  const sparkyIntroStepRef = useRef(-1);
  const sparkyWalkHomeTimerRef = useRef(0);
  const chestGlowRef = useRef<THREE.Mesh | null>(null);
  const awakenSoundPlayedRef = useRef(false);
  const electrocuteDlgShownRef = useRef(false);
  const stringDlgIsHelpRef = useRef(false);
  const dateDlgShownRef = useRef(false);
  const dateCodingShownRef = useRef(false);
  const batteryDlgShownRef = useRef(false);
  const versionDlgShownRef = useRef(false);
  const versionCodingShownRef = useRef(false);
  const bootDlgShownRef = useRef(false);
  const bootCodingShownRef = useRef(false);
  const smokeParticlesRef = useRef<THREE.Mesh[]>([]);
  const beepOscillatorRef = useRef<OscillatorNode | null>(null);
  const aptSparkyWalkWpRef = useRef(0);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const antennaGlowLightRef = useRef<THREE.PointLight | null>(null);
  const antennaGlowSpriteRef = useRef<THREE.Sprite | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animateFnRef = useRef<((now: number) => void) | null>(null);
  const lastAnimFrameRef = useRef(0);
  const animFrameCounterRef = useRef(0);
  const tabHiddenRef = useRef(false);
  const tabHiddenAtRef = useRef(0);

  const playAwakenSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Thump — low sine burst
      const thump = ctx.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(80, ctx.currentTime);
      thump.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(0.6, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      thump.connect(g1).connect(ctx.destination);
      thump.start(ctx.currentTime);
      thump.stop(ctx.currentTime + 0.15);
      // Rising chime — 300→1200Hz sweep
      const chime = ctx.createOscillator();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(300, ctx.currentTime + 0.1);
      chime.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.9);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
      g2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.3);
      g2.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.9);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      chime.connect(g2).connect(ctx.destination);
      chime.start(ctx.currentTime + 0.1);
      chime.stop(ctx.currentTime + 1.2);
    } catch {}
  };

  const playStartupChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.2);
        g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.2 + 0.02);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.2 + 0.14);
        osc.connect(g).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.15);
      });
    } catch {}
  };

  const playBootBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(g).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  };

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [code, setCode] = useState('String petName = "Milo";');
  const [output, setOutput] = useState('');
  const [success, setSuccess] = useState(false);
  const [sparkleBurst, setSparkleBurst] = useState(false);
  const [tutorialComplete, setTutorialComplete] = useState(false);
  const [shopUnlocked, setShopUnlocked] = useState(false);
  const [inWorkshopRoom, setInWorkshopRoom] = useState(false);
  const [inShopRoom, setInShopRoom] = useState(false);
  const inShopRoomRef = useRef(false);
  const [roomEntryFlash, setRoomEntryFlash] = useState(false);
  const money = useGameStoreKey('money');
  const [sparkyQuestStage, setSparkyQuestStage] = useState<SparkyQuestStage>('intro');
  const [tutorialPhases, setTutorialPhases] = useState<TutorialPhase[]>(unit1Phases);
  const [robotName, setRobotName] = useState('Scrap');
  const [activeCustomer, setActiveCustomer] = useState<CustomerRequest | null>(null);
  const [workshopCode, setWorkshopCode] = useState('');
  const [workshopOutput, setWorkshopOutput] = useState('');
  const [interactionPromptName, setInteractionPromptName] = useState<string | null>(null);
  const [workshopIntroSeen, setWorkshopIntroSeen] = useState(false);
  const [workshopIntroStep, setWorkshopIntroStep] = useState(0);
  const [inArenaRoom, setInArenaRoom] = useState(false);
  const [inApartmentRoom, setInApartmentRoom] = useState(false);
  const [arenaPlayers, setArenaPlayers] = useState<ArenaPlayer[]>([]);
  const [arenaChallenge, setArenaChallenge] = useState<{
    id?: string;
    fromId?: string;
    fromName?: string;
    toId?: string;
    toName?: string;
    status: 'pending' | 'active' | 'accepted' | 'declined';
  } | null>(null);
  const [arenaCode, setArenaCode] = useState('');
  const [arenaOutput, setArenaOutput] = useState('');
  const [arenaBattleActive, setArenaBattleActive] = useState(false);
  const [sparkyModal, setSparkyModal] = useState<string | null>(null);
  const [sparkyIntroStep, setSparkyIntroStep] = useState(-1);
  const [showBatteryDlg, setShowBatteryDlg] = useState(false);
  const [batteryDlgStep, setBatteryDlgStep] = useState(0);
  const [batteryDlgText, setBatteryDlgText] = useState('');
  const [showRafiqLetterDlg, setShowRafiqLetterDlg] = useState(false);
  const [rafiqLetterStep, setRafiqLetterStep] = useState(0);
  const [rafiqLetterText, setRafiqLetterText] = useState('');
  const [showWhoDlg, setShowWhoDlg] = useState(false);
  const [whoText, setWhoText] = useState('');
  const [showSparkyExamples, setShowSparkyExamples] = useState(false);
  const [showElectrocuteDlg, setShowElectrocuteDlg] = useState(false);
  const [electrocuteStep, setElectrocuteStep] = useState(0);
  const [electrocuteText, setElectrocuteText] = useState('');
  const [workshopIntroText, setWorkshopIntroText] = useState('');
  const [playerName, setPlayerName] = useState('');
  const cutsceneDlgSteps = useMemo(() => [
    { speaker: 'Sparky', text: "I'll get electrocuted if I code Scrap..." },
    { speaker: 'Sparky', text: '...can you code him?' },
    { speaker: playerName || 'You', text: 'Okay...' },
  ], [playerName]);
  const [showStringDlg, setShowStringDlg] = useState(false);
  const [stringDlgStep, setStringDlgStep] = useState(0);
  const [stringDlgText, setStringDlgText] = useState('');
  const stringDlgSteps = useMemo(() => [
    { speaker: 'Sparky', text: 'He needs a name so we can send commands to him.' },
    { speaker: 'Sparky', text: 'You can pick any name you want — that\'s what he\'ll be called.' },
    { speaker: 'Sparky', text: 'Use a `String` in code. Like this: `String name = "Scrap";`' },
    { speaker: 'Sparky', text: '`String` stores text. `name` is the variable. `"Scrap"` is the value.' },
  ], []);
  const dateDlgSteps = useMemo(() => [
    { speaker: 'Sparky', text: 'Nice! He\'s online. Now let\'s calibrate his internal clock — he needs to know today\'s date.' },
    { speaker: 'Sparky', text: 'Use `int` variables — they store whole numbers. Put EACH on its own separate line: `int year = 2026;` then `int month = 5;`' },
    { speaker: 'Sparky', text: 'Oh — and months start at 0 in code! January is 0, February is 1, up to December which is 11. The laptop shows a chart to help.' },
  ], []);
  const dateHelpSteps = useMemo(() => [
    { speaker: 'Sparky', text: 'Type each `int` on its own line. Like: `int year = 2026;` then press Enter and type `int month = 5;`' },
    { speaker: 'Sparky', text: 'Look at the month chart below the editor. January is 0, February is 1, March is 2... pick the number that matches right now.' },
    { speaker: 'Sparky', text: 'Make sure your values match today\'s actual date! Check your computer\'s clock if you\'re not sure.' },
  ], []);
  const versionDlgSteps = useMemo(() => [
    { speaker: 'Sparky', text: 'Uh oh — the bot is still glitching! Its version number is corrupted and its operational mode is undefined.' },
    { speaker: 'Sparky', text: 'We need to update the version to 1.0. For numbers that have decimals, we use `double`.' },
    { speaker: 'Sparky', text: 'Now declare a `double` called `version` with value `1.0`, and a `String` called `mode` with a word meaning \'working correctly\'. Each on its own line!' },
  ], []);
  const versionHelpSteps = useMemo(() => [
    { speaker: 'Sparky', text: 'Decimals are numbers with a dot — like 1.5, 2.75, 0.99. `double` is the Java type for storing them. So `double version = 1.0;` declares a decimal variable called `version`.' },
    { speaker: 'Sparky', text: '`String mode = "normal";` — `mode` describes the bot\'s operational state. Fill in the word that\'s the opposite of \'glitching\' or \'broken\'.' },
  ], []);
  const bootDlgSteps = useMemo(() => [
    { speaker: 'Sparky', text: 'The firmware\'s in place and the mode is set. Time to bring him online!' },
    { speaker: 'Sparky', text: 'We need a `boolean` called `ready`. A `boolean` is like a light switch — it can only be ON or OFF. In Java, those are the keywords `true` and `false`.' },
    { speaker: 'Sparky', text: 'Declare `ready` as the \'on\' value. You know the format — type, name, equals, value — all on one line!' },
  ], []);
  const bootHelpSteps = useMemo(() => [
    { speaker: 'Sparky', text: '`boolean` is the simplest type — it only holds `true` or `false`. Think of it like an LED: either lit or not lit.' },
    { speaker: 'Sparky', text: 'We want `ready` to be `true` — the robot is powered and good to go. The line should look familiar: `boolean ready = true;`' },
  ], []);
  const [showLaptopUI, setShowLaptopUI] = useState(false);
  const [laptopCode, setLaptopCode] = useState('String name = "[Put Your Robot Name Here]";');
  const [laptopOutput, setLaptopOutput] = useState('');
  const [laptopSuccess, setLaptopSuccess] = useState(false);
  const [laptopMode, setLaptopMode] = useState<'name' | 'date' | 'version' | 'boot'>('name');
  const [laptopWindowCSS, setLaptopWindowCSS] = useState('70vw');
  const [showDateDlg, setShowDateDlg] = useState(false);
  const [dateDlgStep, setDateDlgStep] = useState(0);
  const [dateDlgText, setDateDlgText] = useState('');
  const [showVersionDlg, setShowVersionDlg] = useState(false);
  const [versionDlgStep, setVersionDlgStep] = useState(0);
  const [versionDlgText, setVersionDlgText] = useState('');
  const [showDecimalExplain, setShowDecimalExplain] = useState(false);
  const [showBootDlg, setShowBootDlg] = useState(false);
  const [bootDlgStep, setBootDlgStep] = useState(0);
  const [bootDlgText, setBootDlgText] = useState('');
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [transportMessage, setTransportMessage] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const backpack = useGameStoreKey('backpack');
  const [heldSlotIndex, setHeldSlotIndex] = useState<number | null>(null);
  const heldSlotIndexRef = useRef<number | null>(null);
  const heldItemGroupRef = useRef<THREE.Group | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showWasmHint, setShowWasmHint] = useState(true);
  const [shopkeeperGreeting, setShopkeeperGreeting] = useState<string | null>(null);
  const [showControlsModal, setShowControlsModal] = useState(false);
  const [showSemicolonArrow, setShowSemicolonArrow] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = activeModal !== null;
  const modalFrameCountRef = useRef(0);
  const [debugMode, setDebugMode] = useState(() => {
    try { return localStorage.getItem('rb_debug') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('rb_debug', debugMode ? '1' : '0'); } catch {}
  }, [debugMode]);
  const fpsRef = useRef(0);
  const sessionPlaytimeRef = useRef(0);
  const lastPositionSyncRef = useRef(0);
  const [bonusFraction, setBonusFraction] = useState(0);
  const bonusTimerRef = useRef<number | null>(null);
  const lockedBonusRef = useRef(0);
  const BONUS_DURATION = 45;
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());
  const [debugDisplay, setDebugDisplay] = useState({ fps: '0', x: '0.00', y: '0.00' });
  useEffect(() => {
    if (!debugMode) return;
    const id = setInterval(() => {
      setDebugDisplay({ fps: String(fpsRef.current), x: localPositionRef.current.x.toFixed(2), y: localPositionRef.current.y.toFixed(2) });
    }, 250);
    return () => clearInterval(id);
  }, [debugMode]);

  const apiSync = useCallback((data: Record<string, unknown>) => {
    fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .catch(() => {});
  }, []);

  const updateQuestStage = useCallback((stage: SparkyQuestStage) => {
    setSparkyQuestStage(stage);
    sparkyQuestStageRef.current = stage;
    apiSync({ questStage: stage });
    lastConfirmedQuestRef.current = stage;
  }, [apiSync]);

  const updateBackpack = useCallback((items: ScrapPartId[]) => {
    gameStore.set('backpack', items);
    apiSync({ backpack: items });
    lastConfirmedBackpackRef.current = items;
  }, [apiSync]);

  const updateMoney = useCallback((val: number) => {
    gameStore.set('money', val);
    apiSync({ money: val });
    lastConfirmedMoneyRef.current = val;
  }, [apiSync]);

  function validateJavaLines(
    code: string,
    specs: { type: string; name: string; validate: (value: string) => string | null }[]
  ): { valid: boolean; message: string; showArrow: boolean } {
    const lines = code.trim().split('\n').filter(l => l.trim());
    if (lines.length !== specs.length) {
      return { valid: false, message: `❌ Enter exactly ${specs.length} line${specs.length > 1 ? 's' : ''}.`, showArrow: false };
    }
    const typeAliases: Record<string, string> = {
      'string': 'String', 'str': 'String',
      'Int': 'int', 'integer': 'int',
      'Double': 'double', 'float': 'double',
      'Bool': 'boolean', 'bool': 'boolean', 'Boolean': 'boolean',
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const spec = specs[i];
      if (/[[\]]/.test(line)) {
        return { valid: false, message: '❌ Those `[]` just mean "fill in a value"!', showArrow: false };
      }
      if (!line.endsWith(';')) {
        return { valid: false, message: '❌ Missing a semicolon at the end of the line!', showArrow: true };
      }
      const m = line.match(/^\s*(\w+)\s+(\w+)\s*=\s*(.+)\s*;\s*$/);
      if (!m) {
        if (/==/.test(line)) return { valid: false, message: '❌ Use single `=` for assignment, not `==`.', showArrow: false };
        return { valid: false, message: `❌ Check line ${i + 1} — should be \`type name = value;\`.`, showArrow: false };
      }
      const userType = m[1];
      const userName = m[2];
      const value = m[3];
      const alias = typeAliases[userType];
      if (alias) {
        return { valid: false, message: `❌ Use \`${alias}\` (not \`${userType}\`).`, showArrow: false };
      }
      if (userType !== spec.type && userType.toLowerCase() === spec.type.toLowerCase()) {
        return { valid: false, message: `❌ \`${spec.type}\` is all lowercase in Java.`, showArrow: false };
      }
      if (userType !== spec.type) {
        return { valid: false, message: `❌ Expected \`${spec.type}\`, not \`${userType}\`.`, showArrow: false };
      }
      if (userName !== spec.name) {
        return { valid: false, message: `❌ The variable should be \`${spec.name}\`, not \`${userName}\`.`, showArrow: false };
      }
      // Type-specific pre-checks
      if (spec.type === 'boolean') {
        if (/^"[^"]*"$/.test(value)) return { valid: false, message: '❌ Remove the `"` marks — booleans don\'t use quotes.', showArrow: false };
        if (value === 'True' || value === 'TRUE') return { valid: false, message: '❌ Java is case-sensitive — use lowercase `true`.', showArrow: false };
        if (value !== 'true' && value !== 'false') return { valid: false, message: '❌ `boolean` can only be `true` or `false`.', showArrow: false };
      }
      if (spec.type === 'String') {
        if (!/^"[^"]*"$/.test(value)) return { valid: false, message: '❌ String values need double quotes like `"value"`.', showArrow: false };
        if (value === '""') return { valid: false, message: '❌ The value can\'t be empty!', showArrow: false };
      }
      if (spec.type === 'double') {
        if (/^"[^"]*"$/.test(value)) return { valid: false, message: '❌ Remove the `"` marks — `double` values are just numbers.', showArrow: false };
        if (isNaN(Number(value))) return { valid: false, message: '❌ `double` expects a number like `1.0`.', showArrow: false };
      }
      if (spec.type === 'int') {
        if (/^"[^"]*"$/.test(value)) return { valid: false, message: '❌ Remove the `"` marks — `int` values are just numbers.', showArrow: false };
        if (!/^-?\d+$/.test(value)) return { valid: false, message: '❌ `int` expects a whole number without decimals.', showArrow: false };
      }
      const err = spec.validate(value);
      if (err) return { valid: false, message: `❌ ${err}`, showArrow: false };
    }
    return { valid: true, message: '', showArrow: false };
  }

  const handleLaptopRun = useCallback(() => {
    if (laptopMode === 'name') {
      const result = validateJavaLines(laptopCode, [
        { type: 'String', name: 'name', validate: (value) => {
          const content = value.slice(1, -1);
          if (content === '[Put Your Robot Name Here]') return 'That\'s the placeholder — give your robot a real name!';
          if (!content.trim()) return 'The name can\'t be empty!';
          return null;
        }},
      ]);
      if (!result.valid) {
        setLaptopOutput(result.message);
        setLaptopSuccess(false);
        setShowSemicolonArrow(result.showArrow);
        return;
      }
      const val = laptopCode.trim().match(/^\s*String\s+\w+\s*=\s*"([^"]*)"\s*;\s*$/)?.[1] || '';
      setLaptopOutput(`✅ "${val}" — what a great name!`);
      setLaptopSuccess(true);
      setRobotName(val);
      robotNameRef.current = val;
      gameStore.set('robotName', val);
      apiSync({ robotName: val });
      try { localStorage.setItem('rb_robot_name', val); } catch {}
      setTimeout(() => {
        setShowLaptopUI(false);
        aptCutscenePhaseRef.current = 'antenna-glow';
        aptCutsceneTimerRef.current = 0;
        dateDlgShownRef.current = false;
      }, 1500);
    } else if (laptopMode === 'date') {
      const now = new Date();
      const expectedYear = now.getFullYear();
      const expectedMonth = now.getMonth();
      const expectedDay = now.getDate();
      const monthName = now.toLocaleString('default', { month: 'long' });
      const result = validateJavaLines(laptopCode, [
        { type: 'int', name: 'year', validate: (value) => {
          if (parseInt(value, 10) !== expectedYear) return `The year should be ${expectedYear} — check your computer's clock!`;
          return null;
        }},
        { type: 'int', name: 'month', validate: (value) => {
          if (parseInt(value, 10) !== expectedMonth) return 'That\'s not today\'s month. Check the chart below.';
          return null;
        }},
        { type: 'int', name: 'day', validate: (value) => {
          if (parseInt(value, 10) !== expectedDay) return `Today is day ${expectedDay} — check your computer's clock!`;
          return null;
        }},
      ]);
      if (!result.valid) {
        setLaptopOutput(result.message);
        setLaptopSuccess(false);
        setShowSemicolonArrow(result.showArrow);
        return;
      }
      setLaptopOutput(`✅ Calibrated! Today is ${monthName} ${expectedDay}, ${expectedYear}. (int month = ${expectedMonth})`);
      setLaptopSuccess(true);
      const lines = laptopCode.trim().split('\n').filter(l => l.trim());
      for (const line of lines) {
        const m = line.match(/^\s*int\s+(year|month|day)\s*=\s*(-?\d+)\s*;\s*$/);
        if (m) {
          if (m[1] === 'year') gameStore.set('calibrationYear', parseInt(m[2], 10));
          if (m[1] === 'month') gameStore.set('calibrationMonth', parseInt(m[2], 10));
          if (m[1] === 'day') gameStore.set('calibrationDay', parseInt(m[2], 10));
        }
      }
      setTimeout(() => {
        setShowLaptopUI(false);
        aptCutscenePhaseRef.current = 'reboot';
        aptCutsceneTimerRef.current = 0;
      }, 1500);
    } else if (laptopMode === 'version') {
      const result = validateJavaLines(laptopCode, [
        { type: 'double', name: 'version', validate: (value) => {
          if (Number(value) !== 1.0) return 'Set version to 1.0.';
          return null;
        }},
        { type: 'String', name: 'mode', validate: (value) => {
          const content = value.slice(1, -1);
          if (content.toLowerCase() !== 'normal') return 'The mode should be "normal".';
          return null;
        }},
      ]);
      if (!result.valid) {
        setLaptopOutput(result.message);
        setLaptopSuccess(false);
        setShowSemicolonArrow(result.showArrow);
        return;
      }
      setLaptopOutput('✅ Version 1.0, mode = normal. The bot is stable!');
      setLaptopSuccess(true);
      setTimeout(() => {
        setShowLaptopUI(false);
        aptCutscenePhaseRef.current = 'pre-boot';
        aptCutsceneTimerRef.current = 0;
      }, 1500);
    } else if (laptopMode === 'boot') {
      const result = validateJavaLines(laptopCode, [
        { type: 'boolean', name: 'ready', validate: (value) => {
          if (value !== 'true') return 'ready should be `true` (powered on).';
          return null;
        }},
      ]);
      if (!result.valid) {
        setLaptopOutput(result.message);
        setLaptopSuccess(false);
        setShowSemicolonArrow(result.showArrow);
        return;
      }
      setLaptopOutput('✅ Ready = true. Initiating boot sequence...');
      setLaptopSuccess(true);
      setTimeout(() => {
        setShowLaptopUI(false);
        aptCutscenePhaseRef.current = 'boot';
        aptCutsceneTimerRef.current = 0;
      }, 1500);
    }
  }, [laptopCode, laptopMode, apiSync]);

  const highlightedCode = useMemo(() => highlightJava(code), [code]);
  const missionText = useMemo(() => {
    if (sparkyQuestStage === 'intro') return 'Talk to Sparky.';
    if (sparkyQuestStage === 'unit1') return 'Complete Unit 1 with Sparky.';
    if (sparkyQuestStage === 'unit1-done') {
      const owned = backpack.includes('sensor');
      return owned ? 'Give the sensor to Sparky!' : 'Buy the Sensor at the Parts Shop.';
    }
    if (sparkyQuestStage === 'unit2') return 'Complete Unit 2 with Sparky.';
    if (sparkyQuestStage === 'unit2-done') {
      const owned = backpack.includes('voice');
      return owned ? 'Give the voice module to Sparky!' : 'Buy the Voice Module at the Parts Shop.';
    }
    if (sparkyQuestStage === 'unit3') return 'Complete Unit 3 with Sparky.';
    if (sparkyQuestStage === 'unit3-done') {
      const owned = backpack.includes('navigation');
      return owned ? 'Give the navigation chip to Sparky!' : 'Buy the Navigation Chip at the Parts Shop.';
    }
    if (sparkyQuestStage === 'unit4') return 'Complete Unit 4 with Sparky.';
    if (sparkyQuestStage === 'all-done') return 'Scrap is fully repaired!';
    return 'Explore the city!';
  }, [sparkyQuestStage, money]);
  const sparkyQuestStageRef = useRef<SparkyQuestStage>('intro');
  const firstTransactionDoneRef = useRef(false);
  const [firstTransactionDone, setFirstTransactionDone] = useState(false);
  const lastConfirmedQuestRef = useRef<SparkyQuestStage>('intro');
  const lastConfirmedBackpackRef = useRef<ScrapPartId[]>([]);
  const lastConfirmedMoneyRef = useRef(0);



  const playHappyChime = () => {
    const context = audioRef.current || new AudioContext();
    audioRef.current = context;
    const now = context.currentTime;

    const playTone = (frequency: number, start: number, duration: number, gain: number) => {
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(gain, start + 0.01);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    };

    playTone(523.25, now, 0.16, 0.04);
    playTone(659.25, now + 0.11, 0.18, 0.045);
    playTone(783.99, now + 0.22, 0.22, 0.05);
  };

  const playStepPop = (nowTime: number) => {
    const context = audioRef.current || new AudioContext();
    audioRef.current = context;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(220 + Math.random() * 30, nowTime);
    volume.gain.setValueAtTime(0.0001, nowTime);
    volume.gain.exponentialRampToValueAtTime(0.01, nowTime + 0.01);
    volume.gain.exponentialRampToValueAtTime(0.0001, nowTime + 0.08);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(nowTime);
    oscillator.stop(nowTime + 0.1);
  };

  const playToolClank = () => {
    const context = audioRef.current || new AudioContext();
    audioRef.current = context;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 + Math.random() * 200, context.currentTime);
    gain.gain.setValueAtTime(0.03, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(context.currentTime);
    osc.stop(context.currentTime + 0.08);
  };

  const playSparkBurst = () => {
    const context = audioRef.current || new AudioContext();
    audioRef.current = context;
    const now = context.currentTime;
    // Noise burst
    const bufferSize = context.sampleRate * 0.15;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    const bp = context.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2000;
    bp.Q.value = 1;
    const ng = context.createGain();
    ng.gain.setValueAtTime(0.08, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(context.destination);
    noise.start(now);
    noise.stop(now + 0.15);
    // Descending pitch sweep
    const osc = context.createOscillator();
    const og = context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    og.gain.setValueAtTime(0.04, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(og);
    og.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  };

  const triggerAttentionEvent = () => {
    playSparkBurst();
    const kioskPos = new THREE.Vector3(NPC_POSITION.x, NPC_POSITION.y - 0.1, 0.15);

    // Smoke burst particles (expanding grey spheres)
    const particleGroup = new THREE.Group();
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x9ca3af, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.015 + Math.random() * 0.02, 6, 6), smokeMat);
      p.userData = { vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 + 0.3, vz: Math.random() * 0.3, life: 1.5 };
      p.position.set(0, 0, 0);
      particleGroup.add(p);
    }
    // Spark burst (small emissive sprites)
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 4), sparkMat);
      const angle = (i / 8) * Math.PI * 2;
      s.userData = { vx: Math.cos(angle) * 0.8, vy: Math.sin(angle) * 0.8 + 0.5, vz: 0.5, life: 0.8 };
      s.position.set(0, 0, 0);
      particleGroup.add(s);
    }
    particleGroup.position.copy(kioskPos);
    const scene = sceneRef.current;
    if (scene) scene.add(particleGroup);
    eventParticlesRef.current = particleGroup;

    // Sparky recoil + sequence (use relative rotateZ to preserve north-facing quaternion)
    const sparky = outdoorSparkyRef.current;
    if (sparky) {
      sparky.root.rotateZ(0.15);
      setTimeout(() => {
        if (sparky.root) sparky.root.rotateZ(-0.23);
      }, 150);
      setTimeout(() => {
        if (sparky.root) sparky.root.rotateZ(0.13);
      }, 300);
      setTimeout(() => {
        if (sparky.root) sparky.root.rotateZ(-0.05);
      }, 500);
    }

    // After recoil: Sparky notices player
    setTimeout(() => {
      if (!sparkyAcknowledgedRef.current) {
        sparkyAcknowledgedRef.current = true;
        // Clean up particles
        if (eventParticlesRef.current && scene) {
          scene.remove(eventParticlesRef.current);
          eventParticlesRef.current.traverse((child) => {
            const m = child as THREE.Mesh;
            if (m.isMesh) m.geometry?.dispose();
          });
          eventParticlesRef.current = null;
        }
      }
    }, 3000);
  };

  useEffect(() => {
    showTutorialRef.current = showTutorial;
    if (showTutorial && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [showTutorial]);

  useEffect(() => {
    tutorialStepRef.current = tutorialStep;
  }, [tutorialStep]);

  useEffect(() => {
    sparkyIntroStepRef.current = sparkyIntroStep;
  }, [sparkyIntroStep]);

  useEffect(() => {
    tutorialCompleteRef.current = tutorialComplete;
  }, [tutorialComplete]);

  useEffect(() => {
    if (sparkyQuestStage === 'unit1') { setTutorialPhases(unit1Phases); tutorialPhasesRef.current = unit1Phases; }
    else if (sparkyQuestStage === 'unit2') { setTutorialPhases(unit2Phases); tutorialPhasesRef.current = unit2Phases; }
  }, [sparkyQuestStage]);

  useEffect(() => {
    shopUnlockedRef.current = shopUnlocked;
  }, [shopUnlocked]);

  useEffect(() => {
    if (sparkyQuestStage !== 'intro') { setShowWasmHint(false); return; }
    const t = setTimeout(() => setShowWasmHint(false), 5000);
    return () => clearTimeout(t);
  }, [sparkyQuestStage]);

  useEffect(() => {
    inWorkshopRoomRef.current = inWorkshopRoom;
  }, [inWorkshopRoom]);

  useEffect(() => {
    inShopRoomRef.current = inShopRoom;
  }, [inShopRoom]);

  useEffect(() => {
    workshopIntroSeenRef.current = workshopIntroSeen;
  }, [workshopIntroSeen]);

  useEffect(() => {
    inApartmentRoomRef.current = inApartmentRoom;
  }, [inApartmentRoom]);

  const profileLoadedRef = useRef(false);

  // Load persisted state
  useEffect(() => {
    try {
      if (localStorage.getItem('rb_first_tx_done')) {
        setFirstTransactionDone(true);
        firstTransactionDoneRef.current = true;
      }
    } catch {}
    setShowControlsModal(true);
  }, []);

  // Electrocute dialog Enter key handler
  useEffect(() => {
    if (!showElectrocuteDlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextStep = electrocuteStep + 1;
        if (nextStep < cutsceneDlgSteps.length) {
          setElectrocuteStep(nextStep);
        } else {
          setShowElectrocuteDlg(false);
          electrocuteDlgShownRef.current = false;
          aptCutscenePhaseRef.current = 'walk-to-laptop';
          aptCutsceneTimerRef.current = 0;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showElectrocuteDlg, electrocuteStep, cutsceneDlgSteps.length]);

  // Electrocute dialog typewriter effect
  useEffect(() => {
    if (!showElectrocuteDlg) return;
    const step = cutsceneDlgSteps[electrocuteStep];
    if (!step) return;
    setElectrocuteText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setElectrocuteText(step.text.slice(0, i));
      if (i >= step.text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [electrocuteStep, showElectrocuteDlg, cutsceneDlgSteps]);

  // Battery dialog typewriter effect
  useEffect(() => {
    if (!showBatteryDlg) return;
    const step = BATTERY_DLG_STEPS[batteryDlgStep];
    if (!step) return;
    setBatteryDlgText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setBatteryDlgText(step.text.slice(0, i));
      if (i >= step.text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [batteryDlgStep, showBatteryDlg]);

  // Battery dialog Enter key handler
  useEffect(() => {
    if (!showBatteryDlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextStep = batteryDlgStep + 1;
        if (nextStep < BATTERY_DLG_STEPS.length) {
          setBatteryDlgStep(nextStep);
        } else {
          // Give letter to player
          const bp = gameStore.get('backpack');
          if (!bp.includes('letter' as ScrapPartId)) {
            const newBackpack: ScrapPartId[] = [...bp, 'letter'];
            gameStore.set('backpack', newBackpack);
            apiSync({ backpack: newBackpack });
            lastConfirmedBackpackRef.current = newBackpack;
          }
          setShowBatteryDlg(false);
          aptCutscenePhaseRef.current = 'done';
          aptCutsceneTimerRef.current = 0;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showBatteryDlg, batteryDlgStep]);

  // Rafiq letter dialog typewriter effect
  useEffect(() => {
    if (!showRafiqLetterDlg) return;
    const step = RAFIQ_LETTER_STEPS[rafiqLetterStep];
    if (!step) return;
    setRafiqLetterText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setRafiqLetterText(step.text.slice(0, i));
      if (i >= step.text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [rafiqLetterStep, showRafiqLetterDlg]);

  // Rafiq letter dialog Enter key handler
  useEffect(() => {
    if (!showRafiqLetterDlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextStep = rafiqLetterStep + 1;
        if (nextStep < RAFIQ_LETTER_STEPS.length) {
          setRafiqLetterStep(nextStep);
        } else {
          setShowRafiqLetterDlg(false);
          reopenWorkshopIntro();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRafiqLetterDlg, rafiqLetterStep]);

  // Workshop intro typewriter effect
  useEffect(() => {
    if (!inWorkshopRoom || workshopIntroSeen || !profileLoadedRef.current) return;
    const step = WORKSHOP_INTRO_STEPS[workshopIntroStep];
    if (!step) return;
    setWorkshopIntroText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setWorkshopIntroText(step.text.slice(0, i));
      if (i >= step.text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [workshopIntroStep, inWorkshopRoom, workshopIntroSeen]);

  // Workshop intro Enter key handler
  useEffect(() => {
    if (!inWorkshopRoom || workshopIntroSeen || !profileLoadedRef.current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextStep = workshopIntroStep + 1;
        if (nextStep < WORKSHOP_INTRO_STEPS.length) {
          setWorkshopIntroStep(nextStep);
        } else {
          finishWorkshopIntro();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inWorkshopRoom, workshopIntroSeen, workshopIntroStep]);

  // "Who are you?" dialog typewriter effect
  const WHO_TEXT = "Who are you? This workshop is for employees only.";
  useEffect(() => {
    if (!showWhoDlg) return;
    setWhoText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setWhoText(WHO_TEXT.slice(0, i));
      if (i >= WHO_TEXT.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [showWhoDlg]);

  // "Who are you?" dialog Enter key handler
  useEffect(() => {
    if (!showWhoDlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        setShowWhoDlg(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showWhoDlg]);

  // String tutorial dialog Enter key handler
  useEffect(() => {
    if (!showStringDlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextStep = stringDlgStep + 1;
        if (nextStep < stringDlgSteps.length) {
          setStringDlgStep(nextStep);
        } else {
          setShowStringDlg(false);
          if (stringDlgIsHelpRef.current) {
            stringDlgIsHelpRef.current = false;
            setShowLaptopUI(true);
          } else {
            aptCutscenePhaseRef.current = 'laptop-ui';
            aptCutsceneTimerRef.current = 0;
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showStringDlg, stringDlgStep, stringDlgSteps.length]);

  // Date dialog Enter key handler
  useEffect(() => {
    if (!showDateDlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const steps = stringDlgIsHelpRef.current ? dateHelpSteps : dateDlgSteps;
        const nextStep = dateDlgStep + 1;
        if (nextStep < steps.length) {
          setDateDlgStep(nextStep);
        } else {
          setShowDateDlg(false);
          if (stringDlgIsHelpRef.current) {
            stringDlgIsHelpRef.current = false;
            setShowLaptopUI(true);
          } else {
            dateCodingShownRef.current = false;
            aptCutscenePhaseRef.current = 'date-coding';
            aptCutsceneTimerRef.current = 0;
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDateDlg, dateDlgStep, stringDlgIsHelpRef.current, dateHelpSteps.length, dateDlgSteps.length]);

  // Date dialog typewriter effect
  useEffect(() => {
    if (!showDateDlg) return;
    const steps = stringDlgIsHelpRef.current ? dateHelpSteps : dateDlgSteps;
    const step = steps[dateDlgStep];
    if (!step) return;
    setDateDlgText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDateDlgText(step.text.slice(0, i));
      if (i >= step.text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [dateDlgStep, showDateDlg, stringDlgIsHelpRef.current]);

  // String tutorial dialog typewriter effect
  useEffect(() => {
    if (!showStringDlg) return;
    const step = stringDlgSteps[stringDlgStep];
    if (!step) return;
    setStringDlgText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setStringDlgText(step.text.slice(0, i));
      if (i >= step.text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [stringDlgStep, showStringDlg, stringDlgSteps]);

  // Version dialog Enter key handler
  useEffect(() => {
    if (!showVersionDlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const steps = stringDlgIsHelpRef.current ? versionHelpSteps : versionDlgSteps;
        const nextStep = versionDlgStep + 1;
        if (nextStep < steps.length) {
          setVersionDlgStep(nextStep);
        } else {
          setShowVersionDlg(false);
          if (stringDlgIsHelpRef.current) {
            stringDlgIsHelpRef.current = false;
            setShowLaptopUI(true);
          } else {
            versionCodingShownRef.current = false;
            aptCutscenePhaseRef.current = 'version-coding';
            aptCutsceneTimerRef.current = 0;
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showVersionDlg, versionDlgStep, stringDlgIsHelpRef.current, versionHelpSteps.length, versionDlgSteps.length]);

  // Version dialog typewriter effect
  useEffect(() => {
    if (!showVersionDlg) return;
    const steps = stringDlgIsHelpRef.current ? versionHelpSteps : versionDlgSteps;
    const step = steps[versionDlgStep];
    if (!step) return;
    setVersionDlgText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVersionDlgText(step.text.slice(0, i));
      if (i >= step.text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [versionDlgStep, showVersionDlg, stringDlgIsHelpRef.current]);

  // Decimal explainer keyboard handler (Escape to close)
  useEffect(() => {
    if (!showDecimalExplain) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        setShowDecimalExplain(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDecimalExplain]);

  // Boot dialog Enter key handler
  useEffect(() => {
    if (!showBootDlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const steps = stringDlgIsHelpRef.current ? bootHelpSteps : bootDlgSteps;
        const nextStep = bootDlgStep + 1;
        if (nextStep < steps.length) {
          setBootDlgStep(nextStep);
        } else {
          setShowBootDlg(false);
          if (stringDlgIsHelpRef.current) {
            stringDlgIsHelpRef.current = false;
            setShowLaptopUI(true);
          } else {
            bootCodingShownRef.current = false;
            aptCutscenePhaseRef.current = 'boot-coding';
            aptCutsceneTimerRef.current = 0;
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showBootDlg, bootDlgStep, stringDlgIsHelpRef.current, bootHelpSteps.length, bootDlgSteps.length]);

  // Boot dialog typewriter effect
  useEffect(() => {
    if (!showBootDlg) return;
    const steps = stringDlgIsHelpRef.current ? bootHelpSteps : bootDlgSteps;
    const step = steps[bootDlgStep];
    if (!step) return;
    setBootDlgText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setBootDlgText(step.text.slice(0, i));
      if (i >= step.text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [bootDlgStep, showBootDlg, stringDlgIsHelpRef.current]);

  // Load profile data — prevents tutorial re-trigger
  useEffect(() => {
    let retries = 6;
    const loadProfile = (): Promise<void> => fetch('/api/profile').then(r => {
      if (!r.ok) throw new Error('Not OK');
      return r.json();
    }).then(data => {
      if (data.error) throw new Error(data.error);
      console.log('📦 Profile loaded:', { questStage: data.questStage, backpack: data.backpack, currency: data.currency });
      if (data.name) setPlayerName(data.name);
      // Always restore money and backpack regardless of questStage
      gameStore.set('money', data.currency ?? 0);
      lastConfirmedMoneyRef.current = data.currency ?? 0;
      if (Array.isArray(data.backpack)) {
        gameStore.set('backpack', data.backpack);
        lastConfirmedBackpackRef.current = data.backpack;
      }
      if (data.cutsceneDone) {
        cutsceneDoneRef.current = true;
      }
      if (data.questStage) {
        let mappedStage = String(data.questStage) as SparkyQuestStage;
        if (data.workshopIntroDone) setWorkshopIntroSeen(true);
        setSparkyQuestStage(mappedStage);
        sparkyQuestStageRef.current = mappedStage;
        lastConfirmedQuestRef.current = mappedStage;
        if (mappedStage === 'intro') {
          setTutorialComplete(false); setShopUnlocked(false);
          tutorialCompleteRef.current = false; showTutorialRef.current = false;
          sparkyEventTriggeredRef.current = false;
          sparkyAcknowledgedRef.current = false;
        } else if (mappedStage === 'unit1') {
          setTutorialComplete(false); setShopUnlocked(true);
          tutorialCompleteRef.current = false; showTutorialRef.current = false;
        } else {
          setTutorialComplete(true); setShopUnlocked(true);
          tutorialCompleteRef.current = true; showTutorialRef.current = false;
        }
      }
      const nonQuestTutorials = data.tutorials?.filter((c: string) => !c.startsWith('_quest_'));
      if (data.questStage === 'intro' && nonQuestTutorials?.length > 0) {
        setTutorialComplete(true); setShopUnlocked(true);
        updateQuestStage('unit1-done');
        tutorialCompleteRef.current = true; showTutorialRef.current = false;
      }
      // Always restore from last saved position (cloud), regardless of quest stage
      if (data.position) {
        const pos = new THREE.Vector2(data.position.x, data.position.y);
        localPositionRef.current.copy(pos);
        if (typeof data.position.rotation === 'number') {
          yawRef.current = data.position.rotation;
        }
        // Restore room state if player was inside a room
        if (data.position.room === 'workshop') {
          inWorkshopRoomRef.current = true;
          setInWorkshopRoom(true);
          roomObstacleHitboxesRef.current = workshopObstaclesRef.current;
          if (localRobotRef.current) {
            localRobotRef.current.root.position.set(pos.x, pos.y, 0.26);
          }
        } else if (data.position.room === 'arena') {
          inArenaRoomRef.current = true;
          setInArenaRoom(true);
          roomObstacleHitboxesRef.current = [];
          if (localRobotRef.current) {
            localRobotRef.current.root.position.set(pos.x, pos.y, 0.28);
          }
        } else if (data.position.room === 'apartment') {
          inApartmentRoomRef.current = true;
          setInApartmentRoom(true);
          roomObstacleHitboxesRef.current = [];
          if (localRobotRef.current) {
            localRobotRef.current.root.position.set(pos.x, pos.y, 0.28);
          }
          if (outdoorSparkyRef.current) outdoorSparkyRef.current.root.visible = false;
          if (apartmentSparkyRef.current) apartmentSparkyRef.current.root.visible = true;
          if (data.cutsceneDone || cutsceneDoneRef.current) {
            cutsceneDoneRef.current = true;
            if (scrapRobotRef.current) scrapRobotRef.current.root.visible = true;
            // Auto-start tutorial if in intro stage after cutscene
            if (sparkyQuestStageRef.current === 'intro') {
              setTimeout(() => {
                showTutorialRef.current = true;
                setShowTutorial(true);
                setTutorialStep(0);
                setCode(tutorialPhasesRef.current[0].kind === 'dialogue' ? '' : tutorialPhasesRef.current[0].starterCode || '');
                setOutput('');
                setSuccess(false);
              }, 500);
            }
          }
        } else {
          if (localRobotRef.current) {
            localRobotRef.current.root.position.set(pos.x, pos.y, 0.24);
          }
        }
      }
      // Intro spawn override: only when saved position is the default (0,0) — first load after reset
      if (data.questStage === 'intro' && data.position && data.position.x === 0 && data.position.y === 0) {
        localPositionRef.current.set(-5.53, -9.63);
        if (localRobotRef.current) {
          localRobotRef.current.root.position.set(-5.53, -9.63, 0.24);
        }
        yawRef.current = Math.atan2(-2.87 - (-5.53), -5.3 - (-9.63));
      }
      profileLoadedRef.current = true;
      const savedName = localStorage.getItem('rb_robot_name');
      if (savedName) { setRobotName(savedName); robotNameRef.current = savedName; }
    }).catch(() => {
      if (--retries > 0) return new Promise(r => setTimeout(r, 1500)).then(loadProfile);
      profileLoadedRef.current = true;
    });
    loadProfile();
  }, []);

  // Block tutorial if already completed or profile loaded with completion
  useEffect(() => {
    if (tutorialComplete || (sparkyQuestStage !== 'intro' && sparkyQuestStage !== 'unit1' && sparkyQuestStage !== 'unit2')) {
      showTutorialRef.current = false;
    }
  }, [tutorialComplete, sparkyQuestStage]);

  // Periodic sync (30s safety net for crash recovery)
  // (no beforeunload beacon — would re-save stale data after reset)

  useEffect(() => {
    heldSlotIndexRef.current = heldSlotIndex;
  }, [heldSlotIndex]);

  useEffect(() => {
    if (sparkyQuestMarkerRef.current) {
      sparkyQuestMarkerRef.current.visible = false;
    }
  }, [sparkyQuestStage]);

  const joinedRef = useRef(false);
  useEffect(() => {
    if (connected && !joinedRef.current) {
      joinedRef.current = true;
      const joinRoom = inWorkshopRoomRef.current ? 'workshop' : inArenaRoomRef.current ? 'arena' : inApartmentRoomRef.current ? 'apartment' : 'outside';
      triggerEvent('client-player-join', { x: localPositionRef.current.x, y: localPositionRef.current.y, room: joinRoom });
    }
  }, [connected, triggerEvent]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mountElement = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a7a9a);
    sceneRef.current = scene;

    const outdoorGroup = new THREE.Group();
    scene.add(outdoorGroup);
    outdoorGroupRef.current = outdoorGroup;

    const workshopRoomGroup = new THREE.Group();
    workshopRoomGroup.visible = false;
    scene.add(workshopRoomGroup);
    workshopRoomGroupRef.current = workshopRoomGroup;

    const arenaRoomGroup = new THREE.Group();
    arenaRoomGroup.visible = false;
    scene.add(arenaRoomGroup);
    arenaRoomGroupRef.current = arenaRoomGroup;

    const apartmentRoomGroup = new THREE.Group();
    apartmentRoomGroup.visible = false;
    scene.add(apartmentRoomGroup);
    apartmentRoomGroupRef.current = apartmentRoomGroup;

    const aspect = mountElement.clientWidth / mountElement.clientHeight;
    const camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -10.5, 2.2);
    camera.lookAt(0, -3, 0.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountElement.clientWidth, mountElement.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mountElement.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(-10, -8, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -18;
    sunLight.shadow.camera.right = 18;
    sunLight.shadow.camera.top = 18;
    sunLight.shadow.camera.bottom = -18;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 45;
    scene.add(sunLight);

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 30),
      createToonMaterial(0xffe066, 0.2, 0.05)
    );
    sun.position.set(8.5, 6.8, 5.2);
    outdoorGroup.add(sun);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      createToonMaterial(0x4a7a9a)
    );
    water.position.z = 0.02;
    water.receiveShadow = true;
    outdoorGroup.add(water);

    const grassTex = getTileTexture('tile_01.png');
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(80, 80);
    const cityGround = new THREE.Mesh(
      new THREE.CircleGeometry(ISLAND_RADIUS, 120),
      new THREE.MeshToonMaterial({
        map: grassTex,
        gradientMap: createGradientTexture(3),
      })
    );
    cityGround.position.z = 0.10;
    cityGround.receiveShadow = true;
    outdoorGroup.add(cityGround);

    const streetW = 3;
    const sw = 0.5;

    // SINGLE continuous road rectangle covering ALL road areas (y:-22 to y:9.5, h:31.5)
    const roadColor = 0x5a6a7a;
    const roadMesh = new THREE.Mesh(new THREE.BoxGeometry(48, 32, 0.04), createToonMaterial(roadColor));
    roadMesh.position.set(0, -6.25, 0.14);
    roadMesh.receiveShadow = true;
    outdoorGroup.add(roadMesh);
    // Grass blocks ABOVE the road to carve out city blocks between roads
    const gMat = createToonMaterial(0x6aaa5a);
    const addG = (x: number, y: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), gMat);
      m.position.set(x, y, 0.20); m.receiveShadow = true;
      outdoorGroup.add(m);
    };
    // All 4 grass rows between the 4 horizontals, split by the 4 verticals
    const yGaps: [number, number, number][] = [
      [1.5, 6.5, 4],     // between h-y0 (1.5) and h-y8p (6.5)
      [-6.5, -1.5, -4],   // between h-y8 (-6.5) and h-y0 (-1.5)
      [-14.5, -9.5, -12], // between h-y16 (-14.5) and h-y8 (-9.5)
    ];
    const xGaps: [number, number, number][] = [
      [-24, -13.5, -18.75], [-10.5, -1.5, -6], [1.5, 10.5, 6], [13.5, 24, 18.75],
    ];
    yGaps.forEach(([y1, y2, yc]) => {
      xGaps.forEach(([x1, x2, xc]) => { addG(xc, yc, x2 - x1, y2 - y1); });
    });

    // Sidewalks along road edges, split to avoid covering intersections
    const sMat = new THREE.MeshBasicMaterial({ color: 0xc8c0b0 });
    const makeSW = (x: number, y: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), sMat);
      m.position.set(x, y, 0.24); outdoorGroup.add(m);
    };
    // Horizontal sidewalks: split at each vertical road (gaps for intersections)
    const hSW = (y: number) => {
      xGaps.forEach(([x1,x2]) => {
        makeSW((x1+x2)/2, y, x2-x1, sw);
      });
    };
    // Vertical sidewalks: split at each horizontal road
    const vSW = (x: number) => {
      [[-14.5,-9.5],[-6.5,-1.5],[1.5,6.5]].forEach(([y1,y2]) => {
        makeSW(x, (y1+y2)/2, sw, y2-y1);
      });
    };
    hSW(1.75); hSW(-1.75); hSW(-6.25); hSW(-9.75); hSW(6.25); hSW(9.75); hSW(-14.25); hSW(-17.75);
    vSW(-1.75); vSW(1.75); vSW(-13.75); vSW(-10.25); vSW(10.25); vSW(13.75);

    // Street markings - dashed yellow center lines
    // Dashed yellow center lines
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const makeDashedLine = (x: number, y: number, len: number, horiz: boolean) => {
      const dashLen = 0.4, gapLen = 0.3, step = dashLen + gapLen;
      const count = Math.floor(len / step);
      for (let i = 0; i < count; i++) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? dashLen : 0.06, horiz ? 0.06 : dashLen), dashMat);
        d.position.set(horiz ? x - len / 2 + i * step + dashLen / 2 : x, horiz ? y : y - len / 2 + i * step + dashLen / 2, 0.17);
        outdoorGroup.add(d);
      }
    };
    // Crosswalks removed — intersections are filled with road
    // Dashed yellow center lines for all roads (excl. stray x=20 vertical)
    makeDashedLine(0, 0, 48, true); makeDashedLine(0, -8, 48, true);
    makeDashedLine(0, 8, 48, true); makeDashedLine(0, -16, 48, true);
    makeDashedLine(0, -8, 28, false); makeDashedLine(-12, -8, 28, false);
    makeDashedLine(12, -8, 28, false);

    // Small lake with 6 palm trees and fountain centerpiece
    const lx = 6, ly = -4, lr = 1.8;
    const lake = new THREE.Mesh(new THREE.CircleGeometry(lr, 24), createToonMaterial(0x38bdf8));
    lake.position.set(lx, ly, 0.15); outdoorGroup.add(lake);
    const lakeDeep = new THREE.Mesh(new THREE.CircleGeometry(lr * 0.7, 24), createToonMaterial(0x1d4ed8));
    lakeDeep.position.set(lx, ly, 0.14); outdoorGroup.add(lakeDeep);
    const lakeShine = new THREE.Mesh(new THREE.CircleGeometry(lr * 0.3, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 }));
    lakeShine.position.set(lx + 0.4, ly - 0.4, 0.16); outdoorGroup.add(lakeShine);
    // Fountain in the middle of the lake
    const fCol = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 12), createToonMaterial(0x94a3b8));
    fCol.rotation.x = Math.PI / 2; fCol.position.set(lx, ly, 0.22); outdoorGroup.add(fCol);
    const fDish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 14), createToonMaterial(0x94a3b8));
    fDish.rotation.x = Math.PI / 2; fDish.position.set(lx, ly, 0.38); outdoorGroup.add(fDish);
    const fWater = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.02, 18), new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.6 }));
    fWater.rotation.x = Math.PI / 2; fWater.position.set(lx, ly, 0.42); outdoorGroup.add(fWater);
    const fJet = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.45 }));
    fJet.rotation.x = Math.PI / 2; fJet.position.set(lx, ly, 0.7); outdoorGroup.add(fJet);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const tx = lx + Math.cos(angle) * lr;
      const ty = ly + Math.sin(angle) * lr;
      outdoorGroup.add(createPalmTree(tx, ty));
    }

    // Rocks at corners of the grass block
    const jitter = (geo: THREE.BufferGeometry, amount: number) => {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i,
          pos.getX(i) + (Math.random() - 0.5) * amount,
          pos.getY(i) + (Math.random() - 0.5) * amount,
          pos.getZ(i) + (Math.random() - 0.5) * amount,
        );
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };
    const dodec = new THREE.DodecahedronGeometry(0.2); jitter(dodec, 0.04);
    const ico = new THREE.IcosahedronGeometry(0.17); jitter(ico, 0.035);
    const octa = new THREE.OctahedronGeometry(0.24); jitter(octa, 0.05);
    const ico2 = new THREE.IcosahedronGeometry(0.14); jitter(ico2, 0.03);
    const rockDefs: [number, number, number, THREE.BufferGeometry, number, number, number][] = [
      [2.5, -2.5, 0x8b7d6b, dodec, 1, 1, 1],
      [9.5, -2.5, 0x78716c, ico, 1.2, 0.8, 1.1],
      [2.5, -5.5, 0x57534e, octa, 0.9, 1.3, 0.9],
      [9.5, -5.5, 0x6b635e, ico2, 1.1, 1, 0.8],
    ];
    rockDefs.forEach(([rx, ry, color, geo, sx, sy, sz]) => {
      const rock = new THREE.Mesh(geo, createToonMaterial(color));
      rock.position.set(rx, ry, 0.18);
      rock.scale.set(sx, sy, sz);
      rock.rotation.z = Math.random() * Math.PI * 2;
      rock.castShadow = true;
      rock.receiveShadow = true;
      outdoorGroup.add(rock);
    });

    // Park benches
    const benchMat = createToonMaterial(0x8b6b4a);
    const benchPositions: [number, number][] = [];
    benchPositions.forEach(([benchX, benchY]) => {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.12), benchMat);
      seat.position.set(benchX, benchY, 0.16);
      seat.castShadow = true;
      outdoorGroup.add(seat);
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), benchMat);
      leg1.position.set(benchX - 0.18, benchY - 0.04, 0.1);
      outdoorGroup.add(leg1);
      const leg2 = leg1.clone();
      leg2.position.x = benchX + 0.18;
      outdoorGroup.add(leg2);
    });

    // Trash cans
    const canMat = createToonMaterial(0x6a6a7a);
    const canPositions: [number, number][] = [];
    canPositions.forEach(([canX, canY]) => {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 10), canMat);
      can.position.set(canX, canY, 0.12);
      can.castShadow = true;
      outdoorGroup.add(can);
    });

    // No buildings yet — story hasn't progressed past the pet workshop job

    const poleMat = createToonMaterial(0x6a6a7a);
    const lampMat = createToonMaterial(0xfef08a);
    const lightPositions: [number, number][] = [
      [-1.75, -1.75], [1.75, -1.75], [-1.75, 1.75], [1.75, 1.75],
      [-1.75, -6.25], [1.75, -6.25], [-13.75, -1.75], [-10.25, -1.75],
      [10.25, -1.75], [13.75, -1.75], [-13.75, -9.75], [-10.25, -9.75],
      [10.25, -9.75], [13.75, -9.75], [-1.75, -14.25], [1.75, -14.25],
      [18.25, -14.25], [21.75, -14.25],
    ];
    lightPositions.forEach(([lx, ly]) => {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), poleMat);
      pole.position.set(lx, ly, 0.5);
      pole.castShadow = true;
      outdoorGroup.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lampMat);
      lamp.position.set(lx, ly, 1.1);
      outdoorGroup.add(lamp);
    });

    const treeTrunkMat = createToonMaterial(0x8b5a2b);
    const treeCrownMat = createToonMaterial(0x5a9e5a);
    const treePositions: [number, number][] = [[-8, -6], [-4.5, -6], [-2, -6], [2.5, -6], [6, -6], [9, -6]];
    treePositions.forEach(([tx, ty]) => {
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), treeTrunkMat);
      trunk.position.set(tx, ty, 0.2);
      trunk.castShadow = true;
      outdoorGroup.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), treeCrownMat);
      crown.position.set(tx, ty, 0.7);
      crown.castShadow = true;
      outdoorGroup.add(crown);
    });

    const shops = [
      createBazaarShop(-7.5, -5.3, 0xe879f9, 0xf97316, 'Masala Chai', 1.2),
      createBazaarShop(-4.87, -5.3, 0x60a5fa, 0xfb7185, 'Code Bazaar', 1.2),
    ];
    shops.forEach((shop) => outdoorGroup.add(shop));

    const apartmentBuilding = createApartmentBuilding(-6, -3.5, 8.0, 2.8, -3.6);
    outdoorGroup.add(apartmentBuilding);

    // Vendor builder: 3D shopkeeper, back visible to camera
    const makeVendor = (vx: number, vy: number, color: number) => {
      const g = new THREE.Group();
      const sMat = new THREE.MeshToonMaterial({ color: 0xf5d6c6, gradientMap: createGradientTexture(3) });
      const cMat = new THREE.MeshToonMaterial({ color, gradientMap: createGradientTexture(3) });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.35, 12), cMat);
      b.rotation.x = Math.PI / 2; b.position.set(0, 0, 0.2); g.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), sMat);
      h.position.set(0, 0, 0.55); g.add(h);
      // Hair covering the BACK of the head (visible from camera)
      const hr = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshToonMaterial({ color: 0x2a1a0a, gradientMap: createGradientTexture(3) }));
      hr.position.set(0, -0.04, 0.56); g.add(hr);
      // Arms
      for (let s = -1; s <= 1; s += 2) {
        const a = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.25, 8), cMat);
        a.rotation.x = Math.PI / 2; a.rotation.z = s * 0.3;
        a.position.set(s * 0.2, 0, 0.35); g.add(a);
      }
      g.position.set(vx, vy, 0.24);
      outdoorGroup.add(g);
    };
    makeVendor(-7.5, -5.3, 0xffffff);
    makeVendor(-4.87, -5.3, 0x60a5fa);

    // Grid removed (was creating lines through the lake)

    // Rangoli removed

    // Pet workshop: two-story building, bottom floor glass storefront
    const ps = new THREE.Group();
    const psW = new THREE.MeshToonMaterial({ color: 0xf0f0f0, gradientMap: createGradientTexture(3) });
    const psT = new THREE.MeshToonMaterial({ color: 0x2a2a3a, gradientMap: createGradientTexture(3) });
    const psR = new THREE.MeshToonMaterial({ color: 0x8b4513, gradientMap: createGradientTexture(3) });
    const psG = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const psFloor = new THREE.MeshToonMaterial({ color: 0x94a3b8, gradientMap: createGradientTexture(3) });
    const psAp = new THREE.MeshToonMaterial({ color: 0xf5e6d0, gradientMap: createGradientTexture(3) });
    const cx = -6, cy = -11.8, bw = 7.4, bd = 2.4, bh = 1.7;

    // Ground floor slab
    const gSlab = new THREE.Mesh(new THREE.BoxGeometry(bw, bd, 0.04), psFloor);
    gSlab.position.set(cx, cy, 0.02); ps.add(gSlab);
    // Ceiling slab
    const cSlab = new THREE.Mesh(new THREE.BoxGeometry(bw, bd, 0.08), new THREE.MeshToonMaterial({ color: 0x94a3b8, gradientMap: createGradientTexture(3) }));
    cSlab.position.set(cx, cy, bh); ps.add(cSlab);
    // Back wall (now at SOUTH side, away from bazaars)
    const bWall = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.2, 0.08, bh - 0.1), psW);
    bWall.position.set(cx, cy - bd / 2 + 0.04, bh / 2); ps.add(bWall);
    // Side walls
    for (let s = -1; s <= 1; s += 2) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.08, bd, bh - 0.1), psW);
      sw.position.set(cx + s * (bw / 2 - 0.04), cy, bh / 2); ps.add(sw);
    }
    // Front glass wall (NORTH side, facing bazaars) — full width coverage
    const fwY = cy + bd / 2 - 0.04;
    const sectW = 1.5, nSect = 5;
    const totalW = bw - 0.16;
    const gap = (totalW - nSect * sectW) / (nSect + 1);
    for (let i = 0; i < nSect + 1; i++) {
      const px = cx - totalW / 2 + i * (sectW + gap) + gap / 2;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, bh), psT);
      pillar.position.set(px, fwY, bh / 2); ps.add(pillar);
    }
    for (let i = 0; i < nSect; i++) {
      const gx = cx - totalW / 2 + gap + i * (sectW + gap) + sectW / 2;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(sectW - 0.02, 0.04, bh - 0.4), psG);
      glass.position.set(gx, fwY, (bh - 0.4) / 2 + 0.2); ps.add(glass);
    }
    // Door (center)
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.9), new THREE.MeshToonMaterial({ color: 0x0f172a, gradientMap: createGradientTexture(3) }));
    door.position.set(cx, fwY, 0.45); ps.add(door);
    const doorTrim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.04), psT);
    doorTrim.position.set(cx, fwY, 0.92); ps.add(doorTrim);

    // Top floor
    const tfW = bw + 0.3, tfD = bd + 0.3, tfH = 1.3;
    const tfZ = bh + tfH / 2;
    // Back wall (SOUTH)
    const tfBack = new THREE.Mesh(new THREE.BoxGeometry(tfW, 0.08, tfH), psAp);
    tfBack.position.set(cx, cy - tfD / 2, tfZ); ps.add(tfBack);
    // Side walls
    for (let s = -1; s <= 1; s += 2) {
      const tfSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, tfD, tfH), psAp);
      tfSide.position.set(cx + s * tfW / 2, cy, tfZ); ps.add(tfSide);
    }
    // Front wall (NORTH) with window cutouts
    const fwY2 = cy + tfD / 2;
    const winCxRel = [-2.2, 0, 2.2];
    const winW = 1.4, winH = 0.6, winZ = bh + 0.78;
    const segs = [
      { from: -tfW / 2, to: winCxRel[0] - winW / 2 },
      { from: winCxRel[0] + winW / 2, to: winCxRel[1] - winW / 2 },
      { from: winCxRel[1] + winW / 2, to: winCxRel[2] - winW / 2 },
      { from: winCxRel[2] + winW / 2, to: tfW / 2 },
    ];
    for (const seg of segs) {
      const segW = seg.to - seg.from;
      if (segW < 0.01) continue;
      const segCx = cx + (seg.from + seg.to) / 2;
      const botH = winZ - winH / 2 - bh;
      const topH = bh + tfH - (winZ + winH / 2);
      if (botH > 0.01) {
        const bwSeg = new THREE.Mesh(new THREE.BoxGeometry(segW - 0.02, 0.08, botH), psAp);
        bwSeg.position.set(segCx, fwY2, bh + botH / 2); ps.add(bwSeg);
      }
      if (topH > 0.01) {
        const twSeg = new THREE.Mesh(new THREE.BoxGeometry(segW - 0.02, 0.08, topH), psAp);
        twSeg.position.set(segCx, fwY2, winZ + winH / 2 + topH / 2); ps.add(twSeg);
      }
    }
    // Window glass & frames
    for (const wcxRel of winCxRel) {
      const wcx = cx + wcxRel;
      const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.2, 0.06, 0.06), psT);
      sill.position.set(wcx, fwY2 + 0.01, winZ - winH / 2); ps.add(sill);
      const wg = new THREE.Mesh(new THREE.BoxGeometry(winW - 0.04, 0.04, winH - 0.04), new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
      wg.position.set(wcx, fwY2, winZ); ps.add(wg);
      for (let s = -1; s <= 1; s += 2) {
        const wf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, winH), psT);
        wf.position.set(wcx + s * (winW / 2 - 0.02), fwY2, winZ); ps.add(wf);
      }
    }
    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.8, bd + 0.6, 0.08), psR);
    roof.position.set(cx, cy, bh + 1.36); ps.add(roof);
    // Sign — HUGE 3D box on the front wall above the door
    {
      const sc = document.createElement('canvas');
      sc.width = 800; sc.height = 128;
      const sctx = sc.getContext('2d')!;
      const rad = 16;
      sctx.fillStyle = 'rgba(220,38,38,0.95)';
      sctx.beginPath(); sctx.moveTo(rad, 0); sctx.lineTo(800 - rad, 0);
      sctx.quadraticCurveTo(800, 0, 800, rad); sctx.lineTo(800, 128 - rad);
      sctx.quadraticCurveTo(800, 128, 800 - rad, 128); sctx.lineTo(rad, 128);
      sctx.quadraticCurveTo(0, 128, 0, 128 - rad); sctx.lineTo(0, rad);
      sctx.quadraticCurveTo(0, 0, rad, 0); sctx.closePath(); sctx.fill();
      sctx.shadowColor = '#000'; sctx.shadowBlur = 6;
      sctx.fillStyle = '#f8fafc'; sctx.font = '700 68px system-ui'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
      sctx.fillText("RAFIQ'S ROBOTS", 400, 66);
      const st = new THREE.CanvasTexture(sc);
      st.minFilter = THREE.LinearFilter;
      st.flipY = false;
      // BoxGeometry(wide, thin (faces north), tall) — mounted on apartment north wall, outside
      const pSign = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.06, 0.5), new THREE.MeshBasicMaterial({ map: st }));
      pSign.position.set(cx, cy + (bd + 0.3) / 2 + 0.07, bh + 0.2);
      pSign.scale.x = -1;
      ps.add(pSign);
    }

    ps.position.set(0, 0, 0);
    outdoorGroup.add(ps);
    ps.visible = true;
    petShopRef.current = ps;

    // Exclamation mark above the workshop door, visible when player should enter
    const doorAnchor = new THREE.Group();
    doorAnchor.position.set(-6, -10.0, 1.0);
    outdoorGroup.add(doorAnchor);
    const doorMarker = addExclamationMarker(doorAnchor);
    doorMarker.visible = sparkyQuestStageRef.current === 'unit1-done' || sparkyQuestStageRef.current === 'unit2-done' || sparkyQuestStageRef.current === 'unit3-done';
    workshopDoorMarkerRef.current = doorMarker;

    const aptDoorAnchor = new THREE.Group();
    aptDoorAnchor.position.set(-9.6, -4.9, 1.8);
    outdoorGroup.add(aptDoorAnchor);
    const aptDoorMarker = addExclamationMarker(aptDoorAnchor);
    aptDoorMarker.position.set(0, 0, -0.3);
    aptDoorMarker.visible = false;
    apartmentDoorMarkerRef.current = aptDoorMarker;

    // Exclamation mark above the shop door, visible when player needs to buy a part
    const shopDoorAnchor = new THREE.Group();
    shopDoorAnchor.position.set(6.0, -10.2, 1.0);
    outdoorGroup.add(shopDoorAnchor);
    const shopDoorMarker = addExclamationMarker(shopDoorAnchor);
    const shopPartId = PART_FOR_STAGE[sparkyQuestStageRef.current];
    shopDoorMarker.visible = !!shopPartId && !gameStore.get('backpack').includes(shopPartId);
    shopDoorMarkerRef.current = shopDoorMarker;

    // Transport store at (-18.75, -12) — within left grass block, clears sidewalks
    const bCx = -18.75, bCy = -12;
    const bHw = 4.65, bHh = 1.95;
    // Bounds check: east edge -14.1 clears vSW(-13.75) at x[-14.0,-13.5],
    // north edge -10.05 clears hSW(-9.75) at y[-10.0,-9.5],
    // south edge -13.95 clears hSW(-14.25) at y[-14.5,-14.0].
    {
      // Concrete floor slab
      const floor = new THREE.Mesh(new THREE.BoxGeometry(bHw * 2, bHh * 2, 0.08), createToonMaterial(0x94a3b8));
      floor.position.set(bCx, bCy, 0.04);
      floor.receiveShadow = true;
      outdoorGroup.add(floor);

      // South wall (y-)
      const sWall = new THREE.Mesh(new THREE.BoxGeometry(bHw * 2 - 0.2, 0.2, 2.4), createToonMaterial(0x64748b));
      sWall.position.set(bCx, bCy - bHh + 0.1, 1.2);
      sWall.castShadow = true;
      outdoorGroup.add(sWall);

      // North wall (y+)
      const nWall = new THREE.Mesh(new THREE.BoxGeometry(bHw * 2 - 0.2, 0.2, 2.4), createToonMaterial(0x64748b));
      nWall.position.set(bCx, bCy + bHh - 0.1, 1.2);
      nWall.castShadow = true;
      outdoorGroup.add(nWall);

      // West wall (x-)
      const wWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, bHh * 2 - 0.2, 2.4), createToonMaterial(0x64748b));
      wWall.position.set(bCx - bHw + 0.1, bCy, 1.2);
      wWall.castShadow = true;
      outdoorGroup.add(wWall);

      // East entrance pillars (x+ side, open)
      for (let s = -1; s <= 1; s += 2) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.4), createToonMaterial(0x475569));
        pillar.position.set(bCx + bHw - 0.1, bCy + s * 1.5, 1.2);
        pillar.castShadow = true;
        outdoorGroup.add(pillar);
      }

      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(bHw * 2 + 0.4, bHh * 2 + 0.4, 0.08), createToonMaterial(0xdc2626));
      roof.position.set(bCx, bCy, 2.44);
      roof.castShadow = true;
      outdoorGroup.add(roof);

      // 3D sign above entrance — BoxGeometry(thin (faces east), wide, tall)
      {
        const sc = document.createElement('canvas');
        sc.width = 512; sc.height = 96;
        const sctx = sc.getContext('2d')!;
        const rad = 12;
        sctx.fillStyle = 'rgba(220,38,38,0.92)';
        sctx.beginPath(); sctx.moveTo(rad, 0); sctx.lineTo(512 - rad, 0);
        sctx.quadraticCurveTo(512, 0, 512, rad); sctx.lineTo(512, 96 - rad);
        sctx.quadraticCurveTo(512, 96, 512 - rad, 96); sctx.lineTo(rad, 96);
        sctx.quadraticCurveTo(0, 96, 0, 96 - rad); sctx.lineTo(0, rad);
        sctx.quadraticCurveTo(0, 0, rad, 0); sctx.closePath(); sctx.fill();
        sctx.fillStyle = '#f8fafc'; sctx.font = '700 48px system-ui'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
        sctx.fillText('TRANSPORTER', 256, 50);
        const st = new THREE.CanvasTexture(sc);
        st.minFilter = THREE.LinearFilter;
        st.flipY = false;
        const tSign = new THREE.Mesh(new THREE.BoxGeometry(4, 0.06, 0.7), new THREE.MeshBasicMaterial({ map: st }));
        tSign.position.set(bCx + bHw + 0.3, bCy, 2.1);
        tSign.scale.x = -1;
        tSign.rotation.z = -Math.PI / 2;
        outdoorGroup.add(tSign);
      }

      // Bicycle display (left side, human-scale)
      {
        const bg = new THREE.Group();
        const wheelMat = new THREE.MeshToonMaterial({ color: 0x1a1a1a, gradientMap: createGradientTexture(3) });
        const frameMat = createToonMaterial(0xf59e0b);
        const spokeMat = new THREE.MeshToonMaterial({ color: 0x94a3b8, gradientMap: createGradientTexture(3) });
        const seatMat = createToonMaterial(0x1f2937);

        const rw = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 16), wheelMat);
        rw.rotation.x = Math.PI / 2;
        rw.position.set(-0.45, 0, 0);
        bg.add(rw);
        const fw = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 16), wheelMat);
        fw.rotation.x = Math.PI / 2;
        fw.position.set(0.45, 0, 0);
        bg.add(fw);
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6;
          const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 4), spokeMat);
          spoke.rotation.x = Math.PI / 2;
          spoke.rotation.z = a;
          spoke.position.set(-0.45, 0, 0);
          bg.add(spoke);
        }
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6;
          const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 4), spokeMat);
          spoke.rotation.x = Math.PI / 2;
          spoke.rotation.z = a;
          spoke.position.set(0.45, 0, 0);
          bg.add(spoke);
        }

        const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6), frameMat);
        hb.rotation.x = Math.PI / 2;
        hb.position.set(0.45, 0, 0.2);
        bg.add(hb);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.03), seatMat);
        seat.position.set(-0.1, 0, 0.27);
        bg.add(seat);

        bg.position.set(bCx - 3, bCy + 0.5, 0.1);
        outdoorGroup.add(bg);

        const bp = createLabelSprite('$100', '#f8fafc', 'rgba(0,0,0,0.8)', '#f59e0b', 140, 55);
        bp.scale.set(1.6, 0.6, 1);
        bp.position.set(bCx - 3, bCy - 0.4, 0.7);
        bp.renderOrder = 33;
        outdoorGroup.add(bp);
      }

      // Broken car display (right side, human-scale)
      {
        const cg = new THREE.Group();
        const cBody = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.55, 0.45),
          createToonMaterial(0xdc2626)
        );
        cBody.position.set(0, 0, 0.25);
        cBody.rotation.z = 0.08;
        cg.add(cBody);

        const cCab = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.35, 0.22),
          createToonMaterial(0xdc2626)
        );
        cCab.position.set(-0.05, 0, 0.53);
        cCab.rotation.z = 0.05;
        cg.add(cCab);

        const ws = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.04, 0.2),
          new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.25 })
        );
        ws.position.set(0.2, 0, 0.48);
        ws.rotation.z = 0.25;
        cg.add(ws);

        const wheelMatCar = createToonMaterial(0x1a1a1a);
        const wPoses: [number, number, number, number][] = [
          [-0.4, -0.32, 0.04, 0], [0.4, -0.32, 0.04, 0.2],
          [-0.4, 0.32, 0.04, 0], [0.4, 0.32, 0.02, 0.6],
        ];
        wPoses.forEach(([wx, wy, wz, rot]) => {
          const w = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 12), wheelMatCar);
          w.rotation.x = Math.PI / 2;
          w.rotation.y = rot;
          w.position.set(wx, wy, wz);
          cg.add(w);
        });

        for (let i = 0; i < 3; i++) {
          const sm = new THREE.Mesh(
            new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.3 })
          );
          sm.position.set(-0.4 + Math.random() * 0.2, -0.2 + Math.random() * 0.2, 0.6 + Math.random() * 0.15);
          cg.add(sm);
        }

        cg.position.set(bCx + 3, bCy + 0.3, 0.1);
        outdoorGroup.add(cg);

        const cp = createLabelSprite('$1,000', '#f8fafc', 'rgba(0,0,0,0.8)', '#f59e0b', 170, 55);
        cp.scale.set(1.8, 0.6, 1);
        cp.position.set(bCx + 3, bCy - 0.4, 0.85);
        cp.renderOrder = 33;
        outdoorGroup.add(cp);
      }

      // Vendor (mechanic) at back center
      {
        const vg = new THREE.Group();
        const vsMat = new THREE.MeshToonMaterial({ color: 0xf5d6c6, gradientMap: createGradientTexture(3) });
        const vcMat = new THREE.MeshToonMaterial({ color: 0x1e293b, gradientMap: createGradientTexture(3) });
        const vb = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.35, 12), vcMat);
        vb.rotation.x = Math.PI / 2; vb.position.set(0, 0, 0.2); vg.add(vb);
        const vh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), vsMat);
        vh.position.set(0, 0, 0.55); vg.add(vh);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.06, 12), createToonMaterial(0xf59e0b));
        cap.position.set(0, 0, 0.6); vg.add(cap);
        const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.02), createToonMaterial(0xf59e0b));
        capBrim.position.set(0, 0, 0.63); vg.add(capBrim);
        for (let s = -1; s <= 1; s += 2) {
          const a = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.25, 8), vcMat);
          a.rotation.x = Math.PI / 2; a.rotation.z = s * 0.3;
          a.position.set(s * 0.2, 0, 0.35); vg.add(a);
        }
        vg.position.set(bCx, bCy - bHh + 0.6, 0.24);
        outdoorGroup.add(vg);
      }

      transportHitboxRef.current = { shape: 'circle', center: { x: bCx + bHw + 0.5, y: bCy }, radius: 3.0 };
    }

    // Parts shop at (6.0, -12.0) — fills the entire grass patch east of Rafiq's
    {
      const partsShop = createPartsShop(6.0, -12.0, 8.0, 4.0);
      outdoorGroup.add(partsShop);

      shopDoorHitboxRef.current = {
        shape: 'circle',
        center: { x: 6.0, y: -10.2 },
        radius: 0.5,
      };
    }

    // Invisible vertical occluder panels around outdoor buildings — prevent camera from seeing over walls into interiors
    // Mirror of room camera clamping: these block the upward frustum that sees past short walls
    const occluderMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
    const panelH = 3.0 - 1.05;
    const panelZ = 1.05 + panelH / 2;
    const INSET = 0.02;
    const buildingFootprints: { x1: number; y1: number; x2: number; y2: number; cx: number; cy: number; bw: number; bd: number }[] = [
      { x1: -10.08, y1: -4.98, x2: -1.92, y2: -2.02, cx: -6, cy: -3.5, bw: 8.0, bd: 2.8 },
      { x1: -9.7, y1: -13.0, x2: -2.3, y2: -10.6, cx: -6, cy: -11.8, bw: 7.4, bd: 2.4 },
      { x1: -23.4, y1: -13.95, x2: -14.2, y2: -10.05, cx: -18.75, cy: -12, bw: 9.3, bd: 3.9 },
      { x1: 2.0, y1: -14.0, x2: 10.0, y2: -10.0, cx: 6, cy: -12, bw: 8.0, bd: 4.0 },
    ];
    for (let bi = 0; bi < buildingFootprints.length; bi++) {
      const b = buildingFootprints[bi];
      if (bi >= 3) continue; // parts shop has peaked roof, no occluder needed
      const hw = b.bw / 2, hd = b.bd / 2;
      const addPanel = (w: number, d: number, x: number, y: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, panelH), occluderMat);
        m.position.set(x, y, panelZ);
        outdoorGroup.add(m);
      };
      addPanel(b.bw, 0.02, b.cx, b.cy + hd - INSET);
      addPanel(b.bw, 0.02, b.cx, b.cy - hd + INSET);
      addPanel(0.02, b.bd, b.cx + hw - INSET, b.cy);
      addPanel(0.02, b.bd, b.cx - hw + INSET, b.cy);
    }

    const createExitSignMesh = (x: number, y: number, z: number, parent: THREE.Group, bgColor = '#dc2626', textColor = '#ffffff', borderColor = '#fde68a') => {
      const canvas = document.createElement('canvas');
      canvas.width = 200; canvas.height = 80;
      const ctx = canvas.getContext('2d')!;
      const r = 12;
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(200 - r, 0);
      ctx.quadraticCurveTo(200, 0, 200, r);
      ctx.lineTo(200, 80 - r);
      ctx.quadraticCurveTo(200, 80, 200 - r, 80);
      ctx.lineTo(r, 80);
      ctx.quadraticCurveTo(0, 80, 0, 80 - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, 192, 72);
      ctx.fillStyle = textColor;
      ctx.font = '700 40px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', 100, 44);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.flipY = false;
      const bracketMat = new THREE.MeshToonMaterial({ color: 0x334155 });
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.35), bracketMat);
      bracket.position.set(0, 0, -0.15);
      const signMat = new THREE.MeshBasicMaterial({ map: tex });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.2), signMat);
      panel.scale.y = -1;
      const frameMat = new THREE.MeshToonMaterial({ color: 0x1e293b });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.24), frameMat);
      frame.renderOrder = 1;
      const signGroup = new THREE.Group();
      signGroup.add(frame);
      signGroup.add(panel);
      signGroup.add(bracket);
      signGroup.position.set(x, y, z);
      parent.add(signGroup);
    };

    // Shop interior room
    {
      const shopRoomGroup = new THREE.Group();
      shopRoomGroup.visible = false;
      scene.add(shopRoomGroup);
      shopRoomGroupRef.current = shopRoomGroup;

      const sW = 7.6, sD = 3.6, sH = 1.3;

      const sFloor = new THREE.Mesh(
        new THREE.BoxGeometry(sW, sD, 0.04),
        createTexturedToonMaterial('tile_43.png', 5, 3, 0x8b6b4a)
      );
      sFloor.position.set(0, 0, 0.02);
      shopRoomGroup.add(sFloor);

      const sWallMat = createTexturedToonMaterial('tile_23.png', 4, 2, 0xf5e6d0);
      sWallMat.side = THREE.DoubleSide;
      // South wall (entrance side) — full width
      const sWallS = new THREE.Mesh(new THREE.BoxGeometry(sW, 0.08, sH), sWallMat);
      sWallS.position.set(0, -sD / 2, sH / 2);
      shopRoomGroup.add(sWallS);
      // North wall (exit side) — with door cutout
      const exitDoorW = 0.68;
      const nSegW = (sW - exitDoorW) / 2;
      for (let s = -1; s <= 1; s += 2) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(nSegW, 0.08, sH), sWallMat);
        seg.position.set(s * (exitDoorW / 2 + nSegW / 2), sD / 2, sH / 2);
        shopRoomGroup.add(seg);
      }
      // East/west end walls
      for (let s = -1; s <= 1; s += 2) {
        const endWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, sD, sH), sWallMat);
        endWall.position.set(s * sW / 2, 0, sH / 2);
        shopRoomGroup.add(endWall);
      }

      // Back counter
      const counterMat = createToonMaterial(0x8b4513);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.25), counterMat);
      counter.position.set(0, -sD / 2 + 0.3, 0.16);
      shopRoomGroup.add(counter);

      const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.04), createToonMaterial(0xa0522d));
      counterTop.position.set(0, -sD / 2 + 0.3, 0.32);
      shopRoomGroup.add(counterTop);

      // Shelves along the sides with items
      const shelfMat = createToonMaterial(0x475569);
      const itemColors = [0x60a5fa, 0x34d399, 0xf97316, 0xa855f7, 0xfacc15];
      for (let sx = -1; sx <= 1; sx += 2) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.25), shelfMat);
        shelf.position.set(sx * 2.2, 0, 0.16);
        shopRoomGroup.add(shelf);
        // Items on shelves
        for (let iy = -1; iy <= 1; iy += 2) {
          const item = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.06, 0.06),
            createToonMaterial(itemColors[Math.floor(Math.random() * itemColors.length)])
          );
          item.position.set(sx * (2.2 + 0.04), iy * 0.5, 0.3);
          shopRoomGroup.add(item);
        }
      }

      // Side display case (right side of entrance, not blocking the door)
      const sideDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.2), createToonMaterial(0x8b4513));
      sideDisplay.position.set(-sW / 2 + 0.15, sD / 2 - 0.35, 0.12);
      shopRoomGroup.add(sideDisplay);
      const dItem = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x60a5fa })
      );
      dItem.position.set(-sW / 2 + 0.15, sD / 2 - 0.35, 0.24);
      shopRoomGroup.add(dItem);

      // Shop obstacle hitboxes
      shopObstaclesRef.current = [
        { shape: 'box', center: { x: 0, y: -1.5 }, halfWidth: 0.8, halfHeight: 0.06 },
        { shape: 'box', center: { x: 2.2, y: 0 }, halfWidth: 0.02, halfHeight: 0.6 },
        { shape: 'box', center: { x: -2.2, y: 0 }, halfWidth: 0.02, halfHeight: 0.6 },
        { shape: 'box', center: { x: -3.65, y: 1.45 }, halfWidth: 0.03, halfHeight: 0.25 },
      ];

      // Shopkeeper robot — same visual but scaled down to fit room
      const shopNpc = createRobotVisual(new THREE.Color(0x60a5fa), 'Shopkeeper');
      shopNpc.root.scale.set(0.45, 0.45, 0.45);
      shopNpc.root.position.set(0, -sD / 2 + 0.35, -0.124);
      shopRoomGroup.add(shopNpc.root);
      shopNpcRef.current = shopNpc;

      // Welcome mat at entrance
      const welcomeMat = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.2, 0.02),
        createToonMaterial(0x6d4c2a)
      );
      welcomeMat.position.set(0, sD / 2 - 0.05, 0.03);
      shopRoomGroup.add(welcomeMat);

      // Exit door on the north wall — flush with the wall in the cutout
      const exitDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.08, 0.7),
        createToonMaterial(0xdc2626)
      );
      exitDoor.position.set(0, sD / 2, 0.39);
      shopRoomGroup.add(exitDoor);
      const exitFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.08, 0.76),
        createToonMaterial(0x1a1a1a)
      );
      exitFrame.position.set(0, sD / 2, 0.42);
      shopRoomGroup.add(exitFrame);

      createExitSignMesh(0, 1.8, 0.84, shopRoomGroup, '#dc2626', '#ffffff', '#fde68a');
    }

    // Multi-floor arena at (18.75, -12) — merged grass block x=[13.5,24]
    const aCx = 18.75, aCy = -12;
    const aW = 7, aD = 3.5, aFH = 2.0, aWT = 0.12;
    const aFloors = [0x7c3aed, 0xdc2626, 0x2563eb];
    const arenaBuilding = new THREE.Group();
    // Base slab
    const base = new THREE.Mesh(new THREE.BoxGeometry(aW, aD, 0.1), createToonMaterial(0x94a3b8));
    base.position.set(aCx, aCy, 0.05);
    arenaBuilding.add(base);
    // 3 stacked floors (directly on each other, no gaps)
    for (let f = 0; f < 3; f++) {
      const zW = f * (aFH + 0.1) + 0.1; // wall bottom
      const zS = zW + aFH; // slab bottom (top of wall)
      const wMat = createTexturedToonMaterial('tile_25.png', 14, 7, aFloors[f]);
      // South wall
      const sw = new THREE.Mesh(new THREE.BoxGeometry(aW - aWT * 2, aWT, aFH), wMat);
      sw.position.set(aCx, aCy - aD / 2 + aWT / 2, zW + aFH / 2);
      arenaBuilding.add(sw);
      // Side walls
      for (let s = -1; s <= 1; s += 2) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(aWT, aD - aWT * 2, aFH), wMat);
        side.position.set(aCx + s * (aW / 2 - aWT / 2), aCy, zW + aFH / 2);
        arenaBuilding.add(side);
      }
      if (f === 0) {
        // Ground: north wall with door opening
        const dW = 1.8, nSeg = (aW - dW) / 2;
        const n1 = new THREE.Mesh(new THREE.BoxGeometry(nSeg - aWT, aWT, aFH), wMat);
        n1.position.set(aCx - dW / 2 - nSeg / 2 + aWT / 2, aCy + aD / 2 - aWT / 2, zW + aFH / 2);
        arenaBuilding.add(n1);
        const n2 = new THREE.Mesh(new THREE.BoxGeometry(nSeg - aWT, aWT, aFH), wMat);
        n2.position.set(aCx + dW / 2 + nSeg / 2 - aWT / 2, aCy + aD / 2 - aWT / 2, zW + aFH / 2);
        arenaBuilding.add(n2);
        // Door fill (dark recess)
        const df = new THREE.Mesh(new THREE.BoxGeometry(dW - 0.2, aWT + 0.01, aFH - 0.4), createToonMaterial(0x0f172a, 0.36, 0.35));
        df.position.set(aCx, aCy + aD / 2 - aWT / 2 + 0.005, zW + aFH / 2);
        arenaBuilding.add(df);
        // Door glow
        const glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.3), new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.5 }));
        glow.position.set(aCx, aCy + aD / 2 + 0.04, zW + aFH - 0.3);
        arenaBuilding.add(glow);
        // ARENA sign above door
        {
          const sc = document.createElement('canvas');
          sc.width = 400; sc.height = 96;
          const sctx = sc.getContext('2d')!;
          const rad = 12;
          sctx.fillStyle = 'rgba(220,38,38,0.92)';
          sctx.beginPath(); sctx.moveTo(rad, 0); sctx.lineTo(400 - rad, 0);
          sctx.quadraticCurveTo(400, 0, 400, rad); sctx.lineTo(400, 96 - rad);
          sctx.quadraticCurveTo(400, 96, 400 - rad, 96); sctx.lineTo(rad, 96);
          sctx.quadraticCurveTo(0, 96, 0, 96 - rad); sctx.lineTo(0, rad);
          sctx.quadraticCurveTo(0, 0, rad, 0); sctx.closePath(); sctx.fill();
          sctx.fillStyle = '#f8fafc'; sctx.font = '700 52px system-ui'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
          sctx.fillText('ARENA', 200, 52);
          const st = new THREE.CanvasTexture(sc);
          st.minFilter = THREE.LinearFilter;
          st.flipY = false;
          const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.45), new THREE.MeshBasicMaterial({ map: st }));
          sign.position.set(aCx, aCy + aD / 2 + 0.01, zS + 0.1);
          sign.scale.x = -1;
          arenaBuilding.add(sign);
        }
      } else {
        // Upper floors: solid north wall
        const nw = new THREE.Mesh(new THREE.BoxGeometry(aW - aWT * 2, aWT, aFH), wMat);
        nw.position.set(aCx, aCy + aD / 2 - aWT / 2, zW + aFH / 2);
        arenaBuilding.add(nw);
      }
      // Floor/ceiling slab between floors
      if (f < 2) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(aW, aD, 0.1), createToonMaterial(0x94a3b8));
        slab.position.set(aCx, aCy, zS + 0.05);
        arenaBuilding.add(slab);
      }
    }
    // Flat roof with parapet
    const rZ = 3 * (aFH + 0.1) + 0.1;
    const aRoof = new THREE.Mesh(new THREE.BoxGeometry(aW, aD, 0.15), createToonMaterial(0x1e293b));
    aRoof.position.set(aCx, aCy, rZ + 0.075);
    arenaBuilding.add(aRoof);
    const pMat = createToonMaterial(0x334155);
    for (let s = -1; s <= 1; s += 2) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(aW + 0.2, 0.08, 0.25), pMat);
      p.position.set(aCx, aCy + s * aD / 2, rZ + 0.2);
      arenaBuilding.add(p);
      const ps = new THREE.Mesh(new THREE.BoxGeometry(0.08, aD + 0.2, 0.25), pMat);
      ps.position.set(aCx + s * aW / 2, aCy, rZ + 0.2);
      arenaBuilding.add(ps);
    }
    addOutline(base);
    applyShadows(arenaBuilding, true, true);
    outdoorGroup.add(arenaBuilding);
    arenaBuildingRef.current = arenaBuilding;

    obstacleHitboxesRef.current = buildObstacles({
      arenaCenterX: aCx,
      arenaCenterY: aCy,
      arenaHalfW: aW / 2 + 0.2,
      arenaHalfD: aD / 2 + 0.2,
    });
    workshopDoorHitboxRef.current = {
      shape: 'circle',
      center: { x: -6, y: -10.3 },
      radius: 0.5,
    };

    arenaDoorHitboxRef.current = {
      shape: 'circle',
      center: { x: aCx, y: aCy + aD / 2 },
      radius: 0.5,
    };

    apartmentDoorHitboxRef.current = {
      shape: 'circle',
      center: { x: -9.6, y: -4.9 },
      radius: 0.5,
    };

    workshopObstaclesRef.current = [
      { shape: 'box', center: { x: -3.2, y: 3.25 }, halfWidth: 0.825, halfHeight: 0.225 },
      { shape: 'box', center: { x: 2.9, y: 3.05 }, halfWidth: 0.75, halfHeight: 0.35 },
      { shape: 'box', center: { x: 3.4, y: -2.4 }, halfWidth: 0.625, halfHeight: 0.41 },
      { shape: 'box', center: { x: -1.9, y: 0.5 }, halfWidth: 0.35, halfHeight: 0.35 },
    ];

    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 7; i += 1) {
      const cloud = new THREE.Group();
      const cloudColor = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
      const puffs = [
        { x: -0.45, y: 0, r: 0.45 },
        { x: 0, y: 0.1, r: 0.5 },
        { x: 0.48, y: 0, r: 0.38 },
      ];
      puffs.forEach((puff) => {
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(puff.r, 18), cloudColor);
        mesh.position.set(puff.x, puff.y, 0.02);
        cloud.add(mesh);
      });
      cloud.position.set(-26 + i * 8.5, 12 - i * 1.1, 0.02);
      clouds.push(cloud);
      outdoorGroup.add(cloud);
    }

    const playerVis = buildPlayerVisual(0x3b82f6, '');
    const localGroup = playerVis.root;
    leftLegPivotRef.current = playerVis.leftLegPivot;
    rightLegPivotRef.current = playerVis.rightLegPivot;

    localGroup.position.set(0, -7, 0.24);
    scene.add(localGroup);
    localPositionRef.current.set(0, -7);
    const localRobot = { root: localGroup, nameSprite: new THREE.Sprite(), body: playerVis.torso, shadow: playerVis.torso, leftPupil: playerVis.torso, rightPupil: playerVis.torso, antennaTip: playerVis.torso, leftArm: playerVis.torso, rightArm: playerVis.torso, leftLeg: playerVis.torso, rightLeg: playerVis.torso };
    localRobotRef.current = localRobot;

    // Held item group — attaches to right hand for 3D inventory display
    const heldItemGroup = new THREE.Group();
    heldItemGroup.position.set(0.15, 0, 0.50);
    heldItemGroup.visible = false;
    localGroup.add(heldItemGroup);
    heldItemGroupRef.current = heldItemGroup;

    const scrapRobot = createRobotVisual(new THREE.Color(0x2a1a0a), robotNameRef.current);
    scrapRobot.root.scale.set(0.7, 0.7, 0.7);
    scrapRobot.root.position.set(NPC_POSITION.x + 1.5, NPC_POSITION.y - 1.2, 0.24);
    scrapRobot.root.rotation.z = 0.15;
    scrapRobot.nameSprite.visible = false;
    if (scrapRobot.leftPupil) scrapRobot.leftPupil.material.color.setHex(0x222222);
    if (scrapRobot.rightPupil) scrapRobot.rightPupil.material.color.setHex(0x222222);
    if (scrapRobot.antennaTip) scrapRobot.antennaTip.material.color.setHex(0x555555);
    scrapRobotRef.current = scrapRobot;

    // Repair kiosk — proper kiosk at Snack Stop spot
    const kiosk = createRepairKiosk();
    kiosk.position.set(-2.87, -5.3, 0.04);
    outdoorGroup.add(kiosk);
    repairKioskRef.current = kiosk;

    const sparky = createRobotVisual(new THREE.Color(0xfacc15), 'Sparky', 'north');
    sparky.root.scale.set(0.8, 0.8, 0.8);
    sparky.root.position.set(NPC_POSITION.x, NPC_POSITION.y, 0.24);
    sparky.nameSprite.visible = false;
    outdoorGroup.add(sparky.root);
    if (sparky.body) sparky.body.visible = true;
    outdoorSparkyRef.current = sparky;
    sparkyBaseQuatRef.current = sparky.root.quaternion.clone();
    // Neck connector so head doesn't float
    const sparkyNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 8), createToonMaterial(0xfacc15));
    sparkyNeck.rotation.x = Math.PI / 2;
    sparkyNeck.position.set(0, 0, 0.35);
    sparky.root.add(sparkyNeck);
    const sparkyQuestMarker = addExclamationMarker(sparky.root);
    sparkyQuestMarkerRef.current = sparkyQuestMarker;

    const workshopFloor = new THREE.Mesh(
      new THREE.BoxGeometry(10.6, 10.6, 0.24),
      createTexturedToonMaterial('tile_41.png', 20, 20)
    );
    workshopFloor.position.set(0, 0, 0.12);
    workshopRoomGroup.add(workshopFloor);

    const workshopWalls = [
      new THREE.Vector3(0, 5.3, 1.2),
      new THREE.Vector3(0, -5.3, 1.2),
      new THREE.Vector3(-5.3, 0, 1.2),
      new THREE.Vector3(5.3, 0, 1.2),
    ];
    workshopWalls.forEach((position, index) => {
      const horizontal = index < 2;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 10.6 : 0.3, horizontal ? 0.3 : 10.6, 2.4),
        createTexturedToonMaterial('tile_24.png', horizontal ? 10 : 1, 5, 0x334155)
      );
      wall.position.copy(position);
      wall.material.side = THREE.DoubleSide;
      workshopRoomGroup.add(wall);
    });
    // Exit door on south wall — industrial style (flush with wall inner face)
    const wsExitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.08, 0.7),
      createToonMaterial(0x475569)
    );
    wsExitDoor.position.set(0, -5.15, 0.59);
    workshopRoomGroup.add(wsExitDoor);
    const wsExitFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.08, 0.76),
      createToonMaterial(0x1e293b)
    );
    wsExitFrame.position.set(0, -5.15, 0.62);
    workshopRoomGroup.add(wsExitFrame);
    createExitSignMesh(0, -5.15, 1.3, workshopRoomGroup, '#eab308', '#1e293b', '#000000');

    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.45, 1.45),
      createToonMaterial(0x8b5a2b, 0.7, 0.08)
    );
    shelf.position.set(-3.2, 3.25, 0.82);
    workshopRoomGroup.add(shelf);

    // Mini robots on the shelf
    const shelfColors = [0x60a5fa, 0xf97316, 0x34d399];
    const shelfTopZ = 0.82 + 1.45 / 2;
    for (let i = -1; i <= 1; i++) {
      const mini = createRobotVisual(new THREE.Color(shelfColors[i + 1]), '');
      mini.root.scale.set(0.25, 0.25, 0.25);
      mini.root.position.set(-3.2 + i * 0.45, 3.25 + i * 0.1, shelfTopZ + 0.02);
      mini.nameSprite.visible = false;
      workshopRoomGroup.add(mini.root);
      miniRobotRefs.current.push(mini);
    }

    // Windows on all 4 walls
    const winMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    const frameMat = createToonMaterial(0x1e293b);
    const addWorkshopWindow = (cx: number, cy: number, horiz: boolean) => {
      const off = 0.15;
      const ix = cx - Math.sign(cx || 0.001) * off;
      const iy = cy - Math.sign(cy || 0.001) * off;
      const ww = 2.2, wh = 1.0, fw = 0.06;
      for (let s = -1; s <= 1; s += 2) {
        const wcx = horiz ? cx + s * 2.0 : ix;
        const wcy = horiz ? iy : cy + s * 2.0;
        const w = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? ww : 0.01, horiz ? 0.01 : ww, wh),
          winMat
        );
        w.position.set(wcx, wcy, 1.3);
        w.renderOrder = 1;
        workshopRoomGroup.add(w);
        // Window frame on wall surface
        if (horiz) {
          // Top/bottom rails
          for (let t = -1; t <= 1; t += 2) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(ww + fw * 2, 0.04, fw), frameMat);
            rail.position.set(wcx, wcy, 1.3 + t * (wh / 2 + fw / 2));
            workshopRoomGroup.add(rail);
          }
          // Left/right stiles
          for (let t = -1; t <= 1; t += 2) {
            const stile = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.04, wh + fw * 2), frameMat);
            stile.position.set(wcx + t * (ww / 2 + fw / 2), wcy, 1.3);
            workshopRoomGroup.add(stile);
          }
        } else {
          // Top/bottom rails
          for (let t = -1; t <= 1; t += 2) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, ww + fw * 2, fw), frameMat);
            rail.position.set(wcx, wcy, 1.3 + t * (wh / 2 + fw / 2));
            workshopRoomGroup.add(rail);
          }
          // Left/right stiles
          for (let t = -1; t <= 1; t += 2) {
            const stile = new THREE.Mesh(new THREE.BoxGeometry(0.04, fw, wh + fw * 2), frameMat);
            stile.position.set(wcx, wcy + t * (ww / 2 + fw / 2), 1.3);
            workshopRoomGroup.add(stile);
          }
        }
      }
    };
    addWorkshopWindow(0, 5.3, true);   // north
    addWorkshopWindow(0, -5.3, true);  // south
    addWorkshopWindow(-5.3, 0, false); // west
    addWorkshopWindow(5.3, 0, false);  // east

    const petBed = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.82, 0.2),
      createToonMaterial(0xf59e0b, 0.64, 0.07)
    );
    petBed.position.set(3.4, -2.4, 0.21);
    workshopRoomGroup.add(petBed);

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.7, 0.75),
      createToonMaterial(0x7c3aed, 0.62, 0.08)
    );
    desk.position.set(2.9, 3.05, 0.48);
    workshopRoomGroup.add(desk);

    const owner = createRobotVisual(new THREE.Color(0x14b8a6), 'Rafiq');
    owner.root.scale.set(0.7, 0.7, 0.7);
    owner.root.position.set(ROOM_OWNER_POS.x, ROOM_OWNER_POS.y, 0.26);
    owner.nameSprite.visible = false;
    workshopRoomGroup.add(owner.root);
    roomOwnerVisualRef.current = owner;

    const petDisplay = createRobotVisual(new THREE.Color(0x60a5fa), 'Shop Pet');
    petDisplay.root.scale.set(0.6, 0.6, 0.6);
    petDisplay.root.position.set(-1.9, 0.5, 0.26);
    petDisplay.nameSprite.visible = false;
    workshopRoomGroup.add(petDisplay.root);
    roomPetVisualRef.current = petDisplay;

    const customerGroup = new THREE.Group();
    workshopRoomGroup.add(customerGroup);
    roomCustomerGroupRef.current = customerGroup;

    {
      const apartmentFloor = new THREE.Mesh(
        new THREE.BoxGeometry(8, 8, 0.24),
        createTexturedToonMaterial('tile_21.png', 16, 16, 0x8b6b4a)
      );
      apartmentFloor.position.set(0, 0, 0.12);
      apartmentRoomGroup.add(apartmentFloor);

      const aptWalls = [
        { pos: new THREE.Vector3(0, 4.15, 1.2), horiz: true },
        { pos: new THREE.Vector3(0, -4.15, 1.2), horiz: true },
        { pos: new THREE.Vector3(-4.15, 0, 1.2), horiz: false },
        { pos: new THREE.Vector3(4.15, 0, 1.2), horiz: false },
      ];
      aptWalls.forEach(({ pos, horiz }) => {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? 8.3 : 0.3, horiz ? 0.3 : 8.3, 2.4),
          createTexturedToonMaterial('tile_24.png', horiz ? 8 : 1, 4, 0x475569)
        );
        wall.position.copy(pos);
        wall.material.side = THREE.DoubleSide;
        apartmentRoomGroup.add(wall);
      });

      // Window on north wall
      const aptWinMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
      const aptWinGlow = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.01, 1.0),
        new THREE.MeshBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.4 })
      );
      aptWinGlow.position.set(0, 4.17, 1.3);
      apartmentRoomGroup.add(aptWinGlow);

      const aptWin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.01, 1.0), aptWinMat);
      aptWin.position.set(0, 4.17, 1.3);
      aptWin.renderOrder = 1;
      apartmentRoomGroup.add(aptWin);

      // Window frame
      const aptFrmMat = createToonMaterial(0x1e293b);
      for (let s = -1; s <= 1; s += 2) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.04, 0.06), aptFrmMat);
        rail.position.set(0, 4.17, 1.3 + s * 0.53);
        apartmentRoomGroup.add(rail);
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.12), aptFrmMat);
        stile.position.set(s * 0.93, 4.17, 1.3);
        apartmentRoomGroup.add(stile);
      }

      // Workbench
      const workbench = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.9, 0.65),
        createToonMaterial(0x6b4226, 0.7, 0.08)
      );
      workbench.position.set(2.2, -0.2, 0.52);
      apartmentRoomGroup.add(workbench);

      // Scrap inside box — Sparky's find, hidden by box walls until lid opens
      scrapRobot.root.scale.set(0.4, 0.4, 0.4);
      scrapRobot.root.position.set(-2.8, 1.8, 0.26);
      scrapRobot.root.rotation.set(Math.PI / 2, 0, 0.4);
      scrapRobot.nameSprite.visible = false;
      if (scrapRobot.leftPupil) scrapRobot.leftPupil.material.color.setHex(0x111111);
      if (scrapRobot.rightPupil) scrapRobot.rightPupil.material.color.setHex(0x111111);
      if (scrapRobot.antennaTip) scrapRobot.antennaTip.material.color.setHex(0x333333);
      apartmentRoomGroup.add(scrapRobot.root);

      // Bed
      const bedBase = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.9, 0.15),
        createToonMaterial(0x334155, 0.6, 0.06)
      );
      bedBase.position.set(-2.8, 2.2, 0.17);
      apartmentRoomGroup.add(bedBase);
      const bedMat = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.7, 0.08),
        createToonMaterial(0x60a5fa, 0.5, 0.05)
      );
      bedMat.position.set(-2.8, 2.2, 0.28);
      apartmentRoomGroup.add(bedMat);

      // Bookshelf
      const shelfBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.25, 1.2),
        createToonMaterial(0x78350f, 0.65, 0.07)
      );
      shelfBack.position.set(-3.4, -1.8, 0.72);
      apartmentRoomGroup.add(shelfBack);
      for (let i = 0; i < 3; i++) {
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.04, 0.04),
          createToonMaterial(0x92400e, 0.6, 0.06)
        );
        plank.position.set(-3.4, -1.8, 0.08 + i * 0.34);
        apartmentRoomGroup.add(plank);
      }

      // Small table with lamp
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.45),
        createToonMaterial(0x7c3aed, 0.6, 0.07)
      );
      table.position.set(-2.2, -2.5, 0.32);
      apartmentRoomGroup.add(table);
      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.25, 8),
        createToonMaterial(0xfbbf24, 0.4, 0.05)
      );
      lamp.position.set(-2.2, -2.5, 0.62);
      apartmentRoomGroup.add(lamp);

      // Cardboard box (cutscene) — hidden initially
      const boxResult = createCardboardBox();
      boxResult.group.position.set(-2.8, 1.8, 0.24);
      boxResult.group.visible = false;
      apartmentRoomGroup.add(boxResult.group);
      cutsceneBoxRef.current = boxResult.group;
      cutsceneBoxLidRef.current = boxResult.lid;



      // Computer (cutscene) — hidden until fetch-laptop phase
      const computer = createLaptop();
      computer.position.set(-3.4, 1.2, 0.24);
      computer.visible = false;
      apartmentRoomGroup.add(computer);
      computerRef.current = computer;

      scrapRobot.root.visible = true;

      // Wire (cutscene) — hidden initially, positioned dynamically in link-computer phase
      const wire = createWire(1.0);
      wire.visible = false;
      apartmentRoomGroup.add(wire);
      wireRef.current = wire;

      // Wire coil (cutscene) — hidden initially, shown at Sparky's hand during placement
      const coil = createWireCoil();
      coil.visible = false;
      apartmentRoomGroup.add(coil);
      coilRef.current = coil;

      // Tack sparkle effect (reused)
      const fx = new THREE.Group();
      const fxMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 1 });
      for (let i = 0; i < 12; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 4), fxMat.clone());
        s.position.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08);
        s.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
        fx.add(s);
      }
      fx.visible = false;
      apartmentRoomGroup.add(fx);
      tackFxRef.current = fx;
      tackFxPhaseRef.current = 0;

      // Sparky inside apartment (hidden until Sparky walks home)
      const aptSparky = createRobotVisual(new THREE.Color(0xfacc15), 'Sparky');
      aptSparky.root.scale.set(0.7, 0.7, 0.7);
      aptSparky.root.position.set(0.2, 2.2, 0.22);
      aptSparky.nameSprite.visible = false;
      aptSparky.root.visible = false;
      apartmentRoomGroup.add(aptSparky.root);
      apartmentSparkyRef.current = aptSparky;

      // Exit door on south wall — wooden style
      const aptDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.08, 0.7),
        createToonMaterial(0x8b5a2b)
      );
      aptDoor.position.set(0, -4.00, 0.59);
      apartmentRoomGroup.add(aptDoor);
      const aptDoorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.08, 0.76),
        createToonMaterial(0x5c3a1e)
      );
      aptDoorFrame.position.set(0, -4.00, 0.62);
      apartmentRoomGroup.add(aptDoorFrame);
      createExitSignMesh(0, -4.00, 1.3, apartmentRoomGroup, '#b45309', '#fef3c7', '#fde68a');
    }

    {
      const arenaFloor = new THREE.Mesh(
        new THREE.BoxGeometry(12, 12, 0.24),
        createTexturedToonMaterial('tile_42.png', 24, 24, 0x1e293b)
      );
      arenaFloor.position.set(0, 0, 0.12);
      arenaRoomGroup.add(arenaFloor);

      const arenaGrid = createGrid(5.8, 1, 0x334155);
      arenaGrid.position.z = 0.2;
      arenaRoomGroup.add(arenaGrid);

      const arenaWallPositions = [
        new THREE.Vector3(0, 6.3, 1.2),
        new THREE.Vector3(0, -6.3, 1.2),
        new THREE.Vector3(-6.3, 0, 1.2),
        new THREE.Vector3(6.3, 0, 1.2),
      ];
      arenaWallPositions.forEach((pos, i) => {
        const horizontal = i < 2;
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 12.6 : 0.3, horizontal ? 0.3 : 12.6, 2.4),
          createTexturedToonMaterial('tile_26.png', horizontal ? 12 : 1, 5, 0x475569)
        );
        wall.position.copy(pos);
        wall.material.side = THREE.DoubleSide;
        arenaRoomGroup.add(wall);
      });

      const arenaCenterLight = new THREE.Mesh(
        new THREE.CircleGeometry(0.6, 20),
        createToonMaterial(0xfef08a, 0.2, 0.1)
      );
      arenaCenterLight.position.set(0, 0, 0.25);
      arenaRoomGroup.add(arenaCenterLight);
    }

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = mountElement.clientWidth / mountElement.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountElement.clientWidth, mountElement.clientHeight);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput = target !== null && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);
      if (isTextInput) {
        return;
      }

      // Block all keyboard input during cutscene
      if (aptCutscenePhaseRef.current !== 'idle') {
        event.preventDefault();
        return;
      }

      // Number keys 1/2 pick conversation choice
      if (sparkyIntroStepRef.current >= 0 && (event.key === '1' || event.key === '2')) {
        event.preventDefault();
        const convo = SPARKY_INTRO_CONVO[sparkyIntroStepRef.current];
        const choiceIdx = event.key === '2' && convo.choices.length > 1 ? 1 : 0;
        const next = convo.choices[choiceIdx].next;
        if (next === -1) {
          setSparkyIntroStep(-1);
          if (!sparkyHomeArrivedRef.current) {
            const s = outdoorSparkyRef.current;
            if (s) {
              const sx = s.root.position.x;
              const sy = s.root.position.y;
              sparkyHomeWaypointsRef.current = [
                new THREE.Vector2(sx, -6.5),
                new THREE.Vector2(-9.6, -6.5),
                new THREE.Vector2(-9.6, -5.7),
              ];
              sparkyHomeWaypointIdxRef.current = 0;
            }
            sparkyGoHomeRef.current = true;
          }
        } else {
          setSparkyIntroStep(next);
        }
        return;
      }

      // During the tutorial, Space advances the dialog (handled by TutorialOverlay) — skip room interactions
      if (showTutorialRef.current && event.code === 'Space') {
        event.preventDefault();
        return;
      }

      // Advance Sparky dialogue on any key press
      if (showTutorialRef.current) {
        const step = tutorialStepRef.current;
        const phases = tutorialPhasesRef.current;
        const phase = phases[step];
        if (phase && phase.kind === 'dialogue') {
          event.preventDefault();
          const next = step + 1;
          const nextPhase = phases[next];
          if (nextPhase && nextPhase.kind === 'challenge') {
            setTutorialStep(next);
            setCode(nextPhase.starterCode);
          } else {
            setShowTutorial(false);
            setTutorialStep(0);
            setOutput('');
            setSuccess(false);
          }
          return;
        }
      }

      if (event.code === 'Space' && inWorkshopRoomRef.current) {
        event.preventDefault();
        interactionRequestedRef.current = true;
        return;
      }
      if (event.code === 'Space' && inApartmentRoomRef.current) {
        event.preventDefault();
        // Check Sparky interaction inside apartment
        if (apartmentSparkyRef.current) {
          const aptSparky = apartmentSparkyRef.current;
          if (aptSparky && aptSparky.root.visible) {
            const distToAptSparky = localPositionRef.current.distanceTo(new THREE.Vector2(0.2, 2.2));
            if (distToAptSparky < SPARKY_INTERACTION_DISTANCE) {
              runApartmentSparkyInteraction();
              return;
            }
          }
        }
        const exitDist = Math.abs(localPositionRef.current.y + 4.15);
        if (exitDist < 1.5) {
          leaveApartmentRoom();
        }
        return;
      }
      if (event.code === 'Space' && inShopRoomRef.current) {
        event.preventDefault();
        if (localPositionRef.current.y > 1.0) {
          inShopRoomRef.current = false;
          setInShopRoom(false);
          localPositionRef.current.set(6.0, -9.0);
          localRobot.root.position.set(6.0, -9.0, 0.24);
          shopDoorArmedRef.current = false;
          roomObstacleHitboxesRef.current = [];
          apiSync({ position: { x: 6.0, y: -9.0, rotation: null, room: 'outside' } });
        } else {
          interactionRequestedRef.current = true;
        }
        return;
      }
      if (event.code === 'Space' && !inWorkshopRoomRef.current && !inArenaRoomRef.current && !inApartmentRoomRef.current) {
        event.preventDefault();
        worldInteractionRequestedRef.current = true;
        return;
      }
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        keyStateRef.current.add(key);
        return;
      }
      // Inventory slot keys 1-9
      const slotNum = parseInt(event.key);
      if (slotNum >= 1 && slotNum <= 9) {
        event.preventDefault();
        const slotIndex = slotNum - 1;
        if (slotIndex < gameStore.get('backpack').length) {
          const next = heldSlotIndexRef.current === slotIndex ? null : slotIndex;
          setHeldSlotIndex(next);
          heldSlotIndexRef.current = next;
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keyStateRef.current.delete(event.key.toLowerCase());
    };

    window.addEventListener('resize', handleResize);
    const handleFocusClick = () => window.focus();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    mountElement.addEventListener('mousedown', handleFocusClick);

    const rendererEl = renderer.domElement;

    // Pointer Lock — capture mouse on click, orbit while locked
    const isLockedRef = { current: false };
    rendererEl.addEventListener('pointerdown', () => {
      if (document.pointerLockElement !== rendererEl) {
        rendererEl.requestPointerLock();
      }
    });
    const onLockChange = () => {
      isLockedRef.current = document.pointerLockElement === rendererEl;
    };
    document.addEventListener('pointerlockchange', onLockChange);

    const onPointerMove = (e: PointerEvent) => {
      if (!isLockedRef.current) return;
      yawRef.current += e.movementX * 0.012;
      cameraPitchRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraPitchRef.current + e.movementY * 0.005));
    };
    rendererEl.addEventListener('pointermove', onPointerMove);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraPitchRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraPitchRef.current + e.deltaY * 0.003));
    };
    rendererEl.addEventListener('wheel', onWheel, { passive: false });

    const createCustomerRequest = (customerName: string): CustomerRequest => {
      const blockedSignature = lastWorkshopRequestSigRef.current;
      const stage = sparkyQuestStageRef.current;

      // After sensor given (unit2+), occasionally spawn data-processing orders
      if ((stage === 'unit2' || stage === 'unit2-done' || stage === 'unit3' || stage === 'unit3-done' || stage === 'unit4' || stage === 'all-done') && Math.random() < 0.45) {
        const dp = createDataRequest(customerName);
        const dpRequest: CustomerRequest = {
          customerName,
          petName: pickRandom(PET_NAMES),
          petColor: 'none',
          petSize: 0,
          required: [],
          requestType: 'data-processing',
          dataSteps: dp.dataSteps,
        };
        let dpTries = 0;
        while (blockedSignature && getWorkshopRequestSignature(dpRequest) === blockedSignature && dpTries < 8) {
          const dp2 = createDataRequest(customerName);
          dpRequest.dataSteps = dp2.dataSteps;
          dpTries += 1;
        }
        return dpRequest;
      }

      let nextRequest: CustomerRequest = {
        customerName,
        petName: pickRandom(PET_NAMES),
        petColor: pickRandom(PET_COLORS),
        petSize: 2 + Math.floor(Math.random() * 5),
        required: [...REQUEST_PATTERNS[Math.floor(Math.random() * REQUEST_PATTERNS.length)]],
        requestType: 'standard',
      };

      let tries = 0;
      while (blockedSignature && getWorkshopRequestSignature(nextRequest) === blockedSignature && tries < 8) {
        nextRequest = {
          customerName,
          petName: pickRandom(PET_NAMES),
          petColor: pickRandom(PET_COLORS),
          petSize: 2 + Math.floor(Math.random() * 5),
          required: [...REQUEST_PATTERNS[Math.floor(Math.random() * REQUEST_PATTERNS.length)]],
          requestType: 'standard',
        };
        tries += 1;
      }

      return nextRequest;
    };

    const spawnCustomer = () => {
      const customerGroupCurrent = roomCustomerGroupRef.current;
      if (!customerGroupCurrent || workshopCustomersRef.current.length >= 4) return;
      const occupiedSpots = new Set(
        workshopCustomersRef.current.filter((npc) => npc.stage !== 'leaving').map((npc) => npc.spotIndex)
      );
      const availableSpotIndexes = ROOM_PET_BROWSE_POINTS.map((_, index) => index).filter(
        (index) => !occupiedSpots.has(index)
      );
      if (availableSpotIndexes.length === 0) return;

      const usedNames = new Set(
        workshopCustomersRef.current.filter((npc) => npc.stage !== 'leaving').map((npc) => npc.request.customerName)
      );
      const availableNames = CUSTOMER_NAMES.filter((name) => !usedNames.has(name));
      const customerName = pickRandom(availableNames.length > 0 ? availableNames : CUSTOMER_NAMES);
      const request = createCustomerRequest(customerName);
      const colors = [0xfacc15, 0x60a5fa, 0x34d399, 0xf97316, 0xa855f7, 0xec4899];
      const cg = new THREE.Group();
      const cm = new THREE.MeshToonMaterial({ color: colors[Math.floor(Math.random() * colors.length)], gradientMap: createGradientTexture(3) });
      const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 8), cm);
      cb.rotation.x = Math.PI / 2; cb.position.set(0, 0, 0.1); cg.add(cb);
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), new THREE.MeshToonMaterial({ color: 0xf5d6c6, gradientMap: createGradientTexture(3) }));
      ch.position.set(0, 0, 0.26); cg.add(ch);
      const cn = createNameSprite(customerName, new THREE.Color(0x22c55e));
      cn.visible = false;
      cg.add(cn);
      const cmarker = addExclamationMarker(cg);
      cmarker.visible = false;
      cg.scale.set(1.8, 1.8, 1.8);
      const visual = { root: cg, nameSprite: cn, marker: cmarker };
      const start = new THREE.Vector2(-4.8, -4.2 + Math.random() * 1.8);
      visual.root.position.set(start.x, start.y, 0.24);
      customerGroupCurrent.add(visual.root);
      const spotIndex = pickRandom(availableSpotIndexes);
      const chosenPoint = ROOM_PET_BROWSE_POINTS[spotIndex];
      const npc: CustomerNpc = {
        id: `${customerName}-${Math.random().toString(36).slice(2, 8)}`,
        visual,
        position: start,
        target: new THREE.Vector2(0, 0),
        spotIndex,
        browseSpot: new THREE.Vector2(0, 0),
        petLookTarget: new THREE.Vector2(0, 0),
        speed: 1.2 + Math.random() * 0.35,
        request,
        stage: 'walking-to-browse',
      };
      npc.browseSpot.copy(chosenPoint.stand);
      npc.petLookTarget.copy(chosenPoint.look);
      npc.target.copy(npc.browseSpot);
      (npc as any).startedAtMs = performance.now();
      workshopCustomersRef.current.push(npc);
    };

    let lastTime = performance.now();
    const animate = (now: number) => {
      try {
      if (tabHiddenRef.current || tabHiddenAtRef.current > lastTime) {
        lastTime = now;
        tabHiddenRef.current = false;
        rafRef.current = window.requestAnimationFrame(animate);
        return;
      }
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      sessionPlaytimeRef.current += delta;
      const worldTime = now / 1000;

      animFrameCounterRef.current += 1;
      lastAnimFrameRef.current = performance.now();
      fpsFrameCountRef.current += 1;
      const fpsElapsed = now - fpsLastTimeRef.current;
      if (fpsElapsed >= 1000) {
        fpsRef.current = Math.round(fpsFrameCountRef.current / (fpsElapsed / 1000));
        fpsFrameCountRef.current = 0;
        fpsLastTimeRef.current = now;
      }

      if (modalOpenRef.current || (inWorkshopRoomRef.current && !workshopIntroSeenRef.current && profileLoadedRef.current)) {
        modalFrameCountRef.current += 1;
        if (modalFrameCountRef.current % 6 !== 0) {
          rafRef.current = window.requestAnimationFrame(animate);
          return;
        }
      } else {
        modalFrameCountRef.current = 0;
      }

      let moved = false;
      let moveDir2 = new THREE.Vector2(0, 0);
      if (aptCutscenePhaseRef.current !== 'idle') {
        // Cutscene active — freeze player
        keyStateRef.current.clear();
      } else if (!showTutorialRef.current) {
        const keys = keyStateRef.current;
        let forward = 0, strafe = 0;
        if (keys.has('arrowup') || keys.has('w')) forward += 1;
        if (keys.has('arrowdown') || keys.has('s')) forward -= 1;
        if (keys.has('arrowleft') || keys.has('a')) strafe -= 1;
        if (keys.has('arrowright') || keys.has('d')) strafe += 1;

        if (forward || strafe) {
          moved = true;
          const camSin = Math.sin(yawRef.current), camCos = Math.cos(yawRef.current);
          moveDir2.set(
            camSin * forward + camCos * strafe,
            camCos * forward - camSin * strafe
          );
          const candidate = localPositionRef.current.clone().add(moveDir2.multiplyScalar(MOVE_SPEED * delta));
          if (inWorkshopRoomRef.current) {
            candidate.x = Math.max(-4.82, Math.min(4.82, candidate.x));
            candidate.y = Math.max(-5.3, Math.min(4.82, candidate.y));
            // Walk into south exit door → leave workshop
            if (candidate.y < -5.1) {
              leaveWorkshopRoom();
              moved = false;
            } else {
              const hitsRoomObstacle = collidesWithAny(candidate, roomObstacleHitboxesRef.current) ||
              workshopCustomersRef.current.some(npc => {
                const dx = candidate.x - npc.position.x;
                const dy = candidate.y - npc.position.y;
                return dx * dx + dy * dy < 0.09;
              });
              if (!hitsRoomObstacle) {
                localPositionRef.current.copy(candidate);
                localRobot.root.position.set(candidate.x, candidate.y, 0.28);
              } else {
                moved = false;
              }
            }
          } else if (inArenaRoomRef.current) {
            candidate.x = Math.max(-5.8, Math.min(5.8, candidate.x));
            candidate.y = Math.max(-5.8, Math.min(5.8, candidate.y));
            localPositionRef.current.copy(candidate);
            localRobot.root.position.set(candidate.x, candidate.y, 0.28);
          } else if (inApartmentRoomRef.current) {
            candidate.x = Math.max(-3.8, Math.min(3.8, candidate.x));
            candidate.y = Math.max(-4.3, Math.min(3.8, candidate.y));
            // Walk into south exit door → leave apartment
            if (candidate.y < -4.0) {
              leaveApartmentRoom();
              moved = false;
            } else {
              const hitsRoomObstacle = collidesWithAny(candidate, roomObstacleHitboxesRef.current);
              if (!hitsRoomObstacle) {
                localPositionRef.current.copy(candidate);
                localRobot.root.position.set(candidate.x, candidate.y, 0.28);
              } else {
                moved = false;
              }
            }
          } else if (inShopRoomRef.current) {
            candidate.x = Math.max(-3.8, Math.min(3.8, candidate.x));
            // If player walks into the exit door area (north wall), exit the shop
            if (candidate.y > 1.6) {
              inShopRoomRef.current = false;
              setInShopRoom(false);
              localPositionRef.current.set(6.0, -9.0);
              localRobot.root.position.set(6.0, -9.0, 0.24);
              shopDoorArmedRef.current = false;
              roomObstacleHitboxesRef.current = [];
              apiSync({ position: { x: 6.0, y: -9.0, rotation: null, room: 'outside' } });
              keyStateRef.current.clear();
              moved = false;
            } else {
              candidate.y = Math.max(-1.8, candidate.y);
              const hitsShopObstacle = collidesWithAny(candidate, roomObstacleHitboxesRef.current);
              if (!hitsShopObstacle) {
                localPositionRef.current.copy(candidate);
                localRobot.root.position.set(candidate.x, candidate.y, 0.28);
              } else {
                moved = false;
              }
            }
          } else {
            const maxRadius = ISLAND_RADIUS - PLAYER_RADIUS - 0.35;
            if (candidate.length() > maxRadius) candidate.setLength(maxRadius);
            const canEnterBuildings = sparkyQuestStageRef.current !== 'intro' || sparkyHomeArrivedRef.current;
            const hitsObstacle = collidesWithAny(candidate, obstacleHitboxesRef.current) ||
              (!canEnterBuildings && apartmentDoorHitboxRef.current && isInsideHitbox(candidate, apartmentDoorHitboxRef.current)) ||
              Object.values(remoteAvatarsRef.current).some(a => a.room === 'outside' &&
                candidate.distanceTo(a.target) < 0.3);
            const workshopDoor = workshopDoorHitboxRef.current;
            const atWorkshopDoor =
              Boolean(shopUnlockedRef.current) &&
              canEnterBuildings &&
              workshopDoor !== null &&
              workshopDoorArmedRef.current &&
              isInsideHitbox(candidate, workshopDoor);

            if (workshopDoor !== null && !isInsideHitbox(candidate, workshopDoor)) {
              workshopDoorArmedRef.current = true;
            }

            const arenaDoor = arenaDoorHitboxRef.current;
            const atArenaDoor =
              canEnterBuildings &&
              arenaDoor !== null &&
              arenaDoorArmedRef.current &&
              isInsideHitbox(candidate, arenaDoor);

            if (arenaDoor !== null && !isInsideHitbox(candidate, arenaDoor)) {
              arenaDoorArmedRef.current = true;
            }

            const apartmentDoor = apartmentDoorHitboxRef.current;
            const aptStage = sparkyQuestStageRef.current;
            const atApartmentDoor =
              canEnterBuildings &&
              apartmentDoor !== null &&
              apartmentDoorArmedRef.current &&
              isInsideHitbox(candidate, apartmentDoor);

            if (apartmentDoor !== null && !isInsideHitbox(candidate, apartmentDoor)) {
              apartmentDoorArmedRef.current = true;
            }

            const shopDoor = shopDoorHitboxRef.current;
            const atShopDoor =
              canEnterBuildings &&
              shopDoor !== null &&
              shopDoorArmedRef.current &&
              isInsideHitbox(candidate, shopDoor);

            if (shopDoor !== null && !isInsideHitbox(candidate, shopDoor)) {
              shopDoorArmedRef.current = true;
            }

            if (atWorkshopDoor) {
              workshopDoorArmedRef.current = false;
              inWorkshopRoomRef.current = true;
              setInWorkshopRoom(true);
              setWorkshopIntroStep(0);
              setRoomEntryFlash(true);
              if (roomEntryFlashTimeoutRef.current !== null) {
                window.clearTimeout(roomEntryFlashTimeoutRef.current);
              }
              roomEntryFlashTimeoutRef.current = window.setTimeout(() => setRoomEntryFlash(false), 460);
              localPositionRef.current.copy(ROOM_SPAWN);
              localRobot.root.position.set(ROOM_SPAWN.x, ROOM_SPAWN.y, 0.26);
              roomObstacleHitboxesRef.current = workshopObstaclesRef.current;
              if (workshopCustomersRef.current.length === 0) {
                spawnCustomer();
              }
              moved = false;
              fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: { x: ROOM_SPAWN.x, y: ROOM_SPAWN.y, room: 'workshop', rotation: yawRef.current } }),
              }).catch(() => {});
            } else if (atArenaDoor) {
              arenaDoorArmedRef.current = false;
              setInArenaRoom(true);
              inArenaRoomRef.current = true;
              fetch('/api/arena', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'join' }),
              }).catch(() => {});
              triggerEvent('client-player-join', { x: ARENA_ROOM_SPAWN.x, y: ARENA_ROOM_SPAWN.y, room: 'arena' });
              localPositionRef.current.copy(ARENA_ROOM_SPAWN);
              localRobot.root.position.set(ARENA_ROOM_SPAWN.x, ARENA_ROOM_SPAWN.y, 0.28);
              keyStateRef.current.clear();
              moved = false;
              fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: { x: ARENA_ROOM_SPAWN.x, y: ARENA_ROOM_SPAWN.y, room: 'arena', rotation: yawRef.current } }),
              }).catch(() => {});
            } else if (atShopDoor) {
              shopDoorArmedRef.current = false;
              setInShopRoom(true);
              inShopRoomRef.current = true;
              setRoomEntryFlash(true);
              if (roomEntryFlashTimeoutRef.current !== null) {
                window.clearTimeout(roomEntryFlashTimeoutRef.current);
              }
              roomEntryFlashTimeoutRef.current = window.setTimeout(() => setRoomEntryFlash(false), 460);
              localPositionRef.current.set(0, 1.2);
              localRobot.root.position.set(0, 1.2, 0.28);
              roomObstacleHitboxesRef.current = shopObstaclesRef.current;
              keyStateRef.current.clear();
              moved = false;
            } else if (atApartmentDoor) {
              apartmentDoorArmedRef.current = false;
              setInApartmentRoom(true);
              inApartmentRoomRef.current = true;
              setRoomEntryFlash(true);
              if (roomEntryFlashTimeoutRef.current !== null) {
                window.clearTimeout(roomEntryFlashTimeoutRef.current);
              }
              roomEntryFlashTimeoutRef.current = window.setTimeout(() => setRoomEntryFlash(false), 460);
              localPositionRef.current.copy(APARTMENT_SPAWN);
              localRobot.root.position.set(APARTMENT_SPAWN.x, APARTMENT_SPAWN.y, 0.28);
              roomObstacleHitboxesRef.current = [
                { shape: 'box', center: { x: 2.2, y: -0.2 }, halfWidth: 0.8, halfHeight: 0.45 },
                { shape: 'box', center: { x: -2.8, y: 2.2 }, halfWidth: 0.9, halfHeight: 0.45 },
                { shape: 'box', center: { x: -3.4, y: -1.8 }, halfWidth: 0.45, halfHeight: 0.12 },
                { shape: 'box', center: { x: -2.2, y: -2.5 }, halfWidth: 0.25, halfHeight: 0.25 },
                { shape: 'box', center: { x: -2.2, y: 1.5 }, halfWidth: 0.2, halfHeight: 0.15 },
              ];
              if (aptStage === 'intro' && !cutsceneDoneRef.current) {
                // Start cutscene — only the box is visible
                cinemCamActiveRef.current = true;
                aptCutscenePhaseRef.current = 'walk-west';
                aptCutsceneTimerRef.current = 0;
                if (cutsceneBoxRef.current) cutsceneBoxRef.current.visible = true;
                const csSparky = apartmentSparkyRef.current;
                if (csSparky) {
                  csSparky.root.visible = true;
                  csSparky.root.position.set(0.2, 2.2, 0.22);
                  const initDir = new THREE.Vector2(-2.8 - 0.2, 0.8 - 2.2).normalize();
                  aptSparkyFacingRef.current = -Math.atan2(initDir.x, initDir.y);
                  const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
                  if (sparkyBaseQuatRef.current) csSparky.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                }
                // Position player avatar to walk alongside Sparky
                if (localRobotRef.current) {
                  localPositionRef.current.set(0, 1.2);
                  localRobotRef.current.root.position.set(0, 1.2, 0.28);
                  localGroup.position.set(0, 1.2, 0.28);
                }
                yawRef.current = Math.atan2(-2.3, 0.53); // face toward walk direction
                document.exitPointerLock();
              } else if (aptStage === 'intro' || aptStage === 'unit1' || aptStage === 'unit2') {
                showTutorialRef.current = true;
                setShowTutorial(true);
                setTutorialStep(0);
                setCode(tutorialPhasesRef.current[0].kind === 'dialogue' ? '' : tutorialPhasesRef.current[0].starterCode || '');
                setOutput('');
                setSuccess(false);
              }
              keyStateRef.current.clear();
              moved = false;
              fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: { x: APARTMENT_SPAWN.x, y: APARTMENT_SPAWN.y, room: 'apartment', rotation: yawRef.current } }),
              }).catch(() => {});
            } else if (!hitsObstacle) {
              localPositionRef.current.copy(candidate);
              localRobot.root.position.set(candidate.x, candidate.y, 0.24);
            } else {
              moved = false;
            }
          }
        }
      }

      if (moved) {
        const room = inArenaRoomRef.current ? 'arena' : inWorkshopRoomRef.current ? 'workshop' : 'outside';
        triggerEvent('client-player-move', { x: localPositionRef.current.x, y: localPositionRef.current.y, room });
      }
      // Periodic full sync (30s safety net for crash recovery)
      if (now - lastPositionSyncRef.current >= 30000) {
        lastPositionSyncRef.current = now;
        const pRoom = inWorkshopRoomRef.current ? 'workshop' : inArenaRoomRef.current ? 'arena' : inApartmentRoomRef.current ? 'apartment' : inShopRoomRef.current ? 'shop' : 'outside';
        const pos = pRoom !== 'outside'
          ? ({ workshop: ROOM_SPAWN, arena: ARENA_ROOM_SPAWN, apartment: APARTMENT_SPAWN, shop: { x: 0, y: 1.2 } } as Record<string, { x: number; y: number }>)[pRoom]
          : { x: localPositionRef.current.x, y: localPositionRef.current.y };
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position: { x: pos.x, y: pos.y, room: pRoom, rotation: yawRef.current },
            questStage: sparkyQuestStageRef.current,
            backpack: gameStore.get('backpack'),
            money: gameStore.get('money'),
            playtime: Math.floor(sessionPlaytimeRef.current),
          }),
        }).catch(() => {});
      }
      if (moved && now - lastStepAtRef.current > 190) {
        const context = audioRef.current || new AudioContext();
        audioRef.current = context;
        playStepPop(context.currentTime);
        lastStepAtRef.current = now;
      }

      const playerYaw = yawRef.current;
      localGroup.rotation.z = -playerYaw;
      if (moved) {
        const bob = Math.sin(worldTime * 14) * 0.03;
        localGroup.position.z = (() => {
          if (inApartmentRoomRef.current) return 0.28;
          if (inArenaRoomRef.current) return 0.28;
          if (inWorkshopRoomRef.current) return 0.26;
          if (inShopRoomRef.current) return 0.28;
          return 0.24;
        })() + bob;
      } else {
        localGroup.position.z = (() => {
          if (inApartmentRoomRef.current) return 0.28;
          if (inArenaRoomRef.current) return 0.28;
          if (inWorkshopRoomRef.current) return 0.26;
          if (inShopRoomRef.current) return 0.28;
          return 0.24;
        })();
      }
      // Walk animation for player legs and arms (rotation.x = forward/backward swing)
      const localVis = localRobotRef.current;
      const playerSpeed = moved ? 1 : 0;
      const walkSwing = Math.sin(worldTime * WALK_BOB_SPEED) * 0.3 * playerSpeed;
      if (leftLegPivotRef.current) leftLegPivotRef.current.rotation.x = walkSwing;
      if (rightLegPivotRef.current) rightLegPivotRef.current.rotation.x = -walkSwing;
      const armSwing = Math.sin(worldTime * WALK_BOB_SPEED + Math.PI) * 0.2 * playerSpeed;
      if (localVis) {
        localVis.leftArm.rotation.x = -Math.PI / 2 + armSwing;
        localVis.rightArm.rotation.x = -Math.PI / 2 - armSwing;
      }

      // Held item 3D model
      const heldGroup = heldItemGroupRef.current;
      if (heldGroup && heldSlotIndexRef.current !== null && heldSlotIndexRef.current < gameStore.get('backpack').length) {
        heldGroup.visible = true;
        const partId = gameStore.get('backpack')[heldSlotIndexRef.current];
        if (heldGroup.userData.partId !== partId) {
          while (heldGroup.children.length) heldGroup.remove(heldGroup.children[0]);
          const model = createPartModel(partId);
          heldGroup.add(model);
          heldGroup.userData.partId = partId;
        }
        heldGroup.rotation.y = Math.sin(worldTime * 2) * 0.3;
        heldGroup.rotation.x = Math.sin(worldTime * 1.5) * 0.15;
      } else if (heldGroup) {
        heldGroup.visible = false;
      }

      // Animate event particles (smoke/sparks expand outward)
      if (eventParticlesRef.current) {
        eventParticlesRef.current.children.forEach((child) => {
          const p = child as THREE.Mesh;
          if (p.isMesh && p.userData.life > 0) {
            p.userData.life -= delta;
            p.position.x += (p.userData.vx || 0) * delta;
            p.position.y += (p.userData.vy || 0) * delta;
            p.position.z += (p.userData.vz || 0) * delta;
            if (p.material) {
              (p.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.userData.life / 1.5);
            }
          }
        });
      }

      if (!inWorkshopRoomRef.current && !inShopRoomRef.current && !inArenaRoomRef.current && !inApartmentRoomRef.current) {
        const distanceToSparky = localPositionRef.current.distanceTo(NPC_POSITION);
        let outsidePrompt: string | null = null;

        const stage = sparkyQuestStageRef.current;
        const sparkyOutsideVisible = outdoorSparkyRef.current?.root.visible ?? true;
        const showSparkyPrompt =
          sparkyOutsideVisible &&
          (stage === 'intro' ||
           stage === 'unit1' ||
           stage === 'unit1-done' ||
           stage === 'unit2' ||
           stage === 'unit2-done' ||
           stage === 'unit3' ||
           stage === 'unit3-done' ||
           stage === 'unit4' ||
           stage === 'all-done');

        if (
          showSparkyPrompt &&
          distanceToSparky < SPARKY_INTERACTION_DISTANCE
        ) {
          outsidePrompt = 'Sparky';
        } else if (
          transportHitboxRef.current &&
          isInsideHitbox(localPositionRef.current, transportHitboxRef.current)
        ) {
          outsidePrompt = 'Transporter';
        }

        if (worldInteractionRequestedRef.current) {
          worldInteractionRequestedRef.current = false;
          if (distanceToSparky < SPARKY_INTERACTION_DISTANCE) {
            if (stage === 'intro' && !sparkyGoHomeRef.current) {
              setSparkyIntroStep(0);
            } else if (stage === 'unit1' || stage === 'unit2') {
              showTutorialRef.current = true;
              setShowTutorial(true);
              setTutorialStep(0);
              setCode(tutorialPhasesRef.current[0].kind === 'dialogue' ? '' : tutorialPhasesRef.current[0].starterCode || '');
              setOutput('');
              setSuccess(false);
            } else if (stage === 'unit1-done' || stage === 'unit2-done' || stage === 'unit3-done') {
              setSparkyModal('Sparky is waiting in his apartment. Go upstairs and bring him the part!');
            } else if (stage === 'unit3' || stage === 'unit4') {
              const unitLabel = stage === 'unit3' ? 'Unit 3 (coming soon)' : 'Unit 4 (coming soon)';
              setSparkyModal(`${unitLabel} isn't built yet! Check back later.`);
            } else if (stage === 'all-done') {
              setSparkyModal('Scrap is fully repaired! Arena mode is unlocked — go battle your friends!');
            }
          } else if (transportHitboxRef.current && isInsideHitbox(localPositionRef.current, transportHitboxRef.current)) {
            setShowTransportModal(true);
            setTransportMessage(null);
          }
        }

        setInteractionPromptName(outsidePrompt);
        if (!outsidePrompt && workshopOutput && !inWorkshopRoomRef.current) setWorkshopOutput('');
        interactionCandidateIdRef.current = null;
      }

      if (sparkyGoHomeRef.current && !sparkyHomeArrivedRef.current) {
        if (sparkyWalkHomeTimerRef.current === 0) sparkyWalkHomeTimerRef.current = performance.now();
        if (performance.now() - sparkyWalkHomeTimerRef.current > 15000) {
          sparkyHomeWaypointIdxRef.current = sparkyHomeWaypointsRef.current.length;
        }
        const waypoints = sparkyHomeWaypointsRef.current;
        const idx = sparkyHomeWaypointIdxRef.current;
        if (waypoints.length > 0 && idx < waypoints.length) {
          const target = waypoints[idx];
          const dist = sparky.root.position.distanceTo(new THREE.Vector3(target.x, target.y, 0.14));
          if (dist < 0.15) {
            sparkyHomeWaypointIdxRef.current++;
          } else {
            const dir = new THREE.Vector2(target.x - sparky.root.position.x, target.y - sparky.root.position.y).normalize();
            const step = 1.8 * delta;
            const candidate = new THREE.Vector2(
              sparky.root.position.x + dir.x * step,
              sparky.root.position.y + dir.y * step
            );
            if (!collidesWithAny(candidate, obstacleHitboxesRef.current)) {
              sparky.root.position.x = candidate.x;
              sparky.root.position.y = candidate.y;
              animateRobotVisual(sparky, worldTime, 0.3, -0.2, 0.1);
            }
          }
        } else {
          sparkyWalkHomeTimerRef.current = 0;
          sparkyHomeArrivedRef.current = true;
          sparky.root.visible = false;
          if (sparkyQuestMarkerRef.current) sparkyQuestMarkerRef.current.visible = false;
          if (apartmentSparkyRef.current) apartmentSparkyRef.current.root.visible = true;
          if (apartmentDoorMarkerRef.current) apartmentDoorMarkerRef.current.visible = true;
        }
      } else if (!sparkyHomeArrivedRef.current) {
        if (sparkyQuestStageRef.current === 'intro' && !sparkyGoHomeRef.current) {
          repairTimerRef.current += delta;
          animateRepairSparky(sparky, worldTime, repairTimerRef.current);
          if (repairKioskRef.current) animateRepairKiosk(repairKioskRef.current, worldTime);
          if (sparky.antennaTip) {
            sparky.antennaTip.material.color.setHSL(0.12, 0.9, 0.5 + Math.sin(worldTime * 5) * 0.3);
          }
          if (worldTime > 25 && !sparkyEventTriggeredRef.current) {
            sparkyEventTriggeredRef.current = true;
            triggerAttentionEvent();
          }
          if (sparkyAcknowledgedRef.current) {
            animateSparkyWave(sparky, worldTime);
          }
          if (repairTimerRef.current > 3 && repairTimerRef.current < 3.5 && Math.random() < 0.3) {
            playToolClank();
          }
        } else {
          sparkyWaitTimerRef.current += delta;
          if (sparkyWaitTimerRef.current > 1.5 && !showTutorialRef.current) {
            const target = SPARKY_PATH[sparkyPathIndexRef.current];
            const dist = sparky.root.position.distanceTo(new THREE.Vector3(target.x, target.y, 0.14));
            if (dist < 0.15) {
              sparkyPathIndexRef.current = (sparkyPathIndexRef.current + 1) % SPARKY_PATH.length;
              sparkyWaitTimerRef.current = 0;
            } else {
              const dir = new THREE.Vector2(target.x - sparky.root.position.x, target.y - sparky.root.position.y).normalize();
              const step = 1.8 * delta;
              const candidate = new THREE.Vector2(
                sparky.root.position.x + dir.x * step,
                sparky.root.position.y + dir.y * step
              );
              if (!collidesWithAny(candidate, obstacleHitboxesRef.current)) {
                sparky.root.position.x = candidate.x;
                sparky.root.position.y = candidate.y;
              }
            }
          }
        }
      }
      const baseQuat = sparkyBaseQuatRef.current;
      if (baseQuat && sparky.root.visible && !inApartmentRoomRef.current && !inWorkshopRoomRef.current && !inShopRoomRef.current) {
        const dx = sparkyIntroStepRef.current >= 0
          ? localPositionRef.current.x - sparky.root.position.x
          : (sparkyGoHomeRef.current && !sparkyHomeArrivedRef.current && sparkyHomeWaypointIdxRef.current < sparkyHomeWaypointsRef.current.length
            ? sparkyHomeWaypointsRef.current[sparkyHomeWaypointIdxRef.current].x - sparky.root.position.x
            : 0);
        const dy = sparkyIntroStepRef.current >= 0
          ? localPositionRef.current.y - sparky.root.position.y
          : (sparkyGoHomeRef.current && !sparkyHomeArrivedRef.current && sparkyHomeWaypointIdxRef.current < sparkyHomeWaypointsRef.current.length
            ? sparkyHomeWaypointsRef.current[sparkyHomeWaypointIdxRef.current].y - sparky.root.position.y
            : 0);
        const targetFacing = dx === 0 && dy === 0 ? 0 : -Math.atan2(dx, dy);
        const diff = targetFacing - sparkyFacingRef.current;
        const wrappedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
        sparkyFacingRef.current += wrappedDiff * 0.04;
        if (Math.abs(sparkyFacingRef.current) > 0.001) {
          const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sparkyFacingRef.current);
          sparky.root.quaternion.copy(baseQuat).premultiply(facingQ);
        } else {
          sparkyFacingRef.current = 0;
          sparky.root.quaternion.copy(baseQuat);
        }
      }
      if (sparky.root.visible && !inApartmentRoomRef.current && !inWorkshopRoomRef.current && !inShopRoomRef.current) {
        animateSparkyWave(sparky, worldTime);
      }
      if (speechBubbleRef.current && sparkyIntroStepRef.current >= 0) {
        const headPos = new THREE.Vector3();
        sparky.antennaTip.getWorldPosition(headPos);
        headPos.project(camera);
        if (headPos.z > 1) {
          speechBubbleRef.current.style.display = 'none';
        } else {
          speechBubbleRef.current.style.display = '';
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const x = (headPos.x * 0.5 + 0.5) * vw;
          const y = (-headPos.y * 0.5 + 0.5) * vh;
          speechBubbleRef.current.style.left = `${x}px`;
          speechBubbleRef.current.style.top = `${y}px`;
          speechBubbleRef.current.style.transform = 'translate(-50%, -100%) translateY(-8px)';
        }
      } else if (speechBubbleRef.current) {
        speechBubbleRef.current.style.display = 'none';
      }
      sparky.root.position.z = 0.24 + Math.sin(worldTime * 4) * 0.04;
      if (sparkyQuestStageRef.current === 'intro' && !sparkyGoHomeRef.current) {
        // Don't override repair animation with walk animation
      } else {
        animateRobotVisual(sparky, worldTime, 0.5, -0.3, 0.15);
      }
      if (sparkyQuestMarkerRef.current) {
        sparkyQuestMarkerRef.current.visible = sparkyQuestStageRef.current === 'intro' && sparky.root.visible;
        sparkyQuestMarkerRef.current.position.y = 1.0 + Math.sin(worldTime * 5.2) * 0.08;
      }
      animateRobotVisual(owner, worldTime * 0.9, 0.12, -0.2, -0.1);
      if (shopNpcRef.current) {
        shopNpcRef.current.root.position.z = 0.28 + Math.sin(worldTime * 3) * 0.04;
      }
      if (roomOwnerVisualRef.current) {
        animateRobotVisual(roomOwnerVisualRef.current, worldTime * 0.92, 0.14, -0.28, -0.2);
      }
      if (roomPetVisualRef.current) {
        animateRobotVisual(roomPetVisualRef.current, worldTime * 1.35, 0.28, 0.5, -0.2);
      }

      // Apartment Sparky animation + part installation animation
      if (inApartmentRoomRef.current) {
        const aptSparky = apartmentSparkyRef.current;
        if (aptSparky && aptSparky.root.visible && aptCutscenePhaseRef.current === 'idle') {
          aptSparky.root.position.z = 0.24 + Math.sin(worldTime * 3) * 0.04;
          animateRobotVisual(aptSparky, worldTime, 0.3, -0.2, 0.1);
        }
        // Cutscene phase
        if (aptCutscenePhaseRef.current !== 'idle') {
          const aptSparkyCS = apartmentSparkyRef.current;
          const phase = aptCutscenePhaseRef.current;

          if (phase === 'walk-west') {
            const sparkyWps = [new THREE.Vector2(-3.2, 2.2), new THREE.Vector2(-3.2, 0.8)];
            const playerTarget = new THREE.Vector2(-2.3, 1.73);
            const wpIdx = aptSparkyWalkWpRef.current;
            if (aptSparkyCS) {
              const spTgt = sparkyWps[Math.min(wpIdx, sparkyWps.length - 1)];
              const dist = aptSparkyCS.root.position.distanceTo(new THREE.Vector3(spTgt.x, spTgt.y, 0.22));
              if (dist > 0.08 && wpIdx < sparkyWps.length) {
                const dir = new THREE.Vector2(spTgt.x - aptSparkyCS.root.position.x, spTgt.y - aptSparkyCS.root.position.y).normalize();
                aptSparkyCS.root.position.x += dir.x * MOVE_SPEED * 0.15 * delta;
                aptSparkyCS.root.position.y += dir.y * MOVE_SPEED * 0.15 * delta;
                const moveFacing = -Math.atan2(dir.x, dir.y);
                aptSparkyFacingRef.current = dist < 0.4 ? (moveFacing * (dist / 0.4)) : moveFacing;
                const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0.2, -0.2, 0.1);
              } else if (wpIdx < sparkyWps.length - 1) {
                aptSparkyWalkWpRef.current = wpIdx + 1;
                aptSparkyCS.root.position.set(spTgt.x, spTgt.y, 0.22);
              } else {
                aptCutscenePhaseRef.current = 'open-box';
                aptCutsceneTimerRef.current = 0;
                aptSparkyCS.root.position.set(sparkyWps[sparkyWps.length - 1].x, sparkyWps[sparkyWps.length - 1].y, 0.22);
                aptSparkyFacingRef.current = 0;
                const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
              }
            }
            // Player walks to spectator position (camera-left of box, in line with it)
            const pDist = localPositionRef.current.distanceTo(playerTarget);
            if (pDist > 0.08) {
              const pDir = new THREE.Vector2(playerTarget.x - localPositionRef.current.x, playerTarget.y - localPositionRef.current.y).normalize();
              localPositionRef.current.x += pDir.x * MOVE_SPEED * 0.15 * delta;
              localPositionRef.current.y += pDir.y * MOVE_SPEED * 0.15 * delta;
              yawRef.current = Math.atan2(pDir.x, pDir.y); // face walk direction
              if (localRobotRef.current) {
                localRobotRef.current.root.position.set(localPositionRef.current.x, localPositionRef.current.y, 0.28);
                if (leftLegPivotRef.current) leftLegPivotRef.current.rotation.x = Math.sin(worldTime * WALK_BOB_SPEED) * 0.3;
                if (rightLegPivotRef.current) rightLegPivotRef.current.rotation.x = -Math.sin(worldTime * WALK_BOB_SPEED) * 0.3;
                const armSwing = Math.sin(worldTime * WALK_BOB_SPEED + Math.PI) * 0.2;
                localRobotRef.current.leftArm.rotation.x = -Math.PI / 2 + armSwing;
                localRobotRef.current.rightArm.rotation.x = -Math.PI / 2 - armSwing;
              }
            } else {
              // Arrived — face the box
              yawRef.current = Math.atan2(-0.5, 0.5); // toward box center
              if (localRobotRef.current) {
                localRobotRef.current.root.position.set(-2.3, 1.73, 0.28);
                if (leftLegPivotRef.current) leftLegPivotRef.current.rotation.x = 0;
                if (rightLegPivotRef.current) rightLegPivotRef.current.rotation.x = 0;
                localRobotRef.current.leftArm.rotation.x = -Math.PI / 2;
                localRobotRef.current.rightArm.rotation.x = -Math.PI / 2;
              }
            }
          } else if (phase === 'open-box') {
            aptCutsceneTimerRef.current += delta;
            const progress = Math.min(1, aptCutsceneTimerRef.current / 2.0);
            if (cutsceneBoxLidRef.current) {
              openBoxLid(cutsceneBoxLidRef.current, progress);
            }
            if (aptSparkyCS) {
              animateRobotVisual(aptSparkyCS, worldTime, 0, -0.15, -0.1);
            }
            if (progress >= 1) {
              aptCutscenePhaseRef.current = 'lift-rise';
              aptCutsceneTimerRef.current = 0;
            }
          } else if (phase === 'lift-rise') {
            aptCutsceneTimerRef.current += delta;
            const progress = Math.min(1, aptCutsceneTimerRef.current / 1.5);
            if (scrapRobotRef.current) {
              const z = 0.26 + (0.55 - 0.26) * progress;
              scrapRobotRef.current.root.position.z = z;
              scrapRobotRef.current.root.rotation.z = 0.4 * (1 - progress) + 0.2 * progress;
            }
            if (aptSparkyCS) {
              aptSparkyCS.root.position.z = 0.22 - 0.06 * progress;
              aptSparkyCS.body.rotation.x = -0.25 * progress;
              aptSparkyCS.leftArm.rotation.x = -1.5 * progress;
              aptSparkyCS.rightArm.rotation.x = -1.5 * progress;
              animateRobotVisual(aptSparkyCS, worldTime, 0, 0.15, -0.05);
            }
            if (progress >= 1) {
              if (scrapRobotRef.current) {
                scrapRobotRef.current.root.position.set(-2.8, 1.8, 0.55);
                scrapRobotRef.current.root.rotation.z = 0.2;
              }
              aptCutscenePhaseRef.current = 'lift-carry';
              aptCutsceneTimerRef.current = 0;
            }
          } else if (phase === 'lift-carry') {
            aptCutsceneTimerRef.current += delta;
            const progress = Math.min(1, aptCutsceneTimerRef.current / 2.5);
            if (scrapRobotRef.current) {
              const x = -2.8 + (-2.6 + 2.8) * progress;
              const y = 1.8 + (1.2 - 1.8) * progress;
              scrapRobotRef.current.root.position.x = x;
              scrapRobotRef.current.root.position.y = y;
              scrapRobotRef.current.root.rotation.z = 0.2 * (1 - progress) + 0.12 * progress;
            }
            if (aptSparkyCS) {
              aptSparkyCS.root.position.x = -2.8;
              aptSparkyCS.root.position.y = 0.8 + (0.45 - 0.8) * progress;
              aptSparkyCS.root.position.z = 0.16;
              aptSparkyFacingRef.current = 0;
              const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
              if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
              animateRobotVisual(aptSparkyCS, worldTime, 0.2, -0.1, 0.0);
              aptSparkyCS.leftArm.rotation.x = -1.5;
              aptSparkyCS.rightArm.rotation.x = -1.5;
            }
            if (progress >= 1) {
              if (scrapRobotRef.current) {
                scrapRobotRef.current.root.position.set(-2.6, 1.2, 0.55);
                scrapRobotRef.current.root.rotation.z = 0.12;
              }
              if (aptSparkyCS) {
                aptSparkyCS.root.position.y = 0.45;
              }
              aptCutscenePhaseRef.current = 'lift-lower';
              aptCutsceneTimerRef.current = 0;
            }
          } else if (phase === 'lift-lower') {
            aptCutsceneTimerRef.current += delta;
            const progress = Math.min(1, aptCutsceneTimerRef.current / 1.5);
            if (scrapRobotRef.current) {
              const z = 0.55 + (0.24 - 0.55) * progress;
              scrapRobotRef.current.root.position.z = z;
              scrapRobotRef.current.root.rotation.z = 0.12 * (1 - progress) + 0.08 * progress;
            }
            if (aptSparkyCS) {
              aptSparkyCS.root.position.z = 0.16 + 0.06 * progress;
              aptSparkyCS.body.rotation.x = -0.25 * (1 - progress);
              aptSparkyCS.leftArm.rotation.x = -1.5 * (1 - progress);
              aptSparkyCS.rightArm.rotation.x = -1.5 * (1 - progress);
              animateRobotVisual(aptSparkyCS, worldTime, 0, 0.1, 0.05);
            }
            if (progress >= 1) {
              if (scrapRobotRef.current) {
                scrapRobotRef.current.root.position.set(-2.6, 1.2, 0.24);
                scrapRobotRef.current.root.rotation.z = 0.08;
              }
              if (aptSparkyCS) {
                aptSparkyCS.root.position.z = 0.22;
                aptSparkyCS.body.rotation.x = 0;
                aptSparkyCS.leftArm.rotation.x = 0;
                aptSparkyCS.rightArm.rotation.x = 0;
              }
              aptCutscenePhaseRef.current = 'fetch-laptop';
              aptCutsceneTimerRef.current = 0;
            }
          } else if (phase === 'fetch-laptop') {
            aptCutsceneTimerRef.current += delta;
            const EAST_TARGET = new THREE.Vector2(0, 0.5);
            const WEST_TARGET = new THREE.Vector2(-2.8, 0.5);
            if (aptSparkyCS) {
              const t = aptCutsceneTimerRef.current;
              if (t < 2.5) {
                const walkT = t / 2.5;
                aptSparkyCS.root.position.x = WEST_TARGET.x + (EAST_TARGET.x - WEST_TARGET.x) * walkT;
                aptSparkyCS.root.position.y = WEST_TARGET.y;
                aptSparkyFacingRef.current = -Math.PI * 0.5;
                const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0.5, -0.1, 0.0);
              } else if (t < 3.0) {
                const turnT = (t - 2.5) / 0.5;
                aptSparkyFacingRef.current = -Math.PI * 0.5 + turnT * Math.PI;
                const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0, 0, 0);
                if (t >= 2.8 && computerRef.current && computerRef.current.parent !== aptSparkyCS.root) {
                  aptSparkyCS.root.attach(computerRef.current);
                  computerRef.current.scale.set(1 / 0.7, 1 / 0.7, 1 / 0.7);
                  computerRef.current.position.set(0, 0.47, 1.0);
                  const invQ = aptSparkyCS.root.quaternion.clone().invert();
                  const worldUp = new THREE.Vector3(0, 0, 1);
                  const localUp = worldUp.applyQuaternion(invQ);
                  const lapQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), localUp);
                  computerRef.current.quaternion.copy(lapQuat);
                  computerRef.current.visible = true;
                }
              } else {
                const walkT = (t - 3.0) / 2.5;
                if (walkT < 1.0) {
                  aptSparkyCS.root.position.x = EAST_TARGET.x + (WEST_TARGET.x - EAST_TARGET.x) * walkT;
                  aptSparkyCS.root.position.y = WEST_TARGET.y;
                  aptSparkyFacingRef.current = Math.PI * 0.5;
                  const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
                  if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                  animateRobotVisual(aptSparkyCS, worldTime, 0.5, -0.1, 0.0);
                } else {
                  aptSparkyCS.root.position.set(WEST_TARGET.x, WEST_TARGET.y, 0.22);
                  aptSparkyFacingRef.current = Math.PI * 0.5;
                  const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
                  if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                  aptCutscenePhaseRef.current = 'link-computer';
                  aptCutsceneTimerRef.current = 0;
                }
              }
            }
          } else if (phase === 'link-computer') {
            aptCutsceneTimerRef.current += delta;
            const t = aptCutsceneTimerRef.current;

            // Sub-phase progress values
            const rotDuration = 2.5;
            const lowerStart = 2.0;
            const lowerDuration = 2.5;
            const coilAppear = 3.0;
            const walkNorthStart = 3.5;
            const walkNorthDuration = 1.0;
            const tack1Start = 4.5;
            const tack1Duration = 0.5;
            const walkEastStart = 5.0;
            const walkEastDuration = 3.5;
            const tack2Start = 8.5;
            const tack2Duration = 0.5;

            const rotProgress = Math.min(1, t / rotDuration);
            const lowerProgress = Math.max(0, Math.min(1, (t - lowerStart) / lowerDuration));
            const walkNorthProgress = Math.max(0, Math.min(1, (t - walkNorthStart) / walkNorthDuration));
            const tack1Progress = Math.max(0, Math.min(1, (t - tack1Start) / tack1Duration));
            const walkEastProgress = Math.max(0, Math.min(1, (t - walkEastStart) / walkEastDuration));
            const tack2Progress = Math.max(0, Math.min(1, (t - tack2Start) / tack2Duration));

            const laptopApproach = new THREE.Vector3(-3.4, 0.65, 0.22);
            const scrapApproach = new THREE.Vector3(-2.6, 0.55, 0.22);

            if (aptSparkyCS) {
              // === Phase 1: Rotate Sparky west→north ===
              const startAngle = Math.PI * 0.5;
              const endAngle = 0;
              const easedRot = rotProgress < 1 ? rotProgress * rotProgress * (3 - 2 * rotProgress) : 1;
              aptSparkyFacingRef.current = startAngle + (endAngle - startAngle) * easedRot;
              const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
              if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);

              // Sparky sidesteps west from -2.8 to -3.4 during rotation
              const startX = -2.8;
              const endX = -3.4;
              aptSparkyCS.root.position.x = startX + (endX - startX) * easedRot;

              // Laptop stays at fixed local (0, 0.47, 1.0) — orbits naturally with Sparky
              if (computerRef.current && computerRef.current.parent === aptSparkyCS.root) {
                computerRef.current.position.set(0, 0.47, 1.0);
                const invQ = aptSparkyCS.root.quaternion.clone().invert();
                const localUp = new THREE.Vector3(0, 0, 1).applyQuaternion(invQ);
                const lapQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), localUp);
                computerRef.current.quaternion.copy(lapQuat);
              }

              // === Detach laptop at start of lowering ===
              if (lowerProgress > 0 && computerRef.current && computerRef.current.parent === aptSparkyCS.root) {
                const worldPos = new THREE.Vector3();
                computerRef.current.getWorldPosition(worldPos);
                apartmentRoomGroup.attach(computerRef.current);
                computerRef.current.scale.set(1, 1, 1);
                computerRef.current.position.copy(worldPos);
                computerRef.current.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
                computerRef.current.userData.lowerStartZ = worldPos.z;
              }

              // === Coil appears at Sparky's hand ===
              if (t >= coilAppear && coilRef.current && !coilRef.current.visible) {
                coilRef.current.visible = true;
              }

              // === Walk north to laptop ===
              if (walkNorthProgress > 0 && walkNorthProgress < 1) {
                const startWalk = new THREE.Vector3(-3.4, 0.5, 0.22);
                const easedWalk = walkNorthProgress * walkNorthProgress * (3 - 2 * walkNorthProgress);
                aptSparkyCS.root.position.lerpVectors(startWalk, laptopApproach, easedWalk);
                aptSparkyFacingRef.current = 0;
                const wfQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(wfQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0.3, 0, 0);
              }

              // === Tack 1: Sparkle at laptop port ===
              if (tack1Progress > 0 && tack1Progress < 1) {
                aptSparkyCS.root.position.copy(laptopApproach);
                aptSparkyFacingRef.current += (0 - aptSparkyFacingRef.current) * 0.08;
                const nfQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(nfQ);
                // Animate tack fx
                if (tackFxRef.current) {
                  if (tackFxPhaseRef.current === 0) {
                    tackFxRef.current.position.set(-3.4, 1.025, 0.253);
                    tackFxRef.current.visible = true;
                    tackFxRef.current.scale.set(1, 1, 1);
                    tackFxRef.current.children.forEach((c: THREE.Object3D) => {
                      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1;
                      const vel = c.userData.vel as THREE.Vector3;
                      vel.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
                    });
                    tackFxPhaseRef.current = 1;
                  }
                  const sfx = tack1Progress < 0.5 ? tack1Progress / 0.5 : (1 - (tack1Progress - 0.5) / 0.5);
                  tackFxRef.current.children.forEach((c: THREE.Object3D) => {
                    const vel = c.userData.vel as THREE.Vector3;
                    c.position.x += vel.x * delta;
                    c.position.y += vel.y * delta;
                    c.position.z += vel.z * delta;
                    ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - tack1Progress;
                  });
                  tackFxRef.current.scale.setScalar(1 + sfx * 2);
                }
                // Right arm reaches toward laptop port
                animateRobotVisual(aptSparkyCS, worldTime, 0, 0.3, -0.1);
                aptSparkyCS.rightArm.rotation.x = -0.8;
                aptSparkyCS.rightArm.rotation.z = 0.05;
              }

              // === Walk east to scrap ===
              if (walkEastProgress > 0 && walkEastProgress < 1) {
                const easedWalk2 = walkEastProgress * walkEastProgress * (3 - 2 * walkEastProgress);
                aptSparkyCS.root.position.lerpVectors(laptopApproach, scrapApproach, easedWalk2);
                aptSparkyFacingRef.current = -Math.PI * 0.5; // face east
                const wfQ2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(wfQ2);
                animateRobotVisual(aptSparkyCS, worldTime, 0.3, 0, 0);
              }

              // === Tack 2: Sparkle at scrap port ===
              if (tack2Progress > 0 && tack2Progress < 1) {
                aptSparkyCS.root.position.copy(scrapApproach);
                aptSparkyFacingRef.current += (0 - aptSparkyFacingRef.current) * 0.08;
                const nfQ2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(nfQ2);
                if (tackFxRef.current) {
                  if (tackFxPhaseRef.current === 1) {
                    tackFxRef.current.position.set(-2.6, 0.976, 0.36);
                    tackFxRef.current.visible = true;
                    tackFxRef.current.scale.set(1, 1, 1);
                    tackFxRef.current.children.forEach((c: THREE.Object3D) => {
                      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1;
                      const vel = c.userData.vel as THREE.Vector3;
                      vel.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
                    });
                    tackFxPhaseRef.current = 2;
                  }
                  const sfx2 = tack2Progress < 0.5 ? tack2Progress / 0.5 : (1 - (tack2Progress - 0.5) / 0.5);
                  tackFxRef.current.children.forEach((c: THREE.Object3D) => {
                    const vel = c.userData.vel as THREE.Vector3;
                    c.position.x += vel.x * delta;
                    c.position.y += vel.y * delta;
                    c.position.z += vel.z * delta;
                    ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - tack2Progress;
                  });
                  tackFxRef.current.scale.setScalar(1 + sfx2 * 2);
                }
                animateRobotVisual(aptSparkyCS, worldTime, 0, 0.3, -0.1);
                aptSparkyCS.rightArm.rotation.x = -0.6;
                aptSparkyCS.rightArm.rotation.z = -0.2;
              }

              // === Default arm pose during rotation/lowering ===
              if (rotProgress < 1 && lowerProgress === 0) {
                animateRobotVisual(aptSparkyCS, worldTime, 0, 0.3, -0.1);
                aptSparkyCS.rightArm.rotation.x = -0.3;
                aptSparkyCS.leftArm.rotation.x = -0.3;
              }

              aptSparkyCS.body.rotation.x = Math.sin(worldTime * 2) * 0.03;
            }

            // === Lower laptop straight down ===
            if (computerRef.current && lowerProgress > 0 && lowerProgress < 1 && computerRef.current.parent === apartmentRoomGroup) {
              const startZ = (computerRef.current.userData.lowerStartZ as number) ?? computerRef.current.position.z;
              const endZ = 0.24;
              const easedLower = lowerProgress * lowerProgress * (3 - 2 * lowerProgress);
              computerRef.current.position.z = startZ + (endZ - startZ) * easedLower;
            }

            // === Coil follows Sparky's right hand ===
            if (coilRef.current && coilRef.current.visible && aptSparkyCS) {
              const coilOffset = new THREE.Vector3(0.33, 0.12, 0.5).applyQuaternion(
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), aptSparkyFacingRef.current)
              );
              const invQ = aptSparkyCS.root.quaternion.clone().invert();
              const coilUp = new THREE.Vector3(0, 0, 1).applyQuaternion(invQ);
              coilRef.current.quaternion.setFromUnitVectors(coilUp, new THREE.Vector3(0, 0, 1));
              coilRef.current.position.set(
                aptSparkyCS.root.position.x + coilOffset.x * 0.7,
                aptSparkyCS.root.position.y + coilOffset.y * 0.7,
                0.38
              );
            }

            // === Wire: laptop → hand during tack1, laptop → scrap after tack2 ===
            if (wireRef.current && computerRef.current) {
              if (tack2Progress >= 1) {
                // Fully connected: laptop → scrap (permanent)
                wireRef.current.visible = true;
                const lapPort = new THREE.Vector3(-3.4, 1.025, 0.253);
                const scrapPos = new THREE.Vector3(-2.6, 0.976, 0.36);
                const mid = new THREE.Vector3().addVectors(lapPort, scrapPos).multiplyScalar(0.5);
                wireRef.current.position.copy(mid);
                const dir = new THREE.Vector3().subVectors(scrapPos, lapPort);
                const dist = dir.length();
                dir.normalize();
                wireRef.current.scale.set(1, dist, 1);
                const up = new THREE.Vector3(0, 1, 0);
                wireRef.current.quaternion.setFromUnitVectors(up, dir);
                animateWirePulse(wireRef.current, worldTime);
              } else if (tack2Progress > 0) {
                wireRef.current.visible = true;
                const scrapPos = new THREE.Vector3(-2.6, 0.976, 0.36);
                const lapPos = new THREE.Vector3(-3.4, 1.025, 0.253);
                const fullWireT = tack2Progress;
                const curEnd = new THREE.Vector3().lerpVectors(
                  coilRef.current?.position ?? scrapPos,
                  scrapPos,
                  fullWireT
                );
                const mid = new THREE.Vector3().addVectors(lapPos, curEnd).multiplyScalar(0.5);
                wireRef.current.position.copy(mid);
                const dir = new THREE.Vector3().subVectors(curEnd, lapPos);
                const dist = dir.length();
                dir.normalize();
                wireRef.current.scale.set(1, dist, 1);
                const up = new THREE.Vector3(0, 1, 0);
                wireRef.current.quaternion.setFromUnitVectors(up, dir);
                animateWirePulse(wireRef.current, worldTime);
              } else if (tack1Progress > 0) {
                wireRef.current.visible = true;
                const lapPort = new THREE.Vector3(-3.4, 1.025, 0.253);
                const handPos = coilRef.current?.position ?? lapPort;
                const mid = new THREE.Vector3().addVectors(lapPort, handPos).multiplyScalar(0.5);
                wireRef.current.position.copy(mid);
                const dir = new THREE.Vector3().subVectors(handPos, lapPort);
                const dist = dir.length();
                dir.normalize();
                wireRef.current.scale.set(1, dist, 1);
                const up = new THREE.Vector3(0, 1, 0);
                wireRef.current.quaternion.setFromUnitVectors(up, dir);
                animateWirePulse(wireRef.current, worldTime);
              }
            }

            // === Done — hide coil (Sparky puts it away) ===
            if (t >= tack2Start + tack2Duration + 0.5) {
              if (coilRef.current) coilRef.current.visible = false;
              aptCutscenePhaseRef.current = 'electrocute';
              aptCutsceneTimerRef.current = 0;
            }
          } else if (phase === 'electrocute') {
            aptCutsceneTimerRef.current += delta;
            const et = aptCutsceneTimerRef.current;
            // Wire emissive lerp blue -> red and color flashes red
            if (wireRef.current) {
              const wireMat = (wireRef.current as THREE.Mesh).material as THREE.MeshStandardMaterial;
              const tColor = Math.min(1, et / 1.5);
              wireMat.emissive.setHSL(0, 1, tColor * 0.3);
              const sparkPulse = et < 3 ? Math.max(0, Math.sin(et * 8 * Math.PI)) : 0;
              wireMat.color.setHSL(0.6 - sparkPulse * 0.6, 1, 0.3 + sparkPulse * 0.3);
            }
            // Sparky body emissive pulses red
            if (aptSparkyCS) {
              const sparkPulse = et < 3 ? Math.max(0, Math.sin(et * 8 * Math.PI)) : 0;
              aptSparkyCS.root.traverse((child) => {
                const m = (child as THREE.Mesh);
                if (m.isMesh && m.material) {
                  const mat = m.material as THREE.MeshStandardMaterial;
                  if (mat.emissive) mat.emissive.setHSL(0, 1, sparkPulse * 0.4);
                }
              });
            }
            // Laptop screen pulses red
            if (computerRef.current) {
              const sparkPulse = et < 3 ? Math.max(0, Math.sin(et * 8 * Math.PI)) : 0;
              const disp = computerRef.current.getObjectByName('laptop-display') as THREE.Mesh | null;
              if (disp) {
                const dm = disp.material as THREE.MeshBasicMaterial;
                dm.color.setHSL(0, 1, 0.2 + sparkPulse * 0.4);
              }
            }
            // After 3s: show dialogue modal
            if (et >= 3.0 && !electrocuteDlgShownRef.current) {
              electrocuteDlgShownRef.current = true;
              document.exitPointerLock();
              setShowElectrocuteDlg(true);
              setElectrocuteStep(0);
              sceneBgOverrideRef.current = 0x4a7a9a;
              if (aptSparkyCS) {
                aptSparkyCS.root.traverse((child) => {
                  const m = (child as THREE.Mesh);
                  if (m.isMesh && m.material) {
                    const mat = m.material as THREE.MeshStandardMaterial;
                    if (mat.emissive) mat.emissive.setHSL(0, 0, 0);
                  }
                });
              }
              if (computerRef.current) {
                const disp = computerRef.current.getObjectByName('laptop-display') as THREE.Mesh | null;
                if (disp) {
                  const dm = disp.material as THREE.MeshBasicMaterial;
                  dm.color.setHSL(0.6, 1, 0.5);
                }
              }
              if (wireRef.current) {
                const wm = (wireRef.current as THREE.Mesh).material as THREE.MeshStandardMaterial;
                wm.color.setHSL(0.6, 1, 0.3);
                wm.emissive.setHSL(0.6, 1, 0.3);
              }
            }
          } else if (phase === 'walk-to-laptop') {
            aptCutsceneTimerRef.current += delta;
            // Player walks south then west to stand in front of laptop screen
            const wlTgt = new THREE.Vector2(-3.4, 0.6);
            const wlDir = new THREE.Vector2(
              wlTgt.x - localPositionRef.current.x,
              wlTgt.y - localPositionRef.current.y
            );
            const wlAbsX = Math.abs(wlDir.x), wlAbsY = Math.abs(wlDir.y);
            if (wlAbsX > 0.08 || wlAbsY > 0.08) {
              const wlStep = MOVE_SPEED * 0.15 * delta;
              if (wlAbsY > 0.08) {
                const sy = Math.sign(wlDir.y);
                localPositionRef.current.y += sy * Math.min(wlStep, wlAbsY);
                yawRef.current = Math.atan2(0, sy);
              } else {
                const sx = Math.sign(wlDir.x);
                localPositionRef.current.x += sx * Math.min(wlStep, wlAbsX);
                yawRef.current = Math.atan2(sx, 0);
              }
              if (localRobotRef.current) {
                localRobotRef.current.root.position.set(
                  localPositionRef.current.x, localPositionRef.current.y, 0.28
                );
                if (leftLegPivotRef.current) leftLegPivotRef.current.rotation.x = Math.sin(worldTime * WALK_BOB_SPEED) * 0.3;
                if (rightLegPivotRef.current) rightLegPivotRef.current.rotation.x = -Math.sin(worldTime * WALK_BOB_SPEED) * 0.3;
                const armSwing = Math.sin(worldTime * WALK_BOB_SPEED + Math.PI) * 0.2;
                localRobotRef.current.leftArm.rotation.x = -Math.PI / 2 + armSwing;
                localRobotRef.current.rightArm.rotation.x = -Math.PI / 2 - armSwing;
              }
            } else {
              localPositionRef.current.set(wlTgt.x, wlTgt.y);
              if (localRobotRef.current) {
                localRobotRef.current.root.position.set(wlTgt.x, wlTgt.y, 0.28);
                if (leftLegPivotRef.current) leftLegPivotRef.current.rotation.x = 0;
                if (rightLegPivotRef.current) rightLegPivotRef.current.rotation.x = 0;
                localRobotRef.current.leftArm.rotation.x = -Math.PI / 2;
                localRobotRef.current.rightArm.rotation.x = -Math.PI / 2;
              }
              yawRef.current = Math.atan2(0, 1); // face north toward laptop screen
            }
            // Sparky walks west of the laptop
            const slTgt = new THREE.Vector2(-3.5, 1.2);
            if (aptSparkyCS) {
              const slDist = Math.hypot(
                aptSparkyCS.root.position.x - slTgt.x,
                aptSparkyCS.root.position.y - slTgt.y
              );
              if (slDist > 0.08) {
                const slDir = new THREE.Vector2(
                  slTgt.x - aptSparkyCS.root.position.x,
                  slTgt.y - aptSparkyCS.root.position.y
                ).normalize();
                aptSparkyCS.root.position.x += slDir.x * MOVE_SPEED * 0.15 * delta;
                aptSparkyCS.root.position.y += slDir.y * MOVE_SPEED * 0.15 * delta;
                const slFacing = -Math.atan2(slDir.x, slDir.y);
                aptSparkyFacingRef.current = slFacing;
                const slQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), slFacing);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(slQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0.15, -0.15, 0.08);
              } else {
                aptSparkyCS.root.position.set(slTgt.x, slTgt.y, 0.22);
              }
            }
            // Both arrived (2D distance, ignore z) → transition
            const playerArrived = Math.hypot(
              localPositionRef.current.x - wlTgt.x,
              localPositionRef.current.y - wlTgt.y
            ) <= 0.08;
            const sparkyArrived = aptSparkyCS && Math.hypot(
              aptSparkyCS.root.position.x - slTgt.x,
              aptSparkyCS.root.position.y - slTgt.y
            ) <= 0.08;
            if (playerArrived && sparkyArrived) {
              aptCutscenePhaseRef.current = 'string-tutorial';
              aptCutsceneTimerRef.current = 0;
              document.exitPointerLock();
              setShowStringDlg(true);
              setStringDlgStep(0);
            }
          } else if (phase === 'string-tutorial') {
            aptCutsceneTimerRef.current += delta;
          } else if (phase === 'laptop-ui') {
            aptCutsceneTimerRef.current += delta;
            const luElapsed = aptCutsceneTimerRef.current;
            if (luElapsed > 0.5 && !showLaptopUI) {
              document.exitPointerLock();
              setShowLaptopUI(true);
            }
          } else if (phase === 'antenna-glow') {
            aptCutsceneTimerRef.current += delta;
            const t = aptCutsceneTimerRef.current;
            if (scrapRobotRef.current) {
              const mat = scrapRobotRef.current.antennaTip.material as THREE.MeshToonMaterial | undefined;
              if (mat) {
                mat.emissive = new THREE.Color(0x00ff88);
                mat.emissiveIntensity = Math.max(0, Math.sin(t * 8)) * 0.8;
              }
              // Create PointLight + glow sprite on first frame
              if (t < 0.05 && sceneRef.current) {
                const tip = scrapRobotRef.current.antennaTip;
                const worldPos = new THREE.Vector3();
                tip.getWorldPosition(worldPos);
                // PointLight illuminates nearby surfaces
                const light = new THREE.PointLight(0x00ff88, 0, 1.5);
                light.position.copy(worldPos);
                sceneRef.current.add(light);
                antennaGlowLightRef.current = light;
                // Radial gradient sprite for the visible halo
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d')!;
                const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
                gradient.addColorStop(0, 'rgba(0,255,136,1)');
                gradient.addColorStop(0.2, 'rgba(0,255,136,0.8)');
                gradient.addColorStop(0.5, 'rgba(0,255,136,0.3)');
                gradient.addColorStop(1, 'rgba(0,255,136,0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 64, 64);
                const texture = new THREE.CanvasTexture(canvas);
                const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.position.copy(worldPos);
                sprite.scale.set(0.3, 0.3, 1);
                sceneRef.current.add(sprite);
                antennaGlowSpriteRef.current = sprite;
              }
              // Pulse glow sprite and light in sync with emissive
              const glowIntensity = Math.max(0, Math.sin(t * 8));
              if (antennaGlowLightRef.current) antennaGlowLightRef.current.intensity = glowIntensity * 0.4;
              if (antennaGlowSpriteRef.current) {
                const sm = antennaGlowSpriteRef.current.material as THREE.SpriteMaterial;
                sm.opacity = glowIntensity * 0.5;
                antennaGlowSpriteRef.current.scale.setScalar(0.2 + glowIntensity * 0.25);
              }
            }
            if (t > 3.0 && !dateDlgShownRef.current) {
              dateDlgShownRef.current = true;
              setShowDateDlg(true);
              setDateDlgStep(0);
              document.exitPointerLock();
            }
          } else if (phase === 'date-coding') {
            aptCutsceneTimerRef.current += delta;
            const dcElapsed = aptCutsceneTimerRef.current;
            if (dcElapsed > 0.5 && !dateCodingShownRef.current) {
              dateCodingShownRef.current = true;
              setLaptopMode('date');
              setLaptopCode('');
              setLaptopOutput('');
              setLaptopSuccess(false);
              setShowLaptopUI(true);
            }
          } else if (phase === 'reboot') {
            aptCutsceneTimerRef.current += delta;
            const t = aptCutsceneTimerRef.current;
            if (scrapRobotRef.current) {
              // Rapid green flash on antenna
              const mat = scrapRobotRef.current.antennaTip.material as THREE.MeshToonMaterial | undefined;
              if (mat) {
                mat.emissive = new THREE.Color(0x00ff88);
                mat.emissiveIntensity = Math.max(0, Math.sin(t * 20)) * 0.9;
              }
              // Create PointLight on first frame
              if (t < 0.05 && sceneRef.current && !antennaGlowLightRef.current) {
                const tip = scrapRobotRef.current.antennaTip;
                const worldPos = new THREE.Vector3();
                tip.getWorldPosition(worldPos);
                const light = new THREE.PointLight(0x00ff88, 0, 1.5);
                light.position.copy(worldPos);
                sceneRef.current.add(light);
                antennaGlowLightRef.current = light;
              }
              // Pulse light
              if (antennaGlowLightRef.current) {
                antennaGlowLightRef.current.intensity = Math.max(0, Math.sin(t * 20)) * 0.6;
              }
              // Violent shake — random position jitter + rapid rotation snapping
              const phase = Math.floor(t * 30); // ~30 new random values per second for stuttery feel
              const seed1 = Math.sin(phase * 1.7) * 0.5 + 0.5;
              const seed2 = Math.cos(phase * 2.3) * 0.5 + 0.5;
              const seed3 = Math.sin(phase * 3.1) * 0.5 + 0.5;
              const amp = Math.min(1, t / 0.3) * (1 - Math.max(0, (t - 1.8) / 0.4));
              scrapRobotRef.current.root.position.x = -2.6 + (seed1 - 0.5) * 0.06 * amp;
              scrapRobotRef.current.root.position.z = 0.24 + (seed2 - 0.5) * 0.06 * amp;
              scrapRobotRef.current.root.rotation.x = Math.PI / 2 + (seed3 - 0.5) * 0.15 * amp;
              scrapRobotRef.current.root.rotation.z = 0.08 + (seed2 - 0.5) * 0.12 * amp;
            }
            // Show version dialog after shake
            if (t > 2.5 && !versionDlgShownRef.current) {
              versionDlgShownRef.current = true;
              setShowVersionDlg(true);
              setVersionDlgStep(0);
              document.exitPointerLock();
              if (antennaGlowLightRef.current) {
                sceneRef.current?.remove(antennaGlowLightRef.current);
                antennaGlowLightRef.current = null;
              }
            }
          } else if (phase === 'version-coding') {
            aptCutsceneTimerRef.current += delta;
            const vcElapsed = aptCutsceneTimerRef.current;
            if (vcElapsed > 0.5 && !versionCodingShownRef.current) {
              versionCodingShownRef.current = true;
              setLaptopMode('version');
              setLaptopCode('');
              setLaptopOutput('');
              setLaptopSuccess(false);
              setShowLaptopUI(true);
            }
          } else if (phase === 'pre-boot') {
            aptCutsceneTimerRef.current += delta;
            const t = aptCutsceneTimerRef.current;
            if (scrapRobotRef.current) {
              // Reset position first frame
              if (t < 0.05) {
                scrapRobotRef.current.root.position.set(-2.6, 1.2, 0.24);
                scrapRobotRef.current.root.rotation.x = Math.PI / 2;
                scrapRobotRef.current.root.rotation.z = 0.08;
                scrapRobotRef.current.root.scale.set(0.65, 0.65, 0.65);
                scrapRobotRef.current.root.visible = true;
                playStartupChime();
                // Recreate antenna PointLight
                if (sceneRef.current) {
                  const tip = scrapRobotRef.current.antennaTip;
                  const worldPos = new THREE.Vector3();
                  tip.getWorldPosition(worldPos);
                  const light = new THREE.PointLight(0x00ff88, 0, 1.5);
                  light.position.copy(worldPos);
                  sceneRef.current.add(light);
                  antennaGlowLightRef.current = light;
                }
              }
              // Pulse antenna slowly
              const mat = scrapRobotRef.current.antennaTip.material as THREE.MeshToonMaterial | undefined;
              if (mat) {
                mat.emissive = new THREE.Color(0x00ff88);
                mat.emissiveIntensity = Math.max(0, Math.sin(t * 3)) * 0.6;
              }
              if (antennaGlowLightRef.current) {
                antennaGlowLightRef.current.intensity = Math.max(0, Math.sin(t * 3)) * 0.3;
              }
              // Beep at pulse peaks (~every 1s)
              if (t > 0.05) {
                const prevPeak = Math.floor((t - delta) * 3);
                const currPeak = Math.floor(t * 3);
                if (prevPeak !== currPeak && Math.sin(t * 3) > 0.8) {
                  playBootBeep();
                }
              }
            }
            // Sparky dialog after chime + some pulses
            if (t > 3.0 && !bootDlgShownRef.current) {
              bootDlgShownRef.current = true;
              setShowBootDlg(true);
              setBootDlgStep(0);
              document.exitPointerLock();
              if (antennaGlowLightRef.current) {
                sceneRef.current?.remove(antennaGlowLightRef.current);
                antennaGlowLightRef.current = null;
              }
              const mat = scrapRobotRef.current?.antennaTip.material as THREE.MeshToonMaterial | undefined;
              if (mat) { mat.emissive = new THREE.Color(0x000000); mat.emissiveIntensity = 0; }
            }
          } else if (phase === 'boot-coding') {
            aptCutsceneTimerRef.current += delta;
            const bcElapsed = aptCutsceneTimerRef.current;
            if (bcElapsed > 0.5 && !bootCodingShownRef.current) {
              bootCodingShownRef.current = true;
              setLaptopMode('boot');
              setLaptopCode('');
              setLaptopOutput('');
              setLaptopSuccess(false);
              setShowLaptopUI(true);
            }
          } else if (phase === 'boot') {
            aptCutsceneTimerRef.current += delta;
            const t = aptCutsceneTimerRef.current;
            // Eye flash + jolt on first frame
            if (t < 0.05 && scrapRobotRef.current) {
              if (scrapRobotRef.current.leftPupil) scrapRobotRef.current.leftPupil.material.color.setHex(0x22d3ee);
              if (scrapRobotRef.current.rightPupil) scrapRobotRef.current.rightPupil.material.color.setHex(0x22d3ee);
              scrapRobotRef.current.root.position.x = -2.6 + (Math.random() - 0.5) * 0.04;
              scrapRobotRef.current.root.position.z = 0.24 + (Math.random() - 0.5) * 0.04;
            }
            // Fade eyes off after 0.3s
            if (t > 0.3 && t < 0.6 && scrapRobotRef.current) {
              const fade = (t - 0.3) / 0.3;
              const eyeVal = Math.floor(0x22 * (1 - fade)) * 0x10000 + Math.floor(0xd3 * (1 - fade)) * 0x100 + Math.floor(0xee * (1 - fade));
              if (scrapRobotRef.current.leftPupil) scrapRobotRef.current.leftPupil.material.color.setHex(eyeVal);
              if (scrapRobotRef.current.rightPupil) scrapRobotRef.current.rightPupil.material.color.setHex(eyeVal);
            }
            // Smoke puffs at 0.3s, 0.6s, 0.9s
            const puffTimes = [0.3, 0.6, 0.9];
            for (const pt of puffTimes) {
              if (t > pt && t < pt + delta + 0.01 && t < pt + 0.05 && scrapRobotRef.current && sceneRef.current) {
                for (let i = 0; i < 4; i++) {
                  const size = 0.05 + Math.random() * 0.04;
                  const puff = new THREE.Mesh(
                    new THREE.CircleGeometry(size, 8),
                    new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5, depthWrite: false })
                  );
                  const bx = scrapRobotRef.current.root.position.x + (Math.random() - 0.5) * 0.06;
                  const by = scrapRobotRef.current.root.position.y + (Math.random() - 0.5) * 0.06;
                  puff.position.set(bx, by, 0.7);
                  puff.userData = { spawnTime: t, riseSpeed: 0.3 + Math.random() * 0.2, driftX: (Math.random() - 0.5) * 0.15, driftY: (Math.random() - 0.5) * 0.15 };
                  sceneRef.current.add(puff);
                  smokeParticlesRef.current.push(puff);
                }
              }
            }
            // Animate existing smoke particles
            for (let i = smokeParticlesRef.current.length - 1; i >= 0; i--) {
              const p = smokeParticlesRef.current[i];
              const age = t - (p.userData.spawnTime as number);
              if (age > 1.2) {
                sceneRef.current?.remove(p);
                p.geometry.dispose();
                (p.material as THREE.Material).dispose();
                smokeParticlesRef.current.splice(i, 1);
              } else {
                p.position.z = 0.24 + age * (p.userData.riseSpeed as number);
                p.position.x = (p.userData.spawnX ?? p.position.x) + (p.userData.driftX as number) * age;
                p.position.y = (p.userData.spawnY ?? p.position.y) + (p.userData.driftY as number) * age;
                if (!p.userData.spawnX) { p.userData.spawnX = p.position.x; p.userData.spawnY = p.position.y; }
                const s = 1 + age * 3;
                p.scale.set(s, s, 1);
                (p.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 * (1 - age / 1.2));
              }
            }
            // Transition to battery-scene
            if (t > 2.0) {
              // Cleanup any remaining smoke
              for (const p of smokeParticlesRef.current) {
                sceneRef.current?.remove(p);
                p.geometry.dispose();
                (p.material as THREE.Material).dispose();
              }
              smokeParticlesRef.current = [];
              aptCutscenePhaseRef.current = 'battery-scene';
              aptCutsceneTimerRef.current = 0;
            }
          } else if (phase === 'battery-scene') {
            aptCutsceneTimerRef.current += delta;
            const t = aptCutsceneTimerRef.current;
            // Scrap falls over at start
            if (t < 0.1 && scrapRobotRef.current) {
              scrapRobotRef.current.root.rotation.z = 0.3 + Math.random() * 0.1;
              scrapRobotRef.current.root.position.z = 0.2;
              if (scrapRobotRef.current.leftPupil) scrapRobotRef.current.leftPupil.material.color.setHex(0x000000);
              if (scrapRobotRef.current.rightPupil) scrapRobotRef.current.rightPupil.material.color.setHex(0x000000);
            }
            // Show Sparky battery dialog at 0.5s
            if (t > 0.5 && !batteryDlgShownRef.current) {
              batteryDlgShownRef.current = true;
              setShowBatteryDlg(true);
              setBatteryDlgStep(0);
            }
            // Safety timeout: advance after 30s regardless
            if (t > 30.0) {
              aptCutscenePhaseRef.current = 'done';
              aptCutsceneTimerRef.current = 0;
              setShowBatteryDlg(false);
            }
          } else if (phase === 'done') {
            if (cutsceneBoxRef.current) cutsceneBoxRef.current.visible = false;
            if (computerRef.current) computerRef.current.visible = false;
            if (wireRef.current) {
              wireRef.current.visible = false;
            }
            if (coilRef.current) coilRef.current.visible = false;
            if (tackFxRef.current) {
              tackFxRef.current.visible = false;
              tackFxRef.current.scale.set(1, 1, 1);
              tackFxRef.current.children.forEach((c: THREE.Object3D) => {
                c.position.set(0, 0, 0);
                ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1;
              });
            }
            tackFxPhaseRef.current = 0;
            if (scrapRobotRef.current) {
              scrapRobotRef.current.root.scale.set(0.65, 0.65, 0.65);
              scrapRobotRef.current.root.position.set(-2.6, 1.2, 0.24);
              scrapRobotRef.current.root.rotation.x = Math.PI / 2;
              scrapRobotRef.current.root.rotation.z = 0.08;
              scrapRobotRef.current.root.visible = true;
              const mat = scrapRobotRef.current.antennaTip.material as THREE.MeshToonMaterial | undefined;
              if (mat) { mat.emissive = new THREE.Color(0x000000); mat.emissiveIntensity = 0; }
            }
            // Cleanup antenna glow
            if (antennaGlowLightRef.current) {
              sceneRef.current?.remove(antennaGlowLightRef.current);
              antennaGlowLightRef.current = null;
            }
            // Cleanup any lingering smoke particles
            for (const p of smokeParticlesRef.current) {
              sceneRef.current?.remove(p);
              p.geometry.dispose();
              (p.material as THREE.Material).dispose();
            }
            smokeParticlesRef.current = [];
            if (antennaGlowSpriteRef.current) {
              sceneRef.current?.remove(antennaGlowSpriteRef.current);
              (antennaGlowSpriteRef.current.material as THREE.SpriteMaterial).map?.dispose();
              antennaGlowSpriteRef.current.material.dispose();
              antennaGlowSpriteRef.current = null;
            }
            sceneBgOverrideRef.current = null;
            cinemCamActiveRef.current = false;
            aptCutscenePhaseRef.current = 'idle';
            cutsceneDoneRef.current = true;
            try { localStorage.setItem('rb_cutscene_done', '1'); } catch {}
            apiSync({ cutsceneDone: true });
            if (aptSparkyCS) {
              aptSparkyCS.body.rotation.x = 0;
              aptSparkyCS.root.position.set(0.2, 2.2, 0.22);
              if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current);
            }
          }
        } else if (installBatteryPhaseRef.current && aptSparky) {
          const ibPhase = installBatteryPhaseRef.current;
          if (ibPhase === 'walk-to-scrap') {
            const target = new THREE.Vector2(-2.3, 1.2);
            const dist = aptSparky.root.position.distanceTo(new THREE.Vector3(target.x, target.y, 0.14));
            if (dist > 0.15) {
              const dir = new THREE.Vector2(target.x - aptSparky.root.position.x, target.y - aptSparky.root.position.y).normalize();
              aptSparky.root.position.x += dir.x * MOVE_SPEED * 0.7 * delta;
              aptSparky.root.position.y += dir.y * MOVE_SPEED * 0.7 * delta;
              setSparkyModal('Sparky walks to Scrap with the battery...');
            } else {
              installBatteryPhaseRef.current = 'open-chest';
              installBatteryTimerRef.current = 0;
            }
          } else if (ibPhase === 'open-chest') {
            installBatteryTimerRef.current += delta;
            if (scrapRobotRef.current) {
              scrapRobotRef.current.root.rotation.z = 0.08 + Math.sin(installBatteryTimerRef.current * 20) * 0.02;
            }
            setSparkyModal('Opening Scrap\'s chest panel...');
            if (installBatteryTimerRef.current > 1.0) {
              installBatteryPhaseRef.current = 'place-battery';
              installBatteryTimerRef.current = 0;
            }
          } else if (ibPhase === 'place-battery') {
            installBatteryTimerRef.current += delta;
            setSparkyModal('Placing the battery...');
            // Create battery glow mesh on Scrap's chest
            if (installBatteryTimerRef.current > 0.8) {
              const scrap = scrapRobotRef.current;
              if (scrap && scrap.body && !batteryGlowRef.current) {
                const glow = new THREE.Mesh(
                  new THREE.SphereGeometry(0.05, 10, 10),
                  new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.3 })
                );
                glow.position.set(0, 0, 0.24);
                scrap.body.add(glow);
                batteryGlowRef.current = glow;
              }
              installBatteryPhaseRef.current = 'chest-glow';
              installBatteryTimerRef.current = 0;
            }
          } else if (ibPhase === 'chest-glow') {
            installBatteryTimerRef.current += delta;
            if (batteryGlowRef.current) {
              const glow = batteryGlowRef.current;
              const intensity = 0.3 + Math.sin(installBatteryTimerRef.current * 6) * 0.15;
              (glow.material as THREE.MeshBasicMaterial).opacity = intensity;
            }
            setSparkyModal('Battery installed! Scrap is powering up...');
            if (installBatteryTimerRef.current > 2.0) {
              installBatteryPhaseRef.current = 'done';
            }
          } else if (ibPhase === 'done') {
            installBatteryPhaseRef.current = null;
            batteryInstalledRef.current = true;
            const newBackpack: ScrapPartId[] = gameStore.get('backpack').filter(id => id !== 'battery');
            updateBackpack(newBackpack);
            if (heldSlotIndexRef.current !== null && (heldSlotIndexRef.current >= newBackpack.length || !newBackpack.includes(gameStore.get('backpack')[heldSlotIndexRef.current]))) {
              setHeldSlotIndex(null);
              heldSlotIndexRef.current = null;
            }
            setSparkyModal('Think you need a sensor — go buy one at the Parts Shop near the lake.');
            setTimeout(() => setSparkyModal(null), 4000);
          }
        } else if (sparkyInstallPhaseRef.current && aptSparky) {
          const phase = sparkyInstallPhaseRef.current;
          if (phase === 'walk-to-bench') {
            const target = new THREE.Vector2(2.9, 0.3);
            const dist = aptSparky.root.position.distanceTo(new THREE.Vector3(target.x, target.y, 0.14));
            if (dist > 0.15) {
              const dir = new THREE.Vector2(target.x - aptSparky.root.position.x, target.y - aptSparky.root.position.y).normalize();
              aptSparky.root.position.x += dir.x * MOVE_SPEED * 0.7 * delta;
              aptSparky.root.position.y += dir.y * MOVE_SPEED * 0.7 * delta;
              setSparkyModal(`${PARTS_CATALOG.find(p => p.id === sparkyInstallPartIdRef.current)?.name} — Sparky walks to the workbench...`);
            } else {
              sparkyInstallPhaseRef.current = 'weld';
              sparkyInstallTimerRef.current = 0;
              setSparkleBurst(true);
              setSparkyModal('Welding! ⚡');
            }
          } else if (phase === 'weld') {
            sparkyInstallTimerRef.current += delta;
            aptSparky.root.position.z = 0.24 + Math.sin(sparkyInstallTimerRef.current * 16) * 0.1;
            aptSparky.root.rotation.z = Math.sin(sparkyInstallTimerRef.current * 20) * 0.08;
            if (sparkyInstallTimerRef.current > 1.8) {
              sparkyInstallPhaseRef.current = 'attach-part';
              sparkyInstallTimerRef.current = 0;
            }
          } else if (phase === 'attach-part') {
            // Attach part mesh to Scrap's body
            const scrap = scrapRobotRef.current;
            if (scrap && scrap.body) {
              const partId = sparkyInstallPartIdRef.current as ScrapPartId;
              let partMesh: THREE.Mesh;
              if (partId === 'sensor') {
                partMesh = new THREE.Mesh(
                  new THREE.SphereGeometry(0.045, 10, 10),
                  new THREE.MeshToonMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.6 })
                );
                partMesh.position.set(0, 0, 0.22);
              } else if (partId === 'voice') {
                partMesh = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.03, 0.055, 0.065, 8),
                  new THREE.MeshToonMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.6 })
                );
                partMesh.position.set(0, 0.18, 0.08);
              } else {
                partMesh = new THREE.Mesh(
                  new THREE.BoxGeometry(0.065, 0.025, 0.04),
                  new THREE.MeshToonMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.6 })
                );
                partMesh.position.set(0, 0, -0.22);
              }
              scrap.body.add(partMesh);
              scrapPartMeshRef.current = partMesh;
            }
            sparkyInstallTimerRef.current += delta;
            if (sparkyInstallTimerRef.current > 0.6) {
              sparkyInstallPhaseRef.current = 'walk-back';
              sparkyInstallTimerRef.current = 0;
              setSparkyModal('Part installed! Sparky steps back...');
            }
          } else if (phase === 'walk-back') {
            const homePos = new THREE.Vector2(0.2, 2.2);
            const dist = aptSparky.root.position.distanceTo(new THREE.Vector3(homePos.x, homePos.y, 0.14));
            aptSparky.root.rotation.z *= 0.9;
            if (dist > 0.15) {
              const dir = new THREE.Vector2(homePos.x - aptSparky.root.position.x, homePos.y - aptSparky.root.position.y).normalize();
              aptSparky.root.position.x += dir.x * MOVE_SPEED * 0.7 * delta;
              aptSparky.root.position.y += dir.y * MOVE_SPEED * 0.7 * delta;
            } else {
              sparkyInstallPhaseRef.current = 'done';
            }
          } else if (phase === 'done') {
            sparkyInstallPhaseRef.current = null;
            setSparkleBurst(false);
            aptSparky.root.rotation.z = 0;

            const partId = sparkyInstallPartIdRef.current!;
            const nextUnit = sparkyInstallNextStageRef.current!;
            const part = PARTS_CATALOG.find(p => p.id === partId)!;
            const unitLabel = nextUnit === 'unit2' ? 'Variables & Data Types' : nextUnit === 'unit3' ? 'String Methods' : 'Unit 4';

            const newBackpack = gameStore.get('backpack').filter(id => id !== partId);
            updateBackpack(newBackpack);
            updateQuestStage(nextUnit);

            setSparkyModal(`⚡ ${part.name} installed! ${unitLabel} lessons unlocked!`);

            setTimeout(() => {
              setSparkyModal(null);
              if (nextUnit === 'unit2') {
                setTutorialPhases(unit2Phases);
                tutorialPhasesRef.current = unit2Phases;
                showTutorialRef.current = true;
                setShowTutorial(true);
                setTutorialStep(0);
                setCode(tutorialPhasesRef.current[0].kind === 'dialogue' ? '' : tutorialPhasesRef.current[0].starterCode || '');
                setOutput('');
                setSuccess(false);
              }
            }, 2000);

            if (heldSlotIndexRef.current !== null && (heldSlotIndexRef.current >= newBackpack.length || !newBackpack.includes(gameStore.get('backpack')[heldSlotIndexRef.current]))) {
              setHeldSlotIndex(null);
              heldSlotIndexRef.current = null;
            }
          }
        }
      }

      if (inWorkshopRoomRef.current) {
        customerSpawnTimerRef.current += delta;
        if (
          customerSpawnTimerRef.current > 3.8 &&
          workshopCustomersRef.current.length < 4 &&
          Math.random() > 0.55
        ) {
          spawnCustomer();
          customerSpawnTimerRef.current = 0;
        }

        let closestCandidate: CustomerNpc | null = null;
        if (!currentCustomerIdRef.current) {
          for (const npc of workshopCustomersRef.current) {
            if (npc.stage !== 'browsing' && npc.stage !== 'walking-to-browse') continue;
            const distance = npc.position.distanceTo(localPositionRef.current);
            if (distance > CUSTOMER_TALK_DISTANCE) continue;
            if (!closestCandidate || distance < closestCandidate.position.distanceTo(localPositionRef.current)) {
              closestCandidate = npc;
            }
          }
        }

        // Show marker on the closest interactable customer (browsing or walking)
        for (const npc of workshopCustomersRef.current) {
          const shouldShow = npc === closestCandidate;
          if (npc.visual.marker && npc.visual.marker.visible !== shouldShow) {
            npc.visual.marker.visible = shouldShow;
          }
        }

        const nextCandidateId = closestCandidate?.id ?? null;
        if (interactionCandidateIdRef.current !== nextCandidateId) {
          interactionCandidateIdRef.current = nextCandidateId;
          setInteractionPromptName(closestCandidate ? closestCandidate.request.customerName : null);
        }

        // Rafiq interaction — "Who are you?", letter reception, or workshop intro
        const distToRafiq = Math.hypot(localPositionRef.current.x - ROOM_OWNER_POS.x, localPositionRef.current.y - ROOM_OWNER_POS.y);
        if (interactionRequestedRef.current && distToRafiq < 1.8) {
          interactionRequestedRef.current = false;
          const bp = gameStore.get('backpack');
          if (!cutsceneDoneRef.current) {
            // Pre-cutscene: Rafiq doesn't know you
            setShowWhoDlg(true);
          } else if (bp.includes('letter' as ScrapPartId)) {
            // Rafiq reads the letter and gives employment
            const newBackpack = bp.filter(id => id !== 'letter');
            gameStore.set('backpack', newBackpack);
            apiSync({ backpack: newBackpack });
            lastConfirmedBackpackRef.current = newBackpack;
            setShowRafiqLetterDlg(true);
            setRafiqLetterStep(0);
          } else {
            reopenWorkshopIntro();
          }
        }

        if (interactionRequestedRef.current && closestCandidate) {
          interactionRequestedRef.current = false;
          let nextRequest = closestCandidate.request;
          if (
            lastWorkshopRequestSigRef.current &&
            getWorkshopRequestSignature(nextRequest) === lastWorkshopRequestSigRef.current
          ) {
            nextRequest = createCustomerRequest(closestCandidate.request.customerName);
            closestCandidate.request = nextRequest;
          }
          closestCandidate.stage = 'awaiting-code';
          currentCustomerIdRef.current = closestCandidate.id;
          bonusTimerRef.current = performance.now();
          setActiveCustomer(nextRequest);
          lastWorkshopRequestSigRef.current = getWorkshopRequestSignature(nextRequest);
          setWorkshopOutput(
            `${nextRequest.customerName}: Here is my request. Do the code, then lead me to the register for $2.`
          );
          interactionCandidateIdRef.current = null;
          setInteractionPromptName(null);
        } else if (interactionRequestedRef.current) {
          interactionRequestedRef.current = false;
        }
      }

      // Shop room interaction
      if (inShopRoomRef.current) {
        const distToShopkeep = localPositionRef.current.distanceTo({ x: 0, y: -1.45 });
        if (interactionRequestedRef.current && distToShopkeep < 1.5) {
          interactionRequestedRef.current = false;
          const stage = sparkyQuestStageRef.current;
          const partId = PART_FOR_STAGE[stage];
          if (partId && !gameStore.get('backpack').includes(partId)) {
            setShopkeeperGreeting(`Welcome! What can I get for you today? I've got just the part Scrap needs.`);
          } else {
            setShopkeeperGreeting(`Welcome back! Take a look around — let me know if anything catches your eye.`);
          }
        } else if (interactionRequestedRef.current) {
          interactionRequestedRef.current = false;
        }
        if (shopNpcRef.current) {
          const shopDx = localPositionRef.current.x;
          const shopDy = localPositionRef.current.y + 1.45;
          animateRobotVisual(shopNpcRef.current, worldTime, 0.1, shopDx, shopDy);
        }
      }

      if (inWorkshopRoomRef.current) {

        workshopCustomersRef.current = workshopCustomersRef.current.filter((npc) => {
          if (npc.stage === 'follow-to-counter') {
            npc.target.copy(ROOM_COUNTER_POS);
          } else if (npc.stage === 'walking-to-browse') {
            npc.target.copy(npc.browseSpot);
            // Force to browsing if stuck for > 8s (blocked by obstacles/other customers)
            if ((npc as any).startedAtMs && performance.now() - (npc as any).startedAtMs > 8000) {
              npc.stage = 'browsing';
              npc.target.copy(npc.position);
            }
          } else if (npc.stage === 'browsing' || npc.stage === 'awaiting-code') {
            npc.target.copy(npc.position);
          } else if (npc.stage === 'leaving') {
            npc.target.copy(ROOM_CUSTOMER_EXIT_POS);
          }
          if (npc.stage !== 'browsing' && npc.stage !== 'awaiting-code' && npc.visual.marker && npc.visual.marker.visible) {
            npc.visual.marker.visible = false;
          }

          const toTarget = npc.target.clone().sub(npc.position);
          const dist = toTarget.length();
          if (dist < 0.12) {
            if (npc.stage === 'leaving') {
              if (roomCustomerGroupRef.current) {
                roomCustomerGroupRef.current.remove(npc.visual.root);
              }
              disposeObject(npc.visual.root);
              if (currentCustomerIdRef.current === npc.id) {
                currentCustomerIdRef.current = null;
                setActiveCustomer(null);
                lockedBonusRef.current = 0;
                bonusTimerRef.current = null;
              }
              return false;
            }
            if (npc.stage === 'walking-to-browse') {
              npc.stage = 'browsing';
            }
          } else {
            const step = Math.min(dist, npc.speed * delta);
            const stepVector = toTarget.normalize().multiplyScalar(step);
            const candidate = npc.position.clone().add(stepVector);
            const blockCustomer = (p: THREE.Vector2) =>
              workshopCustomersRef.current.some(n => n.id !== npc.id && n.stage !== 'leaving' && (
                Math.hypot(p.x - n.position.x, p.y - n.position.y) < 0.28
              ));
            if (!collidesWithAny(candidate, roomObstacleHitboxesRef.current) && !blockCustomer(candidate)) {
              npc.position.copy(candidate);
            } else {
              const slideX = npc.position.clone().add(new THREE.Vector2(stepVector.x, 0));
              const slideY = npc.position.clone().add(new THREE.Vector2(0, stepVector.y));
              if (!collidesWithAny(slideX, roomObstacleHitboxesRef.current) && !blockCustomer(slideX)) {
                npc.position.copy(slideX);
              } else if (!collidesWithAny(slideY, roomObstacleHitboxesRef.current) && !blockCustomer(slideY)) {
                npc.position.copy(slideY);
              }
            }
          }

          if (
            npc.stage === 'follow-to-counter' &&
            localPositionRef.current.distanceTo(ROOM_COUNTER_POS) < REGISTER_ZONE_RADIUS &&
            npc.position.distanceTo(ROOM_COUNTER_POS) < REGISTER_NPC_RADIUS
          ) {
            npc.stage = 'leaving';
            npc.target.copy(ROOM_CUSTOMER_EXIT_POS);
            const bonus = lockedBonusRef.current;
            lockedBonusRef.current = 0;
            bonusTimerRef.current = null;
            const newMoney = gameStore.get('money') + 2 + bonus;
            updateMoney(newMoney);
            playHappyChime();
            const bonusText = bonus > 0 ? ` (+$${bonus} speed bonus!)` : '';
            setWorkshopOutput(`✅ ${npc.request.customerName}: "Thank you!" You earned $2${bonusText}.`);
            if (currentCustomerIdRef.current === npc.id) {
              currentCustomerIdRef.current = null;
              setActiveCustomer(null);
            }
          }

          const moving = dist > 0.06 && npc.stage !== 'browsing' && npc.stage !== 'awaiting-code';
          const sway = moving ? Math.sin(worldTime * 8 + npc.position.x * 0.5) * 0.05 : 0;
          if (npc.stage === 'browsing' || npc.stage === 'awaiting-code') {
            const petLook = npc.petLookTarget.clone().sub(npc.position);
            const angle = Math.atan2(petLook.y, petLook.x) - Math.PI / 2;
            const clamped = Math.max(-0.6, Math.min(0.6, angle));
            npc.visual.root.rotation.z += (clamped - npc.visual.root.rotation.z) * 0.25;
          } else {
            npc.visual.root.rotation.z += (sway - npc.visual.root.rotation.z) * 0.25;
          }
          npc.visual.nameSprite.position.y = 1.15 + Math.sin(worldTime * 2 + npc.position.y) * 0.03;
          npc.visual.root.position.set(npc.position.x, npc.position.y, 0.24);
          return true;
        });
      }

      // Update bonus timer fraction for UI
      if (bonusTimerRef.current !== null) {
        const elapsed = (performance.now() - bonusTimerRef.current) / 1000;
        const frac = Math.max(0, 1 - elapsed / BONUS_DURATION);
        setBonusFraction(frac);
        if (frac <= 0) bonusTimerRef.current = null;
      } else if (bonusFraction !== 0) {
        setBonusFraction(0);
      }

      const currentRoom = inArenaRoomRef.current ? 'arena' : inWorkshopRoomRef.current ? 'workshop' : inShopRoomRef.current ? 'shop' : inApartmentRoomRef.current ? 'apartment' : 'outside';
      for (const avatar of Object.values(remoteAvatarsRef.current)) {
        const showAvatar = currentRoom === avatar.room;
        avatar.root.visible = showAvatar;
        if (showAvatar) {
          const targetGroup = currentRoom === 'arena' ? arenaRoomGroup :
            currentRoom === 'workshop' ? (workshopRoomGroupRef.current || scene) :
            currentRoom === 'apartment' ? (apartmentRoomGroupRef.current || scene) :
            (outdoorGroupRef.current || scene);
          if (avatar.root.parent !== targetGroup) {
            avatar.root.parent?.remove(avatar.root);
            targetGroup.add(avatar.root);
          }
        }
        const prevX = avatar.root.position.x;
        const prevY = avatar.root.position.y;
        avatar.root.position.x += (avatar.target.x - avatar.root.position.x) * REMOTE_LERP;
        avatar.root.position.y += (avatar.target.y - avatar.root.position.y) * REMOTE_LERP;
        const roomZ = avatar.room === 'workshop' ? 0.26 : avatar.room === 'apartment' || avatar.room === 'arena' || avatar.room === 'shop' ? 0.28 : 0.24;
        avatar.root.position.z = roomZ;
        const velocity = Math.hypot(avatar.root.position.x - prevX, avatar.root.position.y - prevY);
        avatar.walkTime += delta * (1 + velocity * 20);
        const lookX = avatar.target.x - avatar.root.position.x;
        const lookY = avatar.target.y - avatar.root.position.y;
        const remoteSpeed = velocity > 0.001 ? 1 : 0;
        const remoteSwing = Math.sin(avatar.walkTime * WALK_BOB_SPEED) * 0.3 * remoteSpeed;
        avatar.leftLegPivot.rotation.x = remoteSwing;
        avatar.rightLegPivot.rotation.x = -remoteSwing;
        const remoteArmSwing = Math.sin(avatar.walkTime * WALK_BOB_SPEED + Math.PI) * 0.2 * remoteSpeed;
        avatar.leftArm.rotation.x = -Math.PI / 2 + remoteArmSwing;
        avatar.rightArm.rotation.x = -Math.PI / 2 - remoteArmSwing;
        if (Math.abs(lookX) > 0.001 || Math.abs(lookY) > 0.001) {
          avatar.root.rotation.z = -Math.atan2(lookX, lookY);
        } else {
          avatar.root.rotation.z = -avatar.facingRotation;
        }
      }

      clouds.forEach((cloud, i) => {
        cloud.position.x += Math.sin(worldTime * (0.08 + i * 0.03) + i) * 0.0025;
      });

      const roomBg = inWorkshopRoomRef.current ? 0x030712 : inShopRoomRef.current ? 0x1a1a2e : inArenaRoomRef.current ? 0x0f172a : inApartmentRoomRef.current ? 0x1a1a2e : 0x4a7a9a;
        outdoorGroup.visible = !inWorkshopRoomRef.current && !inShopRoomRef.current && !inArenaRoomRef.current && !inApartmentRoomRef.current;
        workshopRoomGroup.visible = inWorkshopRoomRef.current;
        arenaRoomGroup.visible = inArenaRoomRef.current;
        apartmentRoomGroup.visible = inApartmentRoomRef.current;
        if (shopRoomGroupRef.current) shopRoomGroupRef.current.visible = inShopRoomRef.current;
        scene.background = new THREE.Color(sceneBgOverrideRef.current ?? roomBg);
        const camYaw = yawRef.current;
        const camPitch = cameraPitchRef.current;
        const px = localPositionRef.current.x;
        const py = localPositionRef.current.y;
        const sinYaw = Math.sin(camYaw), cosYaw = Math.cos(camYaw);
        const sinPitch = Math.sin(camPitch), cosPitch = Math.cos(camPitch);
        const inside = inWorkshopRoomRef.current || inShopRoomRef.current || inArenaRoomRef.current || inApartmentRoomRef.current;
        const room = inside ? currentRoom : 'outside';
        if (cinemCamActiveRef.current) {
          const phase = aptCutscenePhaseRef.current;
          const csSparky = apartmentSparkyRef.current;
          if (csSparky) {
            const sp = csSparky.root.position;
            if (phase === 'fetch-laptop') {
              camera.position.set(-3.0, 2.5, 1.5);
              camera.lookAt(-3.0, 1.15, 0.3);
            } else if (phase === 'link-computer' || phase === 'electrocute') {
              const camTarget = new THREE.Vector3(-3.0, 2.5, 1.5);
              camera.position.lerp(camTarget, 0.04);
              camera.lookAt(-3.0, 1.15, 0.3);
            } else if (phase === 'walk-to-laptop') {
              const camTarget = new THREE.Vector3(localPositionRef.current.x, localPositionRef.current.y + 1.3, 2.0);
              camera.position.lerp(camTarget, 0.04);
              camera.lookAt(localPositionRef.current.x, localPositionRef.current.y - 0.8, 0.3);
            } else if (phase === 'string-tutorial') {
              const camTarget = new THREE.Vector3(-3.4, 1.6, 1.8);
              camera.position.lerp(camTarget, 0.04);
              camera.lookAt(-3.4, 0.5, 0.3);
            } else if (phase === 'laptop-ui') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                const dp = new THREE.Vector3();
                display.getWorldPosition(dp);
                camera.position.set(dp.x, dp.y - 0.35, dp.z);
                camera.lookAt(dp);
              }
            } else if (phase === 'antenna-glow') {
              const t = aptCutsceneTimerRef.current;
              if (t < 2.0) {
                camera.position.lerp(new THREE.Vector3(-3.0, 0.8, 1.5), 0.06);
                camera.lookAt(-2.6, 1.2, 0.34);
              } else {
                if (computerRef.current) {
                  const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                  const dp = new THREE.Vector3();
                  display.getWorldPosition(dp);
                  camera.position.lerp(new THREE.Vector3(dp.x, dp.y - 0.35, dp.z), 0.04);
                  camera.lookAt(dp);
                }
              }
            } else if (phase === 'date-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                const dp = new THREE.Vector3();
                display.getWorldPosition(dp);
                camera.position.set(dp.x, dp.y - 0.35, dp.z);
                camera.lookAt(dp);
              }
            } else if (phase === 'reboot') {
              camera.position.lerp(new THREE.Vector3(-3.0, 0.8, 1.5), 0.06);
              camera.lookAt(-2.6, 1.2, 0.34);
            } else if (phase === 'version-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                const dp = new THREE.Vector3();
                display.getWorldPosition(dp);
                camera.position.set(dp.x, dp.y - 0.35, dp.z);
                camera.lookAt(dp);
              }
            } else if (phase === 'pre-boot') {
              camera.position.lerp(new THREE.Vector3(-3.0, 0.8, 1.5), 0.06);
              camera.lookAt(-2.6, 1.2, 0.34);
            } else if (phase === 'boot-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                const dp = new THREE.Vector3();
                display.getWorldPosition(dp);
                camera.position.set(dp.x, dp.y - 0.35, dp.z);
                camera.lookAt(dp);
              }
            } else if (phase === 'boot') {
              camera.position.lerp(new THREE.Vector3(-3.0, 0.8, 1.5), 0.06);
              camera.lookAt(-2.6, 1.2, 0.34);
            } else {
              const camTarget = new THREE.Vector3(-2.7, 3.0, 2.2);
              camera.position.lerp(camTarget, 0.04);
              camera.lookAt(sp.x, sp.y, 0.3);
            }
          }
        } else {
        const zoom = computeCameraZoom(
          px, py,
          inside, room,
          buildingFootprints as BuildingFootprint[],
        );
        const cd = Math.max(0.1, zoom.camDist + zoomOffsetRef.current);
        const camZ = zoom.height + sinPitch * cd;
        cameraTargetPosRef.current.set(
          px - sinYaw * cosPitch * cd,
          py - cosYaw * cosPitch * cd,
          Math.max(0.05, camZ)
        );
        cameraLookTargetRef.current.set(
          px,
          py,
          inside ? 0.5 : 0.6
        );
        camera.position.copy(cameraTargetPosRef.current);
        camera.lookAt(cameraLookTargetRef.current);

        // Clamp camera inside room so it never sees past walls into the void
        if (inside) {
          const limits: Record<string, number> = {
            workshop: 4.0, arena: 5.0, apartment: 3.0, shop: 2.5,
          };
          const lim = limits[room] ?? 20;
          camera.position.x = Math.max(-lim, Math.min(lim, camera.position.x));
          camera.position.y = Math.max(-lim, Math.min(lim, camera.position.y));
        } else {
          // Push camera outside building interiors (mirror of room clamp in reverse)
          const cx = camera.position.x, cy = camera.position.y;
          for (const fp of buildingFootprints) {
            if (cx >= fp.x1 && cx <= fp.x2 && cy >= fp.y1 && cy <= fp.y2) {
              const dl = cx - fp.x1, dr = fp.x2 - cx;
              const db = cy - fp.y1, dt = fp.y2 - cy;
              const minD = Math.min(dl, dr, db, dt);
              if (minD === dl) camera.position.x = fp.x1;
              else if (minD === dr) camera.position.x = fp.x2;
              else if (minD === db) camera.position.y = fp.y1;
              else camera.position.y = fp.y2;
            }
          }
        }

        // Broadcast position via WebSocket when moving (or every 50ms if moving)
        if (moved && now >= sendAtRef.current) {
          sendAtRef.current = now + NETWORK_SYNC_MS;
          const sendPos = (() => {
            if (inWorkshopRoomRef.current) return { x: ROOM_SPAWN.x, y: ROOM_SPAWN.y, room: 'workshop' };
            if (inArenaRoomRef.current) return { x: ARENA_ROOM_SPAWN.x, y: ARENA_ROOM_SPAWN.y, room: 'arena' };
            if (inApartmentRoomRef.current) return { x: APARTMENT_SPAWN.x, y: APARTMENT_SPAWN.y, room: 'apartment' };
            if (inShopRoomRef.current) return { x: 0, y: 1.2, room: 'shop' };
            return { x: localPositionRef.current.x, y: localPositionRef.current.y };
          })();
          sendPosition(sendPos.x, sendPos.y, sendPos.room, yawRef.current);
        }
      }

      renderer.render(scene, camera);
      rafRef.current = window.requestAnimationFrame(animate);
    } catch (e) {
      console.error('❌ Animation loop error:', e);
      console.log('DEBUG animate state:', {
        inWorkshopRoom: inWorkshopRoomRef.current,
        workshopIntroSeen: workshopIntroSeenRef.current,
        showTutorial: showTutorialRef.current,
        profileLoaded: profileLoadedRef.current,
        modalOpen: modalOpenRef.current,
        hasLocalRobot: !!localRobotRef.current,
      });
      rafRef.current = window.requestAnimationFrame(animate);
    }
    };

    animateFnRef.current = animate;
    rafRef.current = window.requestAnimationFrame(animate);

    const onVisibilityChange = () => {
      if (document.hidden) {
        tabHiddenRef.current = true;
        tabHiddenAtRef.current = performance.now();
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else {
        tabHiddenRef.current = false;
        if (animateFnRef.current && rafRef.current === null) {
          rafRef.current = window.requestAnimationFrame(animateFnRef.current);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const watchdogId = window.setInterval(() => {
      if (document.hidden || tabHiddenRef.current) return;
      const elapsed = performance.now() - lastAnimFrameRef.current;
      if (elapsed > 3000 && rafRef.current !== null) {
        console.warn('⚠️ Restarting frozen animation loop — last frame', elapsed.toFixed(0), 'ms ago');
        if (animateFnRef.current) {
          if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
          rafRef.current = window.requestAnimationFrame(animateFnRef.current);
        }
      }
    }, 2000);

    return () => {
      window.clearInterval(watchdogId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      mountElement.removeEventListener('mousedown', handleFocusClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      rendererEl.removeEventListener('pointermove', onPointerMove);
      rendererEl.removeEventListener('wheel', onWheel);
      Object.values(remoteAvatarsRef.current).forEach((avatar) => disposeObject(avatar.root));
      remoteAvatarsRef.current = {};
      disposeObject(localRobot.root);
      leftLegPivotRef.current = null;
      rightLegPivotRef.current = null;
      disposeObject(sparky.root);
      clouds.forEach((cloud) => disposeObject(cloud));
      shops.forEach((shop) => disposeObject(shop));
      disposeObject(ps);
      if (shopRoomGroupRef.current) {
        scene.remove(shopRoomGroupRef.current);
        disposeObject(shopRoomGroupRef.current);
        shopRoomGroupRef.current = null;
      }
      if (shopNpcRef.current) {
        disposeObject(shopNpcRef.current.root);
        shopNpcRef.current = null;
      }
      disposeObject(owner.root);
      if (roomPetVisualRef.current) {
        disposeObject(roomPetVisualRef.current.root);
        roomPetVisualRef.current = null;
      }
      workshopCustomersRef.current.forEach((npc) => disposeObject(npc.visual.root));
      workshopCustomersRef.current = [];
      miniRobotRefs.current.forEach((r) => disposeObject(r.root));
      miniRobotRefs.current = [];
      roomCustomerGroupRef.current = null;
      roomOwnerVisualRef.current = null;
      outdoorGroupRef.current = null;
      workshopRoomGroupRef.current = null;
      arenaRoomGroupRef.current = null;
      apartmentRoomGroupRef.current = null;
      arenaBuildingRef.current = null;
      obstacleHitboxesRef.current = [];
      roomObstacleHitboxesRef.current = [];
      workshopDoorHitboxRef.current = null;
      arenaDoorHitboxRef.current = null;
      apartmentDoorHitboxRef.current = null;
      apartmentDoorMarkerRef.current = null;
      shopDoorMarkerRef.current = null;
      apartmentSparkyRef.current = null;
      if (scrapPartMeshRef.current) {
        scrapPartMeshRef.current.parent?.remove(scrapPartMeshRef.current);
        (scrapPartMeshRef.current.material as THREE.Material)?.dispose();
        scrapPartMeshRef.current.geometry?.dispose();
        scrapPartMeshRef.current = null;
      }
      if (roomEntryFlashTimeoutRef.current !== null) {
        window.clearTimeout(roomEntryFlashTimeoutRef.current);
        roomEntryFlashTimeoutRef.current = null;
      }
      scene.clear();
      renderer.dispose();
      mountElement.removeChild(renderer.domElement);
      rendererRef.current = null;
    };
  }, [sendPosition, userId]);

  useEffect(() => {
    if (petShopRef.current) petShopRef.current.visible = true;
    if (workshopDoorMarkerRef.current) {
      const partId = PART_FOR_STAGE[sparkyQuestStage];
      const needsPart = !!partId && !backpack.includes(partId);
      workshopDoorMarkerRef.current.visible = (sparkyQuestStage === 'unit1-done' || sparkyQuestStage === 'unit2-done' || sparkyQuestStage === 'unit3-done') && !needsPart && !inWorkshopRoom;
    }
    if (apartmentDoorMarkerRef.current) {
      const showAptMarker = !inApartmentRoom && sparkyHomeArrivedRef.current && (
        sparkyQuestStage === 'intro' ||
        sparkyQuestStage === 'unit1-done' ||
        sparkyQuestStage === 'unit2-done' ||
        sparkyQuestStage === 'unit3-done'
      );
      apartmentDoorMarkerRef.current.visible = showAptMarker;
    }
    if (shopDoorMarkerRef.current) {
      const partId = PART_FOR_STAGE[sparkyQuestStage];
      shopDoorMarkerRef.current.visible = !!partId && !backpack.includes(partId) && !inShopRoom;
    }
  }, [sparkyQuestStage, inWorkshopRoom, inApartmentRoom, inShopRoom, workshopIntroSeen, backpack]);

  useEffect(() => {
    if (!inArenaRoom) {
      setArenaPlayers([]);
      setArenaChallenge(null);
      setArenaBattleActive(false);
      setArenaOutput('');
      return;
    }
    mp.onArenaEventRef.current = (event) => {
      if (event.type === 'arena-join') {
        setArenaPlayers((prev) => {
          if (prev.find(p => p.id === event.fromId)) return prev;
          return [...prev, { id: event.fromId, name: event.fromName }];
        });
      } else if (event.type === 'arena-leave') {
        setArenaPlayers((prev) => prev.filter(p => p.id !== event.fromId));
      } else if (event.type === 'arena-challenge') {
        setArenaChallenge({ id: '', fromId: event.fromId, fromName: event.fromName, status: 'pending' });
      } else if (event.type === 'arena-accept') {
        setArenaBattleActive(true);
        setArenaChallenge({ id: event.challengeId || '', status: 'active' });
        setArenaOutput('Battle started! Write your code.');
      } else if (event.type === 'arena-decline') {
        setArenaChallenge(null);
        setArenaOutput('Challenge declined.');
      }
    };
    fetch('/api/arena', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join' }) }).catch(() => {});
    triggerEvent('client-arena-join', { room: 'arena' });
    fetch('/api/arena?action=players').then(r => r.json()).then(d => { if (d.players) setArenaPlayers(d.players.filter((p: any) => p.id !== userId)); }).catch(() => {});
    return () => {
      mp.onArenaEventRef.current = null;
      fetch('/api/arena', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave' }) }).catch(() => {});
      triggerEvent('client-arena-leave', {});
    };
  }, [inArenaRoom]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const activeIds = new Set(Object.keys(players));

    for (const [remoteUserId, data] of Object.entries(players)) {
      const name = data.name?.trim() || `Player ${remoteUserId.slice(0, 4)}`;
      const remoteRoom = (data as any).room || 'outside';
      if (!remoteAvatarsRef.current[remoteUserId]) {
        const color = new THREE.Color(hashColor(remoteUserId)).getHex();
        const pv = buildPlayerVisual(color, name);
        const roomZ = remoteRoom === 'workshop' ? 0.26 : remoteRoom === 'apartment' || remoteRoom === 'arena' || remoteRoom === 'shop' ? 0.28 : 0.24;
        pv.root.position.set(data.x, data.y, roomZ);
        const initialRotation = (data as any).rotation ?? 0;
        pv.root.rotation.z = -initialRotation;
        remoteAvatarsRef.current[remoteUserId] = {
          root: pv.root,
          nameSprite: pv.nameSprite,
          target: new THREE.Vector2(data.x, data.y),
          name,
          walkTime: performance.now() / 1000,
          room: remoteRoom,
          leftLegPivot: pv.leftLegPivot,
          rightLegPivot: pv.rightLegPivot,
          leftArm: pv.leftArm,
          rightArm: pv.rightArm,
          facingRotation: initialRotation,
        };
      } else {
        const avatar = remoteAvatarsRef.current[remoteUserId];
        avatar.target.set(data.x, data.y);
        avatar.room = remoteRoom;
        const curRotation = (data as any).rotation;
        if (typeof curRotation === 'number') avatar.facingRotation = curRotation;
        if (avatar.name !== name) {
          avatar.root.remove(avatar.nameSprite);
          disposeObject(avatar.nameSprite);
          avatar.nameSprite = createNameSprite(name, new THREE.Color(hashColor(remoteUserId)));
          avatar.root.add(avatar.nameSprite);
          avatar.name = name;
        }
      }
    }

    for (const existingId of Object.keys(remoteAvatarsRef.current)) {
      if (activeIds.has(existingId)) continue;
      const avatar = remoteAvatarsRef.current[existingId];
      avatar.root.parent?.remove(avatar.root);
      disposeObject(avatar.root);
      delete remoteAvatarsRef.current[existingId];
    }
  }, [players]);

  const onEditorScroll = () => {
    if (!codeInputRef.current || !codePreviewRef.current) return;
    codePreviewRef.current.scrollTop = codeInputRef.current.scrollTop;
    codePreviewRef.current.scrollLeft = codeInputRef.current.scrollLeft;
  };

  const checkAnswer = async () => {
    const activePhase = tutorialPhasesRef.current[tutorialStep];
    if (!activePhase || activePhase.kind !== 'challenge') return;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/tutorial/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, concept: activePhase.concept }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { valid: false, error: `Server returned: ${text.substring(0, 200)}` }; }

      if (data.valid) {
        const nextStep = tutorialStep + 1;
        const nextPhase = tutorialPhasesRef.current[nextStep];

        setSuccess(true);
        setSparkleBurst(true);
        playHappyChime();

        scrapChallengesDoneRef.current += 1;
        const scrap = scrapRobotRef.current;
        const done = scrapChallengesDoneRef.current;

        if (activePhase.concept === 'string-name') {
          const match = code.match(/String\s+name\s*=\s*"([^"]+)"/);
          if (match && match[1]) {
            const newName = match[1];
            localStorage.setItem('rb_robot_name', newName);
            robotNameRef.current = newName;
            setRobotName(newName);
            if (scrap) {
              scrap.root.remove(scrap.nameSprite);
              const newSprite = createNameSprite(newName, new THREE.Color(0x22c55e));
              scrap.nameSprite = newSprite;
              scrap.root.add(newSprite);
            }
          }
        }

        if (scrap) {
          const eyesOn = Math.min(1, done / 4);
          const eyeBright = Math.floor(0x22 + eyesOn * 0xdd) * 0x10000 + Math.floor(0xdd + eyesOn * 0x22) * 0x100;
          if (scrap.leftPupil) scrap.leftPupil.material.color.setHex(eyeBright);
          if (scrap.rightPupil) scrap.rightPupil.material.color.setHex(eyeBright);
          if (done >= 6 && scrap.antennaTip) scrap.antennaTip.material.color.setHex(0x22dd22);
          if (done >= 8) scrap.root.rotation.set(0, 0, 0);
          if (done >= 10 && scrap.antennaTip) scrap.antennaTip.material.color.setHex(0x44ff44);
        }

        if (nextPhase && nextPhase.kind === 'challenge') {
          setOutput(`✅ Nice! ${activePhase.title} complete.`);
          setSparkleBurst(false);
        } else {
          const currentStage = sparkyQuestStageRef.current;
          if (currentStage === 'unit2') {
            setOutput('✅ String Methods complete! Scrap\'s voice module is working. He needs a new part — buy it and bring it to the apartment.');
            setTutorialComplete(true);
            setShopUnlocked(true);
            updateQuestStage('unit2-done');
            if (outdoorSparkyRef.current) outdoorSparkyRef.current.root.visible = false;
            if (sparkyQuestMarkerRef.current) sparkyQuestMarkerRef.current.visible = false;
            if (apartmentSparkyRef.current) apartmentSparkyRef.current.root.visible = true;
            setSparkyModal('Scrap can speak! But his voice module is still glitchy. Earn $10 at the workshop, buy a Voice Module at the Parts Shop, then bring it to Sparky in the apartment.');
          } else {
            setOutput('✅ Variables & Data Types complete! Scrap\'s motor diagnostics are online. He needs a new sensor part — buy one at the shop and bring it to the apartment.');
            setTutorialComplete(true);
            setShopUnlocked(true);
            updateQuestStage('unit1-done');
            if (outdoorSparkyRef.current) outdoorSparkyRef.current.root.visible = false;
            if (sparkyQuestMarkerRef.current) sparkyQuestMarkerRef.current.visible = false;
            if (apartmentSparkyRef.current) apartmentSparkyRef.current.root.visible = true;
            setSparkyModal('Scrap\'s motor diagnostics are working! But his sensor is fried. Earn $5 at the workshop, buy a new Sensor at the Parts Shop, then bring it to Sparky in the apartment.');
          }
          setSparkleBurst(false);
          leaveApartmentRoom();
        }
      } else {
        setOutput(`❌ ${data.error || 'Almost there — try again!'}`);
      }
    } catch {
      setOutput('❌ Oops! Could not validate right now.');
    }
  };

  const leaveWorkshopRoom = () => {
    inWorkshopRoomRef.current = false;
    setInWorkshopRoom(false);
    workshopDoorArmedRef.current = false;
    roomObstacleHitboxesRef.current = [];
    workshopCustomersRef.current.forEach((npc) => {
      if (roomCustomerGroupRef.current) roomCustomerGroupRef.current.remove(npc.visual.root);
      disposeObject(npc.visual.root);
    });
    workshopCustomersRef.current = [];
    currentCustomerIdRef.current = null;
    interactionCandidateIdRef.current = null;
    interactionRequestedRef.current = false;
    worldInteractionRequestedRef.current = false;
    setActiveCustomer(null);
    setInteractionPromptName(null);
    setWorkshopCode('');
    setWorkshopOutput('');
    const outsideDoor = new THREE.Vector2(-7, -6);
    localPositionRef.current.copy(outsideDoor);
    if (localRobotRef.current) {
      localRobotRef.current.root.position.set(outsideDoor.x, outsideDoor.y, 0.24);
    }
    apiSync({ position: { x: outsideDoor.x, y: outsideDoor.y, rotation: null, room: 'outside' } });
  };

  const leaveArenaRoom = () => {
    setInArenaRoom(false);
    inArenaRoomRef.current = false;
    arenaDoorArmedRef.current = false;
    setArenaPlayers([]);
    setArenaChallenge(null);
    setArenaCode('');
    setArenaOutput('');
    setArenaBattleActive(false);
    fetch('/api/arena', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave' }) }).catch(() => {});
    const adp = new THREE.Vector2(18.75, -9.0);
    triggerEvent('client-player-join', { x: adp.x, y: adp.y, room: 'outside' });
    localPositionRef.current.copy(adp);
    if (localRobotRef.current) {
      localRobotRef.current.root.position.set(adp.x, adp.y, 0.24);
    }
    apiSync({ position: { x: adp.x, y: adp.y, rotation: null, room: 'outside' } });
  };

  const leaveApartmentRoom = () => {
    setInApartmentRoom(false);
    inApartmentRoomRef.current = false;
    apartmentDoorArmedRef.current = false;
    roomObstacleHitboxesRef.current = [];
    showTutorialRef.current = false;
    setShowTutorial(false);
    setTutorialStep(0);
    setCode('');
    setOutput('');
    setSuccess(false);
    const outsideDoor = new THREE.Vector2(-9.6, -5.5);
    localPositionRef.current.copy(outsideDoor);
    if (localRobotRef.current) {
      localRobotRef.current.root.position.set(outsideDoor.x, outsideDoor.y, 0.24);
    }
    apiSync({ position: { x: outsideDoor.x, y: outsideDoor.y, rotation: null, room: 'outside' } });
  };

  const runApartmentSparkyInteraction = useCallback(() => {
    const stage = sparkyQuestStageRef.current;
    if (stage === 'unit1' || stage === 'unit2') {
      showTutorialRef.current = true;
      setShowTutorial(true);
      setTutorialStep(0);
      setCode(tutorialPhasesRef.current[0].kind === 'dialogue' ? '' : tutorialPhasesRef.current[0].starterCode || '');
      setOutput('');
      setSuccess(false);
    } else if (stage === 'unit1-done' || stage === 'unit2-done' || stage === 'unit3-done') {
      const bp = gameStore.get('backpack');
      // Check battery first (cosmetic prerequisite)
      if (stage === 'unit1-done' && bp.includes('battery') && !batteryInstalledRef.current) {
        if (installBatteryPhaseRef.current) return;
        installBatteryPhaseRef.current = 'walk-to-scrap';
        installBatteryTimerRef.current = 0;
        setSparkyModal('Sparky takes the battery to Scrap...');
        return;
      }
      const partId = PART_FOR_STAGE[stage];
      const part = PARTS_CATALOG.find(p => p.id === partId);
      const owned = bp.includes(partId);
      if (owned) {
        if (sparkyInstallPhaseRef.current) return; // already installing
        const nextUnit: SparkyQuestStage = stage === 'unit1-done' ? 'unit2' : stage === 'unit2-done' ? 'unit3' : 'unit4';
        sparkyInstallPartIdRef.current = partId;
        sparkyInstallNextStageRef.current = nextUnit;
        sparkyInstallPhaseRef.current = 'walk-to-bench';
        sparkyInstallTimerRef.current = 0;
        setSparkyModal(`${part!.name} — Sparky walks to the workbench...`);
      } else {
        setSparkyModal(`Sparky needs a ${part!.name} for Scrap. You can buy one at the Parts Shop near the lake.`);
      }
    } else if (stage === 'unit3' || stage === 'unit4') {
      const unitLabel = stage === 'unit3' ? 'Unit 3 (coming soon)' : 'Unit 4 (coming soon)';
      setSparkyModal(`${unitLabel} isn't built yet! Check back later.`);
    } else if (stage === 'all-done') {
      setSparkyModal('Scrap is fully repaired! Arena mode is unlocked — go battle your friends!');
    }
  }, []);

  const challengePlayer = async (targetId: string, targetName: string) => {
    try {
      const res = await fetch('/api/arena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'challenge', opponentId: targetId }),
      });
      const data = await res.json();
      if (data.error) { setArenaOutput(`❌ ${data.error}`); return; }
      triggerEvent('client-arena-challenge', { targetId });
      setArenaOutput(`Challenge sent to ${targetName}!`);
    } catch {
      setArenaOutput('❌ Failed to send challenge.');
    }
  };

  const acceptChallenge = async (fromId: string) => {
    try {
      const res = await fetch('/api/arena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', opponentId: fromId }),
      });
      const data = await res.json();
      if (data.error) { setArenaOutput(`❌ ${data.error}`); return; }
      setArenaBattleActive(true);
      setArenaChallenge(null);
      setArenaOutput('Battle started! Write your code and submit.');
      triggerEvent('client-arena-accept', { challengeId: data.challenge?.id });
    } catch {
      setArenaOutput('❌ Failed to accept challenge.');
    }
  };

  const declineChallenge = () => {
    fetch('/api/arena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' }),
    }).catch(() => {});
    setArenaChallenge(null);
    setArenaOutput('Challenge declined.');
  };

  const submitArenaCode = async () => {
    if (!arenaCode.trim()) {
      setArenaOutput('Write some code first.');
      return;
    }
    try {
      const res = await fetch('/api/arena/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: arenaChallenge?.id, code: arenaCode }),
      });
      const data = await res.json();
      if (data.error) {
        setArenaOutput(`❌ ${data.error}`);
      } else {
        setArenaOutput(data.output || 'Code submitted!');
        if (data.winner) {
          setArenaOutput(`🏆 ${data.winner} wins!`);
          setArenaBattleActive(false);
        }
      }
    } catch {
      setArenaOutput('❌ Failed to submit code.');
    }
  };

  const runWorkshopCode = () => {
    if (!activeCustomer) {
      setWorkshopOutput('Get close to a customer and press Space to interact first.');
      return;
    }

    const selectedId = currentCustomerIdRef.current;
    const selectedNpc =
      selectedId === null ? undefined : workshopCustomersRef.current.find((npc) => npc.id === selectedId);
    if (!selectedNpc || selectedNpc.stage !== 'awaiting-code') {
      setWorkshopOutput('Talk to a customer first, then submit code for their specific request.');
      return;
    }

    const result = validateWorkshopCode(workshopCode, activeCustomer);
    if (!result.valid) {
      setWorkshopOutput(`❌ ${result.error}`);
      return;
    }

    if (!firstTransactionDoneRef.current) {
      firstTransactionDoneRef.current = true;
      setFirstTransactionDone(true);
      try { localStorage.setItem('rb_first_tx_done', '1'); } catch {}
      setShowRegisterModal(true);
    }
    const bonusNow = bonusTimerRef.current !== null
      ? Math.max(0, Math.round(5 * (1 - (performance.now() - bonusTimerRef.current) / 1000 / BONUS_DURATION)))
      : 0;
    lockedBonusRef.current = bonusNow;
    bonusTimerRef.current = null;
    setWorkshopOutput(`✅ Nice. ${activeCustomer.customerName} is walking to the register now — meet them there for $2${bonusNow > 0 ? ` (+$${bonusNow} speed bonus!)` : ''}.`);
    setWorkshopCode('');
    setActiveCustomer(null);
    (document.activeElement as HTMLElement)?.blur();
    workshopCustomersRef.current = workshopCustomersRef.current.map((npc) =>
      npc.id === selectedId ? { ...npc, stage: 'follow-to-counter' } : npc
    );
  };

  const finishWorkshopIntro = () => {
    interactionRequestedRef.current = false;
    workshopIntroSeenRef.current = true;
    setWorkshopIntroSeen(true);
    setWorkshopIntroStep(0);
    fetch('/api/profile/workshop-intro', { method: 'POST', keepalive: true }).catch(() => {});
  };

  const nextWorkshopIntroStep = () => {
    if (workshopIntroStep >= WORKSHOP_INTRO_STEPS.length - 1) {
      finishWorkshopIntro();
      return;
    }
    setWorkshopIntroStep((prev) => prev + 1);
  };

  const reopenWorkshopIntro = () => {
    setWorkshopIntroStep(0);
    workshopIntroSeenRef.current = false;
    setWorkshopIntroSeen(false);
    try { localStorage.removeItem('rb_ws_intro'); } catch {}
  };

  useEffect(() => {
    if (!showLaptopUI) return;
    const updateWidth = () => {
      const aspect = window.innerWidth / window.innerHeight;
      const vFov = 65 * Math.PI / 180;
      const dist = 0.35;
      const displayW = 0.50;
      const viewW = 2 * dist * Math.tan(vFov / 2) * aspect;
      const fraction = (displayW / viewW) * 0.92;
      setLaptopWindowCSS(`${(fraction * 100).toFixed(1)}vw`);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [showLaptopUI]);

  return (
    <div className="relative" suppressHydrationWarning>
      {showSparkyExamples && inWorkshopRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" onClick={() => setShowSparkyExamples(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-amber-200/50 shadow-2xl p-6 text-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="text-2xl font-bold text-amber-300 mb-4">Sparky's Code Examples</div>
            <div className="space-y-4 text-lg">
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
                <div className="text-emerald-300 font-semibold mb-1">Name (String)</div>
                <code className="text-slate-100">String name = "Bolt";</code>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
                <div className="text-emerald-300 font-semibold mb-1">Color (String)</div>
                <code className="text-slate-100">String color = "teal";</code>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
                <div className="text-emerald-300 font-semibold mb-1">Size (int)</div>
                <code className="text-slate-100">int age = 2;</code>
              </div>
            </div>
            <div className="mt-6 text-right">
              <button className="rounded bg-emerald-500 px-6 py-3 text-lg font-semibold text-white hover:bg-emerald-400" onClick={() => setShowSparkyExamples(false)}>Got it!</button>
            </div>
          </div>
        </div>
      )}

      {inWorkshopRoom && !workshopIntroSeen && profileLoadedRef.current && (() => {
        const cur = WORKSHOP_INTRO_STEPS[workshopIntroStep] ?? WORKSHOP_INTRO_STEPS[0];
        return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
          <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
          <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center"
            style={{ height: '30vh' }}>
            <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-8 8-8s8 4 8 8" />
                </svg>
                <span className="text-amber-300 font-bold text-xl tracking-wide">{cur.speaker}</span>
              </div>
              <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                {workshopIntroText}<span className="animate-pulse text-amber-400/80">▌</span>
              </p>
              <div className="flex justify-end mt-4">
                <button
                  className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none"
                  onClick={nextWorkshopIntroStep}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="14 7 9 12 14 17" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                    <line x1="3" y1="12" x2="5" y2="12" />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      <WorkshopPanel activeCustomer={activeCustomer} workshopCode={workshopCode} setWorkshopCode={setWorkshopCode} workshopOutput={workshopOutput} inWorkshopRoom={inWorkshopRoom} runWorkshopCode={runWorkshopCode} reopenWorkshopIntro={reopenWorkshopIntro} showSparkyExamples={() => setShowSparkyExamples(true)} bonusFraction={bonusFraction} bonusDuration={BONUS_DURATION} firstTransactionDone={firstTransactionDone} />

      <ArenaOverlay inArenaRoom={inArenaRoom} arenaPlayers={arenaPlayers} arenaChallenge={arenaChallenge} arenaCode={arenaCode} setArenaCode={setArenaCode} arenaOutput={arenaOutput} arenaBattleActive={arenaBattleActive} challengePlayer={challengePlayer} acceptChallenge={acceptChallenge} declineChallenge={declineChallenge} submitArenaCode={submitArenaCode} leaveArenaRoom={leaveArenaRoom} currentUserId={userId} />

      {roomEntryFlash && <div className="pointer-events-none fixed inset-0 z-[70] animate-pulse bg-cyan-200/35 backdrop-blur-[1px]" />}

      <div className="w-full h-screen" ref={mountRef} />

      <div className="fixed top-4 right-4 z-50 flex gap-3">
        <button onClick={() => setActiveModal('guilds')} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg hover:bg-black/70 transition-colors" title="Guilds">⚔️</button>
        <button onClick={() => setActiveModal('friends')} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg hover:bg-black/70 transition-colors" title="Friends">👥</button>
        <button onClick={() => setActiveModal('profile')} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg hover:bg-black/70 transition-colors" title="Profile">👤</button>
        <button onClick={() => setActiveModal('settings')} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg hover:bg-black/70 transition-colors" title="Settings">⚙️</button>
      </div>

      {interactionPromptName && (
        <div className="absolute bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-cyan-300/70 bg-slate-900/90 px-6 py-2 text-lg font-semibold text-cyan-100 shadow-xl">
          Press space to interact with {interactionPromptName}!
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-40 rounded-xl border border-emerald-300/50 bg-emerald-500/20 px-6 py-3 text-3xl font-black text-emerald-300 shadow-xl md:text-4xl">
        ${money}
      </div>

      <div className="absolute top-4 left-4 bg-black/45 text-white text-base md:text-lg px-4 py-2 rounded-full">
        {connected ? `🟢 Live island • ${Object.keys(players).length + 1} player${Object.keys(players).length + 1 !== 1 ? 's' : ''}` : '🟡 Connecting to island...'}
      </div>

      {debugMode && (
        <div className="absolute top-20 left-4 z-50 rounded-lg bg-black/60 px-3 py-2 text-xs font-mono text-emerald-300 space-y-0.5">
          <div>FPS: {debugDisplay.fps}</div>
          <div>X: {debugDisplay.x}</div>
          <div>Y: {debugDisplay.y}</div>
        </div>
      )}

      {showWasmHint && sparkyQuestStage === 'intro' && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-slate-400/40 text-sm animate-pulse">
          WASD / Arrow keys — move
        </div>
      )}

      {missionText && (
        <div className="absolute bottom-4 left-4 max-w-[min(90vw,32rem)] rounded-lg border border-amber-300/40 bg-slate-950/80 px-5 py-4 text-base md:text-lg text-amber-100 shadow-lg">
          <div className="font-semibold text-amber-300">Mission</div>
          <div className="mt-1">{missionText}</div>
        </div>
      )}

      {sparkyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" onClick={() => setSparkyModal(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-amber-200/50 shadow-2xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="text-4xl">🤖</div>
              <div className="flex-1">
                <h2 className="text-white text-2xl font-bold">Sparky</h2>
                <p className="mt-2 text-lg text-slate-100 whitespace-pre-line">{sparkyModal}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button className="rounded-lg bg-amber-500 px-6 py-3 text-lg font-semibold text-slate-900 hover:bg-amber-400" onClick={() => setSparkyModal(null)}>Got it!</button>
            </div>
          </div>
        </div>
      )}

      {/* Speech bubble + choices above Sparky (projected via ref) */}
      <div
        ref={speechBubbleRef}
        className="fixed z-50 pointer-events-none"
        style={{ display: 'none', left: 0, top: 0, transform: 'translate(-50%, -100%) translateY(-8px)' }}
      >
        <div className="relative pointer-events-auto">
          <div className="relative rounded-2xl border border-amber-400/50 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur-sm" style={{ width: '260px' }}>
            <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-amber-400/50 bg-slate-900/95" />
            <div className="flex items-start gap-2">
              <div className="text-2xl">🤖</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-amber-300">Sparky</div>
                <p className="mt-0.5 text-sm text-slate-100 leading-snug">{sparkyIntroStep >= 0 ? SPARKY_INTRO_CONVO[sparkyIntroStep].text : ''}</p>
              </div>
            </div>
          </div>
          {sparkyIntroStep >= 0 && (
            <>
              <div className="absolute flex flex-col gap-2" style={{ right: 'calc(100% + 8px)', top: 0 }}>
                {SPARKY_INTRO_CONVO[sparkyIntroStep].choices.filter((_, i) => i % 2 === 0).map((choice, idx) => (
                  <button
                    key={choice.label}
                    className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-slate-800/90 px-3 py-2 shadow-lg backdrop-blur-sm transition-colors hover:border-amber-400 hover:bg-slate-700/90 whitespace-nowrap"
                    onClick={() => {
                      if (choice.next === -1) { setSparkyIntroStep(-1); if (!sparkyHomeArrivedRef.current) { const __s = outdoorSparkyRef.current; if (__s) { const __sx = __s.root.position.x; const __sy = __s.root.position.y; sparkyHomeWaypointsRef.current = [new THREE.Vector2(__sx, -6.5), new THREE.Vector2(-9.6, -6.5), new THREE.Vector2(-9.6, -5.7)]; sparkyHomeWaypointIdxRef.current = 0; } sparkyWalkHomeTimerRef.current = 0; sparkyGoHomeRef.current = true; } }
                      else { setSparkyIntroStep(choice.next); }
                    }}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-900 shrink-0">
                      {idx * 2 + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-100">{choice.label}</span>
                  </button>
                ))}
              </div>
              <div className="absolute flex flex-col gap-2" style={{ left: 'calc(100% + 8px)', top: 0 }}>
                {SPARKY_INTRO_CONVO[sparkyIntroStep].choices.filter((_, i) => i % 2 === 1).map((choice, idx) => (
                  <button
                    key={choice.label}
                    className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-slate-800/90 px-3 py-2 shadow-lg backdrop-blur-sm transition-colors hover:border-amber-400 hover:bg-slate-700/90 whitespace-nowrap"
                    onClick={() => {
                      if (choice.next === -1) { setSparkyIntroStep(-1); if (!sparkyHomeArrivedRef.current) { const __s = outdoorSparkyRef.current; if (__s) { const __sx = __s.root.position.x; const __sy = __s.root.position.y; sparkyHomeWaypointsRef.current = [new THREE.Vector2(__sx, -6.5), new THREE.Vector2(-9.6, -6.5), new THREE.Vector2(-9.6, -5.7)]; sparkyHomeWaypointIdxRef.current = 0; } sparkyWalkHomeTimerRef.current = 0; sparkyGoHomeRef.current = true; } }
                      else { setSparkyIntroStep(choice.next); }
                    }}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-900 shrink-0">
                      {idx * 2 + 2}
                    </span>
                    <span className="text-xs font-semibold text-slate-100">{choice.label}</span>
                  </button>
                ))}
              </div>
              {sparkyIntroStep === 0 && (
                <p className="absolute text-center text-xs text-amber-400/70 whitespace-nowrap" style={{ left: '50%', transform: 'translateX(-50%)', top: 'calc(100% + 10px)' }}>
                  Press the number or click!
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {showTransportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" onClick={() => { setShowTransportModal(false); setTransportMessage(null); }}>
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-amber-200/50 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-amber-300 mb-4">Transporter Store</h2>
            {transportMessage ? (
              <div className="text-center py-6">
                <p className="text-lg text-slate-100">{transportMessage}</p>
                <button className="mt-6 rounded-lg bg-amber-500 px-8 py-3 text-lg font-semibold text-slate-900 hover:bg-amber-400" onClick={() => { setShowTransportModal(false); setTransportMessage(null); }}>OK</button>
              </div>
            ) : (
              <>
                <p className="text-slate-300 mb-6">Browse our fine selection of transportation!</p>
                <div className="flex gap-4">
                  <div className="flex-1 rounded-xl border border-slate-600 bg-slate-800/50 p-4 text-center cursor-pointer hover:border-amber-400/50 transition-colors" onClick={() => setTransportMessage('Coming soon!')}>
                    <div className="text-3xl mb-2">🚲</div>
                    <div className="text-lg font-semibold text-white">Bicycle</div>
                    <div className="text-amber-300 font-bold mt-1">$100</div>
                    <div className="text-xs text-slate-400 mt-2">Reliable two-wheeler</div>
                  </div>
                  <div className="flex-1 rounded-xl border border-slate-600 bg-slate-800/50 p-4 text-center cursor-pointer hover:border-amber-400/50 transition-colors" onClick={() => setTransportMessage('Coming soon!')}>
                    <div className="text-3xl mb-2">🚗</div>
                    <div className="text-lg font-semibold text-white">Car</div>
                    <div className="text-amber-300 font-bold mt-1">$1,000</div>
                    <div className="text-xs text-slate-400 mt-2">*breaks down quickly</div>
                  </div>
                </div>
                <button className="mt-6 w-full rounded-lg bg-slate-700 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-600 transition-colors" onClick={() => { setShowTransportModal(false); setTransportMessage(null); }}>Leave</button>
              </>
            )}
          </div>
        </div>
      )}
      {shopkeeperGreeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" onClick={() => setShopkeeperGreeting(null)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-200/50 shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">Shopkeeper</h2>
            <p className="text-lg text-slate-100 whitespace-pre-line">{shopkeeperGreeting}</p>
            <div className="mt-6 flex gap-3 justify-center">
              <button className="rounded-lg bg-amber-500 px-6 py-3 text-lg font-semibold text-slate-900 hover:bg-amber-400" onClick={() => { setShopkeeperGreeting(null); setShowShopModal(true); }}>Browse parts</button>
              <button className="rounded-lg bg-slate-700 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-600" onClick={() => setShopkeeperGreeting(null)}>Just looking</button>
            </div>
          </div>
        </div>
      )}
      {showShopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" onClick={() => setShowShopModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-amber-200/50 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-amber-300 mb-4">Spare Parts Shop</h2>
            <p className="text-slate-300 mb-6">Browse parts for Scrap!</p>
            <div className="flex flex-col gap-4">
              {PARTS_CATALOG.map((part) => {
                const stage = sparkyQuestStage;
                const partStage = part.questStage;
                const isUnlocked = stage === partStage || (
                  (partStage === 'unit1-done' && (stage === 'unit1-done' || stage === 'unit2' || stage === 'unit2-done' || stage === 'unit3' || stage === 'unit3-done' || stage === 'unit4' || stage === 'all-done')) ||
                  (partStage === 'unit2-done' && (stage === 'unit2-done' || stage === 'unit3' || stage === 'unit3-done' || stage === 'unit4' || stage === 'all-done')) ||
                  (partStage === 'unit3-done' && (stage === 'unit3-done' || stage === 'unit4' || stage === 'all-done'))
                );
                const owned = backpack.includes(part.id);
                if (!isUnlocked) return null;
                return (
                  <div key={part.id} className={`rounded-xl border p-4 ${owned ? 'border-green-500/50 bg-green-900/20' : 'border-slate-600 bg-slate-800/50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{part.name}</div>
                        <div className="text-sm text-slate-400">{part.description}</div>
                      </div>
                      <div className="text-right">
                        {owned ? (
                          <span className="text-green-400 font-bold">Owned ✓</span>
                        ) : (
                          <>
                            <div className="text-amber-300 font-bold">${part.cost}</div>
                            <button
                              className={`mt-2 rounded-lg px-4 py-2 text-sm font-semibold ${money >= part.cost ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}
                              disabled={money < part.cost}
                              onClick={() => {
                                if (money < part.cost) return;
                                const newBackpack = [...gameStore.get('backpack'), part.id];
                                const newMoney = money - part.cost;
                                updateMoney(newMoney);
                                updateBackpack(newBackpack);
                                setShowShopModal(false);
                              }}
                            >
                              {money >= part.cost ? 'Buy' : `Need $${part.cost - money} more`}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 text-sm text-slate-400">Money: ${money}</div>
            <button className="mt-4 w-full rounded-lg bg-slate-700 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-600 transition-colors" onClick={() => setShowShopModal(false)}>Leave</button>
          </div>
        </div>
      )}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" onClick={() => setShowRegisterModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-200/50 shadow-2xl p-6 text-center">
            <div className="text-5xl mb-4">🪙</div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">Go to the register to make $2</h2>
            <p className="text-slate-300 mb-6">Lead the customer to the counter to collect your payment!</p>
            <button className="rounded-lg bg-amber-500 px-8 py-3 text-lg font-semibold text-slate-900 hover:bg-amber-400" onClick={() => setShowRegisterModal(false)}>Got it!</button>
          </div>
        </div>
      )}

      {showControlsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4" onClick={() => setShowControlsModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-cyan-300/50 shadow-2xl p-8 text-slate-100">
            <h2 className="text-xl font-bold text-cyan-300 mb-6 text-center">How to play</h2>
            <div className="flex justify-center gap-8 mb-6">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400 mb-2">Arrow Keys</span>
                <div className="grid grid-cols-3 gap-1">
                  <div />
                  <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-500 bg-slate-800 text-sm">↑</div>
                  <div />
                  <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-500 bg-slate-800 text-sm">←</div>
                  <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-500 bg-slate-800 text-sm">↓</div>
                  <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-500 bg-slate-800 text-sm">→</div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400 mb-2">WASD</span>
                <div className="grid grid-cols-3 gap-1">
                  <div />
                  <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-500 bg-slate-800 text-sm font-bold">W</div>
                  <div />
                  <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-500 bg-slate-800 text-sm font-bold">A</div>
                  <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-500 bg-slate-800 text-sm font-bold">S</div>
                  <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-500 bg-slate-800 text-sm font-bold">D</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 mb-6 animate-fade-in">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-300 animate-slide-x">
                <path d="M12 2a7 7 0 0 0-7 7v6a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7z"/>
                <path d="M12 12V9"/>
              </svg>
              <p className="text-slate-200 text-sm">Move your mouse to look around</p>
            </div>
            <div className="flex justify-center">
              <button className="rounded-lg bg-cyan-500 px-8 py-3 text-lg font-semibold text-slate-900 hover:bg-cyan-400" onClick={() => {
                setShowControlsModal(false);
              }}>Got it!</button>
            </div>
          </div>
        </div>
      )}

      {showBatteryDlg && (() => {
        const cur = BATTERY_DLG_STEPS[batteryDlgStep] ?? BATTERY_DLG_STEPS[0];
        return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
          <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
          <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center"
            style={{ height: '30vh' }}>
            <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <circle cx="12" cy="5" r="2" />
                  <path d="M12 7v4" />
                  <line x1="8" y1="16" x2="8" y2="16" />
                  <line x1="16" y1="16" x2="16" y2="16" />
                </svg>
                <span className="text-amber-300 font-bold text-xl tracking-wide">{cur.speaker}</span>
              </div>
              <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                {batteryDlgText}<span className="animate-pulse text-amber-400/80">▌</span>
              </p>
              <div className="flex justify-end mt-4">
                <button
                  className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none"
                  onClick={() => {
                    const nextStep = batteryDlgStep + 1;
                    if (nextStep < BATTERY_DLG_STEPS.length) {
                      setBatteryDlgStep(nextStep);
                    } else {
                      const bp = gameStore.get('backpack');
                      if (!bp.includes('letter' as ScrapPartId)) {
                        const newBackpack: ScrapPartId[] = [...bp, 'letter'];
                        gameStore.set('backpack', newBackpack);
                        apiSync({ backpack: newBackpack });
                        lastConfirmedBackpackRef.current = newBackpack;
                      }
                      setShowBatteryDlg(false);
                      aptCutscenePhaseRef.current = 'done';
                      aptCutsceneTimerRef.current = 0;
                    }
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="14 7 9 12 14 17" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                    <line x1="3" y1="12" x2="5" y2="12" />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {showWhoDlg && (() => {
        return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
          <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
          <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center"
            style={{ height: '30vh' }}>
            <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-8 8-8s8 4 8 8" />
                </svg>
                <span className="text-amber-300 font-bold text-xl tracking-wide">Rafiq</span>
              </div>
              <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                {whoText}<span className="animate-pulse text-amber-400/80">▌</span>
              </p>
              <div className="flex justify-end mt-4">
                <button
                  className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none"
                  onClick={() => setShowWhoDlg(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="14 7 9 12 14 17" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                    <line x1="3" y1="12" x2="5" y2="12" />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {showRafiqLetterDlg && (() => {
        const cur = RAFIQ_LETTER_STEPS[rafiqLetterStep] ?? RAFIQ_LETTER_STEPS[0];
        return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
          <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
          <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center"
            style={{ height: '30vh' }}>
            <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-8 8-8s8 4 8 8" />
                </svg>
                <span className="text-amber-300 font-bold text-xl tracking-wide">{cur.speaker}</span>
              </div>
              <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                {rafiqLetterText}<span className="animate-pulse text-amber-400/80">▌</span>
              </p>
              <div className="flex justify-end mt-4">
                <button
                  className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none"
                  onClick={() => {
                    const nextStep = rafiqLetterStep + 1;
                    if (nextStep < RAFIQ_LETTER_STEPS.length) {
                      setRafiqLetterStep(nextStep);
                    } else {
                      setShowRafiqLetterDlg(false);
                      reopenWorkshopIntro();
                    }
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="14 7 9 12 14 17" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                    <line x1="3" y1="12" x2="5" y2="12" />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {showElectrocuteDlg && (() => {
        const cur = cutsceneDlgSteps[electrocuteStep] ?? cutsceneDlgSteps[0];
        return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
          <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
          <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center"
            style={{ height: '30vh' }}>
            <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 mb-2">
                {cur.speaker === 'Sparky' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8" y2="16" />
                    <line x1="16" y1="16" x2="16" y2="16" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-8 8-8s8 4 8 8" />
                  </svg>
                )}
                <span className="text-amber-300 font-bold text-xl tracking-wide">{cur.speaker}</span>
              </div>
              <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                {electrocuteText}<span className="animate-pulse text-amber-400/80">▌</span>
              </p>
              <div className="flex justify-end mt-4">
                <button
                  className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none"
                  onClick={() => {
                    const nextStep = electrocuteStep + 1;
                    if (nextStep < cutsceneDlgSteps.length) {
                      setElectrocuteStep(nextStep);
                    } else {
                      setShowElectrocuteDlg(false);
                      electrocuteDlgShownRef.current = false;
                      aptCutscenePhaseRef.current = 'walk-to-laptop';
                      aptCutsceneTimerRef.current = 0;
                    }
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="14 7 9 12 14 17" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                    <line x1="3" y1="12" x2="5" y2="12" />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {showStringDlg && (() => {
        const cur = stringDlgSteps[stringDlgStep] ?? stringDlgSteps[0];
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
            <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
            <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center"
              style={{ height: '30vh' }}>
              <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8" y2="16" />
                    <line x1="16" y1="16" x2="16" y2="16" />
                  </svg>
                  <span className="text-amber-300 font-bold text-xl tracking-wide">Sparky</span>
                </div>
                <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                  {stringDlgText.split(/(`[^`]+`)/).map((seg, i) =>
                    seg.startsWith('`') && seg.endsWith('`')
                      ? <code key={i} className="font-mono text-amber-300 bg-slate-800 px-1.5 rounded">{seg.slice(1, -1)}</code>
                      : seg
                  )}<span className="animate-pulse text-amber-400/80">▌</span>
                </p>
                <div className="flex justify-end mt-4">
                  <button
                    className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none"
                    onClick={() => {
                      const nextStep = stringDlgStep + 1;
                      if (nextStep < stringDlgSteps.length) {
                        setStringDlgStep(nextStep);
                      } else {
                        setShowStringDlg(false);
                        if (stringDlgIsHelpRef.current) {
                          stringDlgIsHelpRef.current = false;
                          setShowLaptopUI(true);
                        } else {
                          aptCutscenePhaseRef.current = 'laptop-ui';
                          aptCutsceneTimerRef.current = 0;
                        }
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="14 7 9 12 14 17" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                      <line x1="3" y1="12" x2="5" y2="12" />
                    </svg>
                    <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showDateDlg && (() => {
        const steps = stringDlgIsHelpRef.current ? dateHelpSteps : dateDlgSteps;
        const cur = steps[dateDlgStep] ?? steps[0];
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
            <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
            <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center"
              style={{ height: '30vh' }}>
              <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8" y2="16" />
                    <line x1="16" y1="16" x2="16" y2="16" />
                  </svg>
                  <span className="text-amber-300 font-bold text-xl tracking-wide">Sparky</span>
                </div>
                <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                  {dateDlgText.split(/(`[^`]+`)/).map((seg, i) =>
                    seg.startsWith('`') && seg.endsWith('`')
                      ? <code key={i} className="font-mono text-amber-300 bg-slate-800 px-1.5 rounded">{seg.slice(1, -1)}</code>
                      : seg
                  )}<span className="animate-pulse text-amber-400/80">▌</span>
                </p>
                <div className="flex justify-end mt-4">
                  <button
                    className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none"
                    onClick={() => {
                      const nextStep = dateDlgStep + 1;
                      if (nextStep < steps.length) {
                        setDateDlgStep(nextStep);
                      } else {
                        setShowDateDlg(false);
                        if (stringDlgIsHelpRef.current) {
                          stringDlgIsHelpRef.current = false;
                          setShowLaptopUI(true);
                        } else {
                          dateCodingShownRef.current = false;
                          aptCutscenePhaseRef.current = 'date-coding';
                          aptCutsceneTimerRef.current = 0;
                        }
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="14 7 9 12 14 17" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                      <line x1="3" y1="12" x2="5" y2="12" />
                    </svg>
                    <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showVersionDlg && (() => {
        const steps = stringDlgIsHelpRef.current ? versionHelpSteps : versionDlgSteps;
        const cur = steps[versionDlgStep] ?? steps[0];
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
            <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
            <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center"
              style={{ height: '30vh' }}>
              <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8" y2="16" />
                    <line x1="16" y1="16" x2="16" y2="16" />
                  </svg>
                  <span className="text-amber-300 font-bold text-xl tracking-wide">Sparky</span>
                </div>
                <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                  {versionDlgText.split(/(`[^`]+`)/).map((seg, i) =>
                    seg.startsWith('`') && seg.endsWith('`')
                      ? <code key={i} className="font-mono text-amber-300 bg-slate-800 px-1.5 rounded">{seg.slice(1, -1)}</code>
                      : seg
                  )}<span className="animate-pulse text-amber-400/80">▌</span>
                </p>
                {!stringDlgIsHelpRef.current && versionDlgStep === 1 && (
                  <button
                    className="mt-2 text-sm text-amber-400/80 underline underline-offset-2 hover:text-amber-300 transition-colors"
                    onClick={() => setShowDecimalExplain(true)}
                  >
                    (What is a decimal?)
                  </button>
                )}
                <div className="flex justify-end mt-4">
                  <button
                    className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none"
                    onClick={() => {
                      const nextStep = versionDlgStep + 1;
                      if (nextStep < steps.length) {
                        setVersionDlgStep(nextStep);
                      } else {
                        setShowVersionDlg(false);
                        if (stringDlgIsHelpRef.current) {
                          stringDlgIsHelpRef.current = false;
                          setShowLaptopUI(true);
                        } else {
                          versionCodingShownRef.current = false;
                          aptCutscenePhaseRef.current = 'version-coding';
                          aptCutsceneTimerRef.current = 0;
                        }
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="14 7 9 12 14 17" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                      <line x1="3" y1="12" x2="5" y2="12" />
                    </svg>
                    <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showBootDlg && (() => {
        const steps = stringDlgIsHelpRef.current ? bootHelpSteps : bootDlgSteps;
        const cur = steps[bootDlgStep] ?? steps[0];
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
            <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
            <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center"
              style={{ height: '30vh' }}>
              <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8" y2="16" />
                    <line x1="16" y1="16" x2="16" y2="16" />
                  </svg>
                  <span className="text-amber-300 font-bold text-xl tracking-wide">Sparky</span>
                </div>
                <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                  {bootDlgText.split(/(`[^`]+`)/).map((seg, i) =>
                    seg.startsWith('`') && seg.endsWith('`')
                      ? <code key={i} className="font-mono text-amber-300 bg-slate-800 px-1.5 rounded">{seg.slice(1, -1)}</code>
                      : seg
                  )}<span className="animate-pulse text-amber-400/80">▌</span>
                </p>
                <div className="flex justify-end mt-4">
                  <button
                    className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none"
                    onClick={() => {
                      const nextStep = bootDlgStep + 1;
                      if (nextStep < steps.length) {
                        setBootDlgStep(nextStep);
                      } else {
                        setShowBootDlg(false);
                        if (stringDlgIsHelpRef.current) {
                          stringDlgIsHelpRef.current = false;
                          setShowLaptopUI(true);
                        } else {
                          bootCodingShownRef.current = false;
                          aptCutscenePhaseRef.current = 'boot-coding';
                          aptCutsceneTimerRef.current = 0;
                        }
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="14 7 9 12 14 17" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                      <line x1="3" y1="12" x2="5" y2="12" />
                    </svg>
                    <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showLaptopUI && (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden pointer-events-auto select-none" style={{ width: laptopWindowCSS, maxWidth: '100vw' }}>
            {/* Title bar */}
            <div className="flex items-center gap-2 bg-slate-800 px-4 py-3 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-slate-400 text-sm font-medium ml-2">{laptopMode === 'date' ? 'Enter today\'s date:' : laptopMode === 'version' ? 'Update bot firmware' : laptopMode === 'boot' ? 'Boot sequence' : 'Enter a name:'}</span>
            </div>
            {/* Code editor */}
            <div className="p-4">
              {laptopMode === 'version' && (
                <p className="text-slate-300 text-sm mb-2">Declare a <code className="font-mono text-amber-300 bg-slate-800 px-1 rounded">double</code> called <code className="font-mono text-amber-300 bg-slate-800 px-1 rounded">version</code> set to <code className="font-mono text-amber-300 bg-slate-800 px-1 rounded">1.0</code>, then a <code className="font-mono text-amber-300 bg-slate-800 px-1 rounded">String</code> called <code className="font-mono text-amber-300 bg-slate-800 px-1 rounded">mode</code> set to a word meaning 'properly working'.</p>
              )}
              {laptopMode === 'boot' && (
                <p className="text-slate-300 text-sm mb-2">Declare a <code className="font-mono text-amber-300 bg-slate-800 px-1 rounded">boolean</code> called <code className="font-mono text-amber-300 bg-slate-800 px-1 rounded">ready</code> set to <code className="font-mono text-amber-300 bg-slate-800 px-1 rounded">true</code>.</p>
              )}
              <textarea
                className="w-full bg-slate-950 text-amber-300 font-mono text-sm p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-500/60 resize-none"
                rows={laptopMode === 'date' ? 4 : laptopMode === 'version' ? 4 : laptopMode === 'boot' ? 2 : 3}
                value={laptopCode}
                onChange={(e) => { setLaptopCode(e.target.value); setLaptopOutput(''); setLaptopSuccess(false); setShowSemicolonArrow(false); }}
                autoFocus
              />
              {showSemicolonArrow && (
                <div className="flex justify-center mt-2">
                  <span className="text-red-400 text-2xl animate-bounce">⬆</span>
                  <span className="text-red-400 text-sm font-bold ml-1.5">Forgot a ; here</span>
                </div>
              )}
              {laptopMode === 'date' && (
                <div className="sticky bottom-0 mt-2 text-xs bg-slate-800/90 rounded-lg border border-slate-700/50 overflow-hidden">
                  <div className="grid grid-cols-2 gap-x-4 p-2 leading-relaxed">
                    <div className="text-slate-400">January</div><div className="text-amber-300 font-mono text-right">0</div>
                    <div className="text-slate-400">February</div><div className="text-amber-300 font-mono text-right">1</div>
                    <div className="text-slate-400">March</div><div className="text-amber-300 font-mono text-right">2</div>
                    <div className="text-slate-400">April</div><div className="text-amber-300 font-mono text-right">3</div>
                    <div className="text-slate-400">May</div><div className="text-amber-300 font-mono text-right">4</div>
                    <div className="text-slate-400 font-semibold text-white">June</div><div className="text-amber-300 font-mono text-right font-semibold text-amber-200">5</div>
                    <div className="text-slate-400">July</div><div className="text-amber-300 font-mono text-right">6</div>
                    <div className="text-slate-400">August</div><div className="text-amber-300 font-mono text-right">7</div>
                    <div className="text-slate-400">September</div><div className="text-amber-300 font-mono text-right">8</div>
                    <div className="text-slate-400">October</div><div className="text-amber-300 font-mono text-right">9</div>
                    <div className="text-slate-400">November</div><div className="text-amber-300 font-mono text-right">10</div>
                    <div className="text-slate-400">December</div><div className="text-amber-300 font-mono text-right">11</div>
                  </div>
                </div>
              )}
              {laptopMode === 'version' && (
                <div className="mt-2 text-xs bg-slate-800/90 rounded-lg border border-slate-700/50 p-2 space-y-1">
                  <div className="text-slate-400"><span className="text-amber-300 font-mono">double</span> — decimal numbers like <span className="text-amber-300 font-mono">1.0</span></div>
                  <div className="text-slate-400"><span className="text-amber-300 font-mono">String</span> — text in double quotes like <span className="text-amber-300 font-mono">"normal"</span></div>
                  <div className="text-slate-400">Each on its own line, ending with <span className="text-amber-300 font-mono">;</span></div>
                </div>
              )}
              {laptopMode === 'boot' && (
                <div className="mt-2 text-xs bg-slate-800/90 rounded-lg border border-slate-700/50 p-2">
                  <div className="text-slate-400"><span className="text-amber-300 font-mono">boolean</span> — only <span className="text-amber-300 font-mono">true</span> or <span className="text-amber-300 font-mono">false</span>, like an on/off switch</div>
                </div>
              )}
              {/* Output */}
              {laptopOutput && (
                <div className={`mt-3 p-3 rounded-lg text-base font-medium ${laptopSuccess ? 'bg-green-900/40 text-green-300 border border-green-700/50' : 'bg-red-900/40 text-red-300 border border-red-700/50'}`}>
                  {laptopOutput}
                </div>
              )}
              {/* Buttons */}
              <div className="flex justify-end mt-4">
                <button
                  className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition-colors ${laptopSuccess ? 'bg-green-600 text-white cursor-default' : 'bg-amber-500 text-slate-900 hover:bg-amber-400'}`}
                  onClick={laptopSuccess ? undefined : handleLaptopRun}
                  disabled={laptopSuccess}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {laptopSuccess ? 'Done!' : 'Run'}
                </button>
              </div>
            </div>
          </div>
        </div>
        <button
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl border-2 border-amber-400/70 bg-gradient-to-r from-amber-500 to-orange-500 px-12 py-5 text-2xl font-bold text-white shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-orange-400 hover:shadow-amber-400/40 transition-all"
          onClick={() => {
            setShowLaptopUI(false);
            stringDlgIsHelpRef.current = true;
            if (laptopMode === 'date') {
              setShowDateDlg(true);
              setDateDlgStep(0);
            } else if (laptopMode === 'version') {
              setShowVersionDlg(true);
              setVersionDlgStep(0);
            } else if (laptopMode === 'boot') {
              setShowBootDlg(true);
              setBootDlgStep(0);
            } else {
              setShowStringDlg(true);
              setStringDlgStep(0);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Need help?
        </button>
        </>
      )}

      {backpack.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
          {backpack.slice(0, 9).map((partId, i) => {
            const isHeld = heldSlotIndex === i;
            return (
              <div key={`${partId}-${i}`} className={`relative w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all cursor-default ${
                isHeld ? 'border-amber-400 bg-amber-900/40 shadow-lg shadow-amber-500/20' : 'border-slate-600 bg-slate-900/80'
              }`}>
                <img src={createPartIcon(partId)} alt={partId} className="w-10 h-10" draggable={false} />
                <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-slate-700 text-[9px] text-slate-300 flex items-center justify-center font-mono border border-slate-500">{i + 1}</span>
              </div>
            );
          })}
          {backpack.length > 9 && (
            <div className="w-12 h-12 rounded-lg border-2 border-slate-600 bg-slate-900/80 flex items-center justify-center text-slate-500 text-sm">...</div>
          )}
        </div>
      )}

      <TutorialOverlay showTutorial={showTutorial} tutorialStep={tutorialStep} setTutorialStep={setTutorialStep} code={code} setCode={setCode} highlightedCode={highlightedCode} output={output} setOutput={setOutput} success={success} setSuccess={setSuccess} sparkleBurst={sparkleBurst} codeInputRef={codeInputRef} codePreviewRef={codePreviewRef} onEditorScroll={onEditorScroll} checkAnswer={checkAnswer} setShowTutorial={setShowTutorial} tutorialPhases={tutorialPhases} />

      {activeModal && <ModalShell activeModal={activeModal} setActiveModal={setActiveModal} userId={userId} debugMode={debugMode} setDebugMode={setDebugMode} />}

      {showDecimalExplain && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm select-none" onClick={() => setShowDecimalExplain(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📐</span>
                <span className="text-lg font-bold text-slate-100">What is a decimal?</span>
              </div>
              <button className="text-slate-500 hover:text-slate-300 transition-colors" onClick={() => setShowDecimalExplain(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Pie visual */}
              <div className="flex items-center gap-5">
                <div className="w-24 h-24 rounded-full" style={{ background: 'conic-gradient(#f59e0b 0deg 180deg, #334155 180deg 360deg)' }} />
                <div className="text-sm text-slate-300 leading-relaxed">
                  <div>A whole pie = <span className="text-amber-300 font-mono font-bold">1</span></div>
                  <div>Cut in half → each piece = <span className="text-amber-300 font-mono font-bold">0.5</span></div>
                  <div className="text-slate-500 text-xs mt-1">That's one half, or <span className="font-mono">½</span></div>
                </div>
              </div>
              {/* Fraction → Decimal table */}
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-medium">Fraction → Decimal</div>
                <div className="grid grid-cols-4 gap-2 text-sm font-mono">
                  <div className="bg-slate-800 rounded-lg px-3 py-2 text-center"><span className="text-amber-300">½</span> <span className="text-slate-500 mx-1">=</span> <span className="text-emerald-300">0.5</span></div>
                  <div className="bg-slate-800 rounded-lg px-3 py-2 text-center"><span className="text-amber-300">¼</span> <span className="text-slate-500 mx-1">=</span> <span className="text-emerald-300">0.25</span></div>
                  <div className="bg-slate-800 rounded-lg px-3 py-2 text-center"><span className="text-amber-300">¾</span> <span className="text-slate-500 mx-1">=</span> <span className="text-emerald-300">0.75</span></div>
                  <div className="bg-slate-800 rounded-lg px-3 py-2 text-center"><span className="text-amber-300">⅓</span> <span className="text-slate-500 mx-1">≈</span> <span className="text-emerald-300">0.33</span></div>
                </div>
              </div>
              {/* Explanation */}
              <div className="text-sm text-slate-300 leading-relaxed space-y-1 bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700/50">
                <div><span className="text-sky-300 font-semibold">Integers</span> = whole numbers <span className="text-slate-500 font-mono">(1, 2, 10)</span></div>
                <div><span className="text-sky-300 font-semibold">Decimals</span> = numbers with a dot <span className="text-slate-500 font-mono">(0.5, 1.0, 3.14)</span></div>
                <div className="text-amber-300 font-medium mt-1">In Java: use <code className="font-mono bg-slate-800 px-1.5 rounded">double</code> for decimals!</div>
              </div>
            </div>
            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-slate-700 bg-slate-800/50">
              <button
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-slate-900 hover:bg-amber-400 transition-colors"
                onClick={() => setShowDecimalExplain(false)}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
