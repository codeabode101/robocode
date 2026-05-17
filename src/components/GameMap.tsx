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
  createToonMaterial, createTexturedToonMaterial, createCharacterSprite, createPlayerSprite,
  createGrid, createPalmTree, createBazaarShop, createRangoli, addWindows, addOutline, applyShadows, disposeObject,
  createBigPetShop, createRobotVisual, createHumanVisual, animateRobotVisual, LABEL_BUILD_TAG, WALK_BOB_SPEED,
  addExclamationMarker,
} from '@/components/game/scene';
import { pickRandom, hashColor, getWorkshopRequestSignature, validateWorkshopCode } from '@/components/game/helpers';
import { unit1Phases, unit2Phases } from '@/components/game/tutorialData';
import { SCRAP_PART_COSTS } from '@/components/game/types';

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
    { x: -6.87, y: -6.2 }, { x: -6.87, y: -7.5 }, { x: -6.87, y: -6.2 },
  ];
const PLAYER_RADIUS = 0.48;
const MOVE_SPEED = 7.4;
const NETWORK_SYNC_MS = 50;
const NPC_POSITION = new THREE.Vector2(-6.87, -6.2);
const REMOTE_LERP = 0.35;
const PLAYER_EYE_HEIGHT = 1.5;
const ROOM_SPAWN = new THREE.Vector2(0, -3.7);
const ARENA_ROOM_SPAWN = new THREE.Vector2(0, 3.7);
const ROOM_OWNER_POS = new THREE.Vector2(2.35, 1.95);
const ROOM_COUNTER_POS = new THREE.Vector2(2.35, 2.25);
const CUSTOMER_TALK_DISTANCE = 1.25;
const REGISTER_ZONE_RADIUS = 2.1;
const REGISTER_NPC_RADIUS = 1.35;
const ROOM_CUSTOMER_EXIT_POS = new THREE.Vector2(-5.35, -4.55);
const REMOTE_SPRITES = [
  '/kenney-topdown/PNG/Man Brown/manBrown_stand.png',
  '/kenney-topdown/PNG/Man Blue/manBlue_stand.png',
  '/kenney-topdown/PNG/Woman Green/womanGreen_stand.png',
  '/kenney-topdown/PNG/Survivor 1/survivor1_stand.png',
  '/kenney-topdown/PNG/Hitman 1/hitman1_stand.png',
  '/kenney-topdown/PNG/Soldier 1/soldier1_stand.png',
  '/kenney-topdown/PNG/Man Old/manOld_stand.png',
];
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
const WORKSHOP_INTRO_PAGES = [
  {
    title: "Welcome to Rafiq's Workshop",
    body: 'Customers browse robo-pets here. Walk up to one and press Space to start a job.',
  },
  {
    title: 'Do the Java task',
    body: 'Each customer asks for different properties (name, color, size). Write code that matches exactly.',
  },
  {
    title: 'Get paid at register',
    body: 'After correct code, they follow you. Lead them to the register to collect your money.',
  },
] as const;

type CircleHitbox = {
  shape: 'circle';
  center: THREE.Vector2;
  radius: number;
};

type BoxHitbox = {
  shape: 'box';
  center: THREE.Vector2;
  halfWidth: number;
  halfHeight: number;
};

type Hitbox = CircleHitbox | BoxHitbox;

function isInsideHitbox(point: THREE.Vector2, hitbox: Hitbox) {
  if (hitbox.shape === 'circle') {
    return point.distanceTo(hitbox.center) <= hitbox.radius;
  }
  const dx = Math.abs(point.x - hitbox.center.x);
  const dy = Math.abs(point.y - hitbox.center.y);
  return dx <= hitbox.halfWidth && dy <= hitbox.halfHeight;
}

function collidesWithAny(point: THREE.Vector2, hitboxes: Hitbox[]) {
  return hitboxes.some((hitbox) => isInsideHitbox(point, hitbox));
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function highlightJava(input: string) {
  const tokenPattern =
    /"(?:[^"\\\n]|\\.)*"|\b(String|int|double|boolean|char|float|long|short|byte)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b(?=\s*=)/g;
  let output = '';
  let lastIndex = 0;

  for (const match of input.matchAll(tokenPattern)) {
    const value = match[0];
    const index = match.index ?? 0;
    output += escapeHtml(input.slice(lastIndex, index));

    if (value.startsWith('"')) {
      output += `<span style="color:#f59e0b">${escapeHtml(value)}</span>`;
    } else if (match[1]) {
      output += `<span style="color:#60a5fa">${escapeHtml(value)}</span>`;
    } else {
      output += `<span style="color:#a78bfa">${escapeHtml(value)}</span>`;
    }

    lastIndex = index + value.length;
  }

  output += escapeHtml(input.slice(lastIndex));
  return output;
}

type ArenaPlayer = {
  id: string;
  name: string;
};

  type RemoteAvatar = {
    visual: RobotVisual;
    target: THREE.Vector2;
    name: string;
    walkTime: number;
    room: string;
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
  const { players, connected, sendPosition, triggerEvent } = mp;

  const localPositionRef = useRef(new THREE.Vector2(0, 0));
  const localRobotRef = useRef<RobotVisual | null>(null);
  const remoteAvatarsRef = useRef<Record<string, RemoteAvatar>>({});
  const keyStateRef = useRef<Set<string>>(new Set());
  const tutorialPhasesRef = useRef<TutorialPhase[]>(unit1Phases);
  const showTutorialRef = useRef(false);
  const tutorialCompleteRef = useRef(false);
  const shopUnlockedRef = useRef(false);
  const inWorkshopRoomRef = useRef(false);
  const inArenaRoomRef = useRef(false);
  const sendAtRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const petShopRef = useRef<THREE.Group | null>(null);

  const outdoorGroupRef = useRef<THREE.Group | null>(null);
  const workshopRoomGroupRef = useRef<THREE.Group | null>(null);
    const yawRef = useRef(0);
    const obstacleHitboxesRef = useRef<Hitbox[]>([]);
  const roomObstacleHitboxesRef = useRef<Hitbox[]>([]);
  const workshopDoorHitboxRef = useRef<CircleHitbox | null>(null);
  const workshopDoorArmedRef = useRef(true);
  const workshopCustomersRef = useRef<CustomerNpc[]>([]);
  const miniRobotRefs = useRef<RobotVisual[]>([]);
  const lastWorkshopRequestSigRef = useRef<string | null>(null);
  const customerSpawnTimerRef = useRef(0);
  const currentCustomerIdRef = useRef<string | null>(null);
  const interactionRequestedRef = useRef(false);
  const worldInteractionRequestedRef = useRef(false);
  const interactionCandidateIdRef = useRef<string | null>(null);
  const roomOwnerVisualRef = useRef<RobotVisual | null>(null);
  const roomPetVisualRef = useRef<RobotVisual | null>(null);
  const roomCustomerGroupRef = useRef<THREE.Group | null>(null);
  const roomEntryFlashTimeoutRef = useRef<number | null>(null);
  const scrapRobotRef = useRef<ReturnType<typeof createRobotVisual> | null>(null);
  const scrapChallengesDoneRef = useRef(0);
  const sparkyQuestMarkerRef = useRef<THREE.Sprite | null>(null);
  const workshopDoorMarkerRef = useRef<THREE.Sprite | null>(null);
  const transportHitboxRef = useRef<CircleHitbox | null>(null);
  const arenaBuildingRef = useRef<THREE.Group | null>(null);
  const arenaRoomGroupRef = useRef<THREE.Group | null>(null);
  const arenaDoorHitboxRef = useRef<CircleHitbox | null>(null);
  const arenaDoorArmedRef = useRef(true);
  const sparkyPathIndexRef = useRef(0);
  const sparkyWaitTimerRef = useRef(0);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [code, setCode] = useState('String petName = "Milo";');
  const [output, setOutput] = useState('');
  const [success, setSuccess] = useState(false);
  const [sparkleBurst, setSparkleBurst] = useState(false);
  const [tutorialComplete, setTutorialComplete] = useState(false);
  const [shopUnlocked, setShopUnlocked] = useState(false);
  const [inWorkshopRoom, setInWorkshopRoom] = useState(false);
  const [roomEntryFlash, setRoomEntryFlash] = useState(false);
  const [money, setMoney] = useState(0);
  const [sparkyQuestStage, setSparkyQuestStage] = useState<SparkyQuestStage>('intro');
  const [tutorialPhases, setTutorialPhases] = useState<TutorialPhase[]>(unit1Phases);
  const [activeCustomer, setActiveCustomer] = useState<CustomerRequest | null>(null);
  const [workshopCode, setWorkshopCode] = useState('');
  const [workshopOutput, setWorkshopOutput] = useState('');
  const [interactionPromptName, setInteractionPromptName] = useState<string | null>(null);
  const [workshopIntroSeen, setWorkshopIntroSeen] = useState(false);
  const [workshopIntroStep, setWorkshopIntroStep] = useState(0);
  const [inArenaRoom, setInArenaRoom] = useState(false);
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
  const [showSparkyExamples, setShowSparkyExamples] = useState(false);
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [transportMessage, setTransportMessage] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showControlsModal, setShowControlsModal] = useState(false);
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
  const lastPlaytimeSyncRef = useRef(0);
  const [bonusFraction, setBonusFraction] = useState(0);
  const bonusTimerRef = useRef<number | null>(null);
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

  const highlightedCode = useMemo(() => highlightJava(code), [code]);
  const missionText = useMemo(() => {
    if (sparkyQuestStage === 'intro') return 'Mission: Talk to Sparky to begin.';
    if (sparkyQuestStage === 'unit1') return 'Mission: Diagnose Scrap with Sparky.';
    if (sparkyQuestStage === 'unit1-done') return `Mission: Earn $${SCRAP_PART_COSTS['unit1-done']} for Scrap's sensor part. ($${money}/${SCRAP_PART_COSTS['unit1-done']})`;
    if (sparkyQuestStage === 'unit2') return 'Mission: Complete Unit 2 with Sparky.';
    if (sparkyQuestStage === 'unit2-done') return `Mission: Earn $${SCRAP_PART_COSTS['unit2-done']} for Scrap's voice module. ($${money}/${SCRAP_PART_COSTS['unit2-done']})`;
    if (sparkyQuestStage === 'unit3') return 'Mission: Complete Unit 3 with Sparky.';
    if (sparkyQuestStage === 'unit3-done') return `Mission: Earn $${SCRAP_PART_COSTS['unit3-done']} for Scrap's navigation chip. ($${money}/${SCRAP_PART_COSTS['unit3-done']})`;
    if (sparkyQuestStage === 'unit4') return 'Mission: Complete Unit 4 with Sparky.';
    if (sparkyQuestStage === 'all-done') return 'Scrap is fully repaired! Arena unlocked.';
    return 'Explore the city!';
  }, [sparkyQuestStage, money]);
  const moneyRef = useRef(0);
  const sparkyQuestStageRef = useRef<SparkyQuestStage>('intro');
  const firstTransactionDoneRef = useRef(false);
  const [firstTransactionDone, setFirstTransactionDone] = useState(false);



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

  useEffect(() => {
    showTutorialRef.current = showTutorial;
  }, [showTutorial]);

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
    inWorkshopRoomRef.current = inWorkshopRoom;
  }, [inWorkshopRoom]);

  useEffect(() => {
    moneyRef.current = money;
  }, [money]);

  const profileLoadedRef = useRef(false);

  // Load persisted state
  useEffect(() => {
    try {
      if (localStorage.getItem('rb_first_tx_done')) {
        setFirstTransactionDone(true);
        firstTransactionDoneRef.current = true;
      }
      if (!localStorage.getItem('rb_controls_seen')) {
        setShowControlsModal(true);
      }
    } catch {}
  }, []);

  // Load profile data — prevents tutorial re-trigger
  useEffect(() => {
    let retries = 6;
    const loadProfile = (): Promise<void> => fetch('/api/profile').then(r => {
      if (!r.ok) throw new Error('Not OK');
      return r.json();
    }).then(data => {
      if (data.error) throw new Error(data.error);
      if (data.currency !== undefined) setMoney(data.currency);
      if (data.workshopIntroDone) setWorkshopIntroSeen(true);
      if (data.questStage && data.questStage !== 'intro') {
        let mappedStage = String(data.questStage) as SparkyQuestStage;
        const oldStages = ['earn-money', 'buy-chai', 'gift-ready', 'done', 'grind1', 'grind2', 'grind3', 'arena-ready', 'unit2', 'unit3', 'unit4', 'unit2-done', 'unit3-done', 'unit4-done', 'all-done'];
        if (oldStages.includes(String(data.questStage))) {
          mappedStage = 'unit1-done';
          setMoney(0);
          moneyRef.current = 0;
          setWorkshopIntroSeen(false);
          fetch('/api/profile/money', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 0 }), keepalive: true }).catch(() => {});
        }
        setSparkyQuestStage(mappedStage);
        sparkyQuestStageRef.current = mappedStage;
        if (mappedStage === 'intro') {
          setTutorialComplete(false); setShopUnlocked(false);
          tutorialCompleteRef.current = false; showTutorialRef.current = false;
        } else if (mappedStage === 'unit1') {
          setTutorialComplete(false); setShopUnlocked(true);
          tutorialCompleteRef.current = false; showTutorialRef.current = false;
        } else {
          setTutorialComplete(true); setShopUnlocked(true);
          tutorialCompleteRef.current = true; showTutorialRef.current = false;
        }
      }
      if (data.questStage === 'intro' && data.tutorials?.length > 0) {
        setTutorialComplete(true); setShopUnlocked(true); setSparkyQuestStage('unit1-done');
        sparkyQuestStageRef.current = 'unit1-done';
        tutorialCompleteRef.current = true; showTutorialRef.current = false;
      }
      profileLoadedRef.current = true;
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

  // Save money to server when it changes
  const moneyTimerRef = useRef<number | null>(null);
  const saveMoney = useCallback((val: number) => {
    fetch('/api/profile/money', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: val }), keepalive: true })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (moneyTimerRef.current) clearTimeout(moneyTimerRef.current);
    moneyTimerRef.current = window.setTimeout(() => saveMoney(money), 2000);
    return () => { if (moneyTimerRef.current) clearTimeout(moneyTimerRef.current); };
  }, [money, saveMoney]);
  // Save immediately on page unload (beforeunload cancels setTimeout)
  useEffect(() => {
    const onUnload = () => { saveMoney(money); };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [money, saveMoney]);

  const prevStageRef = useRef(sparkyQuestStage);
  useEffect(() => {
    sparkyQuestStageRef.current = sparkyQuestStage;
    if (sparkyQuestStage !== 'intro' && sparkyQuestStage !== prevStageRef.current) {
      prevStageRef.current = sparkyQuestStage;
      fetch('/api/profile/quest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: sparkyQuestStage }), keepalive: true }).catch(() => {});
    } else {
      prevStageRef.current = sparkyQuestStage;
    }
  }, [sparkyQuestStage]);

  useEffect(() => {
    if (sparkyQuestMarkerRef.current) {
      sparkyQuestMarkerRef.current.visible = sparkyQuestStage === 'intro';
    }
  }, [sparkyQuestStage]);

  useEffect(() => {
    if (connected) {
      triggerEvent('client-player-join', { x: localPositionRef.current.x, y: localPositionRef.current.y });
      fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: localPositionRef.current.x, y: localPositionRef.current.y }),
      }).catch(() => {});
    }
  }, [connected, triggerEvent]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mountElement = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd4e8f7);
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
      new THREE.CircleGeometry(ISLAND_RADIUS + 10, 120),
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
      createBazaarShop(-6.87, -5.3, 0xe879f9, 0xf97316, 'Masala Chai', 1.2),
      createBazaarShop(-4.87, -5.3, 0x60a5fa, 0xfb7185, 'Code Bazaar', 1.2),
      createBazaarShop(-2.87, -5.3, 0x34d399, 0xfacc15, 'Snack Stop', 1.2),
    ];
    shops.forEach((shop) => outdoorGroup.add(shop));

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
    makeVendor(-6.87, -5.3, 0xffffff);
    makeVendor(-4.87, -5.3, 0x60a5fa);
    makeVendor(-2.87, -5.3, 0x34d399);

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
      sc.width = 640; sc.height = 128;
      const sctx = sc.getContext('2d')!;
      const rad = 16;
      sctx.fillStyle = 'rgba(220,38,38,0.95)';
      sctx.beginPath(); sctx.moveTo(rad, 0); sctx.lineTo(640 - rad, 0);
      sctx.quadraticCurveTo(640, 0, 640, rad); sctx.lineTo(640, 128 - rad);
      sctx.quadraticCurveTo(640, 128, 640 - rad, 128); sctx.lineTo(rad, 128);
      sctx.quadraticCurveTo(0, 128, 0, 128 - rad); sctx.lineTo(0, rad);
      sctx.quadraticCurveTo(0, 0, rad, 0); sctx.closePath(); sctx.fill();
      sctx.shadowColor = '#000'; sctx.shadowBlur = 6;
      sctx.fillStyle = '#f8fafc'; sctx.font = '700 72px system-ui'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
      sctx.fillText('PET WORKSHOP', 320, 66);
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
    doorAnchor.position.set(-6, -10.0, 2.5);
    outdoorGroup.add(doorAnchor);
    const doorMarker = addExclamationMarker(doorAnchor);
    doorMarker.visible = sparkyQuestStageRef.current === 'intro' || sparkyQuestStageRef.current === 'unit1-done' || sparkyQuestStageRef.current === 'unit2-done' || sparkyQuestStageRef.current === 'unit3-done';
    workshopDoorMarkerRef.current = doorMarker;

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

      transportHitboxRef.current = { shape: 'circle', center: new THREE.Vector2(bCx + bHw + 0.5, bCy), radius: 3.0 };
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

    const obstacleHitboxes: Hitbox[] = [
      { shape: 'circle', center: new THREE.Vector2(-6.87, -5.3), radius: 0.5 },
      { shape: 'circle', center: new THREE.Vector2(-4.87, -5.3), radius: 0.5 },
      { shape: 'circle', center: new THREE.Vector2(-2.87, -5.3), radius: 0.5 },
      // Pet workshop footprint
      { shape: 'box', center: new THREE.Vector2(-6, -11.8), halfWidth: 4.1, halfHeight: 1.6 },
      // Arena footprint
      { shape: 'box', center: new THREE.Vector2(aCx, aCy), halfWidth: aW / 2 + 0.2, halfHeight: aD / 2 + 0.2 },
      // Fountain in lake
      { shape: 'circle', center: new THREE.Vector2(6, -4), radius: 0.6 },
    ];
    const buildingObstaclePositions: { x: number; y: number; hw: number; hh: number }[] = [];
    buildingObstaclePositions.forEach((bp) => {
      obstacleHitboxes.push({ shape: 'box' as const, center: new THREE.Vector2(bp.x, bp.y), halfWidth: bp.hw, halfHeight: bp.hh });
    });
    // Transport store wall obstacles (open east side)
    obstacleHitboxes.push(
      { shape: 'box', center: new THREE.Vector2(-18.75, -14.2), halfWidth: 5, halfHeight: 0.1 },
      { shape: 'box', center: new THREE.Vector2(-18.75, -9.8), halfWidth: 5, halfHeight: 0.1 },
      { shape: 'box', center: new THREE.Vector2(-23.8, -12), halfWidth: 0.1, halfHeight: 2.2 },
    );
    obstacleHitboxesRef.current = obstacleHitboxes;
    workshopDoorHitboxRef.current = {
      shape: 'circle',
      center: new THREE.Vector2(-6, -10.3),
      radius: 1.5,
    };

    arenaDoorHitboxRef.current = {
      shape: 'circle',
      center: new THREE.Vector2(aCx, aCy + aD / 2),
      radius: 1.6,
    };

    roomObstacleHitboxesRef.current = [
      { shape: 'box', center: new THREE.Vector2(-3.2, 3.25), halfWidth: 0.825, halfHeight: 0.225 },
      { shape: 'box', center: new THREE.Vector2(2.9, 3.05), halfWidth: 0.75, halfHeight: 0.35 },
      { shape: 'box', center: new THREE.Vector2(3.4, -2.4), halfWidth: 0.625, halfHeight: 0.41 },
      { shape: 'box', center: new THREE.Vector2(ROOM_OWNER_POS.x, ROOM_OWNER_POS.y), halfWidth: 0.4, halfHeight: 0.4 },
      { shape: 'box', center: new THREE.Vector2(-1.9, 0.5), halfWidth: 0.35, halfHeight: 0.35 },
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

    const localColor = hashColor(userId || 'local-user');
    const localGroup = new THREE.Group();
    const skinMat = new THREE.MeshToonMaterial({ color: 0xf5d6c6, gradientMap: createGradientTexture(3) });
    const clothMat = new THREE.MeshToonMaterial({ color: 0x3b82f6, gradientMap: createGradientTexture(3) });
    const darkMat = new THREE.MeshToonMaterial({ color: 0x1f2937, gradientMap: createGradientTexture(3) });
    const accentMat = new THREE.MeshToonMaterial({ color: 0x60a5fa, gradientMap: createGradientTexture(3) });

    // Feet
    for (let s = -1; s <= 1; s += 2) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.03), darkMat);
      foot.position.set(s * 0.08, 0, 0.02);
      localGroup.add(foot);
    }
    // Legs (rotate π/2 around x to stand upright in z-up)
    for (let s = -1; s <= 1; s += 2) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.18, 8), darkMat);
      leg.rotation.x = Math.PI / 2;
      leg.position.set(s * 0.08, 0, 0.12);
      localGroup.add(leg);
    }
    // Body (torso)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.25, 12), clothMat);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0, 0.3);
    localGroup.add(torso);
    // Arms
    for (let s = -1; s <= 1; s += 2) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 8), clothMat);
      arm.rotation.x = Math.PI / 2;
      arm.rotation.z = s * 0.3;
      arm.position.set(s * 0.15, 0, 0.35);
      localGroup.add(arm);
      // Hand
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), skinMat);
      hand.position.set(s * 0.15, 0, 0.46);
      localGroup.add(hand);
    }
    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.06, 8), skinMat);
    neck.rotation.x = Math.PI / 2;
    neck.position.set(0, 0, 0.51);
    localGroup.add(neck);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), skinMat);
    head.position.set(0, 0, 0.57);
    localGroup.add(head);
    // Hair
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshToonMaterial({ color: 0x3a2a1a, gradientMap: createGradientTexture(3) }));
    hair.position.set(0, -0.02, 0.58);
    localGroup.add(hair);
    // Eyes
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.set(s * 0.035, 0.07, 0.63);
      localGroup.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), new THREE.MeshBasicMaterial({ color: 0x050505 }));
      pupil.position.set(s * 0.035, 0.07, 0.645);
      localGroup.add(pupil);
    }

    localGroup.position.set(0, -7, 0.24);
    scene.add(localGroup);
    localPositionRef.current.set(0, -7);
    const localRobot = { root: localGroup, nameSprite: new THREE.Sprite(), body: torso, shadow: torso, leftPupil: torso, rightPupil: torso, antennaTip: torso };
    localRobotRef.current = localRobot;

    const scrapRobot = createRobotVisual(new THREE.Color(0x4a3f35), 'Scrap');
    scrapRobot.root.scale.set(0.7, 0.7, 0.7);
    scrapRobot.root.position.set(NPC_POSITION.x + 1.5, NPC_POSITION.y - 1.2, 0.24);
    scrapRobot.root.rotation.z = 0.15;
    scrapRobot.nameSprite.visible = false;
    if (scrapRobot.leftPupil) scrapRobot.leftPupil.material.color.setHex(0x222222);
    if (scrapRobot.rightPupil) scrapRobot.rightPupil.material.color.setHex(0x222222);
    if (scrapRobot.antennaTip) scrapRobot.antennaTip.material.color.setHex(0x555555);
    outdoorGroup.add(scrapRobot.root);
    scrapRobotRef.current = scrapRobot;

    const sparky = createRobotVisual(new THREE.Color(0xfacc15), 'Sparky');
    sparky.root.scale.set(0.8, 0.8, 0.8);
    sparky.root.position.set(NPC_POSITION.x, NPC_POSITION.y, 0.24);
    sparky.nameSprite.visible = false;
    outdoorGroup.add(sparky.root);
    if (sparky.body) sparky.body.visible = true;
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
      workshopRoomGroup.add(wall);
    });

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
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)) {
        return;
      }
      if (event.code === 'Space' && inWorkshopRoomRef.current) {
        event.preventDefault();
        interactionRequestedRef.current = true;
        return;
      }
      if (event.code === 'Space' && !inWorkshopRoomRef.current && !inArenaRoomRef.current) {
        event.preventDefault();
        worldInteractionRequestedRef.current = true;
        return;
      }
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        keyStateRef.current.add(key);
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

    const createCustomerRequest = (customerName: string): CustomerRequest => {
      const blockedSignature = lastWorkshopRequestSigRef.current;
      let nextRequest: CustomerRequest = {
        customerName,
        petName: pickRandom(PET_NAMES),
        petColor: pickRandom(PET_COLORS),
        petSize: 2 + Math.floor(Math.random() * 5),
        required: [...REQUEST_PATTERNS[Math.floor(Math.random() * REQUEST_PATTERNS.length)]],
      };

      let tries = 0;
      while (blockedSignature && getWorkshopRequestSignature(nextRequest) === blockedSignature && tries < 8) {
        nextRequest = {
          customerName,
          petName: pickRandom(PET_NAMES),
          petColor: pickRandom(PET_COLORS),
          petSize: 2 + Math.floor(Math.random() * 5),
          required: [...REQUEST_PATTERNS[Math.floor(Math.random() * REQUEST_PATTERNS.length)]],
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
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      sessionPlaytimeRef.current += delta;
      const worldTime = now / 1000;

      fpsFrameCountRef.current += 1;
      const fpsElapsed = now - fpsLastTimeRef.current;
      if (fpsElapsed >= 1000) {
        fpsRef.current = Math.round(fpsFrameCountRef.current / (fpsElapsed / 1000));
        fpsFrameCountRef.current = 0;
        fpsLastTimeRef.current = now;
      }

      if (modalOpenRef.current) {
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
      if (!showTutorialRef.current) {
        const keys = keyStateRef.current;
        let forward = 0, turn = 0;
        if (keys.has('arrowup') || keys.has('w')) forward += 1;
        if (keys.has('arrowdown') || keys.has('s')) forward -= 1;
        if (keys.has('arrowleft') || keys.has('a')) turn -= 1;
        if (keys.has('arrowright') || keys.has('d')) turn += 1;

        if (turn) yawRef.current += turn * 2.5 * delta;
        if (forward) {
          moved = true;
          const sin = Math.sin(yawRef.current), cos = Math.cos(yawRef.current);
          moveDir2.set(sin * forward, cos * forward);
          const candidate = localPositionRef.current.clone().add(moveDir2.multiplyScalar(MOVE_SPEED * delta));
          if (inWorkshopRoomRef.current) {
            candidate.x = Math.max(-4.82, Math.min(4.82, candidate.x));
            candidate.y = Math.max(-4.82, Math.min(4.82, candidate.y));
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
          } else if (inArenaRoomRef.current) {
            candidate.x = Math.max(-5.8, Math.min(5.8, candidate.x));
            candidate.y = Math.max(-5.8, Math.min(5.8, candidate.y));
            localPositionRef.current.copy(candidate);
            localRobot.root.position.set(candidate.x, candidate.y, 0.28);
          } else {
            const maxRadius = ISLAND_RADIUS - PLAYER_RADIUS - 0.35;
            if (candidate.length() > maxRadius) candidate.setLength(maxRadius);
            const hitsObstacle = collidesWithAny(candidate, obstacleHitboxesRef.current) ||
              Object.values(remoteAvatarsRef.current).some(a => a.room === 'outside' &&
                candidate.distanceTo(a.target) < 0.6);
            const workshopDoor = workshopDoorHitboxRef.current;
            const atWorkshopDoor =
              Boolean(shopUnlockedRef.current) &&
              workshopDoor !== null &&
              workshopDoorArmedRef.current &&
              isInsideHitbox(candidate, workshopDoor);

            if (workshopDoor !== null && !isInsideHitbox(candidate, workshopDoor)) {
              workshopDoorArmedRef.current = true;
            }

            const arenaDoor = arenaDoorHitboxRef.current;
            const atArenaDoor =
              arenaDoor !== null &&
              arenaDoorArmedRef.current &&
              isInsideHitbox(candidate, arenaDoor);

            if (arenaDoor !== null && !isInsideHitbox(candidate, arenaDoor)) {
              arenaDoorArmedRef.current = true;
            }

            if (atWorkshopDoor) {
              workshopDoorArmedRef.current = false;
              setInWorkshopRoom(true);
              setWorkshopIntroStep(0);
              setRoomEntryFlash(true);
              if (roomEntryFlashTimeoutRef.current !== null) {
                window.clearTimeout(roomEntryFlashTimeoutRef.current);
              }
              roomEntryFlashTimeoutRef.current = window.setTimeout(() => setRoomEntryFlash(false), 460);
              localPositionRef.current.copy(ROOM_SPAWN);
              localRobot.root.position.set(ROOM_SPAWN.x, ROOM_SPAWN.y, 0.26);
              if (workshopCustomersRef.current.length === 0) {
                spawnCustomer();
              }
              keyStateRef.current.clear();
              moved = false;
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
            } else if (!hitsObstacle) {
              localPositionRef.current.copy(candidate);
              localRobot.root.position.set(candidate.x, candidate.y, 0.24);
            } else {
              moved = false;
            }
          }
        }
      }

      if (moved && now - sendAtRef.current >= NETWORK_SYNC_MS) {
        const room = inArenaRoomRef.current ? 'arena' : inWorkshopRoomRef.current ? 'workshop' : 'outside';
        triggerEvent('client-player-move', { x: localPositionRef.current.x, y: localPositionRef.current.y, room });
        sendAtRef.current = now;
      }
      // Sync playtime to server every 30s
      if (now - lastPlaytimeSyncRef.current >= 30000) {
        lastPlaytimeSyncRef.current = now;
        const total = Math.floor(sessionPlaytimeRef.current);
        fetch('/api/profile/playtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seconds: total }),
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
        localGroup.position.z = (inWorkshopRoomRef.current || inArenaRoomRef.current ? 0.28 : 0.24) + bob;
      } else {
        localGroup.position.z = inWorkshopRoomRef.current || inArenaRoomRef.current ? 0.28 : 0.24;
      }

      if (!inWorkshopRoomRef.current && !inArenaRoomRef.current) {
        const distanceToSparky = localPositionRef.current.distanceTo(NPC_POSITION);
        let outsidePrompt: string | null = null;

        if (profileLoadedRef.current && distanceToSparky < SPARKY_INTERACTION_DISTANCE && !showTutorialRef.current && (sparkyQuestStageRef.current === 'intro' || sparkyQuestStageRef.current === 'unit1' || sparkyQuestStageRef.current === 'unit2')) {
          setShowTutorial(true);
          setTutorialStep(0);
          setCode(tutorialPhasesRef.current[0].kind === 'dialogue' ? '' : tutorialPhasesRef.current[0].starterCode || '');
          setOutput('');
          setSuccess(false);
        } else if (distanceToSparky > 2.25 && showTutorialRef.current) {
          setShowTutorial(false);
          setTutorialStep(0);
          setSuccess(false);
          setOutput('');
        }

        const showSparkyPrompt =
          sparkyQuestStageRef.current === 'intro' ||
          sparkyQuestStageRef.current === 'unit1' ||
          sparkyQuestStageRef.current === 'unit1-done' ||
          sparkyQuestStageRef.current === 'unit2' ||
          sparkyQuestStageRef.current === 'unit2-done' ||
          sparkyQuestStageRef.current === 'unit3' ||
          sparkyQuestStageRef.current === 'unit3-done' ||
          sparkyQuestStageRef.current === 'unit4' ||
          sparkyQuestStageRef.current === 'all-done';

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
          const stage = sparkyQuestStageRef.current;
          if (distanceToSparky < SPARKY_INTERACTION_DISTANCE) {
            if (stage === 'intro' || stage === 'unit1' || stage === 'unit2') {
              setShowTutorial(true);
              setTutorialStep(0);
              setCode(tutorialPhasesRef.current[0].kind === 'dialogue' ? '' : tutorialPhasesRef.current[0].starterCode || '');
              setOutput('');
              setSuccess(false);
            } else if (stage === 'unit1-done' || stage === 'unit2-done' || stage === 'unit3-done') {
              const s = stage;
              const cost = SCRAP_PART_COSTS[s];
              const have = moneyRef.current;
              if (have >= cost) {
                const nextUnit: SparkyQuestStage = s === 'unit1-done' ? 'unit2' : s === 'unit2-done' ? 'unit3' : 'unit4';
                const partName = s === 'unit1-done' ? 'sensor part' : s === 'unit2-done' ? 'voice module' : 'navigation chip';
                setSparkyModal(`Great! You have $${have}. Sparky installs the ${partName}. Scrap is one step closer to being whole again! Talk to Sparky when you're ready for the next lesson.`);
                setSparkyQuestStage(nextUnit);
              } else {
                setSparkyModal(`Sparky needs $${cost} for Scrap's next part. You have $${have}. Head to the Pet Workshop across the street to earn more money!`);
              }
            } else if (stage === 'unit3' || stage === 'unit4') {
              const unitName = stage === 'unit3' ? 'Unit 3' : 'Unit 4';
              setSparkyModal(`${unitName} isn't built yet! Check back later.`);
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

      sparkyWaitTimerRef.current += delta;
      if (sparkyWaitTimerRef.current > 1.5 && !showTutorialRef.current) {
        const target = SPARKY_PATH[sparkyPathIndexRef.current];
        const dist = sparky.root.position.distanceTo(new THREE.Vector3(target.x, target.y, 0.14));
        if (dist < 0.15) {
          sparkyPathIndexRef.current = (sparkyPathIndexRef.current + 1) % SPARKY_PATH.length;
          sparkyWaitTimerRef.current = 0;
        } else {
          const dir = new THREE.Vector2(target.x - sparky.root.position.x, target.y - sparky.root.position.y).normalize();
          sparky.root.position.x += dir.x * 1.8 * delta;
          sparky.root.position.y += dir.y * 1.8 * delta;
        }
      }
      sparky.root.position.z = 0.24 + Math.sin(worldTime * 4) * 0.04;
      animateRobotVisual(sparky, worldTime, 0.5, -0.3, 0.15);
      if (sparkyQuestMarkerRef.current) {
        sparkyQuestMarkerRef.current.position.y = 1.0 + Math.sin(worldTime * 5.2) * 0.08;
      }
      animateRobotVisual(owner, worldTime * 0.9, 0.12, -0.2, -0.1);
      if (roomOwnerVisualRef.current) {
        animateRobotVisual(roomOwnerVisualRef.current, worldTime * 0.92, 0.14, -0.28, -0.2);
      }
      if (roomPetVisualRef.current) {
        animateRobotVisual(roomPetVisualRef.current, worldTime * 1.35, 0.28, 0.5, -0.2);
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

        // Rafiq interaction → re-open workshop intro
        const distToRafiq = Math.hypot(localPositionRef.current.x - ROOM_OWNER_POS.x, localPositionRef.current.y - ROOM_OWNER_POS.y);
        if (interactionRequestedRef.current && distToRafiq < 1.8) {
          interactionRequestedRef.current = false;
          setWorkshopIntroStep(0);
          setWorkshopIntroSeen(false);
          return;
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
            let bonus = 0;
            if (bonusTimerRef.current !== null) {
              const elapsed = (performance.now() - bonusTimerRef.current) / 1000;
              bonus = Math.max(0, Math.round(5 * (1 - elapsed / BONUS_DURATION)));
              bonusTimerRef.current = null;
            }
            setMoney((prev) => prev + 2 + bonus);
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

      const currentRoom = inArenaRoomRef.current ? 'arena' : inWorkshopRoomRef.current ? 'workshop' : 'outside';
      for (const avatar of Object.values(remoteAvatarsRef.current)) {
        const showAvatar = currentRoom === avatar.room;
        avatar.visual.root.visible = showAvatar;
        if (showAvatar) {
          const targetGroup = currentRoom === 'arena' ? arenaRoomGroup :
            currentRoom === 'workshop' ? (workshopRoomGroupRef.current || scene) :
            (outdoorGroupRef.current || scene);
          if (avatar.visual.root.parent !== targetGroup) {
            avatar.visual.root.parent?.remove(avatar.visual.root);
            targetGroup.add(avatar.visual.root);
          }
        }
        const prevX = avatar.visual.root.position.x;
        const prevY = avatar.visual.root.position.y;
        avatar.visual.root.position.x += (avatar.target.x - avatar.visual.root.position.x) * REMOTE_LERP;
        avatar.visual.root.position.y += (avatar.target.y - avatar.visual.root.position.y) * REMOTE_LERP;
        const velocity = Math.hypot(avatar.visual.root.position.x - prevX, avatar.visual.root.position.y - prevY);
        avatar.walkTime += delta * (1 + velocity * 20);
        const lookX = avatar.target.x - avatar.visual.root.position.x;
        const lookY = avatar.target.y - avatar.visual.root.position.y;
        animateRobotVisual(avatar.visual, avatar.walkTime, velocity * 24, lookX, lookY);
        if (lookX !== 0 || lookY !== 0) {
          avatar.visual.root.rotation.z = -Math.atan2(lookX, lookY);
        }
      }

      clouds.forEach((cloud, i) => {
        cloud.position.x += Math.sin(worldTime * (0.08 + i * 0.03) + i) * 0.0025;
      });

      const roomBg = inWorkshopRoomRef.current ? 0x030712 : inArenaRoomRef.current ? 0x0f172a : 0xd4e8f7;
        outdoorGroup.visible = !inWorkshopRoomRef.current && !inArenaRoomRef.current;
        workshopRoomGroup.visible = inWorkshopRoomRef.current;
        arenaRoomGroup.visible = inArenaRoomRef.current;
        scene.background = new THREE.Color(roomBg);
        const yaw = yawRef.current;
        const px = localPositionRef.current.x;
        const py = localPositionRef.current.y;
        const sin = Math.sin(yaw), cos = Math.cos(yaw);
        const inside = inWorkshopRoomRef.current || inArenaRoomRef.current;
        camera.position.set(
          px - sin * (inside ? 1.4 : 2.2),
          py - cos * (inside ? 1.4 : 2.2),
          inside ? 1.2 : 1.8
        );
        camera.lookAt(
          px + sin * (inside ? 1.6 : 2.5),
          py + cos * (inside ? 1.6 : 2.5),
          inside ? 0.5 : 0.6
        );

      renderer.render(scene, camera);
      rafRef.current = window.requestAnimationFrame(animate);
    } catch (e) {
      console.error('Animation loop error:', e);
      rafRef.current = window.requestAnimationFrame(animate);
    }
    };

    rafRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      mountElement.removeEventListener('mousedown', handleFocusClick);
      Object.values(remoteAvatarsRef.current).forEach((avatar) => disposeObject(avatar.visual.root));
      remoteAvatarsRef.current = {};
      disposeObject(localRobot.root);
      disposeObject(sparky.root);
      clouds.forEach((cloud) => disposeObject(cloud));
      shops.forEach((shop) => disposeObject(shop));
      disposeObject(ps);
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
      arenaBuildingRef.current = null;
      obstacleHitboxesRef.current = [];
      roomObstacleHitboxesRef.current = [];
      workshopDoorHitboxRef.current = null;
      arenaDoorHitboxRef.current = null;
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
    if (workshopDoorMarkerRef.current) workshopDoorMarkerRef.current.visible = (sparkyQuestStage === 'intro' || sparkyQuestStage === 'unit1-done' || sparkyQuestStage === 'unit2-done' || sparkyQuestStage === 'unit3-done') && !inWorkshopRoom;
  }, [sparkyQuestStage, inWorkshopRoom, inArenaRoom, workshopIntroSeen]);

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
      const name = data.name?.trim() || `Robot ${remoteUserId.slice(0, 4)}`;
      const remoteRoom = (data as any).room || 'outside';
      if (!remoteAvatarsRef.current[remoteUserId]) {
        const color = new THREE.Color(hashColor(remoteUserId));
        let h = 0;
        for (let i = 0; i < remoteUserId.length; i++) h = (h * 31 + remoteUserId.charCodeAt(i)) | 0;
        const spriteIdx = Math.abs(h) % REMOTE_SPRITES.length;
        const visual = createPlayerSprite(REMOTE_SPRITES[spriteIdx], color, name);
        visual.root.position.set(data.x, data.y, 0.24);
        remoteAvatarsRef.current[remoteUserId] = {
          visual,
          target: new THREE.Vector2(data.x, data.y),
          name,
          walkTime: performance.now() / 1000,
          room: remoteRoom,
        };
      } else {
        const avatar = remoteAvatarsRef.current[remoteUserId];
        avatar.target.set(data.x, data.y);
        avatar.room = remoteRoom;
        if (avatar.name !== name) {
          avatar.visual.root.remove(avatar.visual.nameSprite);
          disposeObject(avatar.visual.nameSprite);
          avatar.visual.nameSprite = createNameSprite(name, new THREE.Color(hashColor(remoteUserId)));
          avatar.visual.root.add(avatar.visual.nameSprite);
          avatar.name = name;
        }
      }
    }

    for (const existingId of Object.keys(remoteAvatarsRef.current)) {
      if (activeIds.has(existingId)) continue;
      const avatar = remoteAvatarsRef.current[existingId];
      avatar.visual.root.parent?.remove(avatar.visual.root);
      disposeObject(avatar.visual.root);
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
        if (scrap) {
          const eyesOn = Math.min(1, done / 4);
          const eyeBright = Math.floor(0x22 + eyesOn * 0xdd) * 0x10000 + Math.floor(0xdd + eyesOn * 0x22) * 0x100;
          if (scrap.leftPupil) scrap.leftPupil.material.color.setHex(eyeBright);
          if (scrap.rightPupil) scrap.rightPupil.material.color.setHex(eyeBright);
          if (done >= 6 && scrap.antennaTip) scrap.antennaTip.material.color.setHex(0x22dd22);
          if (done >= 8) scrap.root.rotation.z = 0;
          if (done >= 10 && scrap.antennaTip) scrap.antennaTip.material.color.setHex(0x44ff44);
        }

        if (nextPhase && nextPhase.kind === 'challenge') {
          setOutput(`✅ Nice! ${activePhase.title} complete.`);
          setSparkleBurst(false);
        } else {
          const currentStage = sparkyQuestStageRef.current;
          if (currentStage === 'unit2') {
            setOutput('✅ Unit 2 complete! Scrap\'s voice module is working. He needs a new part — talk to Sparky.');
            setTutorialComplete(true);
            setShopUnlocked(true);
            setSparkyQuestStage('unit2-done');
            setSparkyModal('Scrap can speak! But his voice module is still glitchy. Earn $10 at the workshop, then talk to Sparky to get a replacement.');
          } else {
            setOutput('✅ Unit 1 complete! Scrap\'s motor diagnostics are online. He needs a new sensor part — talk to Sparky.');
            setTutorialComplete(true);
            setShopUnlocked(true);
            setSparkyQuestStage('unit1-done');
            setSparkyModal('Scrap\'s motor diagnostics are working! But his sensor is fried. Earn $5 at the workshop, then talk to Sparky to buy the replacement part.');
          }
          setSparkleBurst(false);
        }
      } else {
        setOutput(`❌ ${data.error || 'Almost there — try again!'}`);
      }
    } catch {
      setOutput('❌ Oops! Could not validate right now.');
    }
  };

  const leaveWorkshopRoom = () => {
    setInWorkshopRoom(false);
    workshopDoorArmedRef.current = false;
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
  };

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
    setWorkshopOutput(`✅ Nice. ${activeCustomer.customerName} is walking to the register now — meet them there for $2${bonusNow > 0 ? ` (+$${bonusNow} speed bonus)` : ''}.`);
    setWorkshopCode('');
    setActiveCustomer(null);
    workshopCustomersRef.current = workshopCustomersRef.current.map((npc) =>
      npc.id === selectedId ? { ...npc, stage: 'follow-to-counter' } : npc
    );
  };

  const finishWorkshopIntro = () => {
    setWorkshopIntroSeen(true);
    setWorkshopIntroStep(0);
    fetch('/api/profile/workshop-intro', { method: 'POST', keepalive: true }).catch(() => {});
  };

  const nextWorkshopIntroStep = () => {
    if (workshopIntroStep >= WORKSHOP_INTRO_PAGES.length - 1) {
      finishWorkshopIntro();
      return;
    }
    setWorkshopIntroStep((prev) => prev + 1);
  };

  const reopenWorkshopIntro = () => {
    setWorkshopIntroStep(0);
    setWorkshopIntroSeen(false);
    try { localStorage.removeItem('rb_ws_intro'); } catch {}
  };

  return (
    <div className="relative">
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

      {inWorkshopRoom && !workshopIntroSeen && profileLoadedRef.current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-amber-200/50 shadow-2xl p-6 text-slate-100">
            <div className="text-2xl font-bold text-amber-300 mb-4">{WORKSHOP_INTRO_PAGES[workshopIntroStep].title}</div>
            <div className="text-lg">{WORKSHOP_INTRO_PAGES[workshopIntroStep].body}</div>
            <div className="mt-6 flex gap-3">
              <button className="rounded bg-emerald-500 px-6 py-3 text-lg font-semibold text-white hover:bg-emerald-400" onClick={() => { if (workshopIntroStep >= WORKSHOP_INTRO_PAGES.length - 1) { finishWorkshopIntro(); } else setWorkshopIntroStep(s => s + 1); }}>{workshopIntroStep >= WORKSHOP_INTRO_PAGES.length - 1 ? 'Start working!' : 'Next →'}</button>
              <button className="rounded bg-slate-700 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-600" onClick={finishWorkshopIntro}>Skip</button>
            </div>
          </div>
        </div>
      )}

      <WorkshopPanel activeCustomer={activeCustomer} workshopCode={workshopCode} setWorkshopCode={setWorkshopCode} workshopOutput={workshopOutput} inWorkshopRoom={inWorkshopRoom} runWorkshopCode={runWorkshopCode} reopenWorkshopIntro={reopenWorkshopIntro} showSparkyExamples={() => setShowSparkyExamples(true)} leaveWorkshopRoom={leaveWorkshopRoom} bonusFraction={bonusFraction} bonusDuration={BONUS_DURATION} firstTransactionDone={firstTransactionDone} />

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
        {connected ? `🟢 Live island • ${Object.keys(players).length + 1} robots` : '🟡 Connecting to island...'}
      </div>

      {debugMode && (
        <div className="absolute top-20 left-4 z-50 rounded-lg bg-black/60 px-3 py-2 text-xs font-mono text-emerald-300 space-y-0.5">
          <div>FPS: {debugDisplay.fps}</div>
          <div>X: {debugDisplay.x}</div>
          <div>Y: {debugDisplay.y}</div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 max-w-[min(90vw,32rem)] rounded-lg border border-amber-300/40 bg-slate-950/80 px-5 py-4 text-base md:text-lg text-amber-100 shadow-lg">
        <div className="font-semibold text-amber-300">Mission</div>
        <div className="mt-1">{missionText}</div>
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4" onClick={() => {
          setShowControlsModal(false);
          try { localStorage.setItem('rb_controls_seen', '1'); } catch {}
        }}>
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-cyan-300/50 shadow-2xl p-8 text-slate-100">
            <h2 className="text-xl font-bold text-cyan-300 mb-6 text-center">How to move around</h2>
            <div className="flex justify-center gap-12 mb-6">
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
            <p className="text-slate-400 text-sm text-center mb-6">Use arrow keys or WASD to walk around the island and explore!</p>
            <div className="flex justify-center">
              <button className="rounded-lg bg-cyan-500 px-8 py-3 text-lg font-semibold text-slate-900 hover:bg-cyan-400" onClick={() => {
                setShowControlsModal(false);
                try { localStorage.setItem('rb_controls_seen', '1'); } catch {}
              }}>Got it!</button>
            </div>
          </div>
        </div>
      )}

       <TutorialOverlay showTutorial={showTutorial} tutorialStep={tutorialStep} setTutorialStep={setTutorialStep} code={code} setCode={setCode} highlightedCode={highlightedCode} output={output} setOutput={setOutput} success={success} setSuccess={setSuccess} sparkleBurst={sparkleBurst} codeInputRef={codeInputRef} codePreviewRef={codePreviewRef} onEditorScroll={onEditorScroll} checkAnswer={checkAnswer} setShowTutorial={setShowTutorial} tutorialPhases={tutorialPhases} />

      {activeModal && <ModalShell activeModal={activeModal} setActiveModal={setActiveModal} userId={userId} debugMode={debugMode} setDebugMode={setDebugMode} />}
    </div>
  );
}
