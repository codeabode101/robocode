'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { SparkyQuestStage, CustomerRequest } from '@/components/game/types';
import Editor from '@/components/game/Editor';
import TutorialOverlay from '@/components/game/TutorialOverlay';
import ArenaOverlay from '@/components/game/ArenaOverlay';
import WorkshopPanel from '@/components/game/WorkshopPanel';
import type { RobotVisual, HumanVisual } from '@/components/game/scene';
import {
  hashColor, createLabelSprite, createExclamationMarker, createNameSprite,
  disposeObject, createRoundedRectGeometry, createGradientTexture,
  createToonMaterial, createTexturedToonMaterial, createCharacterSprite, getTileTexture,
  createPlayerSprite, addOutline, applyShadows, createRobotVisual,
  createGrid, createPalmTree, createBazaarShop, createRangoli, addWindows,
  createBigPetShop, createHumanVisual, animateRobotVisual, LABEL_BUILD_TAG, WALK_BOB_SPEED
} from '@/components/game/scene';
import { pickRandom, getWorkshopRequestSignature, validateWorkshopCode } from '@/components/game/helpers';
import { tutorialPhases } from '@/components/game/tutorialData';

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
const ARENA_ROOM_SPAWN = new THREE.Vector2(0, -3.7);
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
const MASALA_CHAI_SHOP_POS = new THREE.Vector2(-6.87, -5.3);
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
};

type CustomerNpc = {
  id: string;
  visual: HumanVisual;
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
  const petShopMarkerRef = useRef<THREE.Sprite | null>(null);
  const outdoorGroupRef = useRef<THREE.Group | null>(null);
  const workshopRoomGroupRef = useRef<THREE.Group | null>(null);
    const yawRef = useRef(0);
    const obstacleHitboxesRef = useRef<Hitbox[]>([]);
  const roomObstacleHitboxesRef = useRef<Hitbox[]>([]);
  const workshopDoorHitboxRef = useRef<CircleHitbox | null>(null);
  const workshopDoorArmedRef = useRef(true);
  const workshopCustomersRef = useRef<CustomerNpc[]>([]);
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
  const sparkyQuestMarkerRef = useRef<THREE.Sprite | null>(null);
  const chaiShopHitboxRef = useRef<CircleHitbox | null>(null);
  const arenaBuildingRef = useRef<THREE.Group | null>(null);
  const arenaMarkerRef = useRef<THREE.Sprite | null>(null);
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

  const highlightedCode = useMemo(() => highlightJava(code), [code]);
  const missionText = useMemo(() => {
    if (sparkyQuestStage === 'intro') return 'Mission: Talk to Sparky to begin.';
    if (sparkyQuestStage === 'earn-money') return `Mission: Earn $10 at the Pet Workshop. ($${money}/10)`;
    if (sparkyQuestStage === 'buy-chai') return 'Mission: Buy Sparky masala chai.';
    if (sparkyQuestStage === 'gift-ready') return 'Mission: Return to Sparky for your gift.';
    return 'Mission complete: Sparky gave you a gift.';
  }, [sparkyQuestStage, money]);
  const moneyRef = useRef(0);
  const sparkyQuestStageRef = useRef<SparkyQuestStage>('intro');



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
    shopUnlockedRef.current = shopUnlocked;
  }, [shopUnlocked]);

  useEffect(() => {
    inWorkshopRoomRef.current = inWorkshopRoom;
  }, [inWorkshopRoom]);

  useEffect(() => {
    moneyRef.current = money;
  }, [money]);

  const profileLoadedRef = useRef(false);

  // Load profile data — prevents tutorial re-trigger
  useEffect(() => {
    fetch('/api/profile').then(r => {
      if (!r.ok) { profileLoadedRef.current = true; return null; }
      return r.json();
    }).then(data => {
      if (!data) return;
      if (data.error) { profileLoadedRef.current = true; return; }
      if (data.currency !== undefined) setMoney(data.currency);
      if (data.workshopIntroDone) setWorkshopIntroSeen(true);
      if (data.questStage && data.questStage !== 'intro') {
        setSparkyQuestStage(data.questStage);
        sparkyQuestStageRef.current = data.questStage;
        if (data.questStage === 'earn-money' || data.questStage === 'buy-chai' || data.questStage === 'gift-ready' || data.questStage === 'done') {
          setTutorialComplete(true); setShopUnlocked(true);
          tutorialCompleteRef.current = true; showTutorialRef.current = false;
        }
      }
      if (data.questStage === 'intro' && data.tutorials?.length > 0) {
        setTutorialComplete(true); setShopUnlocked(true); setSparkyQuestStage('earn-money');
        sparkyQuestStageRef.current = 'earn-money';
        tutorialCompleteRef.current = true; showTutorialRef.current = false;
      }
      profileLoadedRef.current = true;
    }).catch(() => { profileLoadedRef.current = true; });
  }, []);

  // Block tutorial if already completed or profile loaded with completion
  useEffect(() => {
    if (tutorialComplete || sparkyQuestStage !== 'intro') {
      showTutorialRef.current = false;
    }
  }, [tutorialComplete, sparkyQuestStage]);

  // Save money to server when it changes
  const moneyTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (money === 0) return;
    if (moneyTimerRef.current) clearTimeout(moneyTimerRef.current);
    moneyTimerRef.current = window.setTimeout(() => {
      fetch('/api/profile/money', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: money }), keepalive: true })
        .catch(() => {});
    }, 2000);
    return () => { if (moneyTimerRef.current) clearTimeout(moneyTimerRef.current); };
  }, [money]);

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
      sparkyQuestMarkerRef.current.visible = sparkyQuestStage === 'intro' || sparkyQuestStage === 'gift-ready';
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    const roadMesh = new THREE.Mesh(new THREE.BoxGeometry(48, 32, 0.04), new THREE.MeshBasicMaterial({ color: roadColor }));
    roadMesh.position.set(0, -6.25, 0.14);
    outdoorGroup.add(roadMesh);
    // Grass blocks ABOVE the road to carve out city blocks between roads
    const gMat = new THREE.MeshBasicMaterial({ color: 0x6aaa5a });
    const addG = (x: number, y: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), gMat);
      m.position.set(x, y, 0.20); outdoorGroup.add(m);
    };
    // All 4 grass rows between the 4 horizontals, split by the 4 verticals
    const yGaps: [number, number, number][] = [
      [1.5, 6.5, 4],     // between h-y0 (1.5) and h-y8p (6.5)
      [-6.5, -1.5, -4],   // between h-y8 (-6.5) and h-y0 (-1.5)
      [-14.5, -9.5, -12], // between h-y16 (-14.5) and h-y8 (-9.5)
    ];
    const xGaps: [number, number, number][] = [
      [-24, -13.5, -18.75], [-10.5, -1.5, -6], [1.5, 10.5, 6], [13.5, 18.5, 16], [21.5, 24, 22.75],
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
      [[-24,-13.5],[-10.5,-1.5],[1.5,10.5],[13.5,18.5],[21.5,24]].forEach(([x1,x2]) => {
        makeSW((x1+x2)/2, y, x2-x1, sw);
      });
    };
    // Vertical sidewalks: split at each horizontal road
    const vSW = (x: number) => {
      [[-22,-17.5],[-14.5,-9.5],[-6.5,1.5],[1.5,6.5]].forEach(([y1,y2]) => {
        makeSW(x, (y1+y2)/2, sw, y2-y1);
      });
    };
    hSW(1.75); hSW(-1.75); hSW(-6.25); hSW(-9.75); hSW(6.25); hSW(9.75); hSW(-14.25); hSW(-17.75);
    vSW(-1.75); vSW(1.75); vSW(-13.75); vSW(-10.25); vSW(10.25); vSW(13.75); vSW(18.25); vSW(21.75);

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
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const makeCrosswalk = (x: number, y: number, horiz: boolean) => {
      for (let i = -1; i <= 1; i++) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? 0.15 : 0.8, horiz ? 0.8 : 0.15), crossMat);
        s.position.set(horiz ? x + i * 0.3 : x, horiz ? y : y + i * 0.3, 0.17);
        outdoorGroup.add(s);
      }
    };
    makeDashedLine(0, 0, 48, true); makeDashedLine(0, -8, 48, true);
    makeDashedLine(0, 8, 48, true); makeDashedLine(0, -16, 48, true);
    makeDashedLine(0, -8, 28, false); makeDashedLine(-12, -8, 28, false);
    makeDashedLine(12, -8, 28, false); makeDashedLine(20, -8, 28, false);
    // Crosswalks removed — intersections are filled with road

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

    // Park benches
    const benchMat = createToonMaterial(0x8b6b4a);
    const benchPositions: [number, number][] = [[-3, 6.5], [3, 6.5], [-3, -13.5], [3, -13.5]];
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
    const canPositions: [number, number][] = [[-5.2, 4.2], [5.2, 4.2], [-5.2, -4.2], [5.2, -4.2], [-5.2, -12.2], [5.2, -12.2]];
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
      g.position.set(vx, vy, 0.14);
      outdoorGroup.add(g);
    };
    makeVendor(-6.87, -5.1, 0xffffff);
    makeVendor(-4.87, -5.1, 0x60a5fa);
    makeVendor(-2.87, -5.1, 0x34d399);

    const marketLamps = new THREE.Group();
    for (let i = 0; i < 7; i += 1) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        createToonMaterial(0xfef08a, 0.28, 0.3)
      );
      lamp.position.set(-1.8 + i * 0.6, 0.8, 1.12);
      marketLamps.add(lamp);
    }
    applyShadows(marketLamps, true, true);
    outdoorGroup.add(marketLamps);

    // Grid removed (was creating lines through the lake)

    // Rangoli removed

    // Scatter props from Kenney tiles (furniture, plants, decorations)
    interface PropDef { tile: string; x: number; y: number; scale?: number; rotation?: number; }
    const propTiles: PropDef[] = [
      { tile: 'tile_131.png', x: -1.2, y: 4.8, scale: 0.6 },    // desk/table
      { tile: 'tile_132.png', x: 1.3, y: 4.8, scale: 0.5 },     // chair
      { tile: 'tile_156.png', x: -4.5, y: 2.2, scale: 0.7 },    // plant
      { tile: 'tile_157.png', x: 4.5, y: 2.2, scale: 0.7 },     // plant
      { tile: 'tile_134.png', x: -4.5, y: -6.8, scale: 0.6 },   // barrel/object
      { tile: 'tile_197.png', x: 4.2, y: -10.2, scale: 0.5 },   // shelf/rack
      { tile: 'tile_206.png', x: -3.8, y: -14.8, scale: 0.5 },  // counter
      { tile: 'tile_213.png', x: -8.5, y: 6.2, scale: 0.5 },    // desk
      { tile: 'tile_235.png', x: 7.8, y: 5.8, scale: 0.5 },     // furniture
      { tile: 'tile_242.png', x: 7.5, y: -6.5, scale: 0.5 },    // furniture
      { tile: 'tile_262.png', x: -11.5, y: -6.5, scale: 0.5 },  // object
      { tile: 'tile_289.png', x: 14, y: 5.5, scale: 0.5 },      // decoration
      { tile: 'tile_292.png', x: 14, y: -5.5, scale: 0.5 },     // decoration
      { tile: 'tile_316.png', x: 18, y: -10.5, scale: 0.45 },   // object
      { tile: 'tile_359.png', x: -5.5, y: -16.5, scale: 0.5 },  // object
    ];
    propTiles.forEach(({ tile, x, y, scale = 0.5, rotation = 0 }) => {
      const propTex = getTileTexture(tile);
      const propMat = new THREE.MeshToonMaterial({ map: propTex, gradientMap: createGradientTexture(3), transparent: true });
      const aspect = 1;
      const prop = new THREE.Mesh(new THREE.PlaneGeometry(1 * scale, 1 * scale), propMat);
      prop.position.set(x, y, 0.2);
      prop.rotation.z = rotation;
      prop.castShadow = true;
      prop.receiveShadow = true;
      outdoorGroup.add(prop);
    });

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
    const tf = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.3, bd + 0.3, 1.3), psAp);
    tf.position.set(cx, cy, bh + 0.68); ps.add(tf);
    // Windows on top floor (NORTH side, facing bazaars)
    for (let i = -1; i <= 1; i++) {
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), psT);
      sill.position.set(cx + i * 2.2, fwY + 0.01, bh + 0.4); ps.add(sill);
      const wg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.6), new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
      wg.position.set(cx + i * 2.2, fwY + 0.01, bh + 0.78); ps.add(wg);
      const wf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), psT);
      wf.position.set(cx + i * 2.2 - 0.7, fwY + 0.01, bh + 0.78); ps.add(wf);
      const wf2 = wf.clone();
      wf2.position.x = cx + i * 2.2 + 0.7;
      ps.add(wf2);
    }
    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.8, bd + 0.6, 0.08), psR);
    roof.position.set(cx, cy, bh + 1.36); ps.add(roof);
    // Sign
    const pSign = createLabelSprite('PET WORKSHOP', '#f8fafc', 'rgba(220,38,38,0.95)', '#fca5a5', 320, 60);
    pSign.scale.set(3.2, 0.65, 1); pSign.position.set(cx, cy, bh + 1.55); pSign.renderOrder = 32;
    ps.add(pSign);

    ps.position.set(0, 0, 0);
    outdoorGroup.add(ps);
    ps.visible = true;
    petShopRef.current = ps;
    const petShopMarker = createExclamationMarker();
    petShopMarker.position.set(cx, cy + 3.6, 4.8);
    petShopMarker.renderOrder = 60;
    petShopMarker.visible = shopUnlockedRef.current;
    ps.add(petShopMarker);
    petShopMarkerRef.current = petShopMarker;

    const arenaBuilding = new THREE.Group();
    const arenaBase = new THREE.Mesh(
      new THREE.BoxGeometry(8, 6, 3),
      createTexturedToonMaterial('tile_25.png', 16, 6, 0xa53843)
    );
    arenaBase.position.set(20, -14, 2);
    arenaBuilding.add(arenaBase);
    addOutline(arenaBase);
    const arenaRoof = new THREE.Mesh(
      new THREE.BoxGeometry(9, 6.5, 0.5),
      createTexturedToonMaterial('tile_23.png', 18, 13, 0x1e293b)
    );
    arenaRoof.position.set(20, -14, 4.5);
    arenaBuilding.add(arenaRoof);
    const arenaDoorArch = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.4, 3.5),
      createToonMaterial(0xfde68a, 0.55, 0.14)
    );
    arenaDoorArch.position.set(20, -16.7, 2.2);
    arenaBuilding.add(arenaDoorArch);
    const arenaDoorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.3, 3),
      createToonMaterial(0x0f172a, 0.36, 0.35)
    );
    arenaDoorMesh.position.set(20, -16.7, 2.2);
    arenaBuilding.add(arenaDoorMesh);
    const arenaSign = createLabelSprite('ARENA', '#f8fafc', 'rgba(220,38,38,0.92)', '#fca5a5', 280, 90);
    arenaSign.scale.set(5, 1.4, 1);
    arenaSign.center.set(0.5, 0);
    arenaSign.position.set(20, -11.2, 4.8);
    arenaSign.renderOrder = 32;
    arenaBuilding.add(arenaSign);
    applyShadows(arenaBuilding, true, true);
    outdoorGroup.add(arenaBuilding);
    arenaBuildingRef.current = arenaBuilding;

    const arenaMarker = createExclamationMarker();
    arenaMarker.position.set(20, -10, 4.8);
    arenaMarker.renderOrder = 60;
    arenaMarker.visible = true;
    arenaBuilding.add(arenaMarker);
    arenaMarkerRef.current = arenaMarker;

    const obstacleHitboxes: Hitbox[] = [
      { shape: 'circle', center: new THREE.Vector2(-6.87, -5.3), radius: 0.5 },
      { shape: 'circle', center: new THREE.Vector2(-4.87, -5.3), radius: 0.5 },
      { shape: 'circle', center: new THREE.Vector2(-2.87, -5.3), radius: 0.5 },
      // Pet workshop footprint
      { shape: 'box', center: new THREE.Vector2(-6, -11.8), halfWidth: 4.1, halfHeight: 1.6 },
      // Arena footprint
      { shape: 'box', center: new THREE.Vector2(20, -14), halfWidth: 4.2, halfHeight: 3.2 },
      // Fountain in lake
      { shape: 'circle', center: new THREE.Vector2(6, -4), radius: 0.6 },
    ];
    const buildingObstaclePositions: { x: number; y: number; hw: number; hh: number }[] = [];
    buildingObstaclePositions.forEach((bp) => {
      obstacleHitboxes.push({ shape: 'box' as const, center: new THREE.Vector2(bp.x, bp.y), halfWidth: bp.hw, halfHeight: bp.hh });
    });
    obstacleHitboxesRef.current = obstacleHitboxes;
    workshopDoorHitboxRef.current = {
      shape: 'circle',
      center: new THREE.Vector2(-6, -10.3),
      radius: 1.5,
    };

    arenaDoorHitboxRef.current = {
      shape: 'circle',
      center: new THREE.Vector2(20, -17.5),
      radius: 1.6,
    };

    roomObstacleHitboxesRef.current = [
      { shape: 'box', center: new THREE.Vector2(-3.2, 3.25), halfWidth: 0.9, halfHeight: 0.34 },
      { shape: 'box', center: new THREE.Vector2(2.9, 3.05), halfWidth: 0.82, halfHeight: 0.44 },
      { shape: 'box', center: new THREE.Vector2(3.4, -2.4), halfWidth: 0.72, halfHeight: 0.5 },
      { shape: 'box', center: new THREE.Vector2(ROOM_OWNER_POS.x, ROOM_OWNER_POS.y), halfWidth: 0.7, halfHeight: 0.7 },
      { shape: 'box', center: new THREE.Vector2(-1.9, 0.5), halfWidth: 0.7, halfHeight: 0.7 },
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

    const nameSprite = createNameSprite('You', new THREE.Color(localColor));
    localGroup.add(nameSprite);
    localGroup.position.set(0, -7, 0.30);
    scene.add(localGroup);
    localPositionRef.current.set(0, -7);
    const localRobot = { root: localGroup, nameSprite, body: torso, shadow: torso, leftPupil: torso, rightPupil: torso, antennaTip: torso };
    localRobotRef.current = localRobot;

    const sparky = createRobotVisual(new THREE.Color(0xfacc15), 'Sparky');
    sparky.root.scale.set(0.8, 0.8, 0.8);
    sparky.root.position.set(NPC_POSITION.x, NPC_POSITION.y, 0.10);
    outdoorGroup.add(sparky.root);
    if (sparky.body) sparky.body.visible = true;
    // Neck connector so head doesn't float
    const sparkyNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 8), createToonMaterial(0xfacc15));
    sparkyNeck.rotation.x = Math.PI / 2;
    sparkyNeck.position.set(0, 0, 0.35);
    sparky.root.add(sparkyNeck);
    const sparkyQuestMarker = createExclamationMarker();
    sparkyQuestMarker.position.set(0, 0, 1.8);
    sparkyQuestMarker.renderOrder = 61;
    sparky.root.add(sparkyQuestMarker);
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
    owner.root.position.set(ROOM_OWNER_POS.x, ROOM_OWNER_POS.y, 0.05);
    workshopRoomGroup.add(owner.root);
    roomOwnerVisualRef.current = owner;

    const petDisplay = createRobotVisual(new THREE.Color(0x60a5fa), 'Shop Pet');
    petDisplay.root.scale.set(0.6, 0.6, 0.6);
    petDisplay.root.position.set(-1.9, 0.5, 0.05);
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
      cg.add(cn);
      cg.scale.set(1.8, 1.8, 1.8);
      const visual = { root: cg, nameSprite: cn };
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
      workshopCustomersRef.current.push(npc);
    };

    let lastTime = performance.now();
    const animate = (now: number) => {
      try {
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const worldTime = now / 1000;

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
            const hitsRoomObstacle = collidesWithAny(candidate, roomObstacleHitboxesRef.current);
            if (!hitsRoomObstacle) {
              localPositionRef.current.copy(candidate);
              localRobot.root.position.set(candidate.x, candidate.y, 0.01);
            } else {
              moved = false;
            }
          } else if (inArenaRoomRef.current) {
            candidate.x = Math.max(-5.8, Math.min(5.8, candidate.x));
            candidate.y = Math.max(-5.8, Math.min(5.8, candidate.y));
            localPositionRef.current.copy(candidate);
            localRobot.root.position.set(candidate.x, candidate.y, 0.01);
          } else {
            const maxRadius = ISLAND_RADIUS - PLAYER_RADIUS - 0.35;
            if (candidate.length() > maxRadius) candidate.setLength(maxRadius);
            const hitsObstacle = collidesWithAny(candidate, obstacleHitboxesRef.current);
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
              if (sparkyQuestStageRef.current === 'intro') {
                setSparkyQuestStage('earn-money');
              }
              setWorkshopIntroStep(0);
              setRoomEntryFlash(true);
              if (roomEntryFlashTimeoutRef.current !== null) {
                window.clearTimeout(roomEntryFlashTimeoutRef.current);
              }
              roomEntryFlashTimeoutRef.current = window.setTimeout(() => setRoomEntryFlash(false), 460);
              localPositionRef.current.copy(ROOM_SPAWN);
              localRobot.root.position.set(ROOM_SPAWN.x, ROOM_SPAWN.y, 0.01);
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
              localPositionRef.current.copy(ARENA_ROOM_SPAWN);
              localRobot.root.position.set(ARENA_ROOM_SPAWN.x, ARENA_ROOM_SPAWN.y, 0.01);
              keyStateRef.current.clear();
              moved = false;
            } else if (!hitsObstacle) {
              localPositionRef.current.copy(candidate);
              localRobot.root.position.set(candidate.x, candidate.y, 0.01);
            } else {
              moved = false;
            }
          }
        }
      }

      if (moved && now - sendAtRef.current >= NETWORK_SYNC_MS) {
        sendPosition(localPositionRef.current.x, localPositionRef.current.y);
        sendAtRef.current = now;
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
        localGroup.position.z = 0.30 + bob;
      } else {
        localGroup.position.z = 0.30;
      }

      if (!inWorkshopRoomRef.current && !inArenaRoomRef.current) {
        const distanceToSparky = localPositionRef.current.distanceTo(NPC_POSITION);
        const chaiHitbox = chaiShopHitboxRef.current;
        let outsidePrompt: string | null = null;

        if (profileLoadedRef.current && distanceToSparky < SPARKY_INTERACTION_DISTANCE && !showTutorialRef.current && !tutorialCompleteRef.current) {
          setShowTutorial(true);
          setTutorialStep(0);
          setCode('String petName = "Milo";');
          setOutput('');
          setSuccess(false);
        } else if (distanceToSparky > 2.25 && showTutorialRef.current) {
          setShowTutorial(false);
          setTutorialStep(0);
          setSuccess(false);
          setOutput('');
        }

        if (
          sparkyQuestStageRef.current === 'buy-chai' &&
          chaiHitbox &&
          isInsideHitbox(localPositionRef.current, chaiHitbox)
        ) {
          outsidePrompt = 'Masala Chai';
        } else if (
          sparkyQuestStageRef.current === 'gift-ready' &&
          distanceToSparky < SPARKY_INTERACTION_DISTANCE
        ) {
          outsidePrompt = 'Sparky';
        } else if (
          sparkyQuestStageRef.current !== 'done' &&
          distanceToSparky < SPARKY_INTERACTION_DISTANCE &&
          tutorialCompleteRef.current
        ) {
          outsidePrompt = 'Sparky';
        }

        if (worldInteractionRequestedRef.current) {
          worldInteractionRequestedRef.current = false;
          if (sparkyQuestStageRef.current === 'earn-money' && distanceToSparky < SPARKY_INTERACTION_DISTANCE) {
            setSparkyModal(`Head to the PET WORKSHOP across the street and earn $10 fixing robot pets!\nCurrent: $${moneyRef.current}/10`);
          } else if (sparkyQuestStageRef.current === 'buy-chai' && chaiHitbox && isInsideHitbox(localPositionRef.current, chaiHitbox)) {
            if (moneyRef.current >= 10) {
              setMoney((prev) => prev - 10);
              setSparkyQuestStage('gift-ready');
              if (sparkyQuestMarkerRef.current) sparkyQuestMarkerRef.current.visible = true;
            } else {
              setWorkshopOutput('You need $10 before you can buy Sparky masala chai.');
            }
          } else if (sparkyQuestStageRef.current === 'gift-ready' && distanceToSparky < SPARKY_INTERACTION_DISTANCE) {
            setMoney((prev) => prev + 5);
            setSparkyQuestStage('done');
            if (sparkyQuestMarkerRef.current) sparkyQuestMarkerRef.current.visible = false;
            setWorkshopOutput('🎁 Sparky: Thanks! You got a gift.');
          }
        }

        setInteractionPromptName(outsidePrompt);
        if (!outsidePrompt && workshopOutput && !inWorkshopRoomRef.current) setWorkshopOutput('');
        interactionCandidateIdRef.current = null;
      }

      sparkyWaitTimerRef.current += delta;
      if (sparkyWaitTimerRef.current > 1.5 && !showTutorialRef.current) {
        const target = SPARKY_PATH[sparkyPathIndexRef.current];
        const dist = sparky.root.position.distanceTo(new THREE.Vector3(target.x, target.y, 0.01));
        if (dist < 0.15) {
          sparkyPathIndexRef.current = (sparkyPathIndexRef.current + 1) % SPARKY_PATH.length;
          sparkyWaitTimerRef.current = 0;
        } else {
          const dir = new THREE.Vector2(target.x - sparky.root.position.x, target.y - sparky.root.position.y).normalize();
          sparky.root.position.x += dir.x * 1.8 * delta;
          sparky.root.position.y += dir.y * 1.8 * delta;
        }
      }
      sparky.root.position.z = 0.01 + Math.sin(worldTime * 4) * 0.04;
      animateRobotVisual(sparky, worldTime, 0.5, -0.3, 0.15);
      if (sparkyQuestMarkerRef.current) {
        sparkyQuestMarkerRef.current.position.y = 2.72 + Math.sin(worldTime * 5.2) * 0.08;
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
            if (npc.stage !== 'browsing') continue;
            const distance = npc.position.distanceTo(localPositionRef.current);
            if (distance > CUSTOMER_TALK_DISTANCE) continue;
            if (!closestCandidate || distance < closestCandidate.position.distanceTo(localPositionRef.current)) {
              closestCandidate = npc;
            }
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
          } else if (npc.stage === 'browsing' || npc.stage === 'awaiting-code') {
            npc.target.copy(npc.position);
          } else if (npc.stage === 'leaving') {
            npc.target.copy(ROOM_CUSTOMER_EXIT_POS);
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
            if (!collidesWithAny(candidate, roomObstacleHitboxesRef.current)) {
              npc.position.copy(candidate);
            } else {
              const slideX = npc.position.clone().add(new THREE.Vector2(stepVector.x, 0));
              const slideY = npc.position.clone().add(new THREE.Vector2(0, stepVector.y));
              if (!collidesWithAny(slideX, roomObstacleHitboxesRef.current)) {
                npc.position.copy(slideX);
              } else if (!collidesWithAny(slideY, roomObstacleHitboxesRef.current)) {
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
            setMoney((prev) => prev + 2);
            setWorkshopOutput(`✅ ${npc.request.customerName} reached the register. You earned $2.`);
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

      for (const avatar of Object.values(remoteAvatarsRef.current)) {
        avatar.visual.root.visible = !inWorkshopRoomRef.current;
        const prevX = avatar.visual.root.position.x;
        const prevY = avatar.visual.root.position.y;
        avatar.visual.root.position.x += (avatar.target.x - avatar.visual.root.position.x) * REMOTE_LERP;
        avatar.visual.root.position.y += (avatar.target.y - avatar.visual.root.position.y) * REMOTE_LERP;
        const velocity = Math.hypot(avatar.visual.root.position.x - prevX, avatar.visual.root.position.y - prevY);
        avatar.walkTime += delta * (1 + velocity * 20);
        const lookX = avatar.target.x - avatar.visual.root.position.x;
        const lookY = avatar.target.y - avatar.visual.root.position.y;
        animateRobotVisual(avatar.visual, avatar.walkTime, velocity * 24, lookX, lookY);
      }

      clouds.forEach((cloud, i) => {
        cloud.position.x += Math.sin(worldTime * (0.08 + i * 0.03) + i) * 0.0025;
      });

      marketLamps.children.forEach((lamp, i) => {
        lamp.scale.setScalar(0.95 + Math.sin(worldTime * 3 + i * 0.4) * 0.08);
      });
      if (petShopMarkerRef.current && petShopMarkerRef.current.visible) {
        petShopMarkerRef.current.position.y = 3.6 + Math.sin(worldTime * 3.8) * 0.22;
      }
      if (arenaMarkerRef.current && arenaMarkerRef.current.visible) {
        arenaMarkerRef.current.position.y = 4 + Math.sin(worldTime * 3.5) * 0.22;
      }

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
      disposeObject(marketLamps);
      disposeObject(ps);
      disposeObject(petShopMarker);
      disposeObject(owner.root);
      if (roomPetVisualRef.current) {
        disposeObject(roomPetVisualRef.current.root);
        roomPetVisualRef.current = null;
      }
      workshopCustomersRef.current.forEach((npc) => disposeObject(npc.visual.root));
      workshopCustomersRef.current = [];
      roomCustomerGroupRef.current = null;
      roomOwnerVisualRef.current = null;
      outdoorGroupRef.current = null;
      workshopRoomGroupRef.current = null;
      arenaRoomGroupRef.current = null;
      arenaBuildingRef.current = null;
      arenaMarkerRef.current = null;
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
    if (petShopMarkerRef.current) petShopMarkerRef.current.visible = shopUnlocked && !inWorkshopRoom;
    if (arenaMarkerRef.current) arenaMarkerRef.current.visible = !inArenaRoom;
  }, [shopUnlocked, inWorkshopRoom, inArenaRoom]);

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
    triggerEvent('client-arena-join', {});
    fetch('/api/arena?action=players').then(r => r.json()).then(d => { if (d.players) setArenaPlayers(d.players); }).catch(() => {});
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
      if (!remoteAvatarsRef.current[remoteUserId]) {
        const color = hashColor(remoteUserId);
        const visual = createRobotVisual(color, name);
        visual.root.position.set(data.x, data.y, 0.01);
        if (outdoorGroupRef.current) {
          outdoorGroupRef.current.add(visual.root);
        } else {
          scene.add(visual.root);
        }
        remoteAvatarsRef.current[remoteUserId] = {
          visual,
          target: new THREE.Vector2(data.x, data.y),
          name,
          walkTime: performance.now() / 1000,
        };
      } else {
        const avatar = remoteAvatarsRef.current[remoteUserId];
        avatar.target.set(data.x, data.y);
        if (avatar.name !== name) {
          avatar.visual.root.remove(avatar.visual.nameSprite);
          disposeObject(avatar.visual.nameSprite);
          avatar.visual.nameSprite = createNameSprite(name, hashColor(remoteUserId));
          avatar.visual.root.add(avatar.visual.nameSprite);
          avatar.name = name;
        }
      }
    }

    for (const existingId of Object.keys(remoteAvatarsRef.current)) {
      if (activeIds.has(existingId)) continue;
      const avatar = remoteAvatarsRef.current[existingId];
      if (outdoorGroupRef.current) {
        outdoorGroupRef.current.remove(avatar.visual.root);
      } else {
        scene.remove(avatar.visual.root);
      }
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
    const activePhase = tutorialPhases[tutorialStep];
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
        const nextPhase = tutorialPhases[nextStep];

        setSuccess(true);
        setSparkleBurst(true);
        playHappyChime();

        if (nextPhase && nextPhase.kind === 'challenge') {
          setOutput(`✅ Nice! ${activePhase.title} complete.`);
          setSparkleBurst(false);
        } else {
          setOutput('✅ Amazing! You finished name, color, and age variables. Get $10 to buy me masala chai and I\'ll get you a gift.');
          setTutorialComplete(true);
          setShopUnlocked(true);
          setSparkyQuestStage('earn-money');
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
      localRobotRef.current.root.position.set(outsideDoor.x, outsideDoor.y, 0.01);
    }
    if (sparkyQuestStageRef.current === 'earn-money' && moneyRef.current >= 10) {
      setSparkyQuestStage('buy-chai');
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
    const outsideArena = new THREE.Vector2(20, -16.5);
    localPositionRef.current.copy(outsideArena);
    if (localRobotRef.current) {
      localRobotRef.current.root.position.set(outsideArena.x, outsideArena.y, 0.01);
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

    setWorkshopOutput(`✅ Nice. ${activeCustomer.customerName} is walking to the register now — meet them there for $2.`);
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

      <WorkshopPanel activeCustomer={activeCustomer} workshopCode={workshopCode} setWorkshopCode={setWorkshopCode} workshopOutput={workshopOutput} inWorkshopRoom={inWorkshopRoom} runWorkshopCode={runWorkshopCode} reopenWorkshopIntro={reopenWorkshopIntro} leaveWorkshopRoom={leaveWorkshopRoom} />

      <ArenaOverlay inArenaRoom={inArenaRoom} arenaPlayers={arenaPlayers} arenaChallenge={arenaChallenge} arenaCode={arenaCode} setArenaCode={setArenaCode} arenaOutput={arenaOutput} arenaBattleActive={arenaBattleActive} challengePlayer={challengePlayer} acceptChallenge={acceptChallenge} declineChallenge={declineChallenge} submitArenaCode={submitArenaCode} leaveArenaRoom={leaveArenaRoom} />

      {roomEntryFlash && <div className="pointer-events-none fixed inset-0 z-[70] animate-pulse bg-cyan-200/35 backdrop-blur-[1px]" />}

      <div className="w-full h-screen" ref={mountRef} />

      <div className="fixed top-4 right-4 z-50 flex gap-3">
        <a href="/guilds" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg hover:bg-black/70 transition-colors" title="Guilds">⚔️</a>
        <a href="/friends" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg hover:bg-black/70 transition-colors" title="Friends">👥</a>
        <a href="/profile" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg hover:bg-black/70 transition-colors" title="Profile">👤</a>
        <a href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg hover:bg-black/70 transition-colors" title="Settings">⚙️</a>
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

      <div className="absolute bottom-16 left-4 max-w-[min(90vw,24rem)] rounded-lg border border-amber-300/40 bg-slate-950/80 px-4 py-3 text-sm md:text-base text-amber-100 shadow-lg">
        <div className="font-semibold text-amber-300">Mission</div>
        <div className="mt-1">{missionText}</div>
      </div>

      <div className="absolute bottom-4 left-4 bg-black/40 text-white text-sm md:text-base px-4 py-3 rounded-lg">
        Arrow Keys / WASD to move • PET WORKSHOP is always open • Look for ❗ then enter the door
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
      <TutorialOverlay showTutorial={showTutorial} tutorialStep={tutorialStep} setTutorialStep={setTutorialStep} code={code} setCode={setCode} highlightedCode={highlightedCode} output={output} setOutput={setOutput} success={success} setSuccess={setSuccess} sparkleBurst={sparkleBurst} codeInputRef={codeInputRef} codePreviewRef={codePreviewRef} onEditorScroll={onEditorScroll} checkAnswer={checkAnswer} setShowTutorial={setShowTutorial} tutorialPhases={tutorialPhases} />
    </div>
  );
}
