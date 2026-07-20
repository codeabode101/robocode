'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTypewriterDialog } from '@/hooks/useTypewriterDialog';
import { useDialogEnter } from '@/hooks/useDialogEnter';
import * as THREE from 'three';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import type { SparkyQuestStage, CustomerRequest, TutorialPhase, RoomType, GameGoal, ScrapPartId, SpecSheetPrompt } from '@/components/game/types';
import Editor from '@/components/game/Editor';
import TutorialOverlay from '@/components/game/TutorialOverlay';
import ModalShell from './ModalShell';
import WorkshopPanel from '@/components/game/WorkshopPanel';
// import ArenaOverlay from '@/components/game/ArenaOverlay'; // To re-enable arena
import CodeInput from '@/components/game/CodeInput';
import type { RobotVisual, HumanVisual } from '@/components/game/scene';
import {
  createLabelSprite, createNameSprite, createGradientTexture, getTileTexture,
  createToonMaterial, createTexturedToonMaterial,
  createGrid, createPalmTree, createBazaarShop, createRangoli, addWindows, addOutline, applyShadows, disposeObject,
  createRobotVisual, buildPlayerVisual, createHumanVisual, createPartsShop, createPartModel, createApartmentBuilding, animateRobotVisual, LABEL_BUILD_TAG, WALK_BOB_SPEED, loadPlayerModel,
  addExclamationMarker, createRepairKiosk, animateRepairKiosk, animateRepairSparky, animateSparkyWave,
  createAbandonedBuilding,
} from '@/components/game/scene';
import { pickRandom, hashColor, getWorkshopRequestSignature, validateWorkshopCode, createPartIcon, createDataRequest, computeCameraZoom, createCardboardBox, createLaptop, createWire, createWireCoil, animateWirePulse, openBoxLid, isInsideHitbox, collidesWithAny, escapeHtml, highlightJava, computeGoal, getMissionText, walkPlayer } from '@/components/game/helpers';
import type { BuildingFootprint } from '@/components/game/helpers';
import { buildObstacles } from '@/components/game/city';
import { unit1Phases, unit2Phases } from '@/components/game/tutorialData';
import { PARTS_CATALOG, DATA_CUSTOMER_NAMES } from '@/components/game/types';
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
  characterId: string;
}

  const ISLAND_RADIUS = 40;
  const SPARKY_PATH = [
    { x: -2.87, y: -6.1 }, { x: -2.87, y: -6.9 }, { x: -2.87, y: -6.1 },
  ];
const PLAYER_RADIUS = 0.48;
const MOVE_SPEED = 3.8;
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
const RAFIQ_GREET_STEPS = [
  { speaker: 'Rafiq', text: "Wait — who are you?" },
  { speaker: 'Rafiq', text: "I wasn't expecting anyone today." },
] as const;
const RAFIQ_MEET_STEPS = [
  { speaker: 'Rafiq', text: "A letter from Sparky?" },
  { speaker: 'Rafiq', text: "'My friend needs work.' Hah!" },
  { speaker: 'Rafiq', text: "Good old Sparky. Lucky for me, I need help." },
  { speaker: 'Rafiq', text: "Customers come for custom robots." },
  { speaker: 'Rafiq', text: "You write code that matches their request." },
  { speaker: 'Rafiq', text: "Name. Color. Size. Nail all three." },
  { speaker: 'Rafiq', text: "Code wins, they leave happy. You get paid." },
  { speaker: 'Rafiq', text: "Give it a try. I'm here if you're stuck." },
] as const;
const PLAYER_EYE_HEIGHT = 1.5;
const ROOM_SPAWN = new THREE.Vector2(0, -3.7);
const APARTMENT_SPAWN = new THREE.Vector2(0, -1.5);
const SHOP_SPAWN = new THREE.Vector2(0, 1.2);
const ROOM_OWNER_POS = new THREE.Vector2(-2.5, 2.0);
const RAFIQ_APPROACH_DIR = new THREE.Vector2(ROOM_OWNER_POS.x - ROOM_SPAWN.x, ROOM_OWNER_POS.y - ROOM_SPAWN.y).normalize();
const RAFIQ_ARRIVAL_TARGET = new THREE.Vector2(ROOM_OWNER_POS.x - RAFIQ_APPROACH_DIR.x * 0.85, ROOM_OWNER_POS.y - RAFIQ_APPROACH_DIR.y * 0.85);
const CUSTOMER_TALK_DISTANCE = 1.25;
const ROOM_CUSTOMER_EXIT_POS = new THREE.Vector2(0, -5.5);
const CUSTOMER_QUEUE_POSITIONS = [
  new THREE.Vector2(2.0, 1.80),
  new THREE.Vector2(2.0, 0.95),
  new THREE.Vector2(2.0, 0.10),
  new THREE.Vector2(2.0, -0.75),
];

const SPARKY_INTERACTION_DISTANCE = 1.7;
const PET_COLOR_HEX: Record<string, number> = {
  red: 0xef4444, blue: 0x3b82f6, green: 0x22c55e, gold: 0xeab308,
  teal: 0x14b8a6, violet: 0x8b5cf6, orange: 0xf97316, silver: 0x9ca3af,
};
const CUSTOMER_NAMES = ['Aarav', 'Anaya', 'Rohan', 'Isha', 'Kabir', 'Meera', 'Vihaan', 'Diya'];
const PET_NAMES = ['Bolt', 'Pixel', 'Nano', 'Mochi', 'Orbit', 'Zippy', 'Luna', 'Rex'];
const PET_COLORS = ['red', 'blue', 'green', 'gold', 'teal', 'violet', 'orange', 'silver'];
const REQUEST_PATTERNS: ('name' | 'color' | 'size' | 'hasWireSurge')[][] = [
  ['name'], ['color'], ['size'], ['hasWireSurge'],
  ['name', 'color'], ['name', 'size'], ['name', 'hasWireSurge'],
  ['color', 'size'], ['color', 'hasWireSurge'], ['size', 'hasWireSurge'],
  ['name', 'color', 'size'], ['name', 'color', 'hasWireSurge'],
  ['name', 'size', 'hasWireSurge'], ['color', 'size', 'hasWireSurge'],
  ['name', 'color', 'size', 'hasWireSurge'],
];
const WORKSHOP_INTRO_STEPS = [
  { speaker: 'Rafiq', text: "Customers line up for robot requests. Walk up to the front and press Space to start." },
  { speaker: 'Rafiq', text: "Each asks for different properties (name, color, size). Write code that matches exactly." },
  { speaker: 'Rafiq', text: "Get it right and they leave happy. You get paid instantly." },
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
  visual: HumanVisual & { marker?: THREE.Sprite; leftLegPivot?: THREE.Group; rightLegPivot?: THREE.Group; leftArm?: THREE.Mesh; rightArm?: THREE.Mesh; leftArmPivot?: THREE.Group; rightArmPivot?: THREE.Group };
  cargoRobot: ReturnType<typeof createRobotVisual>;
  position: THREE.Vector2;
  target: THREE.Vector2;
  queueIndex: number;
  speed: number;
  request: CustomerRequest;
  stage: 'walking-to-queue' | 'waiting' | 'awaiting-code' | 'leaving';
  waypoints?: THREE.Vector2[];
  wpIndex?: number;
};

function computeMarkerVisibility(
  room: RoomType,
  stage: SparkyQuestStage,
  backpack: ScrapPartId[],
  money: number,
  cutsceneDone: boolean,
  sparkyHomeArrived: boolean,
  workshopIntroSeen: boolean,
  batteryInstalled: boolean,
) {
  const goal = computeGoal(stage, backpack, money, cutsceneDone, workshopIntroSeen, batteryInstalled);
  const hasBattery = backpack.includes('battery');
  return {
    sparkyOutdoor: goal === 'watch-cutscene' && room === 'outside',
    workshopDoor: (goal === 'show-letter-to-rafiq' || goal === 'earn-money') && room === 'outside',
    shopDoor: goal === 'buy-battery',
    apartmentDoor: goal === 'install-battery' && room === 'outside',
    apartmentExit: room === 'apartment' && goal !== 'install-battery',
    workshopExit: room === 'workshop' && goal !== 'earn-money' && goal !== 'show-letter-to-rafiq',
    shopExit: room === 'shop',
    rafiqMarker: room === 'workshop' && goal === 'show-letter-to-rafiq',
  };
}

function TFB({ show, step, steps, text, icon, onEnter, ttsOn, ttsCharIdx, onTtsToggle, hideEnter, codeBlocks }: {
  show: boolean; step: number;
  steps: readonly { speaker: string; text: string }[] | { speaker: string; text: string }[];
  text: string; icon: 'robot' | 'person' | 'auto'; onEnter: () => void;
  ttsOn: boolean; ttsCharIdx: number | null; onTtsToggle: (t: string) => void;
  hideEnter?: boolean; codeBlocks?: boolean;
}) {
  if (!show) return null;
  const cur = steps[step] ?? steps[0];
  if (!cur) return null;
  const svg = () => {
    if (icon === 'auto') return cur.speaker === 'Sparky' ? 'robot' : 'person';
    return icon;
  };
  const isLast = step >= steps.length - 1;
  const renderTxt = (t: string) => {
    if (!codeBlocks) return t;
    return t.split(/(`[^`]+`)/g).map((seg, i) =>
      seg.startsWith('`') && seg.endsWith('`')
        ? <code key={i} className="font-mono text-amber-300 bg-slate-800 px-1.5 rounded">{seg.slice(1, -1)}</code>
        : seg
    );
  };
  const body = ttsOn && ttsCharIdx !== null
    ? (() => {
        const bounds: Array<{ start: number; end: number }> = [];
        const re = /\S+/g; let m;
        while ((m = re.exec(cur.text)) !== null) bounds.push({ start: m.index, end: m.index + m[0].length });
        const w = bounds.find(b => ttsCharIdx! >= b.start && ttsCharIdx! < b.end);
        if (!w || w.start > text.length) return renderTxt(text);
        return <>{renderTxt(text.slice(0, w.start))}<span className="underline decoration-amber-400 decoration-2 underline-offset-4">{renderTxt(text.slice(w.start, Math.min(w.end, text.length)))}</span>{renderTxt(text.slice(Math.min(w.end, text.length)))}</>;
      })()
    : renderTxt(text);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
      <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
      <div className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/95 border-t-2 border-amber-500/50 shadow-2xl flex flex-col justify-center" style={{ height: '30vh' }}>
        <div className="px-8 md:px-16 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2 mb-2">
            {svg() === 'robot' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0">
                <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-8 8-8s8 4 8 8" />
              </svg>
            )}
            <span className="text-amber-300 font-bold text-xl tracking-wide">{cur.speaker}</span>
            <button onClick={() => onTtsToggle(cur.text)} className="ml-auto p-1.5 rounded hover:bg-white/10 text-amber-300/70 hover:text-amber-300 transition-colors" title={ttsOn ? 'Stop' : 'Read aloud'}>
              {ttsOn ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </button>
          </div>
          <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
            {body}<span className="animate-pulse text-amber-400/80">▌</span>
          </p>
          {(!hideEnter || isLast) && (
            <div className="flex justify-end mt-4">
              <button className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition-colors focus:outline-none" onClick={onEnter}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="14 7 9 12 14 17" /><line x1="21" y1="12" x2="9" y2="12" /><line x1="3" y1="12" x2="5" y2="12" />
                </svg>
                <span className="text-sm font-semibold tracking-wide uppercase">Enter</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GameMap({ userId, apinatorAppKey, apinatorCluster, characterId }: GameMapProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLTextAreaElement>(null);
  const codePreviewRef = useRef<HTMLPreElement>(null);
  const mp = useMultiplayer(userId, apinatorAppKey, apinatorCluster);
  const { players, connected, playerCount, sendPosition, triggerEvent, positionBroadcastRef } = mp;
  positionBroadcastRef.current = () => {
    const room = inWorkshopRoomRef.current ? 'workshop' : inApartmentRoomRef.current ? 'apartment' : inShopRoomRef.current ? 'shop' : 'outside';
    const spawns: Record<string, { x: number; y: number }> = { workshop: ROOM_SPAWN, apartment: APARTMENT_SPAWN, shop: { x: 0, y: 1.2 } };
    const pos = room !== 'outside' ? spawns[room] : { x: localPositionRef.current.x, y: localPositionRef.current.y };
    sendPosition(pos.x, pos.y, room, yawRef.current);
  };

  const localPositionRef = useRef(new THREE.Vector2(0, 0));
  const localRobotRef = useRef<RobotVisual | null>(null);
  const leftLegPivotRef = useRef<THREE.Group | null>(null);
  const rightLegPivotRef = useRef<THREE.Group | null>(null);
  const rightArmPivotRef = useRef<THREE.Group | null>(null);
  const rightArmRef = useRef<THREE.Object3D | null>(null);
  const playerMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const midleActionRef = useRef<THREE.AnimationAction | null>(null);
  const mwalkActionRef = useRef<THREE.AnimationAction | null>(null);
  const mwaveActionRef = useRef<THREE.AnimationAction | null>(null);
  const playerGlTFRootRef = useRef<THREE.Group | null>(null);
  const playerRightHandBoneRef = useRef<THREE.Bone | null>(null);
  const waveTimerRef = useRef(0);
  const prevPlayerPosRef = useRef(new THREE.Vector2(0, 0));
  const onSparkyDlgCloseRef = useRef<(() => void) | null>(null);
  const remoteAvatarsRef = useRef<Record<string, RemoteAvatar>>({});
  const keyStateRef = useRef<Set<string>>(new Set());
  const tutorialPhasesRef = useRef<TutorialPhase[]>(unit1Phases);
  const tutorialStepRef = useRef(0);
  const robotNameRef = useRef('Scrap');
  const showTutorialRef = useRef(false);
  const tutorialCompleteRef = useRef(false);
  const shopUnlockedRef = useRef(false);
  const inWorkshopRoomRef = useRef(false);
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
  const repairsDoneRef = useRef(0);
  const customerSpawnTimerRef = useRef(0);
  const spawnCustomerRef = useRef<(() => void) | null>(null);
  const currentCustomerIdRef = useRef<string | null>(null);
  const interactionRequestedRef = useRef(false);
  const worldInteractionRequestedRef = useRef(false);
  const interactionCandidateIdRef = useRef<string | null>(null);
  const workshopIntroSeenRef = useRef(false);
  const rafiqMeetAutoTriggeredRef = useRef(false);
  const rafiqWalkPhaseRef = useRef<'idle' | 'walking' | 'arriving' | 'greeting' | 'handing-letter' | 'reached'>('idle');
  const rafiqCutsceneTimerRef = useRef(0);
  const rafiqBaseQuatRef = useRef(new THREE.Quaternion());
  const rafiqTargetFacingRef = useRef(0);
  const rafiqLetterSpriteRef = useRef<THREE.Group | null>(null);
  const rafiqRightArmRef = useRef<THREE.Mesh | null>(null);
  const roomOwnerVisualRef = useRef<RobotVisual | null>(null);
  const roomPetVisualRef = useRef<RobotVisual | null>(null);
  const roomCustomerGroupRef = useRef<THREE.Group | null>(null);
  const workshopRegisterDockRef = useRef<THREE.Group | null>(null);
  const workshopRegisterComputerRef = useRef<THREE.Group | null>(null);
  const workshopRegisterWireRef = useRef<THREE.Mesh | null>(null);
  const roomEntryFlashTimeoutRef = useRef<number | null>(null);
  const scrapRobotRef = useRef<ReturnType<typeof createRobotVisual> | null>(null);
  const scrapChallengesDoneRef = useRef(0);
  const scrapFollowerRef = useRef<ReturnType<typeof createRobotVisual> | null>(null);
  const scrapFollowerEnabledRef = useRef(false);
  const miniRobotRefs = useRef<ReturnType<typeof createRobotVisual>[]>([]);
  const sceneBgOverrideRef = useRef<number | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  const outdoorGroupRef = useRef<THREE.Group | null>(null);
  const workshopRoomGroupRef = useRef<THREE.Group | null>(null);
  const apartmentRoomGroupRef = useRef<THREE.Group | null>(null);
  const apartmentDoorHitboxRef = useRef<CircleHitbox | null>(null);
  const apartmentDoorArmedRef = useRef(false);
  const apartmentDoorMarkerRef = useRef<THREE.Sprite | null>(null);
  const aptExitMarkerRef = useRef<THREE.Sprite | null>(null);
  const apartmentSparkyRef = useRef<ReturnType<typeof createRobotVisual> | null>(null);
  const sparkyQuestMarkerRef = useRef<THREE.Sprite | null>(null);
  const workshopDoorMarkerRef = useRef<THREE.Sprite | null>(null);
  const shopDoorMarkerRef = useRef<THREE.Sprite | null>(null);
  const rafiqMarkerRef = useRef<THREE.Sprite | null>(null);
  const workshopExitMarkerRef = useRef<THREE.Sprite | null>(null);
  const shopExitMarkerRef = useRef<THREE.Sprite | null>(null);
  const shopDoorHitboxRef = useRef<CircleHitbox | null>(null);
  const shopDoorArmedRef = useRef(true);
  const shopRoomGroupRef = useRef<THREE.Group | null>(null);
  const shopNpcRef = useRef<{ root: THREE.Group } | null>(null);
  const sparkyPathIndexRef = useRef(0);
  const sparkyWaitTimerRef = useRef(0);
  const outdoorSparkyRef = useRef<ReturnType<typeof createRobotVisual> | null>(null);
  const scrapPartMeshRef = useRef<THREE.Mesh | null>(null);
  const sparkyInstallPhaseRef = useRef<'walk-to-bench' | 'weld' | 'attach-part' | 'walk-back' | 'done' | null>(null);
  const sparkyInstallTimerRef = useRef(0);
  const sparkyInstallPartIdRef = useRef<ScrapPartId | null>(null);
  const sparkyInstallNextStageRef = useRef<SparkyQuestStage | null>(null);
  const installBatteryPhaseRef = useRef<'approach' | 'hand-off' | 'sparky-walk' | 'open-chest' | 'place-battery' | 'chest-glow' | 'done' | null>(null);
  const installBatteryTimerRef = useRef(0);
  const batteryInstalledRef = useRef(false);
  const batteryGlowRef = useRef<THREE.Mesh | null>(null);
  const chestPanelRef = useRef<THREE.Mesh | null>(null);
  const scrapOrigBodyRef = useRef<{ mesh: THREE.Mesh; parent: THREE.Object3D } | null>(null);
  const installBatteryPropRef = useRef<THREE.Group | null>(null);
  const batteryLerpStartPosRef = useRef(new THREE.Vector3());
  const batteryLerpEndPosRef = useRef(new THREE.Vector3());
  const lastSparkyDlgTextRef = useRef('');
  const lastShowSparkyDlgRef = useRef(false);
  const lastOutsidePromptRef = useRef<string | null>(null);
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
  const confettiParticlesRef = useRef<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[]>([]);
  const repairCutscenePhaseRef = useRef<'idle' | 'glow' | 'dialog' | 'place-robot' | 'done'>('idle');
  const repairCutsceneTimerRef = useRef(0);
  const repairCustomerRef = useRef<CustomerNpc | null>(null);
  const repairOutputRef = useRef('');
  const registerCutscenePhaseRef = useRef<'idle' | 'place-robot' | 'player-to-robot' | 'player-to-laptop' | 'connect-wire' | 'register-dlg' | 'laptop-ui' | 'done'>('idle');
  const registerCutsceneTimerRef = useRef(0);
  const registerCutsceneCustomerRef = useRef<CustomerNpc | null>(null);
  const sceneBgColorRef = useRef(new THREE.Color());
  const scratchVec2 = useRef(new THREE.Vector2());
  const scratchVec2b = useRef(new THREE.Vector2());
  const scratchVec3 = useRef(new THREE.Vector3());
  const scratchVec3b = useRef(new THREE.Vector3());
  const scratchVec3c = useRef(new THREE.Vector3());
  const scratchVec3Up = useRef(new THREE.Vector3(0, 1, 0));
  const scratchVec3UpY = useRef(new THREE.Vector3(0, 1, 0));
  const scratchQuat = useRef(new THREE.Quaternion());
  const scratchQuatB = useRef(new THREE.Quaternion());
  const cinemCamActiveRef = useRef(false);
  const hideGameUiRef = useRef(false);
  const cutsceneActiveRef = useRef(false);
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

  const playConnectSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      osc.connect(g).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.0);
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1200, ctx.currentTime + 0.6);
      osc2.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.9);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, ctx.currentTime + 0.6);
      g2.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.65);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      osc2.connect(g2).connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 1.0);
    } catch {}
  };

  const playUsbConnectSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const click = ctx.createOscillator();
      click.type = 'square';
      click.frequency.setValueAtTime(120, ctx.currentTime);
      click.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.04);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.25, ctx.currentTime);
      cg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      click.connect(cg).connect(ctx.destination);
      click.start(ctx.currentTime);
      click.stop(ctx.currentTime + 0.04);
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(500, ctx.currentTime + 0.05);
      osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(0, ctx.currentTime + 0.05);
      g1.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.07);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc1.connect(g1).connect(ctx.destination);
      osc1.start(ctx.currentTime + 0.05);
      osc1.stop(ctx.currentTime + 0.22);
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1000, ctx.currentTime + 0.2);
      osc2.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.28);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, ctx.currentTime + 0.2);
      g2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.22);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc2.connect(g2).connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.2);
      osc2.stop(ctx.currentTime + 0.35);
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

  const playThumpSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(g).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
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
  const [cutsceneDone, setCutsceneDone] = useState(false);
  const [batteryInstalled, setBatteryInstalled] = useState(false);
  const [inApartmentRoom, setInApartmentRoom] = useState(false);
  const [showSparkyDlg, setShowSparkyDlg] = useState(false);
  const [sparkyDlgFull, setSparkyDlgFull] = useState('');
  const [sparkyDlgText, setSparkyDlgText] = useState('');
  const [sparkyIntroStep, setSparkyIntroStep] = useState(-1);
  const [showBatteryDlg, setShowBatteryDlg] = useState(false);
  const [batteryDlgStep, setBatteryDlgStep] = useState(0);
  const [batteryDlgText, setBatteryDlgText] = useState('');

  const [scrapVisible, setScrapVisible] = useState(false);
  const scrapVisibleRef = useRef(false);
  const [showScrapToggle, setShowScrapToggle] = useState(false);
  const [showRafiqLetterDlg, setShowRafiqLetterDlg] = useState(false);
  const [rafiqLetterStep, setRafiqLetterStep] = useState(0);
  const [rafiqLetterText, setRafiqLetterText] = useState('');
  const [showWhoDlg, setShowWhoDlg] = useState(false);
  const [whoStep, setWhoStep] = useState(0);
  const [whoText, setWhoText] = useState('');
  const [rafiqCutsceneActive, setRafiqCutsceneActive] = useState(false);
  const [showSparkyExamples, setShowSparkyExamples] = useState(false);
  const [showElectrocuteDlg, setShowElectrocuteDlg] = useState(false);
  const [electrocuteStep, setElectrocuteStep] = useState(0);
  const [electrocuteText, setElectrocuteText] = useState('');
  const regPanelShownRef = useRef(false);
  const [showRegLaptopUI, setShowRegLaptopUI] = useState(false);
  const [regLaptopOutput, setRegLaptopOutput] = useState('');
  const [regLaptopCode, setRegLaptopCode] = useState('');
  const [workshopIntroText, setWorkshopIntroText] = useState('');
  const [moneyAnim, setMoneyAnim] = useState<{active: boolean; bills: number; hits: number; total: number}>({active: false, bills: 0, hits: 0, total: 0});
  const [missionModal, setMissionModal] = useState<{show: boolean; msg: string}>({show: false, msg: ''});
  const prevMissionRef = useRef('');
  const [playerName, setPlayerName] = useState('');
  const [ttsTick, setTtsTick] = useState(0);
  const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsCharIndexRef = useRef<number | null>(null);
  const puterTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const puterTtsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsActiveTextRef = useRef<string | null>(null);
  const nativeRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);
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
  const [showFirstSaleModal, setShowFirstSaleModal] = useState(false);
  const backpack = useGameStoreKey('backpack');
  const [heldSlotIndex, setHeldSlotIndex] = useState<number | null>(null);
  const heldSlotIndexRef = useRef<number | null>(null);
  const heldItemGroupRef = useRef<THREE.Group | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showWasmHint, setShowWasmHint] = useState(true);
  const [shopkeeperGreeting, setShopkeeperGreeting] = useState<string | null>(null);
  const [showControlsModal, setShowControlsModal] = useState(false);
  const [showPerfOverlay, setShowPerfOverlay] = useState(false);
  const [showSemicolonArrow, setShowSemicolonArrow] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = activeModal !== null;
  const modalFrameCountRef = useRef(0);
  const showControlsModalRef = useRef(false);
  const pendingRafiqCutsceneRef = useRef(false);
  const pendingAptCutsceneRef = useRef(false);
  const pendingBatteryCutsceneRef = useRef(false);
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
  const BONUS_DURATION = 45;
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());
  const [debugDisplay, setDebugDisplay] = useState({ fps: '0', x: '0.00', y: '0.00', z: '0.00' });
  const perfOverlayRef = useRef<HTMLDivElement>(null);
  const perfOverlayUpdateRef = useRef(0);
  useEffect(() => {
    if (!debugMode) return;
    const id = setInterval(() => {
      setDebugDisplay({ fps: String(fpsRef.current), x: localPositionRef.current.x.toFixed(2), y: '0.24', z: (-localPositionRef.current.y).toFixed(2) });
    }, 250);
    return () => clearInterval(id);
  }, [debugMode]);

  const apiSync = useCallback((data: Record<string, unknown>) => {
    fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true })
      .catch(() => {});
  }, []);

  const updateQuestStage = useCallback((stage: SparkyQuestStage) => {
    setSparkyQuestStage(stage);
    sparkyQuestStageRef.current = stage;
    fetch('/api/profile/quest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }), keepalive: true }).catch(() => {});
    lastConfirmedQuestRef.current = stage;
  }, []);

  const updateBackpack = useCallback((items: ScrapPartId[]) => {
    gameStore.set('backpack', items);
    fetch('/api/profile/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }), keepalive: true }).catch(() => {});
    lastConfirmedBackpackRef.current = items;
  }, []);

  const updateMoney = useCallback((val: number) => {
    gameStore.set('money', val);
    fetch('/api/profile/money', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: val }), keepalive: true }).catch(() => {});
    lastConfirmedMoneyRef.current = val;
  }, []);

  const createCustomerCargoRobot = useCallback((customerName: string, petColor: string) => {
    const colorHex = PET_COLOR_HEX[petColor] ?? 0x8b5cf6;
    const robot = createRobotVisual(new THREE.Color(colorHex), '');
    robot.nameSprite.visible = false;
    robot.root.scale.set(0.18, 0.18, 0.18);
    return robot;
  }, []);

  const setCustomerRobotMode = useCallback((npc: CustomerNpc, mode: 'carry' | 'register') => {
    const robot = npc.cargoRobot.root;
    if (mode === 'register') {
      workshopRegisterDockRef.current?.attach(robot);
    } else {
      npc.visual.root.attach(robot);
      robot.position.set(0.105, 0.22, 0.11);
      robot.rotation.set(0, Math.PI / 2, 0);
      robot.scale.set(0.35, 0.35, 0.35);
    }
    robot.visible = true;
  }, []);

  // If broken=true: save original color and set materials to grey.
  // If broken=false: restore original color (robot becomes alive).
  const setRobotBroken = useCallback((robotRoot: THREE.Object3D, broken: boolean) => {
    robotRoot.traverse((node) => {
      const m = node as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!(mat instanceof THREE.MeshToonMaterial)) continue;
        if (broken) {
          if (mat.userData.originalColor === undefined)
            mat.userData.originalColor = mat.color.getHex();
          mat.color.setHex(0x6b7280);
        } else {
          const orig = mat.userData.originalColor;
          if (orig !== undefined) mat.color.setHex(orig);
        }
      }
    });
  }, []);

  // Visual defect functions — toggle flag on cargoRobot.root.userData
  const setNameBroken = useCallback((robotRoot: THREE.Object3D, broken: boolean, petName?: string) => {
    robotRoot.userData.nameBroken = broken;
    if (broken) {
      robotRoot.userData.savedPetName = petName ?? '';
    } else {
      delete robotRoot.userData.nameBroken;
      delete robotRoot.userData.savedPetName;
    }
    robotRoot.traverse((node) => {
      const m = node as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!(mat instanceof THREE.MeshToonMaterial)) continue;
        // Wobble flag -> mesh scale oscillation via userData.noiseRot
        mat.userData.noiseRot = broken ? 0.06 : undefined;
      }
    });
  }, []);

  const setSizeBroken = useCallback((robotRoot: THREE.Object3D, broken: boolean) => {
    robotRoot.userData.sizeBroken = broken;
  }, []);

  const cacheToonMats = useCallback((robotRoot: THREE.Object3D) => {
    if (!robotRoot.userData.toonMats) {
      robotRoot.userData.toonMats = [];
      robotRoot.traverse((node) => {
        const m = node as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (mat instanceof THREE.MeshToonMaterial) {
            if (mat.userData.savedEmissive === undefined)
              mat.userData.savedEmissive = mat.emissive.getHex();
            if (mat.userData.savedEmissiveIntensity === undefined)
              mat.userData.savedEmissiveIntensity = mat.emissiveIntensity;
            robotRoot.userData.toonMats.push(mat);
          }
        }
      });
    }
    return robotRoot.userData.toonMats as THREE.MeshToonMaterial[];
  }, []);

  const restoreToonMats = useCallback((robotRoot: THREE.Object3D) => {
    const mats: THREE.MeshToonMaterial[] = robotRoot.userData.toonMats || [];
    for (const mat of mats) {
      const saved = mat.userData.savedEmissive;
      if (saved !== undefined) mat.emissive.setHex(saved);
      const si = mat.userData.savedEmissiveIntensity;
      if (si !== undefined) mat.emissiveIntensity = si;
    }
  }, []);

  const setActivationBroken = useCallback((robotRoot: THREE.Object3D, broken: boolean) => {
    if (broken) { cacheToonMats(robotRoot); robotRoot.userData.activationBroken = true; }
    else { delete robotRoot.userData.activationBroken; restoreToonMats(robotRoot); }
  }, [cacheToonMats, restoreToonMats]);

  const setReinforcedFrameBroken = useCallback((robotRoot: THREE.Object3D, broken: boolean) => {
    robotRoot.userData.reinforcedFrameBroken = broken;
  }, []);

  const setRequiresChargingBroken = useCallback((robotRoot: THREE.Object3D, broken: boolean) => {
    if (broken) { cacheToonMats(robotRoot); robotRoot.userData.requiresChargingBroken = true; }
    else { delete robotRoot.userData.requiresChargingBroken; restoreToonMats(robotRoot); }
  }, [cacheToonMats, restoreToonMats]);

  const setHasRedundantSensorsBroken = useCallback((robotRoot: THREE.Object3D, broken: boolean) => {
    if (broken) { cacheToonMats(robotRoot); robotRoot.userData.hasRedundantSensorsBroken = true; }
    else { delete robotRoot.userData.hasRedundantSensorsBroken; restoreToonMats(robotRoot); }
  }, [cacheToonMats, restoreToonMats]);

  // Golden defect — special corruption
  const setVersionBroken = useCallback((robotRoot: THREE.Object3D, broken: boolean) => {
    if (broken) { cacheToonMats(robotRoot); robotRoot.userData.versionBroken = true; }
    else { delete robotRoot.userData.versionBroken; restoreToonMats(robotRoot); }
  }, [cacheToonMats, restoreToonMats]);

  const applyDefectFromRequest = useCallback((request: CustomerRequest, robotRoot: THREE.Object3D) => {
    if (request.isSpecSheet) {
      setRobotBroken(robotRoot, true);
      if (request.specSheetPrompts?.some(p => p.expectedType === 'boolean')) setActivationBroken(robotRoot, true);
      if (request.specSheetPrompts?.some(p => p.expectedType === 'int' || p.expectedType === 'double')) setSizeBroken(robotRoot, true);
      if (request.tier === 'golden') setVersionBroken(robotRoot, true);
    } else {
      if (request.required.includes('name')) setNameBroken(robotRoot, true, request.petName);
      if (request.required.includes('size')) setSizeBroken(robotRoot, true);
      if (request.required.includes('hasWireSurge')) setActivationBroken(robotRoot, true);
      if (request.required.includes('color')) setRobotBroken(robotRoot, true);
    }
  }, []);

  const clearDefectFromRequest = useCallback((request: CustomerRequest, robotRoot: THREE.Object3D) => {
    setNameBroken(robotRoot, false);
    setSizeBroken(robotRoot, false);
    setActivationBroken(robotRoot, false);
    setReinforcedFrameBroken(robotRoot, false);
    setRequiresChargingBroken(robotRoot, false);
    setHasRedundantSensorsBroken(robotRoot, false);
    setVersionBroken(robotRoot, false);
    setRobotBroken(robotRoot, false);
  }, []);

  const [cutsceneTick, setCutsceneTick] = useState(0);

  // Deferred state updates to prevent React re-render inside animation frames
  const deferCutsceneTick = () => setTimeout(() => setCutsceneTick(t => t + 1), 0);
  const deferTtsTick = () => setTimeout(() => setTtsTick(t => t + 1), 0);

  const startCinematicCutscene = useCallback(() => {
    cutsceneActiveRef.current = true;
    cinemCamActiveRef.current = true;
    hideGameUiRef.current = true;
    document.exitPointerLock();
    keyStateRef.current.clear();
    deferCutsceneTick();
  }, []);

  const endCinematicCutscene = useCallback(() => {
    cutsceneActiveRef.current = false;
    cinemCamActiveRef.current = false;
    hideGameUiRef.current = false;
    deferCutsceneTick();
  }, []);

  const speakStep = (text: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    if (window.speechSynthesis.getVoices().length === 0) {
      if (typeof (window as any).puter?.ai?.txt2speech === 'function') { speakWithPuter(text); return; }
      console.error('No TTS voices and puter.js not available');
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.volume = 1;
      u.rate = 0.9;
      u.pitch = 1.0;
      const wordBounds: Array<{ start: number; end: number }> = [];
      const re = /\S+/g; let m;
      while ((m = re.exec(text)) !== null) wordBounds.push({ start: m.index, end: m.index + m[0].length });
      ttsCharIndexRef.current = wordBounds[0]?.start ?? null;
      const CHAR_MS = 65;
      const wordTimes = wordBounds.map(w => w.start * CHAR_MS);
      let wIdx = 0;
      const startTime = performance.now();
      const rafTick = () => {
        const elapsed = performance.now() - startTime;
        while (wIdx + 1 < wordBounds.length && elapsed >= wordTimes[wIdx + 1]) { wIdx++; ttsCharIndexRef.current = wordBounds[wIdx].start; deferTtsTick(); }
        if (wIdx < wordBounds.length - 1) nativeRafRef.current = requestAnimationFrame(rafTick);
      };
      nativeRafRef.current = requestAnimationFrame(rafTick);
      u.onboundary = (e: SpeechSynthesisEvent) => {
        ttsCharIndexRef.current = e.charIndex;
        deferTtsTick();
      };
      u.onend = () => { if (nativeRafRef.current !== null) { cancelAnimationFrame(nativeRafRef.current); nativeRafRef.current = null; } ttsUtteranceRef.current = null; ttsCharIndexRef.current = null; deferTtsTick(); };
      u.onerror = (e: any) => { console.error('TTS onerror:', e); if (nativeRafRef.current !== null) { cancelAnimationFrame(nativeRafRef.current); nativeRafRef.current = null; } ttsUtteranceRef.current = null; ttsCharIndexRef.current = null; deferTtsTick(); };
      ttsUtteranceRef.current = u;
      deferTtsTick();
      window.speechSynthesis.cancel();
      setTimeout(() => { window.speechSynthesis.speak(u); }, 10);
    } catch (e) {
      console.error('TTS error:', e);
      ttsUtteranceRef.current = null;
      deferTtsTick();
    }
  };

  const speakWithPuter = async (text: string) => {
    try {
      const audio = await (window as any).puter.ai.txt2speech(text);
      const wordBounds: Array<{ start: number; end: number }> = [];
      const re = /\S+/g; let m;
      while ((m = re.exec(text)) !== null) wordBounds.push({ start: m.index, end: m.index + m[0].length });
      ttsUtteranceRef.current = {} as any;
      ttsCharIndexRef.current = wordBounds[0]?.start ?? null;
      deferTtsTick();
      let idx = 0;
      puterTtsTimerRef.current = setInterval(() => {
        idx++;
        if (idx >= wordBounds.length) { clearInterval(puterTtsTimerRef.current!); puterTtsTimerRef.current = null; stopTts(); return; }
        ttsCharIndexRef.current = wordBounds[idx].start; deferTtsTick();
      }, 220);
      puterTtsAudioRef.current = audio;
      audio.play();
      audio.addEventListener('ended', () => stopTts(), { once: true });
    } catch (e) {
      console.error('Puter TTS error:', e);
      ttsUtteranceRef.current = null;
      deferTtsTick();
    }
  };

  const stopTts = () => {
    if (nativeRafRef.current !== null) { cancelAnimationFrame(nativeRafRef.current); nativeRafRef.current = null; }
    if (puterTtsTimerRef.current) { clearInterval(puterTtsTimerRef.current); puterTtsTimerRef.current = null; }
    if (puterTtsAudioRef.current) { puterTtsAudioRef.current.pause(); puterTtsAudioRef.current = null; }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    }
    ttsUtteranceRef.current = null;
    ttsCharIndexRef.current = null;
    ttsActiveTextRef.current = null;
    deferTtsTick();
  };

  const ttsActive = () => ttsUtteranceRef.current !== null;

  const onTtsToggle = (text: string) => {
    if (ttsUtteranceRef.current) { stopTts(); } else { speakStep(text); }
  };

  // Per-line TTS: click same line = stop, different line = switch
  const playLineTts = (text: string) => {
    if (ttsActiveTextRef.current === text && ttsUtteranceRef.current) {
      stopTts();
    } else {
      stopTts();
      ttsActiveTextRef.current = text;
      speakStep(text);
      deferTtsTick();
    }
  };

  const renderTtsLine = (text: string) => {
    const isActive = ttsActiveTextRef.current === text && ttsUtteranceRef.current !== null;
    const charIdx = isActive ? ttsCharIndexRef.current : null;
    if (charIdx !== null) {
      const bounds: Array<{ start: number; end: number }> = [];
      const re = /\S+/g; let m;
      while ((m = re.exec(text)) !== null) bounds.push({ start: m.index, end: m.index + m[0].length });
      const w = bounds.find(b => charIdx >= b.start && charIdx < b.end);
      if (w) {
        return <>{text.slice(0, w.start)}<span className="underline decoration-amber-400 decoration-2 underline-offset-4">{text.slice(w.start, Math.min(w.end, text.length))}</span>{text.slice(Math.min(w.end, text.length))}</>;
      }
    }
    return text;
  };

  const renderFormattedSpecLine = (text: string) => {
    const isActive = ttsActiveTextRef.current === text && ttsUtteranceRef.current !== null;
    const charIdx = isActive ? ttsCharIndexRef.current : null;
    const bounds: Array<{ start: number; end: number }> = [];
    const re = /\S+/g; let m;
    while ((m = re.exec(text)) !== null) bounds.push({ start: m.index, end: m.index + m[0].length });
    const activeWord = charIdx !== null ? bounds.find(b => charIdx >= b.start && charIdx < b.end) : null;
    if (!bounds.length) return text;
    const segs: { start: number; end: number; cls: string }[] = [];
    for (let i = 0; i < bounds.length; i++) {
      const b = bounds[i];
      const wsStart = i === 0 ? 0 : bounds[i - 1].end;
      if (b.start > wsStart) segs.push({ start: wsStart, end: b.start, cls: 'text-slate-100' });
      const word = text.slice(b.start, b.end);
      const cleanWord = word.replace(/^["""]+|["""]+$/g, '').replace(/[.,!?;:]+$/, '');
      let wordCls = 'text-slate-100';
      if (/^\d+(\.\d+)?%?$/.test(cleanWord)) wordCls = 'text-amber-300 font-bold';
      else if (cleanWord === 'Excellent') wordCls = 'text-white font-bold';
      else if (cleanWord === 'Needs' || cleanWord === 'Repair') wordCls = 'text-sky-300 italic';
      if (activeWord && b.start === activeWord.start) wordCls += ' underline decoration-amber-400 decoration-2 underline-offset-4';
      segs.push({ start: b.start, end: b.end, cls: wordCls });
    }
    if (bounds[bounds.length - 1].end < text.length) {
      segs.push({ start: bounds[bounds.length - 1].end, end: text.length, cls: 'text-slate-100' });
    }
    return <>{segs.map(s => <span key={s.start} className={s.cls}>{text.slice(s.start, s.end)}</span>)}</>;
  };

  const makeLine = (label: string | null, value: string) => {
    const fullLine = label ? `${label}: ${value}` : value;
    const play = () => playLineTts(fullLine);
    const isPlaying = ttsActiveTextRef.current === fullLine;
    return (
      <div className="flex items-center gap-1 mb-1 text-sm">
        <span className="text-slate-100">
          {label && <span className="font-semibold text-emerald-300">{label}: </span>}
          {renderTtsLine(value)}
        </span>
        <button onClick={play} className="shrink-0 p-1 rounded hover:bg-white/10 text-amber-300/70 hover:text-amber-300 transition-colors" title={isPlaying ? 'Stop' : 'Read aloud'}>
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          )}
        </button>
      </div>
    );
  };

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
    const unmatched = [...specs];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
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
      const spec = unmatched.find(s => s.name === userName);
      if (!spec) {
        const expected = unmatched.map(s => `\`${s.name}\``).join(', ');
        return { valid: false, message: `❌ Unexpected variable \`${userName}\`. Expected one of: ${expected}.`, showArrow: false };
      }
      if (userType !== spec.type && userType.toLowerCase() === spec.type.toLowerCase()) {
        return { valid: false, message: `❌ \`${spec.type}\` is all lowercase in Java.`, showArrow: false };
      }
      if (userType !== spec.type) {
        return { valid: false, message: `❌ \`${userName}\` should be type \`${spec.type}\`, not \`${userType}\`.`, showArrow: false };
      }
      unmatched.splice(unmatched.indexOf(spec), 1);
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
  const goal = useMemo(() => computeGoal(
    sparkyQuestStage, backpack, money,
    cutsceneDone, workshopIntroSeen, batteryInstalled,
  ), [sparkyQuestStage, backpack, money, cutsceneDone, workshopIntroSeen, batteryInstalled]);

  const missionText = useMemo(() => getMissionText(goal, money, sparkyQuestStage), [goal, money, sparkyQuestStage]);

  const anyDialogActive = showElectrocuteDlg || showStringDlg || showDateDlg || showVersionDlg || showBootDlg || showBatteryDlg || showRafiqLetterDlg || showWhoDlg || showSparkyDlg || showLaptopUI || (workshopIntroSeen === false && inWorkshopRoom);

  // NEW MISSION full-screen modal (only for qualitative changes, never during dialogs)
  useEffect(() => {
    const key = missionText.replace(/\(\$[^)]+\)/g, '').trim();
    if (!prevMissionRef.current) { prevMissionRef.current = key; return; }
    if (key !== prevMissionRef.current) {
      prevMissionRef.current = key;
      if (!anyDialogActive && !hideGameUiRef.current) {
        setMissionModal({show: true, msg: missionText});
        const t = setTimeout(() => setMissionModal({show: false, msg: ''}), 2500);
        return () => clearTimeout(t);
      }
    }
  }, [missionText, anyDialogActive]);

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
    const kioskPos = new THREE.Vector3(NPC_POSITION.x, 0.15, -NPC_POSITION.y - 0.1);

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

    // Sparky recoil + sequence (use relative rotateY to preserve north-facing quaternion — Y-up yaw)
    const sparky = outdoorSparkyRef.current;
    if (sparky) {
      sparky.root.rotateY(0.15);
      setTimeout(() => {
        if (sparky.root) sparky.root.rotateY(-0.23);
      }, 150);
      setTimeout(() => {
        if (sparky.root) sparky.root.rotateY(0.13);
      }, 300);
      setTimeout(() => {
        if (sparky.root) sparky.root.rotateY(-0.05);
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
    setRafiqCutsceneActive(rafiqWalkPhaseRef.current !== 'idle');
  }); // runs after every render

  useEffect(() => {
    inApartmentRoomRef.current = inApartmentRoom;
  }, [inApartmentRoom]);

  useEffect(() => {
    showControlsModalRef.current = showControlsModal;
  }, [showControlsModal]);

  // Universal cursor release — exit pointer lock when any clickable modal opens
  useEffect(() => {
    if (showControlsModal || showBatteryDlg || showRafiqLetterDlg || showWhoDlg || showSparkyDlg || showElectrocuteDlg || showStringDlg || showDateDlg || showVersionDlg || showBootDlg || showLaptopUI || showFirstSaleModal || showShopModal || shopkeeperGreeting !== null) {
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [showControlsModal, showBatteryDlg, showRafiqLetterDlg, showWhoDlg, showSparkyDlg, showElectrocuteDlg, showStringDlg, showDateDlg, showVersionDlg, showBootDlg, showLaptopUI, showFirstSaleModal, showShopModal, shopkeeperGreeting]);

  // Controls modal Enter key handler
  useEffect(() => {
    if (!showControlsModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        setShowControlsModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showControlsModal]);

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

  useTypewriterDialog(showElectrocuteDlg, electrocuteStep, cutsceneDlgSteps, setElectrocuteText);
  useDialogEnter(showElectrocuteDlg, () => {
    const nextStep = electrocuteStep + 1;
    if (nextStep < cutsceneDlgSteps.length) { setElectrocuteStep(nextStep); }
    else { setShowElectrocuteDlg(false); electrocuteDlgShownRef.current = false; aptCutscenePhaseRef.current = 'walk-to-laptop'; aptCutsceneTimerRef.current = 0; }
  });

  useTypewriterDialog(showBatteryDlg, batteryDlgStep, BATTERY_DLG_STEPS, setBatteryDlgText);
  useDialogEnter(showBatteryDlg, () => {
    const nextStep = batteryDlgStep + 1;
    if (nextStep < BATTERY_DLG_STEPS.length) { setBatteryDlgStep(nextStep); }
    else {
      const bp = gameStore.get('backpack');
      if (!bp.includes('letter' as ScrapPartId)) {
        const newBackpack: ScrapPartId[] = [...bp, 'letter'];
        gameStore.set('backpack', newBackpack);
        fetch('/api/profile/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: newBackpack }), keepalive: true }).catch(() => {});
        lastConfirmedBackpackRef.current = newBackpack;
      }
      setShowBatteryDlg(false);
      aptCutscenePhaseRef.current = 'done';
      aptCutsceneTimerRef.current = 0;
    }
  });

  // Sparky dialog (single text, no steps)
  useEffect(() => {
    if (!showSparkyDlg || !sparkyDlgFull) return;
    setSparkyDlgText('');
    let i = 0;
    const msg = sparkyDlgFull;
    const interval = setInterval(() => {
      i++;
      setSparkyDlgText(msg.slice(0, i));
      if (i >= msg.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [showSparkyDlg, sparkyDlgFull]);
  useDialogEnter(showSparkyDlg, () => {
    if (hideGameUiRef.current) return;
    onSparkyDlgCloseRef.current?.();
    setShowSparkyDlg(false);
  });

  // Money collection animation — hits increment timer
  useEffect(() => {
    if (!moneyAnim.active || moneyAnim.hits >= moneyAnim.total) {
      if (moneyAnim.active && moneyAnim.hits >= moneyAnim.total) {
        const t = setTimeout(() => setMoneyAnim({active: false, bills: 0, hits: 0, total: 0}), 600);
        return () => clearTimeout(t);
      }
      return;
    }
    const t = setTimeout(() => {
      playHappyChime();
      setMoneyAnim(prev => ({...prev, hits: prev.hits + 1}));
    }, 120);
    return () => clearTimeout(t);
  }, [moneyAnim]);

  useTypewriterDialog(showRafiqLetterDlg, rafiqLetterStep, RAFIQ_MEET_STEPS, setRafiqLetterText);
  const consumeLetterInDialog = () => {
    const bp = gameStore.get('backpack');
    if (bp.includes('letter' as ScrapPartId)) {
      const newBackpack = bp.filter((id: string) => id !== 'letter');
      gameStore.set('backpack', newBackpack);
      fetch('/api/profile/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: newBackpack }), keepalive: true }).catch(() => {});
      lastConfirmedBackpackRef.current = newBackpack;
    }
  };
  useDialogEnter(showRafiqLetterDlg, () => {
    const nextStep = rafiqLetterStep + 1;
    if (nextStep < RAFIQ_MEET_STEPS.length) {
      if (rafiqLetterStep === 0) consumeLetterInDialog();
      setRafiqLetterStep(nextStep);
    } else {
      setShowRafiqLetterDlg(false);
      rafiqWalkPhaseRef.current = 'idle';
      cutsceneActiveRef.current = false;
      const reLockEl = rendererRef.current?.domElement;
      if (reLockEl && document.pointerLockElement !== reLockEl) {
        try { reLockEl.requestPointerLock(); } catch {}
      }
      workshopIntroSeenRef.current = true;
      setWorkshopIntroSeen(true);
      fetch('/api/profile/workshop-intro', { method: 'POST', keepalive: true }).catch(() => {});
      if (roomOwnerVisualRef.current) {
        roomOwnerVisualRef.current.root.quaternion.copy(rafiqBaseQuatRef.current);
        if (roomOwnerVisualRef.current.rightArm) roomOwnerVisualRef.current.rightArm.rotation.z = -0.3;
      }
    }
  });

  // Workshop intro
  useTypewriterDialog(inWorkshopRoom && !workshopIntroSeen && profileLoadedRef.current,
    workshopIntroStep, WORKSHOP_INTRO_STEPS, setWorkshopIntroText);
  useDialogEnter(inWorkshopRoom && !workshopIntroSeen && profileLoadedRef.current, () => {
    const nextStep = workshopIntroStep + 1;
    if (nextStep < WORKSHOP_INTRO_STEPS.length) { setWorkshopIntroStep(nextStep); }
    else { finishWorkshopIntro(); }
  });

  useTypewriterDialog(showWhoDlg, whoStep, RAFIQ_GREET_STEPS, setWhoText);
  useDialogEnter(showWhoDlg, () => {
    const nextStep = whoStep + 1;
    if (nextStep < RAFIQ_GREET_STEPS.length) { setWhoStep(nextStep); }
    else {
      setShowWhoDlg(false);
      if (rafiqWalkPhaseRef.current === 'greeting') {
        rafiqWalkPhaseRef.current = 'handing-letter';
        rafiqCutsceneTimerRef.current = 0;
      }
    }
  });

  useTypewriterDialog(showStringDlg, stringDlgStep, stringDlgSteps, setStringDlgText);
  useDialogEnter(showStringDlg, () => {
    const nextStep = stringDlgStep + 1;
    if (nextStep < stringDlgSteps.length) { setStringDlgStep(nextStep); }
    else {
      setShowStringDlg(false);
      if (stringDlgIsHelpRef.current) { stringDlgIsHelpRef.current = false; setShowLaptopUI(true); }
      else { aptCutscenePhaseRef.current = 'laptop-ui'; aptCutsceneTimerRef.current = 0; }
    }
  });

  useTypewriterDialog(showDateDlg, dateDlgStep, stringDlgIsHelpRef.current ? dateHelpSteps : dateDlgSteps, setDateDlgText);
  useDialogEnter(showDateDlg, () => {
    const steps = stringDlgIsHelpRef.current ? dateHelpSteps : dateDlgSteps;
    const nextStep = dateDlgStep + 1;
    if (nextStep < steps.length) { setDateDlgStep(nextStep); }
    else {
      setShowDateDlg(false);
      if (stringDlgIsHelpRef.current) { stringDlgIsHelpRef.current = false; setShowLaptopUI(true); }
      else { dateCodingShownRef.current = false; aptCutscenePhaseRef.current = 'date-coding'; aptCutsceneTimerRef.current = 0; }
    }
  });

  useTypewriterDialog(showVersionDlg, versionDlgStep, stringDlgIsHelpRef.current ? versionHelpSteps : versionDlgSteps, setVersionDlgText);
  useDialogEnter(showVersionDlg, () => {
    const steps = stringDlgIsHelpRef.current ? versionHelpSteps : versionDlgSteps;
    const nextStep = versionDlgStep + 1;
    stopTts();
    if (nextStep < steps.length) { setVersionDlgStep(nextStep); }
    else {
      setShowVersionDlg(false);
      if (stringDlgIsHelpRef.current) { stringDlgIsHelpRef.current = false; setShowLaptopUI(true); }
      else { versionCodingShownRef.current = false; aptCutscenePhaseRef.current = 'version-coding'; aptCutsceneTimerRef.current = 0; }
    }
  });

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

  useTypewriterDialog(showBootDlg, bootDlgStep, stringDlgIsHelpRef.current ? bootHelpSteps : bootDlgSteps, setBootDlgText);
  useDialogEnter(showBootDlg, () => {
    const steps = stringDlgIsHelpRef.current ? bootHelpSteps : bootDlgSteps;
    const nextStep = bootDlgStep + 1;
    if (nextStep < steps.length) { setBootDlgStep(nextStep); }
    else {
      setShowBootDlg(false);
      if (stringDlgIsHelpRef.current) { stringDlgIsHelpRef.current = false; setShowLaptopUI(true); }
      else { bootCodingShownRef.current = false; aptCutscenePhaseRef.current = 'boot-coding'; aptCutsceneTimerRef.current = 0; }
    }
  });

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
        setCutsceneDone(true);
        sparkyHomeArrivedRef.current = true;
        if (outdoorSparkyRef.current) outdoorSparkyRef.current.root.visible = false;
        if (apartmentSparkyRef.current) apartmentSparkyRef.current.root.visible = true;
        prepBatteryInstallProps();
      }
      if (data.batteryInstalled) {
        batteryInstalledRef.current = true;
        setBatteryInstalled(true);
        // Remove battery from backpack if still present (fallback for failed sync)
        const bp = gameStore.get('backpack') as ScrapPartId[];
        if (bp.includes('battery' as ScrapPartId)) {
          const cleaned = bp.filter(id => id !== 'battery');
          gameStore.set('backpack', cleaned);
          lastConfirmedBackpackRef.current = cleaned;
        }
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
      // Cutscene done overrides shop unlock — player can always enter workshop post-cutscene
      if (data.cutsceneDone) {
        setShopUnlocked(true);
        shopUnlockedRef.current = true;
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
          if (localRobotRef.current) {
            localRobotRef.current.root.position.set(pos.x, 0.26, -pos.y);
          }
        } else if (data.position.room === 'apartment') {
          inApartmentRoomRef.current = true;
          setInApartmentRoom(true);
          roomObstacleHitboxesRef.current = [];
          if (localRobotRef.current) {
            localRobotRef.current.root.position.set(pos.x, 0.28, -pos.y);
          }
          if (outdoorSparkyRef.current) outdoorSparkyRef.current.root.visible = false;
          if (apartmentSparkyRef.current) apartmentSparkyRef.current.root.visible = true;
          if (data.cutsceneDone || cutsceneDoneRef.current) {
            cutsceneDoneRef.current = true;
            setCutsceneDone(true);
            if (scrapRobotRef.current) scrapRobotRef.current.root.visible = true;
            // Auto-start tutorial if in intro stage after cutscene
            // No auto-start tutorial — battery-only flow
          }
        } else {
          if (localRobotRef.current) {
            localRobotRef.current.root.position.set(pos.x, 0.24, -pos.y);
          }
        }
      }
      // Intro spawn override: only when saved position is the default (0,0) — first load after reset
      if (data.questStage === 'intro' && data.position && data.position.x === 0 && data.position.y === 0) {
        localPositionRef.current.set(-5.53, -9.63);
        if (localRobotRef.current) {
          localRobotRef.current.root.position.set(-5.53, 0.24, 9.63);
        }
        yawRef.current = Math.atan2(-2.87 - (-5.53), -5.3 - (-9.63));
      }
      // Queue cutscene re-triggers on reload — waits for controls modal to dismiss
      if (data.position?.room === 'workshop' && data.cutsceneDone && Array.isArray(data.backpack) && data.backpack.includes('letter') && rafiqWalkPhaseRef.current === 'idle') {
        workshopIntroSeenRef.current = true;
        setWorkshopIntroSeen(true);
        pendingRafiqCutsceneRef.current = true;
      } else if (data.position?.room === 'apartment' && !data.cutsceneDone) {
        pendingAptCutsceneRef.current = true;
      } else if (data.position?.room === 'apartment' && data.cutsceneDone && Array.isArray(data.backpack) && data.backpack.includes('battery') && !batteryInstalledRef.current) {
        pendingBatteryCutsceneRef.current = true;
        startCinematicCutscene();
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

  const joinedRef = useRef(false);
  useEffect(() => {
    if (connected && !joinedRef.current) {
      joinedRef.current = true;
      const joinRoom = inWorkshopRoomRef.current ? 'workshop' : inApartmentRoomRef.current ? 'apartment' : 'outside';
      triggerEvent('client-player-join', { x: localPositionRef.current.x, y: localPositionRef.current.y, room: joinRoom });
    }
  }, [connected, triggerEvent]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mountElement = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a4a5a);
    scene.fog = new THREE.FogExp2(0x4a4a5a, 0.006);
    sceneRef.current = scene;

    const outdoorGroup = new THREE.Group();
    scene.add(outdoorGroup);
    outdoorGroupRef.current = outdoorGroup;

    const workshopRoomGroup = new THREE.Group();
    workshopRoomGroup.visible = false;
    scene.add(workshopRoomGroup);
    workshopRoomGroupRef.current = workshopRoomGroup;
    {
      const wl = new THREE.PointLight(0xfbbf24, 10, 6);
      wl.position.set(2.35, 1.4, -1.95);
      workshopRoomGroup.add(wl);
      const wl2 = new THREE.PointLight(0xfbbf24, 4, 5);
      wl2.position.set(-2.5, 1.2, 2.0);
      workshopRoomGroup.add(wl2);
    }

    const apartmentRoomGroup = new THREE.Group();
    apartmentRoomGroup.visible = false;
    scene.add(apartmentRoomGroup);
    apartmentRoomGroupRef.current = apartmentRoomGroup;
    {
      const al = new THREE.PointLight(0xfef08a, 10, 6);
      al.position.set(0, 1.5, 0);
      apartmentRoomGroup.add(al);
      const al2 = new THREE.PointLight(0xfef08a, 4, 4);
      al2.position.set(-2.2, 0.9, 2.5);
      apartmentRoomGroup.add(al2);
    }

    const aspect = mountElement.clientWidth / mountElement.clientHeight;
    const camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 100);
    camera.up.set(0, 1, 0);
    camera.position.set(0, 2.2, 10.5);
    camera.lookAt(0, 0.8, 3);
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

    const ambientLight = new THREE.AmbientLight(0xeeeeee, 0.5);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(0xffeedd, 0.55);
    sunLight.position.set(-10, 5, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(512, 512);
    sunLight.shadow.camera.left = -18;
    sunLight.shadow.camera.right = 18;
    sunLight.shadow.camera.top = 18;
    sunLight.shadow.camera.bottom = -18;
    sunLight.shadow.bias = -0.001;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 45;
    scene.add(sunLight);

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 30),
      createToonMaterial(0xffdd99, 0.4, 0.03)
    );
    sun.rotation.x = -Math.PI / 2;
    sun.position.set(8.5, 5.2, -6.8);
    outdoorGroup.add(sun);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      createToonMaterial(0x2a3a4a)
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.02;
    water.receiveShadow = true;
    outdoorGroup.add(water);

    // Solid dark plane deep below to prevent seeing through when camera rotates
    const deepFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshBasicMaterial({ color: 0x0a0a14 })
    );
    deepFloor.rotation.x = -Math.PI / 2;
    deepFloor.position.y = -5;
    outdoorGroup.add(deepFloor);

    // D-shaped island: flat left edge at x=-11, circular elsewhere
    const flatX = -10.4;
    const flatY = 14;
    const chordTopY = Math.sqrt(ISLAND_RADIUS * ISLAND_RADIUS - flatX * flatX);
    const chordRightX = Math.sqrt(ISLAND_RADIUS * ISLAND_RADIUS - flatY * flatY);
    const islandShape = new THREE.Shape();
    islandShape.moveTo(flatX, -flatY);
    islandShape.lineTo(chordRightX, -flatY);
    islandShape.absarc(0, 0, ISLAND_RADIUS, Math.atan2(-flatY, chordRightX), Math.atan2(chordTopY, flatX), false);
    islandShape.lineTo(flatX, -flatY);
    const grassTex = getTileTexture('tile_01.png');
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(80, 80);
    const cityGround = new THREE.Mesh(
      new THREE.ShapeGeometry(islandShape, 120),
      new THREE.MeshToonMaterial({
        map: grassTex,
        gradientMap: createGradientTexture(3),
      })
    );
    cityGround.rotation.x = -Math.PI / 2;
    cityGround.position.y = 0.10;
    cityGround.receiveShadow = true;
    outdoorGroup.add(cityGround);

    const streetW = 3;
    const sw = 0.5;

    // Road stops at island flat edge (x=-10.4) — avoids overlap with dock
    const roadColor = 0x5a6a7a;
    const roadMesh = new THREE.Mesh(new THREE.BoxGeometry(42.4, 0.04, 24), createToonMaterial(roadColor));
    roadMesh.position.set(10.8, 0.14, 2);
    roadMesh.receiveShadow = true;
    outdoorGroup.add(roadMesh);
    // Grass blocks ABOVE the road to carve out city blocks between roads
    const gMat = createToonMaterial(0x6aaa5a);
    const addG = (x: number, y: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, h), gMat);
      m.position.set(x, 0.17, -y); m.receiveShadow = true;
      outdoorGroup.add(m);
    };
    // All grass rows — expanded by 0.5 on each side for bigger building plots
    const yGaps: [number, number, number][] = [
      [1.0, 7.0, 4],       // top row
      [-7.0, -1.0, -4],    // mid row
      [-14, -9, -11.5], // bottom row
    ];
    const xGaps: [number, number, number][] = [
      [-10.4, -1.0, -5.7], [1.0, 11.0, 6], [13.0, 23, 18], [25.0, 29, 27],
    ];
    yGaps.forEach(([y1, y2, yc]) => {
      xGaps.forEach(([x1, x2, xc]) => { addG(xc, yc, x2 - x1, y2 - y1); });
    });
    // Cover road at dock level (y=7 to 9.5) from building eastward
    addG(28.5, -8, 7, 2);

    // Sidewalks — split at intersections (gaps over road crossings)
    const sMat = new THREE.MeshBasicMaterial({ color: 0xc8c0b0 });
    const makeSW = (x: number, y: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, h), sMat);
      m.position.set(x, 0.24, -y); outdoorGroup.add(m);
    };
    const hSW = (y: number) => {
      xGaps.forEach(([x1,x2]) => { makeSW((x1+x2)/2, y, x2-x1, sw); });
    };
    const vSW = (x: number) => {
      [[-14,-9],[-7.0,-1.0],[1.0,7.0],[7.0,9.5]].forEach(([y1,y2]) => { makeSW(x, (y1+y2)/2, sw, y2-y1); });
    };
    hSW(1.25); hSW(-1.25); hSW(-6.75); hSW(-9.25); hSW(6.75); hSW(9.75);
    vSW(-1.25); vSW(1.25); vSW(-10.25); vSW(10.75); vSW(13.25); vSW(22.75); vSW(25.75);

    // Street markings - dashed yellow center lines (go through to intersection centers)
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const makeDashedLine = (x: number, y: number, len: number, horiz: boolean) => {
      const dashLen = 0.4, gapLen = 0.3, step = dashLen + gapLen;
      const count = Math.floor(len / step);
      for (let i = 0; i < count; i++) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? dashLen : 0.06, horiz ? 0.06 : dashLen), dashMat);
        d.rotation.x = -Math.PI / 2;
        d.position.set(horiz ? x - len / 2 + i * step + dashLen / 2 : x, 0.17, -(horiz ? y : y - len / 2 + i * step + dashLen / 2));
        outdoorGroup.add(d);
      }
    };
    // Horizontal center lines — intersection center to intersection center (+ at crossings)
    makeDashedLine(-5.2, 0, 10.4, true);    // x=-10.4 to x=0
    makeDashedLine(6, 0, 12, true);          // x=0 to x=12
    makeDashedLine(18, 0, 12, true);         // x=12 to x=24
    makeDashedLine(26.5, 0, 5, true);        // x=24 to x=29
    makeDashedLine(-5.2, -8, 10.4, true);
    makeDashedLine(6, -8, 12, true);
    makeDashedLine(18, -8, 12, true);
    makeDashedLine(-5.2, 8.5, 10.4, true);
    makeDashedLine(6, 8.5, 12, true);
    makeDashedLine(18, 8.5, 12, true);
    makeDashedLine(26.5, 8.5, 5, true);
    // Vertical center lines — from top T center to bottom, through + intersections
    makeDashedLine(0, 4.25, 8.5, false);      // y=8.5 to y=0 (T at top, + at y=0)
    makeDashedLine(0, -4, 8, false);           // y=0 to y=-8
    makeDashedLine(0, -8.5, 1, false);         // y=-8 to y=-9
    makeDashedLine(12, 4.25, 8.5, false);
    makeDashedLine(12, -4, 8, false);
    makeDashedLine(12, -8.5, 1, false);
    makeDashedLine(24, 4.25, 8.5, false);
    makeDashedLine(24, -4, 8, false);
    makeDashedLine(24, -8.5, 1, false);

    // Parking lot at (0, -11) — 3 spaces in the 3-unit gap between bottom grass columns
    const pkMat = createToonMaterial(0x3a3a4a);
    const asphalt = new THREE.Mesh(new THREE.BoxGeometry(3, 0.02, 4.5), pkMat);
    asphalt.position.set(0, 0.22, 11.75);
    asphalt.receiveShadow = true;
    outdoorGroup.add(asphalt);
    const wMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pLine = (x: number, y: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.008, h), wMat);
      m.position.set(x, 0.24, -y);
      outdoorGroup.add(m);
    };
    // Perimeter
    pLine(0, -9, 3, 0.02);    // north
    pLine(0, -14, 3, 0.02);     // south (water edge curb)
    pLine(-1.5, -11.75, 0.02, 4.5); // west
    pLine(1.5, -11.75, 0.02, 4.5);  // east
    // 2 lines going down — equally spread
    pLine(-0.5, -13.25, 0.02, 1.5);
    pLine(0.5, -13.25, 0.02, 1.5);

    // Small lake with 6 palm trees and fountain centerpiece
    const lx = 6, ly = -4, lr = 1.8;
    const lake = new THREE.Mesh(new THREE.CircleGeometry(lr, 24), createToonMaterial(0x38bdf8));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(lx, 0.15, -ly); outdoorGroup.add(lake);
    const lakeDeep = new THREE.Mesh(new THREE.CircleGeometry(lr * 0.7, 24), createToonMaterial(0x1d4ed8));
    lakeDeep.rotation.x = -Math.PI / 2;
    lakeDeep.position.set(lx, 0.14, -ly); outdoorGroup.add(lakeDeep);
    const lakeShine = new THREE.Mesh(new THREE.CircleGeometry(lr * 0.3, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 }));
    lakeShine.rotation.x = -Math.PI / 2;
    lakeShine.position.set(lx + 0.4, 0.16, -ly - 0.4); outdoorGroup.add(lakeShine);
    // Fountain in the middle of the lake
    const fCol = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 12), createToonMaterial(0x94a3b8));
    fCol.rotation.x = 0; fCol.position.set(lx, 0.22, -ly); outdoorGroup.add(fCol);
    const fDish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 14), createToonMaterial(0x94a3b8));
    fDish.rotation.x = 0; fDish.position.set(lx, 0.38, -ly); outdoorGroup.add(fDish);
    const fWater = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.02, 18), new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.6 }));
    fWater.rotation.x = 0; fWater.position.set(lx, 0.42, -ly); outdoorGroup.add(fWater);
    const fJet = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.45 }));
    fJet.rotation.x = 0; fJet.position.set(lx, 0.7, -ly); outdoorGroup.add(fJet);
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
      rock.position.set(rx, 0.18, -ry);
      rock.scale.set(sx, sy, sz);
      rock.rotation.y = Math.random() * Math.PI * 2;
      rock.receiveShadow = true;
      outdoorGroup.add(rock);
    });

    // Park benches
    const benchMat = createToonMaterial(0x8b6b4a);
    const benchPositions: [number, number][] = [];
    benchPositions.forEach(([benchX, benchY]) => {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.08), benchMat);
      seat.position.set(benchX, 0.16, -benchY);
      seat.castShadow = true;
      outdoorGroup.add(seat);
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.05), benchMat);
      leg1.position.set(benchX - 0.18, 0.1, -benchY - 0.04);
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
      can.position.set(canX, 0.12, -canY);

      outdoorGroup.add(can);
    });

    // No buildings yet — story hasn't progressed past the pet workshop job

    const poleMat = createToonMaterial(0x6a6a7a);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const lightPositions: [number, number][] = [
      [-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25],
      [-1.25, -6.75], [1.25, -6.75], [-10.25, -1.25],
      [10.75, -1.25], [13.25, -1.25], [-10.25, -9.75],
      [10.75, -9.75], [13.25, -9.75],
    ];
    lightPositions.forEach(([lx, ly]) => {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), poleMat);
      pole.position.set(lx, 0.5, -ly);
      pole.castShadow = true;
      outdoorGroup.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lampMat);
      lamp.position.set(lx, 1.1, -ly);
      outdoorGroup.add(lamp);
      const lampLight = new THREE.PointLight(0xfef08a, 0.55, 5);
      lampLight.position.set(lx, 1.1, -ly);
      outdoorGroup.add(lampLight);
    });

    // Door entry light pools
    const poolMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a, transparent: true, opacity: 0.12,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const doorEntries: [number, number][] = [
      [-6, -9.6],    // workshop
      [-9.6, -4.9],   // apartment
      [6.0, -10.2],   // shop
    ];
    doorEntries.forEach(([dx, dy]) => {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(dx, 0.03, -dy);
      pool.rotation.x = -Math.PI / 2;
      outdoorGroup.add(pool);
    });

    const treeTrunkMat = createToonMaterial(0x8b5a2b);
    const treeCrownMat = createToonMaterial(0x5a9e5a);
    const treePositions: [number, number][] = [[-8, -6], [-4.5, -6], [-2, -6], [2.5, -6], [6, -6], [9, -6]];
    treePositions.forEach(([tx, ty]) => {
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), treeTrunkMat);
      trunk.position.set(tx, 0.2, -ty);
      trunk.castShadow = true;
      outdoorGroup.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), treeCrownMat);
      crown.position.set(tx, 0.7, -ty);
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
      b.rotation.x = 0; b.position.set(0, 0.2, 0); g.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), sMat);
      h.position.set(0, 0.55, 0); g.add(h);
      // Hair covering the BACK of the head (visible from camera)
      const hr = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshToonMaterial({ color: 0x2a1a0a, gradientMap: createGradientTexture(3) }));
      hr.position.set(0, 0.56, -0.04); g.add(hr);
      // Arms
      for (let s = -1; s <= 1; s += 2) {
        const a = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.25, 8), cMat);
        a.rotation.x = Math.PI / 2; a.rotation.y = s * 0.3;
        a.position.set(s * 0.2, 0.35, 0); g.add(a);
      }
      g.rotation.y = Math.PI;
      g.position.set(vx, 0.24, -vy);
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
    const cx = -6, cy = -11.8, bw = 7.4, bd = 4.4, bh = 1.7;

    // Ground floor slab
    const gSlab = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.04, bd), psFloor);
    gSlab.position.set(cx, 0.02, -cy); ps.add(gSlab);
    // Ceiling slab
    const cSlab = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, bd), new THREE.MeshToonMaterial({ color: 0x94a3b8, gradientMap: createGradientTexture(3) }));
    cSlab.position.set(cx, bh, -cy); ps.add(cSlab);
  // Back wall (now at SOUTH side, away from bazaars)
  const bWall = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.2, bh - 0.1, 0.08), psW);
  bWall.position.set(cx, bh / 2, -cy + bd / 2 - 0.04); ps.add(bWall);
    // Side walls
    for (let s = -1; s <= 1; s += 2) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.08, bh - 0.1, bd), psW);
      sw.position.set(cx + s * (bw / 2 - 0.04), bh / 2, -cy); ps.add(sw);
    }
    // Front glass wall (NORTH side, facing bazaars) — full width coverage
    const fwY = cy + bd / 2 - 0.04;
    const sectW = 1.5, nSect = 5;
    const totalW = bw - 0.16;
    const gap = (totalW - nSect * sectW) / (nSect + 1);
    for (let i = 0; i < nSect + 1; i++) {
      const px = cx - totalW / 2 + i * (sectW + gap) + gap / 2;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, bh, 0.08), psT);
      pillar.position.set(px, bh / 2, -fwY); ps.add(pillar);
    }
    for (let i = 0; i < nSect; i++) {
      const gx = cx - totalW / 2 + gap + i * (sectW + gap) + sectW / 2;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(sectW - 0.02, bh - 0.4, 0.04), psG);
      glass.position.set(gx, (bh - 0.4) / 2 + 0.2, -fwY); ps.add(glass);
    }
    // Door (center)
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.04), new THREE.MeshToonMaterial({ color: 0x0f172a, gradientMap: createGradientTexture(3) }));
    door.position.set(cx, 0.45, -fwY); ps.add(door);
    const doorTrim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.04), psT);
    doorTrim.position.set(cx, 0.92, -fwY); ps.add(doorTrim);

    // Top floor
    const tfW = bw + 0.3, tfD = bd + 0.3, tfH = 1.3;
    const tfZ = bh + tfH / 2;
    // Back wall (SOUTH)
    const tfBack = new THREE.Mesh(new THREE.BoxGeometry(tfW, tfH, 0.08), psAp);
    tfBack.position.set(cx, tfZ, -cy + tfD / 2); ps.add(tfBack);
    // Side walls
    for (let s = -1; s <= 1; s += 2) {
      const tfSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, tfH, tfD), psAp);
      tfSide.position.set(cx + s * tfW / 2, tfZ, -cy); ps.add(tfSide);
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
        const bwSeg = new THREE.Mesh(new THREE.BoxGeometry(segW - 0.02, botH, 0.08), psAp);
        bwSeg.position.set(segCx, bh + botH / 2, -fwY2); ps.add(bwSeg);
      }
      if (topH > 0.01) {
        const twSeg = new THREE.Mesh(new THREE.BoxGeometry(segW - 0.02, topH, 0.08), psAp);
        twSeg.position.set(segCx, winZ + winH / 2 + topH / 2, -fwY2); ps.add(twSeg);
      }
    }
    // Window glass & frames
    for (const wcxRel of winCxRel) {
      const wcx = cx + wcxRel;
      const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.2, 0.06, 0.06), psT);
      sill.position.set(wcx, winZ - winH / 2, -fwY2 + 0.01); ps.add(sill);
      const wg = new THREE.Mesh(new THREE.BoxGeometry(winW - 0.04, winH - 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
      wg.position.set(wcx, winZ, -fwY2); ps.add(wg);
      for (let s = -1; s <= 1; s += 2) {
        const wf = new THREE.Mesh(new THREE.BoxGeometry(0.04, winH, 0.04), psT);
        wf.position.set(wcx + s * (winW / 2 - 0.02), winZ, -fwY2); ps.add(wf);
      }
    }
    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.8, 0.08, bd + 0.6), psR);
    roof.position.set(cx, bh + 1.36, -cy); ps.add(roof);
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
      // Flat signboard (PlaneGeometry) — on front wall above the door, faces toward player
      const pSign = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.5), new THREE.MeshBasicMaterial({ map: st }));
      pSign.position.set(cx, bh + 0.2, -cy - (bd + 0.3) / 2 - 0.07);
      pSign.rotation.y = Math.PI;
      ps.add(pSign);
    }

    ps.position.set(0, 0, 0);
    outdoorGroup.add(ps);
    ps.visible = true;
    petShopRef.current = ps;

    // Exclamation mark above the workshop door, visible when player should enter
    const doorAnchor = new THREE.Group();
    doorAnchor.position.set(-6, 1.0, 9.6);
    outdoorGroup.add(doorAnchor);
    const doorMarker = addExclamationMarker(doorAnchor);
    workshopDoorMarkerRef.current = doorMarker;

    const aptDoorAnchor = new THREE.Group();
    aptDoorAnchor.position.set(-9.6, 1.8, 4.9);
    outdoorGroup.add(aptDoorAnchor);
    const aptDoorMarker = addExclamationMarker(aptDoorAnchor);
    aptDoorMarker.position.set(0, -0.3, 0);
    aptDoorMarker.visible = false;
    apartmentDoorMarkerRef.current = aptDoorMarker;

    // Exclamation mark above the shop door, visible when player needs to buy a battery
    const shopDoorAnchor = new THREE.Group();
    shopDoorAnchor.position.set(6.0, 1.0, 10.2);
    outdoorGroup.add(shopDoorAnchor);
    const shopDoorMarker = addExclamationMarker(shopDoorAnchor);
    shopDoorMarkerRef.current = shopDoorMarker;

    // Dock at island's flat edge — expanded 8 units wide
    {
      const woodMat = createToonMaterial(0x6b4226);
      const darkWoodMat = createToonMaterial(0x4a2e15);
      const metalMat = createToonMaterial(0x555555);
      // Main deck platform — 8 units wide, east edge at -10.4
      const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 3.5), woodMat);
      deck.position.set(-14.4, 0.12, 8);
      deck.receiveShadow = true;
      outdoorGroup.add(deck);
      // Plank grooves
      for (let i = -1.4; i <= 1.4; i += 0.75) {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.02, 0.02), darkWoodMat);
        groove.position.set(-14.4, 0.17, 8 + i);
        outdoorGroup.add(groove);
      }
      // Corner support posts
      const postPositions: [number, number][] = [[-18.3, -9.6], [-18.3, -6.4], [-10.5, -9.6], [-10.5, -6.4]];
      postPositions.forEach(([px, py]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 8), darkWoodMat);
        post.rotation.x = 0;
        post.position.set(px, 0.15, -py);
        outdoorGroup.add(post);
      });
      // Edge planks (N+S rim)
      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 0.08), woodMat);
        rim.position.set(-14.4, 0.14, 8 + side * 1.7);
        outdoorGroup.add(rim);
      }
      // Mooring bollards
      const bollardPositions: [number, number][] = [[-18.1, -8.5], [-18.1, -7.5], [-10.6, -8]];
      bollardPositions.forEach(([bx, by]) => {
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.12, 8), metalMat);
        bollard.rotation.x = 0;
        bollard.position.set(bx, 0.2, -by);
        outdoorGroup.add(bollard);
      });
      // Rope coils on the deck
      const ropePositions: [number, number][] = [[-16.7, -8.2], [-12.0, -7.2]];
      ropePositions.forEach(([rx, ry]) => {
        for (let j = 0; j < 3; j++) {
          const coil = new THREE.Mesh(new THREE.TorusGeometry(0.05 + j * 0.02, 0.012, 6, 10), createToonMaterial(0xc4a56a));
          coil.rotation.x = 0;
          coil.position.set(rx, 0.14 + j * 0.02, -ry);
          outdoorGroup.add(coil);
        }
      });
      // Lantern on a post
      const lampPost = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.03), createToonMaterial(0x333333));
      lampPost.position.set(-10.9, 0.35, 6.8);
      outdoorGroup.add(lampPost);
      const lampSphere = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      lampSphere.position.set(-10.9, 0.6, 6.8);
      outdoorGroup.add(lampSphere);
      const lampGlow = new THREE.PointLight(0xfef08a, 0.4, 3);
      lampGlow.position.set(-10.9, 0.6, 6.8);
      outdoorGroup.add(lampGlow);
      // Small rowboat tied alongside
      {
        const boat = new THREE.Group();
        const boatHull = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.25), createToonMaterial(0x4a3a2a));
        boatHull.position.set(0, 0.06, 0);
        boat.add(boatHull);
        const prow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), createToonMaterial(0x4a3a2a));
        prow.position.set(0.35, 0.1, 0);
        boat.add(prow);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.18), createToonMaterial(0x3a2a1a));
        seat.position.set(0, 0.14, 0);
        boat.add(seat);
        boat.position.set(-18.2, 0.04, 7);
        boat.rotation.y = 0.15;
        outdoorGroup.add(boat);
      }
    }

    // === Abandoned buildings — procedural toon-shaded ===
    const abMat = (c: number) => createToonMaterial(c);
    const abDebrisMat = abMat(0x5a4a3a);

    const scatterDebris = (cx: number, cy: number, r: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d;
        const t = Math.random();
        if (t < 0.3) {
          const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + Math.random() * 0.12), abDebrisMat);
          m.position.set(x, 0.04 + Math.random() * 0.06, -y);
          outdoorGroup.add(m);
        } else if (t < 0.55) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.15 + Math.random() * 0.3, 0.025, 0.03 + Math.random() * 0.06), abMat(0x5a3a2a));
          m.position.set(x, 0.035, -y);
          m.rotation.y = Math.random() * Math.PI * 2;
          outdoorGroup.add(m);
        } else if (t < 0.75) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.08 + Math.random() * 0.1, 0.06 + Math.random() * 0.06, 0.08 + Math.random() * 0.1), abMat(0x7a4a32));
          m.position.set(x, 0.03, -y);
          m.rotation.y = Math.random() * Math.PI * 0.5;
          outdoorGroup.add(m);
        } else {
          const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04 + Math.random() * 0.08), abMat(0x6b635e));
          m.position.set(x, 0.03, -y);
          outdoorGroup.add(m);
        }
      }
    };

    // === PLACEMENT: one building per grass block ===
    const BUILDINGS: { x: number; y: number; w: number; d: number; palette: 'concrete' | 'brick' | 'slate' | 'wood'; debrisR: number; debrisN: number; height: number }[] = [
      { x: -5.7, y: 4, w: 8.0, d: 4.5, palette: 'concrete', debrisR: 4.5, debrisN: 16, height: 5.5 },
      { x: 6, y: 4, w: 8.5, d: 4.5, palette: 'brick', debrisR: 4.8, debrisN: 16, height: 4.0 },
      { x: 18.5, y: 4, w: 9.0, d: 4.5, palette: 'slate', debrisR: 4.8, debrisN: 18, height: 6.0 },
      { x: 18.5, y: -4, w: 9.0, d: 4.5, palette: 'slate', debrisR: 4.8, debrisN: 18, height: 3.5 },
      { x: 18.5, y: -11.75, w: 9.0, d: 3.5, palette: 'wood', debrisR: 4.5, debrisN: 16, height: 4.5 },
      // Wall of buildings at x≈28 — packed tight, no grass/road gap between them
      { x: 31, y: 1, w: 4, d: 8, palette: 'concrete', debrisR: 3.5, debrisN: 12, height: 7.5 },
      { x: 31, y: -9.5, w: 4, d: 9, palette: 'brick', debrisR: 3.5, debrisN: 12, height: 6.5 },
    ];
    for (const { x, y, w, d, palette, debrisR, debrisN, height } of BUILDINGS) {
      const bldg = createAbandonedBuilding(x, y, w, d, palette, height);
      bldg.position.y = 0.25;
      outdoorGroup.add(bldg);
      scatterDebris(x, y, debrisR, debrisN);
    }

    // Extra scattered debris in empty corners
    scatterDebris(-9, 2, 0.6, 5);
    scatterDebris(-9, 6, 0.6, 5);
    scatterDebris(2.5, 5.5, 0.6, 5);
    scatterDebris(10, 5, 0.6, 5);
    scatterDebris(25, 0, 0.8, 6);   // wall base
    scatterDebris(31, 7, 0.6, 5);   // behind wall north
    scatterDebris(31, -8, 0.6, 5);  // behind wall south

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

    // Invisible occluder panels around outdoor buildings — prevent camera from seeing over walls into interiors
      const buildingFootprints: { x1: number; y1: number; x2: number; y2: number; cx: number; cy: number; bw: number; bd: number; bh: number }[] = [
      { x1: -10.08, y1: -4.98, x2: -1.92, y2: -2.02, cx: -6, cy: -3.5, bw: 8.0, bd: 2.8, bh: 2.8 },
      { x1: -9.7, y1: -14.0, x2: -2.3, y2: -9.6, cx: -6, cy: -11.8, bw: 7.4, bd: 4.4, bh: 2.2 },
      { x1: -23.4, y1: -13.95, x2: -14.2, y2: -10.05, cx: -18.75, cy: -12, bw: 9.3, bd: 3.9, bh: 3.5 },
      { x1: 2.0, y1: -14.0, x2: 10.0, y2: -10.0, cx: 6, cy: -12, bw: 8.0, bd: 4.0, bh: 4.0 },
      // Abandoned buildings
      { x1: -9.7, y1: 1.75, x2: -1.7, y2: 6.25, cx: -5.7, cy: 4, bw: 8.0, bd: 4.5, bh: 5.5 },
      { x1: 1.75, y1: 1.75, x2: 10.25, y2: 6.25, cx: 6, cy: 4, bw: 8.5, bd: 4.5, bh: 4.0 },
      { x1: 14.0, y1: 1.75, x2: 23.0, y2: 6.25, cx: 18.5, cy: 4, bw: 9.0, bd: 4.5, bh: 6.0 },
      { x1: 14.0, y1: -6.25, x2: 23.0, y2: -1.75, cx: 18.5, cy: -4, bw: 9.0, bd: 4.5, bh: 3.5 },
      { x1: 14.0, y1: -13.5, x2: 23.0, y2: -10.0, cx: 18.5, cy: -11.75, bw: 9.0, bd: 3.5, bh: 4.5 },
      // Wall buildings east — packed tight, no gaps
      { x1: 29.0, y1: -3.0, x2: 33.0, y2: 5.0, cx: 31, cy: 1, bw: 4.0, bd: 8.0, bh: 7.5 },
      { x1: 29.0, y1: -14.0, x2: 33.0, y2: -5.0, cx: 31, cy: -9.5, bw: 4.0, bd: 9.0, bh: 6.5 },
    ];
      // Occluders removed — colorWrite:false renders as solid black in this environment

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
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), bracketMat);
      bracket.position.set(0, -0.15, 0);
      const signMat = new THREE.MeshBasicMaterial({ map: tex });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.02), signMat);
      panel.scale.y = -1;
      const frameMat = new THREE.MeshToonMaterial({ color: 0x1e293b });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.24, 0.06), frameMat);
      frame.renderOrder = 1;
      const signGroup = new THREE.Group();
      signGroup.add(frame);
      signGroup.add(panel);
      signGroup.add(bracket);
      signGroup.position.set(x, z, -y);
      parent.add(signGroup);
    };

    // Shop interior room
    {
      const shopRoomGroup = new THREE.Group();
      shopRoomGroup.visible = false;
      scene.add(shopRoomGroup);
      shopRoomGroupRef.current = shopRoomGroup;
      {
        const sl = new THREE.PointLight(0xfef08a, 10, 6);
        sl.position.set(0, 1.3, 0);
        shopRoomGroup.add(sl);
      }

      const sW = 7.6, sD = 3.6, sH = 1.3;

      const sFloor = new THREE.Mesh(
        new THREE.BoxGeometry(sW, 0.04, sD),
        createTexturedToonMaterial('tile_43.png', 5, 3, 0x8b6b4a)
      );
      sFloor.position.set(0, 0.02, 0);
      shopRoomGroup.add(sFloor);

      const sWallMat = createTexturedToonMaterial('tile_23.png', 4, 2, 0xf5e6d0);
      sWallMat.side = THREE.DoubleSide;
      // South wall (entrance side) — full width
      const sWallS = new THREE.Mesh(new THREE.BoxGeometry(sW, sH, 0.08), sWallMat);
      sWallS.position.set(0, sH / 2, sD / 2);
      shopRoomGroup.add(sWallS);
      // North wall (exit side) — with door cutout
      const exitDoorW = 0.68;
      const nSegW = (sW - exitDoorW) / 2;
      for (let s = -1; s <= 1; s += 2) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(nSegW, sH, 0.08), sWallMat);
        seg.position.set(s * (exitDoorW / 2 + nSegW / 2), sH / 2, -sD / 2);
        shopRoomGroup.add(seg);
      }
      // East/west end walls
      for (let s = -1; s <= 1; s += 2) {
        const endWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, sH, sD), sWallMat);
        endWall.position.set(s * sW / 2, sH / 2, 0);
        shopRoomGroup.add(endWall);
      }

      // Back counter
      const counterMat = createToonMaterial(0x8b4513);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.12), counterMat);
      counter.position.set(0, 0.16, sD / 2 + 0.3);
      shopRoomGroup.add(counter);

      const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.14), createToonMaterial(0xa0522d));
      counterTop.position.set(0, 0.32, sD / 2 + 0.3);
      shopRoomGroup.add(counterTop);

      // Shelves along the sides with items
      const shelfMat = createToonMaterial(0x475569);
      const itemColors = [0x60a5fa, 0x34d399, 0xf97316, 0xa855f7, 0xfacc15];
      for (let sx = -1; sx <= 1; sx += 2) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 1.2), shelfMat);
        shelf.position.set(sx * 2.2, 0.16, 0);
        shopRoomGroup.add(shelf);
        // Items on shelves
        for (let iy = -1; iy <= 1; iy += 2) {
          const item = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.06, 0.06),
            createToonMaterial(itemColors[Math.floor(Math.random() * itemColors.length)])
          );
          item.position.set(sx * (2.2 + 0.04), 0.3, -iy * 0.5);
          shopRoomGroup.add(item);
        }
      }

      // Side display case (right side of entrance, not blocking the door)
      const sideDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.5), createToonMaterial(0x8b4513));
      sideDisplay.position.set(-sW / 2 + 0.15, 0.12, -sD / 2 - 0.35);
      shopRoomGroup.add(sideDisplay);
      const dItem = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x60a5fa })
      );
      dItem.position.set(-sW / 2 + 0.15, 0.24, -sD / 2 - 0.35);
      shopRoomGroup.add(dItem);

      // Shop obstacle hitboxes
      shopObstaclesRef.current = [
        { shape: 'box', center: { x: 0, y: -1.5 }, halfWidth: 0.8, halfHeight: 0.06 },
        { shape: 'box', center: { x: 0, y: -1.55 }, halfWidth: 1.0, halfHeight: 0.2 },
        { shape: 'box', center: { x: 2.2, y: 0 }, halfWidth: 0.02, halfHeight: 0.6 },
        { shape: 'box', center: { x: -2.2, y: 0 }, halfWidth: 0.02, halfHeight: 0.6 },
        { shape: 'box', center: { x: -3.65, y: 1.45 }, halfWidth: 0.03, halfHeight: 0.25 },
      ];

      // Shopkeeper person + desk
      const shopPerson = buildPlayerVisual(0x60a5fa, 'Shopkeeper');
      shopPerson.root.position.set(0, 0.02, sD / 2 + 0.15);
      shopRoomGroup.add(shopPerson.root);
      shopNpcRef.current = shopPerson;

      // Fancy desk in front of shopkeeper
      const deskGroup = new THREE.Group();
      // Desk top
      const dTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.4), createToonMaterial(0x5c3d2e));
      dTop.position.set(0, 0.2, sD / 2 + 0.25);
      deskGroup.add(dTop);
      // Desk front
      const dFront = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.35), createToonMaterial(0x8b6914));
      dFront.position.set(0, 0.1, sD / 2 + 0.25);
      deskGroup.add(dFront);
      // Gold trim
      const dTrim = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.04, 0.42), createToonMaterial(0xfbbf24));
      dTrim.position.set(0, 0.24, sD / 2 + 0.25);
      deskGroup.add(dTrim);
      // Potted plant on right side of desk
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.06, 6), createToonMaterial(0xc2410c));
      pot.position.set(0.7, 0.28, sD / 2 + 0.25);
      deskGroup.add(pot);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), createToonMaterial(0x22c55e));
      leaves.position.set(0.7, 0.33, sD / 2 + 0.25);
      deskGroup.add(leaves);
      // Glowing crystal on left side of desk
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), new THREE.MeshBasicMaterial({ color: 0x818cf8 }));
      crystal.position.set(-0.7, 0.28, sD / 2 + 0.25);
      deskGroup.add(crystal);
      shopRoomGroup.add(deskGroup);

      // Welcome mat at entrance
      const welcomeMat = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.02, 0.2),
        createToonMaterial(0x6d4c2a)
      );
      welcomeMat.position.set(0, 0.03, -sD / 2 - 0.05);
      shopRoomGroup.add(welcomeMat);

      // Exit door on the north wall — flush with the wall in the cutout
      const exitDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.7, 0.08),
        createToonMaterial(0xdc2626)
      );
      exitDoor.position.set(0, 0.39, -sD / 2);
      shopRoomGroup.add(exitDoor);
      const exitFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.76, 0.08),
        createToonMaterial(0x1a1a1a)
      );
      exitFrame.position.set(0, 0.42, -sD / 2);
      shopRoomGroup.add(exitFrame);

      createExitSignMesh(0, 1.8, 0.84, shopRoomGroup, '#dc2626', '#ffffff', '#fde68a');
      const shopExitAnchor = new THREE.Group();
      shopExitAnchor.position.set(0, 0.9, -1.5);
      shopRoomGroup.add(shopExitAnchor);
      const shopExitMarker = addExclamationMarker(shopExitAnchor);
      shopExitMarker.visible = false;
      shopExitMarkerRef.current = shopExitMarker;
    }

    obstacleHitboxesRef.current = buildObstacles();
    workshopDoorHitboxRef.current = {
      shape: 'circle',
      center: { x: -6, y: -9.6 },
      radius: 0.5,
    };

    apartmentDoorHitboxRef.current = {
      shape: 'circle',
      center: { x: -9.6, y: -4.9 },
      radius: 0.5,
    };

    workshopObstaclesRef.current = [
      { shape: 'box', center: { x: 2.0, y: 3.05 }, halfWidth: 0.81, halfHeight: 0.41 },
      { shape: 'box', center: { x: 3.4, y: -2.4 }, halfWidth: 0.625, halfHeight: 0.41 },
    ];

    const localGroup = new THREE.Group();
    localGroup.position.set(0, 0.24, 7);
    scene.add(localGroup);
    localPositionRef.current.set(0, -7);
    const dummyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial({ visible: false }));
    const localRobot = { root: localGroup, nameSprite: new THREE.Sprite(), body: dummyMesh, shadow: dummyMesh, leftPupil: dummyMesh, rightPupil: dummyMesh, antennaTip: dummyMesh, leftArm: dummyMesh, rightArm: dummyMesh, leftLeg: dummyMesh, rightLeg: dummyMesh };
    localRobotRef.current = localRobot;

    // Held item group — attaches to right hand for 3D inventory display
    const heldItemGroup = new THREE.Group();
    heldItemGroup.position.set(0.15, 0.50, 0);
    heldItemGroup.visible = false;
    localGroup.add(heldItemGroup);
    heldItemGroupRef.current = heldItemGroup;

    // Load glTF character model
    (async () => {
      try {
        const { root, mixer, idleAction, walkAction, waveAction, rightHandBone } = await loadPlayerModel(characterId);
        localGroup.add(root);
        playerMixerRef.current = mixer;
        midleActionRef.current = idleAction;
        mwalkActionRef.current = walkAction;
        mwaveActionRef.current = waveAction;
        playerGlTFRootRef.current = root;
        playerRightHandBoneRef.current = rightHandBone;
        // Re-parent heldItemGroup to right hand bone if available
        if (rightHandBone && heldItemGroup.parent !== rightHandBone) {
          heldItemGroup.position.set(0, 0, 0);
          rightHandBone.add(heldItemGroup);
        }
        // Name sprite above the model
        const nameSprite = createNameSprite('', new THREE.Color(0x3b82f6));
        nameSprite.position.set(0, 0.9, 0);
        root.add(nameSprite);
        localRobotRef.current!.nameSprite = nameSprite;
      } catch (err) {
        console.error('Failed to load character model:', err);
        const fallback = buildPlayerVisual(0x3b82f6, '');
        localGroup.add(fallback.root);
        localRobotRef.current = { root: localGroup, nameSprite: new THREE.Sprite(), body: fallback.torso, shadow: fallback.torso, leftPupil: fallback.torso, rightPupil: fallback.torso, antennaTip: fallback.torso, leftArm: fallback.leftArm, rightArm: fallback.rightArm, leftLeg: fallback.torso, rightLeg: fallback.torso };
        leftLegPivotRef.current = fallback.leftLegPivot;
        rightLegPivotRef.current = fallback.rightLegPivot;
        rightArmPivotRef.current = fallback.rightArmPivot;
        rightArmRef.current = fallback.rightArm;
      }
    })();

    const scrapRobot = createRobotVisual(new THREE.Color(0x2a1a0a), robotNameRef.current);
    scrapRobot.root.scale.set(0.7, 0.7, 0.7);
    scrapRobot.root.position.set(NPC_POSITION.x + 1.5, NPC_POSITION.y - 1.2, 0.24);
    scrapRobot.root.rotation.z = 0.15;
    scrapRobot.nameSprite.visible = false;
    if (scrapRobot.leftPupil) scrapRobot.leftPupil.material.color.setHex(0x222222);
    if (scrapRobot.rightPupil) scrapRobot.rightPupil.material.color.setHex(0x222222);
    if (scrapRobot.antennaTip) scrapRobot.antennaTip.material.color.setHex(0x555555);
    scrapRobotRef.current = scrapRobot;

    // Scrap follower robot (outdoor, follows player after battery install)
    const scrapFollower = createRobotVisual(new THREE.Color(0x2a1a0a), robotNameRef.current);
    scrapFollower.root.scale.set(0.65, 0.65, 0.65);
    scrapFollower.root.position.set(0, -8, 0.24);
    scrapFollower.nameSprite.visible = true;
    if (scrapFollower.leftPupil) scrapFollower.leftPupil.material.color.setHex(0x222222);
    if (scrapFollower.rightPupil) scrapFollower.rightPupil.material.color.setHex(0x222222);
    if (scrapFollower.antennaTip) scrapFollower.antennaTip.material.color.setHex(0x555555);
    scrapFollower.root.visible = false;
    scene.add(scrapFollower.root);
    scrapFollowerRef.current = scrapFollower;

    // Repair kiosk — proper kiosk at Snack Stop spot
    const kiosk = createRepairKiosk();
    kiosk.position.set(-2.87, 0.04, 5.3);
    outdoorGroup.add(kiosk);
    repairKioskRef.current = kiosk;

    const sparky = createRobotVisual(new THREE.Color(0xfacc15), 'Sparky', 'north');
    sparky.root.scale.set(0.8, 0.8, 0.8);
    sparky.root.position.set(NPC_POSITION.x, 0.24, -NPC_POSITION.y);
    sparky.nameSprite.visible = false;
    outdoorGroup.add(sparky.root);
    if (sparky.body) sparky.body.visible = true;
    outdoorSparkyRef.current = sparky;
    sparkyBaseQuatRef.current = sparky.root.quaternion.clone();
    // Neck connector so head doesn't float
    const sparkyNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 8), createToonMaterial(0xfacc15));
    sparkyNeck.rotation.x = 0;
    sparkyNeck.position.set(0, 0.35, 0);
    sparky.root.add(sparkyNeck);
    const sparkyQuestMarker = addExclamationMarker(sparky.root);
    sparkyQuestMarkerRef.current = sparkyQuestMarker;

    const workshopFloor = new THREE.Mesh(
      new THREE.BoxGeometry(10.6, 0.24, 10.6),
      createTexturedToonMaterial('tile_41.png', 20, 20)
    );
    workshopFloor.position.set(0, 0.12, 0);
    workshopRoomGroup.add(workshopFloor);



    const workshopWalls = [
      new THREE.Vector3(0, 1.2, -5.3),
      new THREE.Vector3(0, 1.2, 5.3),
      new THREE.Vector3(-5.3, 1.2, 0),
      new THREE.Vector3(5.3, 1.2, 0),
    ];
    workshopWalls.forEach((position, index) => {
      const horizontal = index < 2;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 10.6 : 0.3, 2.4, horizontal ? 0.3 : 10.6),
        createTexturedToonMaterial('tile_24.png', horizontal ? 10 : 1, 5, 0x334155)
      );
      wall.position.copy(position);
      wall.material.side = THREE.DoubleSide;
      workshopRoomGroup.add(wall);
    });
    // Exit door on south wall — industrial style (flush with wall inner face)
    const wsExitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.7, 0.08),
      createToonMaterial(0x475569)
    );
    wsExitDoor.position.set(0, 0.59, 5.15);
    workshopRoomGroup.add(wsExitDoor);
    const wsExitFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.76, 0.08),
      createToonMaterial(0x1e293b)
    );
    wsExitFrame.position.set(0, 0.62, 5.15);
    workshopRoomGroup.add(wsExitFrame);
    createExitSignMesh(0, -5.15, 1.3, workshopRoomGroup, '#eab308', '#1e293b', '#000000');
    const wsExitAnchor = new THREE.Group();
    wsExitAnchor.position.set(0, 1.3, 4.6);
    workshopRoomGroup.add(wsExitAnchor);
    const wsExitMarker = addExclamationMarker(wsExitAnchor);
    wsExitMarker.visible = false;
    workshopExitMarkerRef.current = wsExitMarker;

    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.08, 0.45),
      createToonMaterial(0x8b5a2b, 0.7, 0.08)
    );
    shelf.position.set(-3.2, 0.82, -5.075);
    workshopRoomGroup.add(shelf);

    // Mini robots on the shelf
    const shelfColors = [0x60a5fa, 0xf97316, 0x34d399];
    const shelfTopZ = 0.82 + 0.08 / 2;
    for (let i = -1; i <= 1; i++) {
      const mini = createRobotVisual(new THREE.Color(shelfColors[i + 1]), '');
      mini.root.scale.set(0.25, 0.25, 0.25);
      mini.root.position.set(-3.2 + i * 0.45, shelfTopZ + 0.02, -5.075 + i * 0.1);
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
          new THREE.BoxGeometry(horiz ? ww : 0.01, wh, horiz ? 0.01 : ww),
          winMat
        );
        w.position.set(wcx, 1.3, -wcy);
        w.renderOrder = 1;
        workshopRoomGroup.add(w);
        // Window frame on wall surface
        if (horiz) {
          // Top/bottom rails
          for (let t = -1; t <= 1; t += 2) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(ww + fw * 2, fw, 0.04), frameMat);
            rail.position.set(wcx, 1.3 + t * (wh / 2 + fw / 2), -wcy);
            workshopRoomGroup.add(rail);
          }
          // Left/right stiles
          for (let t = -1; t <= 1; t += 2) {
            const stile = new THREE.Mesh(new THREE.BoxGeometry(fw, wh + fw * 2, 0.04), frameMat);
            stile.position.set(wcx + t * (ww / 2 + fw / 2), 1.3, -wcy);
            workshopRoomGroup.add(stile);
          }
        } else {
          // Top/bottom rails
          for (let t = -1; t <= 1; t += 2) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, fw, ww + fw * 2), frameMat);
            rail.position.set(wcx, 1.3 + t * (wh / 2 + fw / 2), -wcy);
            workshopRoomGroup.add(rail);
          }
          // Left/right stiles
          for (let t = -1; t <= 1; t += 2) {
            const stile = new THREE.Mesh(new THREE.BoxGeometry(0.04, wh + fw * 2, fw), frameMat);
            stile.position.set(wcx, 1.3, -wcy + t * (ww / 2 + fw / 2));
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
      new THREE.BoxGeometry(1.25, 0.2, 0.82),
      createToonMaterial(0xf59e0b, 0.64, 0.07)
    );
    petBed.position.set(3.4, 0.21, 2.4);
    workshopRoomGroup.add(petBed);

    const owner = createRobotVisual(new THREE.Color(0x14b8a6), 'Rafiq');
    owner.root.scale.set(0.7, 0.7, 0.7);
    owner.root.position.set(ROOM_OWNER_POS.x, 0.26, -ROOM_OWNER_POS.y);
    owner.nameSprite.visible = false;
    workshopRoomGroup.add(owner.root);
    rafiqBaseQuatRef.current.copy(owner.root.quaternion);
    roomOwnerVisualRef.current = owner;
    const rafiqMarker = addExclamationMarker(owner.root);
    rafiqMarker.visible = false;
    rafiqMarkerRef.current = rafiqMarker;

    const customerGroup = new THREE.Group();
    workshopRoomGroup.add(customerGroup);
    roomCustomerGroupRef.current = customerGroup;

    const registerDock = new THREE.Group();
    registerDock.position.set(2.0, 0.26, -3.05);
    workshopRoomGroup.add(registerDock);
    workshopRegisterDockRef.current = registerDock;

    const registerBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 0.18, 0.72),
      createToonMaterial(0x8b5a2b, 0.62, 0.08)
    );
    registerBase.position.set(0, 0.07, 0);
    registerDock.add(registerBase);

    const registerTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.03, 0.82),
      createToonMaterial(0x92400e, 0.62, 0.08)
    );
    registerTop.position.set(0, 0.19, 0);
    registerDock.add(registerTop);

    const registerComputer = createLaptop();
    registerComputer.scale.set(0.52, 0.52, 0.52);
    registerComputer.position.set(-0.45, 0.22, 0.30);
    registerComputer.rotation.y = Math.PI;
    registerDock.add(registerComputer);
    workshopRegisterComputerRef.current = registerComputer;

    const registerWire = createWire(1.0);
    registerWire.visible = false;
    workshopRoomGroup.add(registerWire);
    workshopRegisterWireRef.current = registerWire;

    {
      const apartmentFloor = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.24, 8),
        createTexturedToonMaterial('tile_21.png', 16, 16, 0x8b6b4a)
      );
      apartmentFloor.position.set(0, 0.12, 0);
      apartmentRoomGroup.add(apartmentFloor);

      const aptWalls = [
        { pos: new THREE.Vector3(0, 1.2, -4.15), horiz: true },
        { pos: new THREE.Vector3(0, 1.2, 4.15), horiz: true },
        { pos: new THREE.Vector3(-4.15, 1.2, 0), horiz: false },
        { pos: new THREE.Vector3(4.15, 1.2, 0), horiz: false },
      ];
      aptWalls.forEach(({ pos, horiz }) => {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? 8.3 : 0.3, 2.4, horiz ? 0.3 : 8.3),
          createTexturedToonMaterial('tile_24.png', horiz ? 8 : 1, 4, 0x475569)
        );
        wall.position.copy(pos);
        wall.material.side = THREE.DoubleSide;
        apartmentRoomGroup.add(wall);
      });

      // Window on north wall
      const aptWinMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
      const aptWinGlow = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.0, 0.01),
        new THREE.MeshBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.4 })
      );
      aptWinGlow.position.set(0, 1.3, -4.17);
      apartmentRoomGroup.add(aptWinGlow);

      const aptWin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.01), aptWinMat);
      aptWin.position.set(0, 1.3, -4.17);
      aptWin.renderOrder = 1;
      apartmentRoomGroup.add(aptWin);

      // Window frame
      const aptFrmMat = createToonMaterial(0x1e293b);
      for (let s = -1; s <= 1; s += 2) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.06, 0.04), aptFrmMat);
        rail.position.set(0, 1.3 + s * 0.53, -4.17);
        apartmentRoomGroup.add(rail);
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.12, 0.04), aptFrmMat);
        stile.position.set(s * 0.93, 1.3, -4.17);
        apartmentRoomGroup.add(stile);
      }

      // Workbench
      const workbench = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.65, 0.9),
        createToonMaterial(0x6b4226, 0.7, 0.08)
      );
      workbench.position.set(2.2, 0.52, 0.2);
      apartmentRoomGroup.add(workbench);

      // Scrap inside box — Sparky's find, hidden by box walls until lid opens
      scrapRobot.root.scale.set(0.4, 0.4, 0.4);
      scrapRobot.root.position.set(-2.8, 0.26, -1.8);
      scrapRobot.root.rotation.set(Math.PI / 2, 0, 0.4);
      scrapRobot.nameSprite.visible = false;
      if (scrapRobot.leftPupil) scrapRobot.leftPupil.material.color.setHex(0x111111);
      if (scrapRobot.rightPupil) scrapRobot.rightPupil.material.color.setHex(0x111111);
      if (scrapRobot.antennaTip) scrapRobot.antennaTip.material.color.setHex(0x333333);
      apartmentRoomGroup.add(scrapRobot.root);

      // Bed
      const bedBase = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.15, 0.9),
        createToonMaterial(0x334155, 0.6, 0.06)
      );
      bedBase.position.set(-2.8, 0.17, -2.2);
      apartmentRoomGroup.add(bedBase);
      const bedMat = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.08, 0.7),
        createToonMaterial(0x60a5fa, 0.5, 0.05)
      );
      bedMat.position.set(-2.8, 0.28, -2.2);
      apartmentRoomGroup.add(bedMat);

      // Bookshelf
      const shelfBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.2, 0.25),
        createToonMaterial(0x78350f, 0.65, 0.07)
      );
      shelfBack.position.set(-3.4, 0.72, 1.8);
      apartmentRoomGroup.add(shelfBack);
      for (let i = 0; i < 3; i++) {
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.04, 0.04),
          createToonMaterial(0x92400e, 0.6, 0.06)
        );
        plank.position.set(-3.4, 0.08 + i * 0.34, 1.8);
        apartmentRoomGroup.add(plank);
      }

      // Small table with lamp
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.45, 0.5),
        createToonMaterial(0x7c3aed, 0.6, 0.07)
      );
      table.position.set(-2.2, 0.32, 2.5);
      apartmentRoomGroup.add(table);
      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.25, 8),
        createToonMaterial(0xfbbf24, 0.4, 0.05)
      );
      lamp.position.set(-2.2, 0.62, 2.5);
      apartmentRoomGroup.add(lamp);

      // Cardboard box (cutscene) — hidden initially
      const boxResult = createCardboardBox();
      boxResult.group.position.set(-2.8, 0.24, -1.8);
      boxResult.group.visible = false;
      apartmentRoomGroup.add(boxResult.group);
      cutsceneBoxRef.current = boxResult.group;
      cutsceneBoxLidRef.current = boxResult.lid;



      // Computer (cutscene) — hidden until fetch-laptop phase
      const computer = createLaptop();
      computer.position.set(-3.4, 0.24, -1.2);
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
        s.position.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, -(Math.random() - 0.5) * 0.08);
        s.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, -(Math.random() - 0.5) * 0.3);
        fx.add(s);
      }
      fx.visible = false;
      apartmentRoomGroup.add(fx);
      tackFxRef.current = fx;
      tackFxPhaseRef.current = 0;

      // Sparky inside apartment (hidden until Sparky walks home)
      const aptSparky = createRobotVisual(new THREE.Color(0xfacc15), 'Sparky');
      aptSparky.root.scale.set(0.7, 0.7, 0.7);
      aptSparky.root.position.set(-2.6, 0.28, 0.55);
      aptSparky.nameSprite.visible = false;
      aptSparky.root.visible = false;
      apartmentRoomGroup.add(aptSparky.root);
      apartmentSparkyRef.current = aptSparky;

      // Exit door on south wall — wooden style
      const aptDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.7, 0.08),
        createToonMaterial(0x8b5a2b)
      );
      aptDoor.position.set(0, 0.59, 4.00);
      apartmentRoomGroup.add(aptDoor);
      const aptDoorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.76, 0.08),
        createToonMaterial(0x5c3a1e)
      );
      aptDoorFrame.position.set(0, 0.62, 4.00);
      apartmentRoomGroup.add(aptDoorFrame);
      createExitSignMesh(0, -4.00, 1.3, apartmentRoomGroup, '#b45309', '#fef3c7', '#fde68a');
      // Exclamation marker at apartment exit
      const aptExitAnchor = new THREE.Group();
      aptExitAnchor.position.set(0, 1.3, 3.35);
      apartmentRoomGroup.add(aptExitAnchor);
      const aptExitMarker = addExclamationMarker(aptExitAnchor);
      aptExitMarker.visible = false;
      aptExitMarkerRef.current = aptExitMarker;
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

      if (event.code === 'Space' && inWorkshopRoomRef.current && !cutsceneActiveRef.current) {
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
          localRobot.root.position.set(6.0, 0.24, 9.0);
          shopDoorArmedRef.current = false;
          roomObstacleHitboxesRef.current = [];
          apiSync({ position: { x: 6.0, y: -9.0, rotation: null, room: 'outside' } });
        } else {
          interactionRequestedRef.current = true;
        }
        return;
      }
      if (event.code === 'Space' && !inWorkshopRoomRef.current && !inApartmentRoomRef.current) {
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
    const perfKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        setShowPerfOverlay(v => {
          const next = !v;
          if (!next && perfOverlayRef.current) perfOverlayRef.current.textContent = '';
          return next;
        });
        const s = (window as any).__perfStats;
        if (s) console.log('[PERF]', JSON.stringify(s.report()));
      }
    };
    window.addEventListener('keydown', perfKeyHandler);

    const rendererEl = renderer.domElement;

    // Pointer Lock — capture mouse on click, orbit while locked
    const isLockedRef = { current: false };
    rendererEl.addEventListener('pointerdown', () => {
      if (!cutsceneActiveRef.current && document.pointerLockElement !== rendererEl) {
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

    const createStandardRequest = (customerName: string): CustomerRequest => ({
      customerName,
      petName: pickRandom(PET_NAMES),
      petColor: pickRandom(PET_COLORS),
      petSize: 2 + Math.floor(Math.random() * 5),
      required: [...REQUEST_PATTERNS[Math.floor(Math.random() * REQUEST_PATTERNS.length)]],
      requestType: 'standard',
      isSpecSheet: false,
      tier: 'standard',
      baseReward: 2,
      bonusReward: 5,
    });

    const createSpecSheetRequest = (customerName: string): CustomerRequest => {
      const r = () => Math.random();
      const ri = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;
      const rf = (min: number, max: number, dec = 1) => parseFloat((r() * (max - min) + min).toFixed(dec));
      const templates: (() => SpecSheetPrompt)[] = [
        // 1: Efficiency → boolean (needsNewBattery)
        () => { const eff = rf(80, 99); return { lines: [`Efficiency is ${eff}%.`, `Set needsNewBattery to true if below 90%, otherwise false.`], expectedType: 'boolean', expectedName: 'needsNewBattery', expectedValue: String(eff < 90), exampleLines: ['Efficiency is 72%.', 'Set isCharged to true if below 90%, otherwise false.'], exampleCode: 'boolean isCharged = true;' }; },
        // 2: Temperature → boolean (isOverheated)
        () => { const temp = rf(70, 90); return { lines: [`Temperature is ${temp} degrees.`, `Set isOverheated to true if above 80, otherwise false.`], expectedType: 'boolean', expectedName: 'isOverheated', expectedValue: String(temp > 80), exampleLines: ['Temperature is 95 degrees.', 'Set isHot to true if above 80, otherwise false.'], exampleCode: 'boolean isHot = true;' }; },
        // 3: Arm count → int (toolCapacity)
        () => { const arms = ri(1, 4); return { lines: [`The robot has ${arms} arm${arms > 1 ? 's' : ''}.`, `Each arm carries 5 tools. Set toolCapacity.`], expectedType: 'int', expectedName: 'toolCapacity', expectedValue: String(arms * 5), exampleLines: ['The robot has 3 arms.', 'Each arm carries 5 tools. Set canCarry.'], exampleCode: 'int canCarry = 15;' }; },
        // 4: Efficiency → double (repairCost)
        () => { const eff = rf(80, 99); return { lines: [`Efficiency is ${eff}%.`, `Repair cost is 100 minus efficiency. Set repairCost.`], expectedType: 'double', expectedName: 'repairCost', expectedValue: String(parseFloat((100 - eff).toFixed(1))), exampleLines: ['Efficiency is 88%.', 'Repair cost is 100 minus efficiency. Set cost.'], exampleCode: 'double cost = 12.0;' }; },
        // 5: Size → double (storageTotal)
        () => { const sz = ri(1, 6); return { lines: [`The robot has ${sz} size unit${sz > 1 ? 's' : ''}.`, `Storage is size times 4. Set storageTotal.`], expectedType: 'double', expectedName: 'storageTotal', expectedValue: `${sz * 4}.0`, exampleLines: ['The robot has 5 size units.', 'Storage is size times 4. Set storage.'], exampleCode: 'double storage = 20.0;' }; },
        // 6: Pressure → int (safeLevel)
        () => { const pres = rf(20, 30); return { lines: [`Pressure reading is ${pres}.`, `Round down for safe level. Set safeLevel.`], expectedType: 'int', expectedName: 'safeLevel', expectedValue: String(Math.floor(pres)), exampleLines: ['Pressure reading is 45.2.', 'Round down for safe level. Set safeLevel.'], exampleCode: 'int safeLevel = 45;' }; },
        // 7: Efficiency → String (status)
        () => { const eff = rf(80, 99); return { lines: [`Efficiency is ${eff}%.`, `95 or higher means "Excellent", otherwise "Needs Repair". Set status.`], expectedType: 'String', expectedName: 'status', expectedValue: eff >= 95 ? 'Excellent' : 'Needs Repair', exampleLines: ['Efficiency is 56%.', '95 or higher means "Excellent", otherwise "Needs Repair". Set result.'], exampleCode: 'String result = "Needs Repair";' }; },
        // 8: Sensor count → boolean (hasConnectionIssue)
        () => { const sensors = ri(0, 4); return { lines: [`The robot has ${sensors} sensor${sensors !== 1 ? 's' : ''}.`, `Set hasConnectionIssue to true if sensors are less than 2, otherwise false.`], expectedType: 'boolean', expectedName: 'hasConnectionIssue', expectedValue: String(sensors < 2), exampleLines: ['The robot has 1 sensor.', 'Set hasIssue to true if sensors are less than 2, otherwise false.'], exampleCode: 'boolean hasIssue = true;' }; },
      ];

      const prompt = templates[Math.floor(r() * templates.length)]();
      const isGolden = Math.random() < 0.15;
      const extraVars: ('name' | 'color' | 'size')[] = ['name', 'color', 'size'];
      const addExtra = r() < 0.5;
      const required: ('name' | 'color' | 'size' | 'hasWireSurge')[] = addExtra ? [extraVars[Math.floor(r() * extraVars.length)]] : [];

      return {
        customerName,
        petName: pickRandom(PET_NAMES),
        petColor: pickRandom(PET_COLORS),
        petSize: 2 + Math.floor(Math.random() * 5),
        required,
        requestType: 'standard',
        isSpecSheet: true,
        tier: isGolden ? 'golden' : 'spec-sheet',
        baseReward: isGolden ? 8 : 5,
        bonusReward: isGolden ? 15 : 10,
        specSheetPrompts: [prompt],
      };
    };

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
          isSpecSheet: false,
          tier: 'standard',
          baseReward: 2,
          bonusReward: 5,
        };
        let dpTries = 0;
        while (blockedSignature && getWorkshopRequestSignature(dpRequest) === blockedSignature && dpTries < 8) {
          const dp2 = createDataRequest(customerName);
          dpRequest.dataSteps = dp2.dataSteps;
          dpTries += 1;
        }
        return dpRequest;
      }

      let nextRequest: CustomerRequest;

      if (Math.random() > 0.5) {
        nextRequest = createStandardRequest(customerName);
      } else {
        nextRequest = createSpecSheetRequest(customerName);
      }

      let tries = 0;
      while (blockedSignature && getWorkshopRequestSignature(nextRequest) === blockedSignature && tries < 8) {
        if (Math.random() > 0.5) {
          nextRequest = createStandardRequest(customerName);
        } else {
          nextRequest = createSpecSheetRequest(customerName);
        }
        tries += 1;
      }
      return nextRequest;
    };

    const spawnCustomer = () => {
      const customerGroupCurrent = roomCustomerGroupRef.current;
      if (!customerGroupCurrent || workshopCustomersRef.current.length >= 4) return;
      const occupiedQueues = new Set(
        workshopCustomersRef.current.filter((npc) => npc.stage !== 'leaving').map((npc) => npc.queueIndex)
      );
      const availableQueueIdx = [0, 1, 2, 3].find((i) => !occupiedQueues.has(i));
      if (availableQueueIdx === undefined) return;

      const usedNames = new Set(
        workshopCustomersRef.current.filter((npc) => npc.stage !== 'leaving').map((npc) => npc.request.customerName)
      );
      const availableNames = CUSTOMER_NAMES.filter((name) => !usedNames.has(name));
      const customerName = pickRandom(availableNames.length > 0 ? availableNames : CUSTOMER_NAMES);
      const request = createCustomerRequest(customerName);
      const colors = [0xfacc15, 0x60a5fa, 0x34d399, 0xf97316, 0xa855f7, 0xec4899];
      const cPerson = buildPlayerVisual(colors[Math.floor(Math.random() * colors.length)], customerName);
      cPerson.nameSprite.visible = false;
      cPerson.root.scale.set(0.9, 0.9, 0.9);
      const cargoRobot = createCustomerCargoRobot(customerName, request.petColor);
      cPerson.root.add(cargoRobot.root);
      applyDefectFromRequest(request, cargoRobot.root);
      const cmarker = addExclamationMarker(cPerson.root);
      cmarker.visible = false;
      cmarker.position.set(0, 0.85, 0);
      const visual = { root: cPerson.root, nameSprite: cPerson.nameSprite, marker: cmarker, leftLegPivot: cPerson.leftLegPivot, rightLegPivot: cPerson.rightLegPivot, leftArm: cPerson.leftArm, rightArm: cPerson.rightArm, leftArmPivot: cPerson.leftArmPivot, rightArmPivot: cPerson.rightArmPivot };
      const start = new THREE.Vector2(0, -5.5);
      visual.root.position.set(start.x, 0.24, -start.y);
      customerGroupCurrent.add(visual.root);
      const queuePos = CUSTOMER_QUEUE_POSITIONS[availableQueueIdx];
      const backY = queuePos.y;
      const entryWaypoints = [
        new THREE.Vector2(0, backY),
        new THREE.Vector2(queuePos.x, backY),
      ];
      const npc: CustomerNpc = {
        id: `${customerName}-${Math.random().toString(36).slice(2, 8)}`,
        visual,
        position: start,
        target: new THREE.Vector2(0, 0),
        queueIndex: availableQueueIdx,
        speed: 1.2 + Math.random() * 0.35,
        request,
        stage: 'walking-to-queue' as const,
        waypoints: entryWaypoints,
        wpIndex: 0,
        cargoRobot,
      };
      npc.target.copy(entryWaypoints[0]);
      (npc as any).startedAtMs = performance.now();
      setCustomerRobotMode(npc, 'carry');
      workshopCustomersRef.current.push(npc);
    };
    spawnCustomerRef.current = spawnCustomer;

    // Pre-spawn customers directly at queue positions (no walking)
    const prespawnColors = [0xfacc15, 0x60a5fa, 0x34d399];
    for (let qi = 0; qi < 3; qi++) {
      const customerGroupCurrent = roomCustomerGroupRef.current;
      if (!customerGroupCurrent) break;
      const usedNames = workshopCustomersRef.current.map(n => n.request.customerName);
      const availableNames = CUSTOMER_NAMES.filter((name: string) => !usedNames.includes(name));
      const customerName = pickRandom(availableNames.length > 0 ? availableNames : CUSTOMER_NAMES);
      const request = createCustomerRequest(customerName);
      const cPerson = buildPlayerVisual(prespawnColors[qi], customerName);
      cPerson.nameSprite.visible = false;
      cPerson.root.scale.set(0.9, 0.9, 0.9);
      const cargoRobot = createCustomerCargoRobot(customerName, request.petColor);
      cPerson.root.add(cargoRobot.root);
      applyDefectFromRequest(request, cargoRobot.root);
      const cmarker = addExclamationMarker(cPerson.root);
      cmarker.visible = false;
      cmarker.position.set(0, 0.85, 0);
      const visual = { root: cPerson.root, nameSprite: cPerson.nameSprite, marker: cmarker, leftLegPivot: cPerson.leftLegPivot, rightLegPivot: cPerson.rightLegPivot, leftArm: cPerson.leftArm, rightArm: cPerson.rightArm, leftArmPivot: cPerson.leftArmPivot, rightArmPivot: cPerson.rightArmPivot };
      const qp = CUSTOMER_QUEUE_POSITIONS[qi];
      visual.root.position.set(qp.x, 0.24, -qp.y);
      customerGroupCurrent.add(visual.root);
      const npc: CustomerNpc = {
        id: `${customerName}-${Math.random().toString(36).slice(2, 8)}`,
        visual,
        position: qp.clone(),
        target: qp.clone(),
        queueIndex: qi,
        speed: 1.2,
        request,
        stage: 'waiting',
        cargoRobot,
      };
      setCustomerRobotMode(npc, 'carry');
      workshopCustomersRef.current.push(npc);
    }

    let lastTime = performance.now();
    if (typeof window !== 'undefined') {
      (window as any).__perfStats = (window as any).__perfStats || {
        frameCount: 0, totalLogicMs: 0, totalRenderMs: 0, maxLogic: 0, maxRender: 0, minLogic: 1000, minRender: 1000, reactRenders: 0,
        get avgLogic() { return this.frameCount ? (this.totalLogicMs / this.frameCount).toFixed(2) : 'N/A'; },
        get avgRender() { return this.frameCount ? (this.totalRenderMs / this.frameCount).toFixed(2) : 'N/A'; },
        report() { const rr = typeof window !== 'undefined' ? (window as any).__reactRenders || 0 : 0; return { frames: this.frameCount, fps: this.fps, avgLogic: this.avgLogic, avgRender: this.avgRender, maxLogic: this.maxLogic.toFixed(2), maxRender: this.maxRender.toFixed(2), drawCalls: this.drawCalls, triangles: this.triangles, reactRenders: rr, slowLogic: this.slowLogicFrames || 0, slowRender: this.slowRenderFrames || 0, lastSlowLogic: this.slowLogicDetails || [] }; },
        reset() { this.frameCount = 0; this.totalLogicMs = 0; this.totalRenderMs = 0; this.maxLogic = 0; this.maxRender = 0; this.minLogic = 1000; this.minRender = 1000; this.reactRenders = 0; if (typeof window !== 'undefined') (window as any).__reactRenders = 0; },
      };
    }
    const animate = (now: number) => {
      const logicStart = performance.now();
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

      if (profileLoadedRef.current) {
        if (pendingRafiqCutsceneRef.current && !showControlsModalRef.current) {
          pendingRafiqCutsceneRef.current = false;
          rafiqWalkPhaseRef.current = 'walking';
          rafiqCutsceneTimerRef.current = 0;
          cutsceneActiveRef.current = true;
          document.exitPointerLock();
          keyStateRef.current.clear();
          deferCutsceneTick();
          yawRef.current = Math.atan2(ROOM_OWNER_POS.x - localPositionRef.current.x, ROOM_OWNER_POS.y - localPositionRef.current.y);
        } else if (pendingAptCutsceneRef.current && !showControlsModalRef.current) {
          pendingAptCutsceneRef.current = false;
          aptCutscenePhaseRef.current = 'walk-west';
          aptCutsceneTimerRef.current = 0;
          startCinematicCutscene();
          keyStateRef.current.clear();
        } else if (pendingBatteryCutsceneRef.current && !showControlsModalRef.current) {
          pendingBatteryCutsceneRef.current = false;
          prepBatteryInstallProps();
          installBatteryPhaseRef.current = 'approach';
          installBatteryTimerRef.current = 0;
          startCinematicCutscene();
          keyStateRef.current.clear();
        }
      }

      let moved = false;
      const moveDir2 = scratchVec2.current.set(0, 0);
      if (cutsceneActiveRef.current) {
        // Cutscene or Rafiq dialog active — freeze player
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
          const candidate = scratchVec2b.current.copy(localPositionRef.current).add(moveDir2.multiplyScalar(MOVE_SPEED * delta));
      if (inWorkshopRoomRef.current && rafiqWalkPhaseRef.current === 'idle') {
            candidate.x = Math.max(-4.82, Math.min(4.82, candidate.x));
            candidate.y = Math.max(-5.3, Math.min(4.82, candidate.y));
            // Walk into south exit door → leave workshop
            if (candidate.y < -5.1 && Math.abs(candidate.x) < 0.5) {
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
                localRobot.root.position.set(candidate.x, 0.28, -candidate.y);
              } else {
                moved = false;
              }
            }
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
                localRobot.root.position.set(candidate.x, 0.28, -candidate.y);
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
              localRobot.root.position.set(6.0, 0.24, 9.0);
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
                localRobot.root.position.set(candidate.x, 0.28, -candidate.y);
              } else {
                moved = false;
              }
            }
          } else {
            const FLAT_EDGE_X = -10.4 + PLAYER_RADIUS;
            const DOCK_WEST_X = -18.4 + PLAYER_RADIUS;
            const onDock = candidate.y >= -9.75 && candidate.y <= -6.25;
            if (candidate.x < (onDock ? DOCK_WEST_X : FLAT_EDGE_X)) candidate.x = onDock ? DOCK_WEST_X : FLAT_EDGE_X;
            const maxRadius = ISLAND_RADIUS - PLAYER_RADIUS;
            if (candidate.length() > maxRadius) candidate.setLength(maxRadius);
            const FLAT_BOTTOM_Y = -14 + PLAYER_RADIUS;
            if (candidate.y < FLAT_BOTTOM_Y) candidate.y = FLAT_BOTTOM_Y;
            const canEnterBuildings = sparkyQuestStageRef.current !== 'intro' || sparkyHomeArrivedRef.current;
            const hitsObstacle = collidesWithAny(candidate, obstacleHitboxesRef.current) ||
              (!canEnterBuildings && apartmentDoorHitboxRef.current && isInsideHitbox(candidate, apartmentDoorHitboxRef.current)) ||
              Object.values(remoteAvatarsRef.current).some(a => a.room === 'outside' &&
                candidate.distanceTo(a.target) < 0.3);
            const checkDoor = (hitbox: Hitbox | null, armedRef: React.MutableRefObject<boolean>, extra?: boolean) => {
              if (hitbox === null) return false;
              const at = canEnterBuildings && (extra ?? true) && armedRef.current && isInsideHitbox(candidate, hitbox);
              if (!isInsideHitbox(candidate, hitbox)) armedRef.current = true;
              return at;
            };

            const atWorkshopDoor = checkDoor(workshopDoorHitboxRef.current, workshopDoorArmedRef, Boolean(shopUnlockedRef.current));
            const aptStage = sparkyQuestStageRef.current;
            const atApartmentDoor = checkDoor(apartmentDoorHitboxRef.current, apartmentDoorArmedRef);
            const atShopDoor = checkDoor(shopDoorHitboxRef.current, shopDoorArmedRef);

            if (atWorkshopDoor) {
              workshopDoorArmedRef.current = false;
              inWorkshopRoomRef.current = true;
              setInWorkshopRoom(true);
              // If player has Sparky's letter, start Rafiq meet cutscene immediately
              if (cutsceneDoneRef.current && (gameStore.get('backpack') as string[]).includes('letter')) {
                workshopIntroSeenRef.current = true;
                setWorkshopIntroSeen(true);
                rafiqMeetAutoTriggeredRef.current = true;
                rafiqWalkPhaseRef.current = 'walking';
                rafiqCutsceneTimerRef.current = 0;
                cutsceneActiveRef.current = true;
                document.exitPointerLock();
                keyStateRef.current.clear();
                yawRef.current = Math.atan2(ROOM_OWNER_POS.x - ROOM_SPAWN.x, ROOM_OWNER_POS.y - ROOM_SPAWN.y);
              } else {
                yawRef.current = 0;
              }
              setWorkshopIntroStep(0);
              setRoomEntryFlash(true);
              if (roomEntryFlashTimeoutRef.current !== null) {
                window.clearTimeout(roomEntryFlashTimeoutRef.current);
              }
              roomEntryFlashTimeoutRef.current = window.setTimeout(() => setRoomEntryFlash(false), 460);
              localPositionRef.current.copy(ROOM_SPAWN);
              localRobot.root.position.set(ROOM_SPAWN.x, 0.26, -ROOM_SPAWN.y);
              roomObstacleHitboxesRef.current = workshopObstaclesRef.current;
              if (workshopCustomersRef.current.length === 0) {
                spawnCustomer();
              }
              moved = false;
              fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: { x: ROOM_SPAWN.x, y: ROOM_SPAWN.y, room: 'workshop', rotation: yawRef.current } }),
                keepalive: true,
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
              localRobot.root.position.set(0, 0.28, -1.2);
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
              localRobot.root.position.set(APARTMENT_SPAWN.x, 0.28, -APARTMENT_SPAWN.y);
              roomObstacleHitboxesRef.current = [
                { shape: 'box', center: { x: 2.2, y: -0.2 }, halfWidth: 0.8, halfHeight: 0.45 },
                { shape: 'box', center: { x: -2.8, y: 2.2 }, halfWidth: 0.9, halfHeight: 0.45 },
                { shape: 'box', center: { x: -3.4, y: -1.8 }, halfWidth: 0.45, halfHeight: 0.12 },
                { shape: 'box', center: { x: -2.2, y: -2.5 }, halfWidth: 0.25, halfHeight: 0.25 },
                { shape: 'box', center: { x: -2.2, y: 1.5 }, halfWidth: 0.2, halfHeight: 0.15 },
              ];
              if (aptStage === 'intro' && !cutsceneDoneRef.current) {
                // Start cutscene — only the box is visible
                startCinematicCutscene();
                aptCutscenePhaseRef.current = 'walk-west';
                aptCutsceneTimerRef.current = 0;
                if (cutsceneBoxRef.current) cutsceneBoxRef.current.visible = true;
                const csSparky = apartmentSparkyRef.current;
                if (csSparky) {
                  csSparky.root.visible = true;
                  csSparky.root.position.set(0.2, 0.22, -2.2);
                  const initDir = new THREE.Vector2(-2.8 - 0.2, 0.8 - 2.2).normalize();
                  aptSparkyFacingRef.current = -Math.atan2(initDir.x, initDir.y);
                  const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
                  if (sparkyBaseQuatRef.current) csSparky.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                }
                // Position player avatar to walk alongside Sparky
                if (localRobotRef.current) {
                  localPositionRef.current.set(0, 1.2);
                  localRobotRef.current.root.position.set(0, 0.28, -1.2);
                  localGroup.position.set(0, 0.28, -1.2);
                }
                yawRef.current = Math.atan2(-2.3, 0.53); // face toward walk direction
                document.exitPointerLock();
              } else if (!batteryInstalledRef.current && (gameStore.get('backpack') as ScrapPartId[]).includes('battery' as ScrapPartId)) {
                prepBatteryInstallProps();
                installBatteryPhaseRef.current = 'approach';
                installBatteryTimerRef.current = 0;
                startCinematicCutscene();
                keyStateRef.current.clear();
                document.exitPointerLock();
              }
              keyStateRef.current.clear();
              moved = false;
              fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: { x: APARTMENT_SPAWN.x, y: APARTMENT_SPAWN.y, room: 'apartment', rotation: yawRef.current }, questStage: sparkyQuestStageRef.current, backpack: gameStore.get('backpack'), money: gameStore.get('money') }),
                keepalive: true,
              }).catch(() => {});
            } else if (!hitsObstacle) {
              localPositionRef.current.copy(candidate);
              localRobot.root.position.set(candidate.x, 0.24, -candidate.y);
            } else {
              moved = false;
            }
          }
        }
        }

      // Rafiq meet cutscene — cinematic walk with timed phases
      if (rafiqWalkPhaseRef.current === 'walking' && inWorkshopRoomRef.current) {
        const dir = scratchVec2.current.set(RAFIQ_ARRIVAL_TARGET.x - localPositionRef.current.x, RAFIQ_ARRIVAL_TARGET.y - localPositionRef.current.y);
        yawRef.current = Math.atan2(dir.x, dir.y);
        if (dir.length() > 0.1) {
          const step = dir.normalize().multiplyScalar(MOVE_SPEED * 0.23 * delta);
          localPositionRef.current.x += step.x;
          localPositionRef.current.y += step.y;
          localRobot.root.position.set(localPositionRef.current.x, 0.26, -localPositionRef.current.y);
          moved = true;
        } else {
          rafiqWalkPhaseRef.current = 'arriving';
          rafiqCutsceneTimerRef.current = 0;
          const dx = localPositionRef.current.x - ROOM_OWNER_POS.x;
          const dy = localPositionRef.current.y - ROOM_OWNER_POS.y;
          rafiqTargetFacingRef.current = dx === 0 && dy === 0 ? 0 : Math.atan2(dx, -dy);
        }
      } else if (rafiqWalkPhaseRef.current === 'arriving') {
        rafiqCutsceneTimerRef.current += delta;
        if (roomOwnerVisualRef.current) {
          const rotProgress = Math.min(1, rafiqCutsceneTimerRef.current / 0.8);
          const facingQ = scratchQuat.current.setFromAxisAngle(scratchVec3.current.set(0, 0, 1), rafiqTargetFacingRef.current * rotProgress);
          roomOwnerVisualRef.current.root.quaternion.copy(rafiqBaseQuatRef.current).premultiply(facingQ);
        }
        if (rafiqCutsceneTimerRef.current >= 1.0) {
          rafiqWalkPhaseRef.current = 'greeting';
          setWhoStep(0);
          setShowWhoDlg(true);
        }
      } else if (rafiqWalkPhaseRef.current === 'handing-letter') {
        rafiqCutsceneTimerRef.current += delta;
        const handDuration = 1.4;
        const wsg = workshopRoomGroupRef.current;
        if (!rafiqLetterSpriteRef.current && wsg) {
          const letter = new THREE.Group();
          const envBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.02, 0.4),
            createToonMaterial(0xf5e6c8)
          );
          letter.add(envBody);
          const fold = new THREE.Mesh(
            new THREE.BoxGeometry(0.26, 0.03, 0.06),
            createToonMaterial(0xe8d5a8)
          );
          fold.position.y = 0.15;
          letter.add(fold);
          const seal = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 8, 8),
            createToonMaterial(0xdc2626)
          );
          seal.position.y = 0.015;
          letter.add(seal);
          letter.position.set((localPositionRef.current.x + ROOM_OWNER_POS.x) / 2, 0.5, -(localPositionRef.current.y + ROOM_OWNER_POS.y) / 2);
          rafiqLetterSpriteRef.current = letter;
          wsg.add(letter);
        }
        if (rafiqLetterSpriteRef.current) {
          const t = Math.min(1, rafiqCutsceneTimerRef.current / handDuration);
          const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          const startX = localPositionRef.current.x * 0.65 + ROOM_OWNER_POS.x * 0.35;
          const startY = localPositionRef.current.y * 0.65 + ROOM_OWNER_POS.y * 0.35;
          const endX = localPositionRef.current.x * 0.25 + ROOM_OWNER_POS.x * 0.75;
          const endY = localPositionRef.current.y * 0.25 + ROOM_OWNER_POS.y * 0.75;
          rafiqLetterSpriteRef.current.position.x = startX + (endX - startX) * ease;
          rafiqLetterSpriteRef.current.position.y = startY + (endY - startY) * ease;
          rafiqLetterSpriteRef.current.position.y = 0.5 + Math.sin(ease * Math.PI) * 0.15;
          rafiqLetterSpriteRef.current.rotation.y = Math.sin(ease * Math.PI) * 0.3;
          const s = t < 0.08 ? t / 0.08 : t > 0.85 ? (1 - t) / 0.15 : 1;
          rafiqLetterSpriteRef.current.scale.set(s, s, s);
        }
        // Rafiq arm animation: extend (0-0.3s), hold (0.3-1.0s), retract (1.0-1.4s)
        if (roomOwnerVisualRef.current?.rightArm) {
          const arm = roomOwnerVisualRef.current.rightArm;
          if (rafiqCutsceneTimerRef.current < 0.3) {
            const p = rafiqCutsceneTimerRef.current / 0.3;
            arm.rotation.x = -0.3 + (0.4 - (-0.3)) * p;
          } else if (rafiqCutsceneTimerRef.current < 1.0) {
            arm.rotation.x = 0.4;
          } else if (rafiqCutsceneTimerRef.current < handDuration) {
            const p = (rafiqCutsceneTimerRef.current - 1.0) / (handDuration - 1.0);
            arm.rotation.x = 0.4 + (-0.3 - 0.4) * p;
          }
        }
        if (rafiqCutsceneTimerRef.current >= handDuration) {
          if (rafiqLetterSpriteRef.current && wsg) {
            wsg.remove(rafiqLetterSpriteRef.current);
            disposeObject(rafiqLetterSpriteRef.current);
            rafiqLetterSpriteRef.current = null;
          }
          rafiqWalkPhaseRef.current = 'reached';
          setShowRafiqLetterDlg(true);
          setRafiqLetterStep(0);
          const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rafiqTargetFacingRef.current);
          if (roomOwnerVisualRef.current) roomOwnerVisualRef.current.root.quaternion.copy(rafiqBaseQuatRef.current).premultiply(facingQ);
        }
      }

      if (moved) {
        const room = inWorkshopRoomRef.current ? 'workshop' : 'outside';
        triggerEvent('client-player-move', { x: localPositionRef.current.x, y: localPositionRef.current.y, room });
      }
      // Periodic full sync (30s safety net for crash recovery)
      if (now - lastPositionSyncRef.current >= 30000) {
        lastPositionSyncRef.current = now;
        const pRoom = inWorkshopRoomRef.current ? 'workshop' : inApartmentRoomRef.current ? 'apartment' : inShopRoomRef.current ? 'shop' : 'outside';
        const pos = pRoom !== 'outside'
          ? ({ workshop: ROOM_SPAWN, apartment: APARTMENT_SPAWN, shop: { x: 0, y: 1.2 } } as Record<string, { x: number; y: number }>)[pRoom]
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
          keepalive: true,
        }).catch(() => {});
      }
      if (moved && now - lastStepAtRef.current > 190) {
        const context = audioRef.current || new AudioContext();
        audioRef.current = context;
        playStepPop(context.currentTime);
        lastStepAtRef.current = now;
      }

      const playerYaw = yawRef.current;
      localGroup.rotation.y = -playerYaw;
      const baseY = inApartmentRoomRef.current ? 0.28 : inWorkshopRoomRef.current ? 0.26 : inShopRoomRef.current ? 0.08 : 0.24;
      localGroup.position.y = baseY + (moved ? Math.sin(worldTime * 10) * 0.02 : 0);
      // Walk animation — glTF mixer or manual fallback
      const isHolding = heldSlotIndexRef.current !== null && heldSlotIndexRef.current < gameStore.get('backpack').length;
      const currPos = localPositionRef.current;
      const playerMoving = moved || Math.abs(currPos.x - prevPlayerPosRef.current.x) > 0.0001 || Math.abs(currPos.y - prevPlayerPosRef.current.y) > 0.0001;
      prevPlayerPosRef.current.copy(currPos);
      if (playerMixerRef.current) {
        playerMixerRef.current.update(delta);
        const idleAction = midleActionRef.current;
        const walkAction = mwalkActionRef.current;
        const waveAction = mwaveActionRef.current;
        if (waveTimerRef.current > 0) {
          waveTimerRef.current -= delta;
          if (idleAction) idleAction.weight = 0;
          if (walkAction) walkAction.weight = 0;
          if (waveAction) {
            waveAction.weight = 1;
            waveAction.setLoop(THREE.LoopOnce, 1);
            waveAction.reset();
            waveTimerRef.current = -1; // plays once naturally
          }
        } else if (waveTimerRef.current === -1 && waveAction && waveAction.isRunning() === false) {
          // Wave finished — return to idle
          waveTimerRef.current = 0;
          if (idleAction) idleAction.reset().play();
          if (idleAction) idleAction.weight = 1;
          if (walkAction) { walkAction.weight = 0; walkAction.reset().play(); }
        } else if (idleAction && walkAction) {
          const target = playerMoving ? 1 : 0;
          const speed = delta * 8;
          idleAction.weight = THREE.MathUtils.lerp(idleAction.weight, 1 - target, speed);
          walkAction.weight = THREE.MathUtils.lerp(walkAction.weight, target, speed);
        }
      } else {
        const localVis = localRobotRef.current;
        const playerSpeed = moved ? 1 : 0;
        const walkSwing = Math.sin(worldTime * WALK_BOB_SPEED) * 0.3 * playerSpeed;
        if (leftLegPivotRef.current) leftLegPivotRef.current.rotation.x = walkSwing;
        if (rightLegPivotRef.current) rightLegPivotRef.current.rotation.x = -walkSwing;
        const armSwing = Math.sin(worldTime * WALK_BOB_SPEED + Math.PI) * 0.2 * playerSpeed;
        if (localVis) {
          localVis.leftArm.rotation.x = armSwing;
          localVis.rightArm.rotation.x = -armSwing;
        }
        if (rightArmPivotRef.current) {
          if (isHolding) {
            rightArmPivotRef.current.rotation.x = -0.7;
          } else {
            rightArmPivotRef.current.rotation.x = -0.42;
          }
        }
      }

      // Held item 3D model — attaches to right hand bone (glTF) or right arm mesh (manual fallback)
      const heldGroup = heldItemGroupRef.current;
      const handBone = playerRightHandBoneRef.current;
      if (heldGroup && heldSlotIndexRef.current !== null && heldSlotIndexRef.current < gameStore.get('backpack').length) {
        heldGroup.visible = true;
        const partId = gameStore.get('backpack')[heldSlotIndexRef.current];
        if (heldGroup.userData.partId !== partId) {
          while (heldGroup.children.length) heldGroup.remove(heldGroup.children[0]);
          const model = createPartModel(partId);
          heldGroup.add(model);
          heldGroup.userData.partId = partId;
        }
        if (isHolding) {
          if (handBone) {
            if (heldGroup.parent !== handBone) handBone.add(heldGroup);
            heldGroup.position.set(0, 0.07, 0);
            heldGroup.rotation.set(-Math.PI / 2, 0, 0);
            heldGroup.scale.set(2, 2, 2);
          } else {
            const arm = rightArmRef.current;
            if (arm && heldGroup.parent !== arm) arm.add(heldGroup);
            heldGroup.position.set(0, 0, -0.14);
            heldGroup.rotation.set(0, 0, 0);
            heldGroup.scale.set(2, 2, 2);
          }
        } else {
          if (heldGroup.parent !== localGroup) localGroup.add(heldGroup);
          heldGroup.scale.set(1, 1, 1);
          heldGroup.position.set(0.15, 0.50, 0);
          heldGroup.rotation.y = Math.sin(worldTime * 2) * 0.3;
          heldGroup.rotation.x = Math.sin(worldTime * 1.5) * 0.15;
        }
      } else if (heldGroup) {
        heldGroup.visible = false;
        if (heldGroup.parent !== localGroup) localGroup.add(heldGroup);
        heldGroup.scale.set(1, 1, 1);
        if (heldGroup.position.x !== 0.15 || heldGroup.position.y !== 0 || heldGroup.position.z !== 0.50) {
          heldGroup.position.set(0.15, 0.50, 0);
        }
      }

      // Animate event particles (smoke/sparks expand outward)
      if (eventParticlesRef.current) {
        eventParticlesRef.current.children.forEach((child) => {
          const p = child as THREE.Mesh;
          if (p.isMesh && p.userData.life > 0) {
            p.userData.life -= delta;
            p.position.x += (p.userData.vx || 0) * delta;
            p.position.y += (p.userData.vz || 0) * delta;
            p.position.z -= (p.userData.vy || 0) * delta;
            if (p.material) {
              (p.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.userData.life / 1.5);
            }
          }
        });
      }

      if (!inWorkshopRoomRef.current && !inShopRoomRef.current && !inApartmentRoomRef.current) {
        const distanceToSparky = localPositionRef.current.distanceTo(NPC_POSITION);
        let outsidePrompt: string | null = null;

        const stage = sparkyQuestStageRef.current;
        const sparkyOutsideVisible = outdoorSparkyRef.current?.root.visible ?? true;
        const showSparkyPrompt =
          sparkyOutsideVisible &&
          (stage === 'intro' ||
           stage === 'intro-done' ||
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
        }

        if (worldInteractionRequestedRef.current) {
          worldInteractionRequestedRef.current = false;
          // Trigger wave animation on interaction
          if (waveTimerRef.current <= 0 && mwaveActionRef.current && playerMixerRef.current) {
            waveTimerRef.current = 0.01; // triggers wave play
          }
          if (distanceToSparky < SPARKY_INTERACTION_DISTANCE) {
            if (stage === 'intro' && gameStore.get('backpack').includes('battery') && !sparkyGoHomeRef.current && !sparkyHomeArrivedRef.current) {
              setSparkyDlgFull('You got the battery! Follow me — let\'s install it!');
              setShowSparkyDlg(true);
              const __s = outdoorSparkyRef.current;
              if (__s) {
                const __sx = __s.root.position.x;
                const __sy = __s.root.position.y;
                sparkyHomeWaypointsRef.current = [new THREE.Vector2(__sx, -6.5), new THREE.Vector2(-9.6, -6.5), new THREE.Vector2(-9.6, -5.7)];
                sparkyHomeWaypointIdxRef.current = 0;
              }
              sparkyWalkHomeTimerRef.current = 0;
              sparkyGoHomeRef.current = true;
            } else if (stage === 'intro' && !sparkyGoHomeRef.current) {
              setSparkyIntroStep(0);
            } else if (stage === 'all-done') {
              setSparkyDlgFull('Scrap is fully repaired! Take him to customers at the repair kiosk.');
              setShowSparkyDlg(true);
            }
          }
        }

        if (outsidePrompt !== lastOutsidePromptRef.current) {
          lastOutsidePromptRef.current = outsidePrompt;
          setInteractionPromptName(outsidePrompt);
        }
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
          const dist = sparky.root.position.distanceTo(scratchVec3.current.set(target.x, target.y, 0.14));
          if (dist < 0.15) {
            sparkyHomeWaypointIdxRef.current++;
          } else {
            const dir = scratchVec2.current.set(target.x - sparky.root.position.x, target.y - sparky.root.position.y).normalize();
            const step = 1.8 * delta;
            const candidate = scratchVec2b.current.set(
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
          if (apartmentSparkyRef.current) apartmentSparkyRef.current.root.visible = true;
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
            const dist = sparky.root.position.distanceTo(scratchVec3.current.set(target.x, target.y, 0.14));
            if (dist < 0.15) {
              sparkyPathIndexRef.current = (sparkyPathIndexRef.current + 1) % SPARKY_PATH.length;
              sparkyWaitTimerRef.current = 0;
            } else {
              const dir = scratchVec2.current.set(target.x - sparky.root.position.x, target.y - sparky.root.position.y).normalize();
              const step = 1.8 * delta;
              const candidate = scratchVec2b.current.set(
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
          const facingQ = scratchQuat.current.setFromAxisAngle(scratchVec3Up.current, sparkyFacingRef.current);
          sparky.root.quaternion.copy(baseQuat).premultiply(facingQ);
        } else {
          sparkyFacingRef.current = 0;
          sparky.root.quaternion.copy(baseQuat);
        }
      }
      if (sparky.root.visible && !inApartmentRoomRef.current && !inWorkshopRoomRef.current && !inShopRoomRef.current) {
        animateSparkyWave(sparky, worldTime);
      }
      // Scrap follower AI
      if (scrapFollowerEnabledRef.current && scrapFollowerRef.current && scrapVisibleRef.current && !inApartmentRoomRef.current && !inWorkshopRoomRef.current && !inShopRoomRef.current) {
        const playerPos = localPositionRef.current;
        const scrapPosX = scrapFollowerRef.current.root.position.x;
        const scrapPosY = scrapFollowerRef.current.root.position.y;
        const scrapPos = scratchVec2.current.set(scrapPosX, scrapPosY);
        const followDist = scrapPos.distanceTo(playerPos);
        if (followDist > 1.2) {
          const target = scratchVec2b.current.set(playerPos.x, playerPos.y - 0.8);
          const dir = scratchVec2.current.copy(target).sub(scrapPos).normalize();
          const step = Math.min(followDist - 0.8, 3.0 * delta);
          const cand = scratchVec2.current.set(scrapPosX + dir.x * step, scrapPosY + dir.y * step);
          if (!collidesWithAny(cand, obstacleHitboxesRef.current)) {
            scrapFollowerRef.current.root.position.x = cand.x;
            scrapFollowerRef.current.root.position.y = cand.y;
          }
        }
        const scrapSpeed = followDist > 1.2 ? 1 : 0;
        animateRobotVisual(scrapFollowerRef.current, worldTime, scrapSpeed, playerPos.x - scrapPos.x, playerPos.y - scrapPos.y);
      }
      if (speechBubbleRef.current && sparkyIntroStepRef.current >= 0) {
        const headPos = scratchVec3.current;
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
      sparky.root.position.y = 0.24 + Math.sin(worldTime * 4) * 0.04;
      if (sparkyQuestStageRef.current === 'intro' && !sparkyGoHomeRef.current) {
        // Don't override repair animation with walk animation
      } else {
        animateRobotVisual(sparky, worldTime, 0.5, -0.3, 0.15);
      }
      if (sparkyQuestMarkerRef.current) {
        sparkyQuestMarkerRef.current.position.y = 1.0 + Math.sin(worldTime * 5.2) * 0.08;
      }
      animateRobotVisual(owner, worldTime * 0.9, 0.12, -0.2, -0.1);
      if (shopNpcRef.current) {
        shopNpcRef.current.root.position.y = 0.02 + Math.sin(worldTime * 3) * 0.02;
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
        if (aptSparky && aptSparky.root.visible && aptCutscenePhaseRef.current === 'idle' && !installBatteryPhaseRef.current) {
          aptSparky.root.position.y = 0.28 + Math.sin(worldTime * 3) * 0.04;
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
              const dist = aptSparkyCS.root.position.distanceTo(new THREE.Vector3(spTgt.x, 0.22, -spTgt.y));
              if (dist > 0.08 && wpIdx < sparkyWps.length) {
                const dir = new THREE.Vector2(spTgt.x - aptSparkyCS.root.position.x, spTgt.y - aptSparkyCS.root.position.y).normalize();
                aptSparkyCS.root.position.x += dir.x * MOVE_SPEED * 0.29 * delta;
                aptSparkyCS.root.position.z += dir.y * MOVE_SPEED * 0.29 * delta;
                const moveFacing = -Math.atan2(dir.x, dir.y);
                aptSparkyFacingRef.current = dist < 0.4 ? (moveFacing * (dist / 0.4)) : moveFacing;
                const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0.2, -0.2, 0.1);
              } else if (wpIdx < sparkyWps.length - 1) {
                aptSparkyWalkWpRef.current = wpIdx + 1;
                aptSparkyCS.root.position.set(spTgt.x, 0.22, -spTgt.y);
              } else {
                aptCutscenePhaseRef.current = 'open-box';
                aptCutsceneTimerRef.current = 0;
                aptSparkyCS.root.position.set(sparkyWps[sparkyWps.length - 1].x, 0.22, -sparkyWps[sparkyWps.length - 1].y);
                aptSparkyFacingRef.current = 0;
                const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
              }
            }
            // Player walks to spectator position (camera-left of box, in line with it)
            if (walkPlayer(localPositionRef.current, playerTarget, MOVE_SPEED * 0.29, delta, worldTime, 0.28, localRobotRef.current, leftLegPivotRef.current, rightLegPivotRef.current, yawRef)) {
              // Arrived — face the box
              yawRef.current = Math.atan2(-0.5, 0.5);
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
              scrapRobotRef.current.root.position.y = z;
              scrapRobotRef.current.root.rotation.y = 0.4 * (1 - progress) + 0.2 * progress;
            }
            if (aptSparkyCS) {
              aptSparkyCS.root.position.y = 0.22 - 0.06 * progress;
              aptSparkyCS.body.rotation.x = -0.25 * progress;
              aptSparkyCS.leftArm.rotation.x = -1.5 * progress;
              aptSparkyCS.rightArm.rotation.x = -1.5 * progress;
              animateRobotVisual(aptSparkyCS, worldTime, 0, 0.15, -0.05);
            }
            if (progress >= 1) {
              if (scrapRobotRef.current) {
                scrapRobotRef.current.root.position.set(-2.8, 0.55, -1.8);
                scrapRobotRef.current.root.rotation.y = 0.2;
              }
              aptCutscenePhaseRef.current = 'lift-carry';
              aptCutsceneTimerRef.current = 0;
            }
          } else if (phase === 'lift-carry') {
            aptCutsceneTimerRef.current += delta;
            const progress = Math.min(1, aptCutsceneTimerRef.current / 2.5);
            if (scrapRobotRef.current) {
              const x = -2.8 + (-2.6 + 2.8) * progress;
              scrapRobotRef.current.root.position.x = x;
              scrapRobotRef.current.root.position.z = -(1.8 + (1.2 - 1.8) * progress);
              scrapRobotRef.current.root.rotation.y = 0.2 * (1 - progress) + 0.12 * progress;
            }
            if (aptSparkyCS) {
              aptSparkyCS.root.position.x = -2.8;
              aptSparkyCS.root.position.z = -(0.8 + (0.45 - 0.8) * progress);
              aptSparkyCS.root.position.y = 0.16;
              aptSparkyFacingRef.current = 0;
              const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
              if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
              animateRobotVisual(aptSparkyCS, worldTime, 0.2, -0.1, 0.0);
              aptSparkyCS.leftArm.rotation.x = -1.5;
              aptSparkyCS.rightArm.rotation.x = -1.5;
            }
            if (progress >= 1) {
              if (scrapRobotRef.current) {
                scrapRobotRef.current.root.position.set(-2.6, 0.55, -1.2);
                scrapRobotRef.current.root.rotation.y = 0.12;
              }
              if (aptSparkyCS) {
                aptSparkyCS.root.position.z = -0.45;
              }
              aptCutscenePhaseRef.current = 'lift-lower';
              aptCutsceneTimerRef.current = 0;
            }
          } else if (phase === 'lift-lower') {
            aptCutsceneTimerRef.current += delta;
            const progress = Math.min(1, aptCutsceneTimerRef.current / 1.5);
            if (scrapRobotRef.current) {
              const z = 0.55 + (0.24 - 0.55) * progress;
              scrapRobotRef.current.root.position.y = z;
              scrapRobotRef.current.root.rotation.y = 0.12 * (1 - progress) + 0.08 * progress;
            }
            if (aptSparkyCS) {
              aptSparkyCS.root.position.y = 0.16 + 0.06 * progress;
              aptSparkyCS.body.rotation.x = -0.25 * (1 - progress);
              aptSparkyCS.leftArm.rotation.x = -1.5 * (1 - progress);
              aptSparkyCS.rightArm.rotation.x = -1.5 * (1 - progress);
              animateRobotVisual(aptSparkyCS, worldTime, 0, 0.1, 0.05);
            }
            if (progress >= 1) {
              if (scrapRobotRef.current) {
                scrapRobotRef.current.root.position.set(-2.6, 0.24, -1.2);
                scrapRobotRef.current.root.rotation.y = 0.08;
              }
              if (aptSparkyCS) {
                aptSparkyCS.root.position.y = 0.22;
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
                aptSparkyCS.root.position.z = -WEST_TARGET.y;
                aptSparkyFacingRef.current = -Math.PI * 0.5;
                const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0.5, -0.1, 0.0);
              } else if (t < 3.0) {
                const turnT = (t - 2.5) / 0.5;
                aptSparkyFacingRef.current = -Math.PI * 0.5 + turnT * Math.PI;
                const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0, 0, 0);
                if (t >= 2.8 && computerRef.current && computerRef.current.parent !== aptSparkyCS.root) {
                  aptSparkyCS.root.attach(computerRef.current);
                  computerRef.current.scale.set(1 / 0.7, 1 / 0.7, 1 / 0.7);
                  computerRef.current.position.set(0, 1.0, -0.47);
                  const invQ = aptSparkyCS.root.quaternion.clone().invert();
                  const worldUp = new THREE.Vector3(0, 1, 0);
                  const localUp = worldUp.applyQuaternion(invQ);
                  const lapQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), localUp);
                  computerRef.current.quaternion.copy(lapQuat);
                  computerRef.current.visible = true;
                }
              } else {
                const walkT = (t - 3.0) / 2.5;
                if (walkT < 1.0) {
                  aptSparkyCS.root.position.x = EAST_TARGET.x + (WEST_TARGET.x - EAST_TARGET.x) * walkT;
                  aptSparkyCS.root.position.y = WEST_TARGET.y;
                  aptSparkyFacingRef.current = Math.PI * 0.5;
                  const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
                  if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
                  animateRobotVisual(aptSparkyCS, worldTime, 0.5, -0.1, 0.0);
                } else {
                  aptSparkyCS.root.position.set(WEST_TARGET.x, 0.22, -WEST_TARGET.y);
                  aptSparkyFacingRef.current = Math.PI * 0.5;
                  const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
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

            const laptopApproach = new THREE.Vector3(-3.4, 0.22, -0.65);
            const scrapApproach = new THREE.Vector3(-2.6, 0.22, -0.55);

            if (aptSparkyCS) {
              // === Phase 1: Rotate Sparky west→north ===
              const startAngle = Math.PI * 0.5;
              const endAngle = 0;
              const easedRot = rotProgress < 1 ? rotProgress * rotProgress * (3 - 2 * rotProgress) : 1;
              aptSparkyFacingRef.current = startAngle + (endAngle - startAngle) * easedRot;
              const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
              if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);

              // Sparky sidesteps west from -2.8 to -3.4 during rotation
              const startX = -2.8;
              const endX = -3.4;
              aptSparkyCS.root.position.x = startX + (endX - startX) * easedRot;

              // Laptop stays at fixed local (0, 0.47, 1.0) — orbits naturally with Sparky
              if (computerRef.current && computerRef.current.parent === aptSparkyCS.root) {
                computerRef.current.position.set(0, 1.0, -0.47);
                const invQ = aptSparkyCS.root.quaternion.clone().invert();
                const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(invQ);
                const lapQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), localUp);
                computerRef.current.quaternion.copy(lapQuat);
              }

              // === Detach laptop at start of lowering ===
              if (lowerProgress > 0 && computerRef.current && computerRef.current.parent === aptSparkyCS.root) {
                const worldPos = new THREE.Vector3();
                computerRef.current.getWorldPosition(worldPos);
                apartmentRoomGroup.attach(computerRef.current);
                computerRef.current.scale.set(1, 1, 1);
                computerRef.current.position.copy(worldPos);
                computerRef.current.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
                computerRef.current.userData.lowerStartZ = worldPos.z;
              }

              // === Coil appears at Sparky's hand ===
              if (t >= coilAppear && coilRef.current && !coilRef.current.visible) {
                coilRef.current.visible = true;
              }

              // === Walk north to laptop ===
              if (walkNorthProgress > 0 && walkNorthProgress < 1) {
                const startWalk = new THREE.Vector3(-3.4, 0.22, -0.5);
                const easedWalk = walkNorthProgress * walkNorthProgress * (3 - 2 * walkNorthProgress);
                aptSparkyCS.root.position.lerpVectors(startWalk, laptopApproach, easedWalk);
                aptSparkyFacingRef.current = 0;
                const wfQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(wfQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0.3, 0, 0);
              }

              // === Tack 1: Sparkle at laptop port ===
              if (tack1Progress > 0 && tack1Progress < 1) {
                aptSparkyCS.root.position.copy(laptopApproach);
                aptSparkyFacingRef.current += (0 - aptSparkyFacingRef.current) * 0.08;
                const nfQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(nfQ);
                // Animate tack fx
                if (tackFxRef.current) {
                  if (tackFxPhaseRef.current === 0) {
                    tackFxRef.current.position.set(-3.4, 0.253, -1.025);
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
                const wfQ2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(wfQ2);
                animateRobotVisual(aptSparkyCS, worldTime, 0.3, 0, 0);
              }

              // === Tack 2: Sparkle at scrap port ===
              if (tack2Progress > 0 && tack2Progress < 1) {
                aptSparkyCS.root.position.copy(scrapApproach);
                aptSparkyFacingRef.current += (0 - aptSparkyFacingRef.current) * 0.08;
                const nfQ2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(nfQ2);
                if (tackFxRef.current) {
                  if (tackFxPhaseRef.current === 1) {
                    tackFxRef.current.position.set(-2.6, 0.36, -0.976);
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
              computerRef.current.position.y = startZ + (endZ - startZ) * easedLower;
            }

            // === Coil follows Sparky's right hand ===
            if (coilRef.current && coilRef.current.visible && aptSparkyCS) {
              const coilOffset = new THREE.Vector3(0.33, 0.5, -0.12).applyQuaternion(
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aptSparkyFacingRef.current)
              );
              const invQ = aptSparkyCS.root.quaternion.clone().invert();
              const coilUp = new THREE.Vector3(0, 1, 0).applyQuaternion(invQ);
              coilRef.current.quaternion.setFromUnitVectors(coilUp, new THREE.Vector3(0, 1, 0));
              coilRef.current.position.set(aptSparkyCS.root.position.x + coilOffset.x * 0.7, 0.38, -aptSparkyCS.root.position.y + coilOffset.y * 0.7);
            }

            // === Wire: laptop → hand during tack1, laptop → scrap after tack2 ===
            if (wireRef.current && computerRef.current) {
              if (tack2Progress >= 1) {
                // Fully connected: laptop → scrap (permanent)
                wireRef.current.visible = true;
                const lapPort = new THREE.Vector3(-3.4, 0.253, -1.025);
                const scrapPos = new THREE.Vector3(-2.6, 0.36, -0.976);
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
                const scrapPos = new THREE.Vector3(-2.6, 0.36, -0.976);
                const lapPos = new THREE.Vector3(-3.4, 0.253, -1.025);
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
                const lapPort = new THREE.Vector3(-3.4, 0.253, -1.025);
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
            // Laptop screen pulses red (only during first 3s — stays blue after)
            if (et < 3 && computerRef.current) {
              const sparkPulse = Math.max(0, Math.sin(et * 8 * Math.PI));
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
            const wlTgt = new THREE.Vector2(-3.4, 0.6);
            if (walkPlayer(localPositionRef.current, wlTgt, MOVE_SPEED * 0.29, delta, worldTime, 0.28, localRobotRef.current, leftLegPivotRef.current, rightLegPivotRef.current, yawRef)) {
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
                aptSparkyCS.root.position.x += slDir.x * MOVE_SPEED * 0.29 * delta;
                aptSparkyCS.root.position.y += slDir.y * MOVE_SPEED * 0.29 * delta;
                const slFacing = -Math.atan2(slDir.x, slDir.y);
                aptSparkyFacingRef.current = slFacing;
                const slQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), slFacing);
                if (sparkyBaseQuatRef.current) aptSparkyCS.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(slQ);
                animateRobotVisual(aptSparkyCS, worldTime, 0.15, -0.15, 0.08);
              } else {
                aptSparkyCS.root.position.set(slTgt.x, 0.22, -slTgt.y);
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
              scrapRobotRef.current.root.position.y = 0.24 + (seed2 - 0.5) * 0.06 * amp;
              scrapRobotRef.current.root.rotation.x = 0 + (seed3 - 0.5) * 0.15 * amp;
              scrapRobotRef.current.root.rotation.y = 0.08 + (seed2 - 0.5) * 0.12 * amp;
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
            if (scrapRobotRef.current && vcElapsed < 0.05) {
              scrapRobotRef.current.root.position.set(-2.6, 0.24, -1.2);
              scrapRobotRef.current.root.rotation.x = 0;
              scrapRobotRef.current.root.rotation.y = 0.08;
            }
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
                scrapRobotRef.current.root.position.set(-2.6, 0.24, -1.2);
                scrapRobotRef.current.root.rotation.x = 0;
                scrapRobotRef.current.root.rotation.y = 0.08;
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
              scrapRobotRef.current.root.position.y = 0.24 + (Math.random() - 0.5) * 0.04;
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
                  const bz = scrapRobotRef.current.root.position.z + (Math.random() - 0.5) * 0.06;
                  puff.position.set(bx, 0.7, bz);
                  puff.userData = { spawnTime: t, riseSpeed: 0.3 + Math.random() * 0.2, driftX: (Math.random() - 0.5) * 0.15, driftZ: (Math.random() - 0.5) * 0.15 };
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
                p.position.y = (p.userData.spawnY ?? p.position.y) + age * (p.userData.riseSpeed as number);
                p.position.x = (p.userData.spawnX ?? p.position.x) + (p.userData.driftX as number) * age;
                p.position.z = (p.userData.spawnZ ?? p.position.z) + (p.userData.driftZ as number) * age;
                if (!p.userData.spawnX) { p.userData.spawnX = p.position.x; p.userData.spawnY = p.position.y; p.userData.spawnZ = p.position.z; }
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
              scrapRobotRef.current.root.rotation.y = 0.3 + Math.random() * 0.1;
              scrapRobotRef.current.root.position.y = 0.2;
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
            if (tackFxRef.current) {
              tackFxRef.current.visible = false;
              tackFxRef.current.scale.set(1, 1, 1);
              tackFxRef.current.children.forEach((c: THREE.Object3D) => {
                c.position.set(0, 0, 0);
                ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1;
              });
            }
            tackFxPhaseRef.current = 0;
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
          endCinematicCutscene();
          aptCutscenePhaseRef.current = 'idle';
            // Position Sparky near Scrap for battery cutscene
            if (aptSparky) aptSparky.root.position.set(-2.6, 0.28, 0.55);
            shopUnlockedRef.current = true;
            setShopUnlocked(true);
            cutsceneDoneRef.current = true;
            setCutsceneDone(true);
            sparkyHomeArrivedRef.current = true;
            if (outdoorSparkyRef.current) outdoorSparkyRef.current.root.visible = false;
            // Reset Scrap's eye pupils (set cyan during boot phase fade-out)
            if (scrapRobotRef.current) {
              if (scrapRobotRef.current.leftPupil) scrapRobotRef.current.leftPupil.material.color.setHex(0x000000);
              if (scrapRobotRef.current.rightPupil) scrapRobotRef.current.rightPupil.material.color.setHex(0x000000);
            }
            try { localStorage.setItem('rb_cutscene_done', '1'); } catch {}
            apiSync({ cutsceneDone: true });
            updateQuestStage('unit1-done');
          }
        } else if (installBatteryPhaseRef.current && aptSparky) {
          const ibPhase = installBatteryPhaseRef.current;
          const aptPos = aptSparky.root.position;
          if (ibPhase === 'approach') {
            if (wireRef.current) animateWirePulse(wireRef.current, worldTime);
            // Sparky faces north toward Scrap using the base quaternion
            if (sparkyBaseQuatRef.current) aptSparky.root.quaternion.copy(sparkyBaseQuatRef.current);
            animateRobotVisual(aptSparky, worldTime, 0, 0, 0);
            // Player walks to Sparky's east side — both face north toward Scrap
            const playerTarget = new THREE.Vector2(-1.8, -0.55);
            const playerArrived = walkPlayer(localPositionRef.current, playerTarget, MOVE_SPEED * 0.29, delta, worldTime, 0.28, localRobotRef.current, leftLegPivotRef.current, rightLegPivotRef.current, yawRef);
            if (playerArrived) {
              installBatteryPhaseRef.current = 'hand-off';
              installBatteryTimerRef.current = 0;
              if (localRobotRef.current) {
                if (leftLegPivotRef.current) leftLegPivotRef.current.rotation.x = 0;
                if (rightLegPivotRef.current) rightLegPivotRef.current.rotation.x = 0;
                localRobotRef.current.leftArm.rotation.x = 0;
                localRobotRef.current.rightArm.rotation.x = 0;
              }
              // Player faces north toward Scrap — side by side with Sparky
              yawRef.current = Math.PI;
            }
          } else if (ibPhase === 'hand-off') {
            installBatteryTimerRef.current += delta;
            animateRobotVisual(aptSparky, worldTime, 0, 0, 0);
            if (installBatteryTimerRef.current < delta) playHappyChime();
            if (installBatteryTimerRef.current > 0.6) {
              // Remove battery from backpack — handed to Sparky
              const newBackpack: ScrapPartId[] = gameStore.get('backpack').filter(id => id !== 'battery');
              updateBackpack(newBackpack);
              installBatteryPhaseRef.current = 'sparky-walk';
              installBatteryTimerRef.current = 0;
            }
          } else if (ibPhase === 'sparky-walk') {
            installBatteryTimerRef.current += delta;
            // Sparky walks toward Scrap
            const sparkyTarget = new THREE.Vector3(-2.6, 0.28, -0.2);
            const dist = aptPos.distanceTo(sparkyTarget);
            if (dist > 0.05) {
              const dir = new THREE.Vector2(sparkyTarget.x - aptPos.x, sparkyTarget.y - aptPos.y).normalize();
              aptPos.x += dir.x * MOVE_SPEED * 1.36 * delta;
              aptPos.y += dir.y * MOVE_SPEED * 1.36 * delta;
              const facingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dir.x, dir.y));
              if (sparkyBaseQuatRef.current) aptSparky.root.quaternion.copy(sparkyBaseQuatRef.current).premultiply(facingQ);
              animateRobotVisual(aptSparky, worldTime, 1, dir.x, dir.y);
            } else {
              // Sparky arrived — face north toward Scrap
              if (sparkyBaseQuatRef.current) aptSparky.root.quaternion.copy(sparkyBaseQuatRef.current);
              installBatteryPhaseRef.current = 'open-chest';
              installBatteryTimerRef.current = 0;
            }
          } else if (ibPhase === 'open-chest') {
            installBatteryTimerRef.current += delta;
            // First frame: replace cylinder body with torus for chest-open animation
            if (installBatteryTimerRef.current < delta && scrapRobotRef.current && !scrapOrigBodyRef.current) {
              const scrap = scrapRobotRef.current;
              scrapOrigBodyRef.current = { mesh: scrap.body, parent: scrap.root };
              const bodyMat = (scrap.body.material as THREE.Material).clone();
              const torusBody = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.08, 16, 24), bodyMat);
              torusBody.position.copy(scrap.body.position);
              scrap.root.remove(scrap.body);
              scrap.body.visible = false;
              scrap.body = torusBody as unknown as typeof scrap.body;
              scrap.root.add(torusBody);
              const chestPanel = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), createToonMaterial(0x2a1a0a));
              chestPanel.position.set(0, 0.08, 0);
              torusBody.add(chestPanel);
              chestPanelRef.current = chestPanel;
            }
            if (installBatteryTimerRef.current < delta) playToolClank();
            if (chestPanelRef.current) {
              const openZ = 0.08 + Math.min(installBatteryTimerRef.current / 1.0, 1) * 0.15;
              chestPanelRef.current.position.y = openZ;
            }
            if (installBatteryTimerRef.current > 1.0) {
              installBatteryPhaseRef.current = 'place-battery';
              installBatteryTimerRef.current = 0;
              const batteryGroup = createPartModel('battery');
              batteryGroup.scale.set(2, 2, 2);
              batteryGroup.position.set(aptPos.x, 0.4, -aptPos.y + 0.3);
              apartmentRoomGroupRef.current?.add(batteryGroup);
              installBatteryPropRef.current = batteryGroup;
              batteryLerpStartPosRef.current.copy(batteryGroup.position);
              if (chestPanelRef.current) {
                const endPos = new THREE.Vector3();
                chestPanelRef.current.getWorldPosition(endPos);
                apartmentRoomGroupRef.current?.worldToLocal(endPos);
                batteryLerpEndPosRef.current.copy(endPos);
              }
            }
          } else if (ibPhase === 'place-battery') {
            installBatteryTimerRef.current += delta;
            if (installBatteryTimerRef.current < delta) playSparkBurst();
            const prop = installBatteryPropRef.current;
            if (prop) {
              const progress = Math.min(installBatteryTimerRef.current / 1.2, 1);
              prop.position.lerpVectors(batteryLerpStartPosRef.current, batteryLerpEndPosRef.current, progress);
              prop.rotation.y = progress * Math.PI * 2;
              prop.scale.setScalar(2 + progress * 0.3);
            }
            if (installBatteryTimerRef.current > 1.2) {
              const scrap = scrapRobotRef.current;
              if (scrap && scrap.body && !batteryGlowRef.current) {
                const glow = new THREE.Mesh(
                  new THREE.SphereGeometry(0.05, 10, 10),
                  new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.3 })
                );
                glow.position.set(0, 0.24, 0);
                scrap.body.add(glow);
                batteryGlowRef.current = glow;
              }
              if (installBatteryPropRef.current) installBatteryPropRef.current.visible = false;
              installBatteryPhaseRef.current = 'chest-glow';
              installBatteryTimerRef.current = 0;
            }
          } else if (ibPhase === 'chest-glow') {
            installBatteryTimerRef.current += delta;
            if (installBatteryTimerRef.current < delta) {
              playHappyChime();
              if (scrapRobotRef.current) {
                if (scrapRobotRef.current.leftPupil) scrapRobotRef.current.leftPupil.material.color.setHex(0x22d3ee);
                if (scrapRobotRef.current.rightPupil) scrapRobotRef.current.rightPupil.material.color.setHex(0x22d3ee);
              }
            }
            if (batteryGlowRef.current) {
              const glow = batteryGlowRef.current;
              const intensity = 0.3 + Math.sin(installBatteryTimerRef.current * 6) * 0.15;
              (glow.material as THREE.MeshBasicMaterial).opacity = intensity;
            }
            if (chestPanelRef.current) {
              const closeProgress = Math.min(installBatteryTimerRef.current / 1.0, 1);
              const closedZ = 0.23 - closeProgress * 0.15;
              chestPanelRef.current.position.y = closedZ;
            }
            if (installBatteryTimerRef.current > 2.0) {
              installBatteryPhaseRef.current = 'done';
              installBatteryTimerRef.current = 0;
            }
          } else if (ibPhase === 'done') {
            installBatteryPhaseRef.current = null;
            // Restore original cylinder body
            if (scrapOrigBodyRef.current && scrapRobotRef.current) {
              const scrap = scrapRobotRef.current;
              const orig = scrapOrigBodyRef.current;
              chestPanelRef.current = null;
              const glowChildren: THREE.Object3D[] = [];
              scrap.body.children.forEach((c) => glowChildren.push(c));
              scrap.root.remove(scrap.body);
              (scrap.body as THREE.Mesh).geometry.dispose();
              (scrap.body.material as THREE.Material).dispose();
              orig.mesh.visible = true;
              scrap.body = orig.mesh as any;
              scrap.root.add(orig.mesh);
              glowChildren.forEach((c) => orig.mesh.add(c));
              scrapOrigBodyRef.current = null;
            }
            batteryInstalledRef.current = true;
            setBatteryInstalled(true);
            if (scrapRobotRef.current) {
              if (scrapRobotRef.current.leftPupil) scrapRobotRef.current.leftPupil.material.color.setHex(0x22d3ee);
              if (scrapRobotRef.current.rightPupil) scrapRobotRef.current.rightPupil.material.color.setHex(0x22d3ee);
            }
            if (installBatteryPropRef.current) {
              installBatteryPropRef.current.parent?.remove(installBatteryPropRef.current);
              disposeObject(installBatteryPropRef.current);
              installBatteryPropRef.current = null;
            }
            endCinematicCutscene();
            // Move Sparky back to his usual spot near the bed
            aptPos.set(0.2, 2.2, 0.28);
            setSparkyDlgFull("Scrap is all yours! He'll follow you everywhere.");
            setShowSparkyDlg(true);
            onSparkyDlgCloseRef.current = () => {
              setShowSparkyDlg(false);
              onSparkyDlgCloseRef.current = null;
              const newBackpack: ScrapPartId[] = gameStore.get('backpack').filter(id => id !== 'battery');
              updateBackpack(newBackpack);
              updateQuestStage('all-done');
              apiSync({ batteryInstalled: true, questStage: 'all-done' });
              if (heldSlotIndexRef.current !== null && (heldSlotIndexRef.current >= newBackpack.length || !newBackpack.includes(gameStore.get('backpack')[heldSlotIndexRef.current]))) {
                setHeldSlotIndex(null);
                heldSlotIndexRef.current = null;
              }
              scrapFollowerEnabledRef.current = true;
              scrapVisibleRef.current = true;
              setScrapVisible(true);
              setShowScrapToggle(true);
              if (scrapFollowerRef.current) scrapFollowerRef.current.root.visible = true;
            };
          }
        } else if (sparkyInstallPhaseRef.current && aptSparky) {
          const phase = sparkyInstallPhaseRef.current;
          if (phase === 'walk-to-bench') {
            const target = new THREE.Vector2(2.9, 0.3);
            const dist = aptSparky.root.position.distanceTo(new THREE.Vector3(target.x, 0.14, -target.y));
            if (dist > 0.15) {
              const dir = new THREE.Vector2(target.x - aptSparky.root.position.x, target.y - aptSparky.root.position.y).normalize();
              aptSparky.root.position.x += dir.x * MOVE_SPEED * 1.36 * delta;
              aptSparky.root.position.y += dir.y * MOVE_SPEED * 1.36 * delta;
              setSparkyDlgFull(`${PARTS_CATALOG.find(p => p.id === sparkyInstallPartIdRef.current)?.name} — Sparky walks to the workbench...`);
              setShowSparkyDlg(true);
            } else {
              sparkyInstallPhaseRef.current = 'weld';
              sparkyInstallTimerRef.current = 0;
              setSparkleBurst(true);
              setSparkyDlgFull('Welding! ⚡');
              setShowSparkyDlg(true);
            }
          } else if (phase === 'weld') {
            sparkyInstallTimerRef.current += delta;
            aptSparky.root.position.y = 0.24 + Math.sin(sparkyInstallTimerRef.current * 16) * 0.1;
            aptSparky.root.rotation.y = Math.sin(sparkyInstallTimerRef.current * 20) * 0.08;
            if (sparkyInstallTimerRef.current > 1.8) {
              sparkyInstallPhaseRef.current = 'attach-part';
              sparkyInstallTimerRef.current = 0;
            }
          } else if (phase === 'attach-part') {
            // Attach part mesh to Scrap's body (dead code — sensor/voice/nav removed)
            sparkyInstallTimerRef.current += delta;
            if (sparkyInstallTimerRef.current > 0.6) {
              sparkyInstallPhaseRef.current = 'walk-back';
              sparkyInstallTimerRef.current = 0;
              setSparkyDlgFull('Part installed! Sparky steps back...');
              setShowSparkyDlg(true);
            }
          } else if (phase === 'walk-back') {
            const homePos = new THREE.Vector2(0.2, 2.2);
            const dist = aptSparky.root.position.distanceTo(new THREE.Vector3(homePos.x, 0.14, -homePos.y));
            aptSparky.root.rotation.z *= 0.9;
            if (dist > 0.15) {
              const dir = new THREE.Vector2(homePos.x - aptSparky.root.position.x, homePos.y - aptSparky.root.position.y).normalize();
              aptSparky.root.position.x += dir.x * MOVE_SPEED * 1.36 * delta;
              aptSparky.root.position.y += dir.y * MOVE_SPEED * 1.36 * delta;
            } else {
              sparkyInstallPhaseRef.current = 'done';
            }
          } else if (phase === 'done') {
            sparkyInstallPhaseRef.current = null;
            setSparkleBurst(false);
            aptSparky.root.rotation.y = 0;

            const partId = sparkyInstallPartIdRef.current!;
            const nextUnit = sparkyInstallNextStageRef.current!;
            const part = PARTS_CATALOG.find(p => p.id === partId)!;
            const unitLabel = nextUnit === 'unit2' ? 'Variables & Data Types' : nextUnit === 'unit3' ? 'String Methods' : 'Unit 4';

            const newBackpack = gameStore.get('backpack').filter(id => id !== partId);
            updateBackpack(newBackpack);
            updateQuestStage(nextUnit);

            setSparkyDlgFull(`⚡ ${part.name} installed! ${unitLabel} lessons unlocked!`);
            setShowSparkyDlg(true);

            setTimeout(() => {
              setShowSparkyDlg(false);
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

      // Repair cutscene handler
      if (repairCutscenePhaseRef.current !== 'idle') {
        const rp = repairCutscenePhaseRef.current;
        repairCutsceneTimerRef.current += delta;
        const cr = repairCustomerRef.current?.cargoRobot;
        const robotRoot = cr?.root;

        if (rp === 'glow') {
          // Emissive pulse on dock robot (green glow) — also restore color (robot becomes alive)
          if (robotRoot) {
            setRobotBroken(robotRoot, false);
            const intensity = 0.5 + Math.sin(repairCutsceneTimerRef.current * 8) * 0.5;
            robotRoot.traverse((node) => {
              const m = node as THREE.Mesh;
              if (m.material) {
                const mat = m.material as THREE.MeshToonMaterial;
                if (mat.emissive) { mat.emissive.setHex(0xffffff); mat.emissiveIntensity = intensity * 0.6; }
              }
            });
          }
          // Sparkle particles on first frame
          if (repairCutsceneTimerRef.current < 0.1) spawnConfetti(new THREE.Vector2(2.9, 3.05));
          if (repairCutsceneTimerRef.current > 2.0) {
            repairCutscenePhaseRef.current = 'place-robot';
          }
        } else if (rp === 'place-robot') {
          // Move robot from dock to ground behind customer
          if (robotRoot && robotRoot.parent === workshopRegisterDockRef.current) {
            const sn2 = repairCustomerRef.current;
            if (sn2) workshopRoomGroupRef.current?.attach(robotRoot);
            else workshopRoomGroupRef.current?.attach(robotRoot);
            const behindX = sn2 ? sn2.position.x : 0;
            const behindY = sn2 ? sn2.position.y - 0.5 : -5.5;
            robotRoot.position.set(behindX, 0.251, -behindY);
            robotRoot.rotation.set(0, 0, 0);
            robotRoot.scale.set(0.35, 0.35, 0.35);
          }
          // Reset emissive
          if (robotRoot) {
            robotRoot.traverse((node) => {
              const m = node as THREE.Mesh;
              if (m.material) {
                const mat = m.material as THREE.MeshToonMaterial;
                if (mat.emissive) mat.emissiveIntensity = 0;
              }
            });
          }
          // Cleanup sparkle particles
          for (const cp of confettiParticlesRef.current) {
            sceneRef.current?.remove(cp.mesh);
            cp.mesh.geometry.dispose();
            (cp.mesh.material as THREE.Material).dispose();
          }
          confettiParticlesRef.current = [];
          endCinematicCutscene();
          setWorkshopOutput(repairOutputRef.current);
          // Trigger customer leaving
          const sn = repairCustomerRef.current;
          if (sn) {
            sn.stage = 'leaving';
            const leavingIdx = sn.queueIndex;
            const frontY = CUSTOMER_QUEUE_POSITIONS[leavingIdx].y;
            sn.waypoints = [new THREE.Vector2(0, frontY), new THREE.Vector2(0, -5.5)];
            sn.wpIndex = 0; sn.target.copy(sn.waypoints[0]);
            currentCustomerIdRef.current = null;
            for (const npc of workshopCustomersRef.current) {
              if (npc.stage !== 'leaving' && npc.queueIndex > leavingIdx) {
                npc.queueIndex--; npc.waypoints = undefined; npc.target.copy(CUSTOMER_QUEUE_POSITIONS[npc.queueIndex]); (npc as any).startedAtMs = performance.now();
                if (npc.stage === 'waiting') { npc.stage = 'walking-to-queue'; }
              }
            }
            spawnCustomerRef.current?.();
          }
          repairCutscenePhaseRef.current = 'idle';
          repairCustomerRef.current = null;
        }
      }

      // Register cutscene handler (place robot + wire connection)
      if (registerCutscenePhaseRef.current !== 'idle') {
        registerCutsceneTimerRef.current += delta;
        const crn = registerCutsceneCustomerRef.current;
        if (registerCutscenePhaseRef.current === 'place-robot') {
          const t = Math.min(registerCutsceneTimerRef.current / 1.5, 1);
          const robot = crn?.cargoRobot.root ?? null;
          if (crn && robot) {
            if (registerCutsceneTimerRef.current - delta < 0.01) {
              // First frame: save original queue position + player position
              robot.userData.backPos = new THREE.Vector2(crn.position.x, crn.position.y);
              robot.userData.playerWalkOrigin = new THREE.Vector2(localPositionRef.current.x, localPositionRef.current.y);
            }
            const backPos = robot.userData.backPos as THREE.Vector2;
            if (backPos) {
              const forwardY = 2.5;
              const origY = backPos.y;
              if (t < 0.4) {
                // Walk forward toward desk
                const pt = t / 0.4;
                const easePt = pt < 0.5 ? 2 * pt * pt : 1 - (-2 * pt + 2) ** 2 / 2;
                crn.position.y = origY + (forwardY - origY) * easePt;
              } else if (t < 0.5) {
                // At desk — place robot
                crn.position.y = forwardY;
                if (!robot.userData.placed) {
                  robot.userData.placed = true;
                  const endDock = workshopRegisterDockRef.current;
                  if (endDock)                   endDock.attach(robot);
                  playThumpSound();
                }
              } else {
                // Walk back to queue
                const pt = (t - 0.5) / 0.5;
                const easePt = pt < 0.5 ? 2 * pt * pt : 1 - (-2 * pt + 2) ** 2 / 2;
                crn.position.y = forwardY + (origY - forwardY) * easePt;
              }
            }
          }
          if (registerCutsceneTimerRef.current > 1.5) {
            registerCutscenePhaseRef.current = 'player-to-robot';
            registerCutsceneTimerRef.current = 0;
          }
        } else if (registerCutscenePhaseRef.current === 'player-to-robot') {
          const t = Math.min(registerCutsceneTimerRef.current / 0.5, 1);
          const walkTarget = new THREE.Vector2(2.3, 2.2);
          const p2rRobot = crn?.cargoRobot.root ?? null;
          const walkOrigin = p2rRobot?.userData.playerWalkOrigin as THREE.Vector2 | undefined;
          if (p2rRobot && walkOrigin) {
            const easeT = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
            const cx = walkOrigin.x + (walkTarget.x - walkOrigin.x) * easeT;
            const cy = walkOrigin.y + (walkTarget.y - walkOrigin.y) * easeT;
            localPositionRef.current.set(cx, cy);
            localGroup.position.set(cx, 0.26, -cy);
            yawRef.current = Math.atan2(walkTarget.x - cx, walkTarget.y - cy);
            localGroup.position.y = 0.26 + Math.sin(worldTime * 10) * 0.02;
            const walkSwing = Math.sin(worldTime * WALK_BOB_SPEED) * 0.3;
            if (leftLegPivotRef.current) leftLegPivotRef.current.rotation.x = walkSwing;
            if (rightLegPivotRef.current) rightLegPivotRef.current.rotation.x = -walkSwing;
            const armSwing = Math.sin(worldTime * WALK_BOB_SPEED + Math.PI) * 0.2;
            if (localRobotRef.current) {
              localRobotRef.current.leftArm.rotation.x = armSwing;
              localRobotRef.current.rightArm.rotation.x = -armSwing;
            }
          }
          if (registerCutsceneTimerRef.current > 0.5) {
            registerCutscenePhaseRef.current = 'player-to-laptop';
            registerCutsceneTimerRef.current = 0;
          }
        } else if (registerCutscenePhaseRef.current === 'player-to-laptop') {
          const t = Math.min(registerCutsceneTimerRef.current / 0.8, 1);
          const laptopTarget = new THREE.Vector2(1.5, 2.2);
          const p2lRobot = crn?.cargoRobot.root ?? null;
          const robotPos = new THREE.Vector2(2.3, 2.2);
          if (p2lRobot) {
            const easeT = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
            const cx = robotPos.x + (laptopTarget.x - robotPos.x) * easeT;
            const cy = robotPos.y + (laptopTarget.y - robotPos.y) * easeT;
            localPositionRef.current.set(cx, cy);
            localGroup.position.set(cx, 0.26, -cy);
            yawRef.current = Math.atan2(laptopTarget.x - cx, laptopTarget.y - cy);
            localGroup.position.y = 0.26 + Math.sin(worldTime * 10) * 0.02;
            const walkSwing = Math.sin(worldTime * WALK_BOB_SPEED) * 0.3;
            const armSwing = Math.sin(worldTime * WALK_BOB_SPEED + Math.PI) * 0.2;
            if (localRobotRef.current) {
              localRobotRef.current.leftArm.rotation.x = armSwing;
              localRobotRef.current.rightArm.rotation.x = -armSwing;
            }
          }
          // Wire stretches from robot to player's hand as player walks
          const wire = workshopRegisterWireRef.current;
          if (wire && crn && p2lRobot) {
            if (registerCutsceneTimerRef.current - delta < 0.01) {
              wire.visible = true;
            }
            const wireStart = scratchVec3.current;
            crn.cargoRobot.root.getWorldPosition(wireStart);
            const handPos = scratchVec3b.current.set(localPositionRef.current.x, localPositionRef.current.y + 0.25, 0.5);
            wireStart.z += 0.02;
            const dir = scratchVec3c.current.copy(handPos).sub(wireStart);
            const distWire = dir.length();
            if (distWire > 0.001) {
              dir.normalize();
              const mid = scratchVec3.current.copy(wireStart).add(handPos).multiplyScalar(0.5);
              wire.position.copy(mid);
              wire.scale.set(1, distWire, 1);
              wire.quaternion.setFromUnitVectors(scratchVec3UpY.current, dir);
              animateWirePulse(wire, worldTime);
            }
          }
          if (registerCutsceneTimerRef.current > 0.8) {
            registerCutscenePhaseRef.current = 'connect-wire';
            registerCutsceneTimerRef.current = 0;
          }
        } else if (registerCutscenePhaseRef.current === 'connect-wire') {
          const t = Math.min(registerCutsceneTimerRef.current / 0.3, 1);
          const wire = workshopRegisterWireRef.current;
          if (wire && crn) {
            if (registerCutsceneTimerRef.current - delta < 0.01) {
              playUsbConnectSound();
            }
            const wireStart = scratchVec3.current;
            crn.cargoRobot.root.getWorldPosition(wireStart);
            const comp = workshopRegisterComputerRef.current;
            const laptopPos = scratchVec3b.current;
            if (comp) {
              const port = comp.getObjectByName('usb-port');
              if (port) port.getWorldPosition(laptopPos);
              else comp.getWorldPosition(laptopPos);
            }
            const handPos = scratchVec3c.current.set(localPositionRef.current.x, localPositionRef.current.y + 0.25, 0.5);
            const wireEnd = scratchVec3b.current.lerp(laptopPos, t);
            wireStart.z += 0.02;
            wireEnd.z += 0.1;
            const dir = scratchVec3c.current.copy(wireEnd).sub(wireStart);
            const distWire = dir.length();
            if (distWire > 0.001) {
              dir.normalize();
              const mid = scratchVec3.current.copy(wireStart).add(wireEnd).multiplyScalar(0.5);
              wire.position.copy(mid);
              wire.scale.set(1, distWire, 1);
              wire.quaternion.setFromUnitVectors(scratchVec3UpY.current, dir);
              animateWirePulse(wire, worldTime);
            }
          }
          if (registerCutsceneTimerRef.current > 0.3) {
            registerCutscenePhaseRef.current = 'laptop-ui';
            registerCutsceneTimerRef.current = 0;
          }
        } else if (registerCutscenePhaseRef.current === 'laptop-ui') {
          registerCutsceneTimerRef.current += delta;
          if (registerCutsceneTimerRef.current > 0.5 && !regPanelShownRef.current) {
            regPanelShownRef.current = true;
            document.exitPointerLock();
            if (crn) {
              setActiveCustomer(crn.request);
              setWorkshopOutput(`${crn.request.customerName}: Here is my request.`);
            }
            setShowRegLaptopUI(true);
          }
        } else if (registerCutscenePhaseRef.current === 'done') {
          endCinematicCutscene();
          registerCutscenePhaseRef.current = 'idle';
          registerCutsceneCustomerRef.current = null;
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
            if (npc.stage !== 'waiting' || npc.queueIndex !== 0) continue;
            const distance = npc.position.distanceTo(localPositionRef.current);
            if (distance > CUSTOMER_TALK_DISTANCE) continue;
            if (!closestCandidate || distance < closestCandidate.position.distanceTo(localPositionRef.current)) {
              closestCandidate = npc;
            }
          }
        }

        // Show marker on the front-of-queue customer (persistent when earning money)
        const cutsceneIdle = rafiqWalkPhaseRef.current === 'idle';
        const playerMoney = gameStore.get('money') ?? 0;
        const hasBattery = (gameStore.get('backpack') as ScrapPartId[]).includes('battery');
        for (const npc of workshopCustomersRef.current) {
          let shouldShow = false;
          if (cutsceneIdle) {
            shouldShow = npc === closestCandidate || (
              npc.stage === 'waiting' && npc.queueIndex === 0 &&
              playerMoney < 10 && !hasBattery
            );
          }
          if (npc.visual.marker && npc.visual.marker.visible !== shouldShow) {
            npc.visual.marker.visible = shouldShow;
          }
        }

        const nextCandidateId = closestCandidate?.id ?? null;
        if (interactionCandidateIdRef.current !== nextCandidateId) {
          interactionCandidateIdRef.current = nextCandidateId;
          setInteractionPromptName(closestCandidate ? closestCandidate.request.customerName : null);
        }

        // Rafiq interaction prompt override (takes priority over customer)
        const distToRafiq = Math.hypot(localPositionRef.current.x - ROOM_OWNER_POS.x, localPositionRef.current.y - ROOM_OWNER_POS.y);
        if (!cutsceneActiveRef.current) {
          if (distToRafiq < 1.8) {
            if (interactionPromptName !== 'Rafiq') setInteractionPromptName('Rafiq');
            interactionCandidateIdRef.current = '__rafiq__';
          } else if (interactionCandidateIdRef.current === '__rafiq__' && !closestCandidate) {
            interactionCandidateIdRef.current = null;
            setInteractionPromptName(null);
          }
        }

        // Rafiq interaction — "Who are you?", letter reception, or workshop intro
        if (!cutsceneActiveRef.current && interactionRequestedRef.current && distToRafiq < 1.8) {
          interactionRequestedRef.current = false;
          const bp = gameStore.get('backpack');
          if (!cutsceneDoneRef.current) {
            // Pre-cutscene: Rafiq doesn't know you
            setWhoStep(0);
            setShowWhoDlg(true);
          } else if (bp.includes('letter' as ScrapPartId)) {
            // Rafiq meet dialog — "Who are you?" → letter consumption at step 0→1
            cutsceneActiveRef.current = true;
            document.exitPointerLock();
            keyStateRef.current.clear();
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
          currentCustomerIdRef.current = closestCandidate.id;
          bonusTimerRef.current = performance.now();
          registerCutsceneCustomerRef.current = closestCandidate;
          registerCutscenePhaseRef.current = 'place-robot';
          registerCutsceneTimerRef.current = 0;
          lastWorkshopRequestSigRef.current = getWorkshopRequestSignature(nextRequest);
          startCinematicCutscene();
          interactionCandidateIdRef.current = null;
          setInteractionPromptName(null);
        } else if (interactionRequestedRef.current) {
          interactionRequestedRef.current = false;
        }
      }

      // Shop room interaction
      if (inShopRoomRef.current) {
        const distToShopkeep = localPositionRef.current.distanceTo({ x: 0, y: -1.65 });
        if (interactionRequestedRef.current && distToShopkeep < 1.5) {
          interactionRequestedRef.current = false;
          const stage = sparkyQuestStageRef.current;
          const bp = gameStore.get('backpack');
          const needsBattery = !bp.includes('battery');
          if (needsBattery) {
            setShopkeeperGreeting(`Welcome! I've got a Battery Pack — exactly what Scrap needs to power up for good.`);
          } else {
            setShopkeeperGreeting(`Welcome back! Take a look around — let me know if anything catches your eye.`);
          }
        } else if (interactionRequestedRef.current) {
          interactionRequestedRef.current = false;
        }
        if (shopNpcRef.current) {
          shopNpcRef.current.root.position.y = 0.02 + Math.sin(worldTime * 3) * 0.02;
        }
      }

      if (inWorkshopRoomRef.current) {

        const walkSin = Math.sin(worldTime * WALK_BOB_SPEED);
        {
          const customers = workshopCustomersRef.current;
          for (let i = customers.length - 1; i >= 0; i--) {
            const npc = customers[i];
          if (npc.stage === 'waiting' || npc.stage === 'awaiting-code') {
            npc.target.copy(npc.position);
            npc.visual.root.rotation.y = 0;
          } else if (npc.stage === 'leaving') {
            if (npc.waypoints && npc.wpIndex !== undefined && npc.wpIndex < npc.waypoints.length) {
              npc.target.copy(npc.waypoints[npc.wpIndex]);
            } else {
              npc.target.copy(ROOM_CUSTOMER_EXIT_POS);
            }
          } else if (npc.stage === 'walking-to-queue') {
            if (npc.waypoints && npc.wpIndex !== undefined && npc.wpIndex < npc.waypoints.length) {
              npc.target.copy(npc.waypoints[npc.wpIndex]);
            } else {
              npc.target.copy(CUSTOMER_QUEUE_POSITIONS[npc.queueIndex]);
            }
          }
          if (npc.stage !== 'waiting' && npc.visual.marker && npc.visual.marker.visible) {
            npc.visual.marker.visible = false;
          }

          if (npc.stage === 'walking-to-queue' && (npc as any).startedAtMs && performance.now() - (npc as any).startedAtMs > 8000) {
            npc.stage = 'waiting';
          }

          const dx = npc.target.x - npc.position.x;
          const dy = npc.target.y - npc.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.12) {
            if (npc.waypoints && npc.wpIndex !== undefined && npc.wpIndex < npc.waypoints.length) {
              npc.wpIndex++;
              if (npc.wpIndex >= npc.waypoints.length) {
                npc.waypoints = undefined;
                if (npc.stage === 'leaving') {
                  if (roomCustomerGroupRef.current) {
                    roomCustomerGroupRef.current.remove(npc.visual.root);
                  }
                  disposeObject(npc.visual.root);
                  if (npc.cargoRobot.root.parent) npc.cargoRobot.root.parent.remove(npc.cargoRobot.root);
                  disposeObject(npc.cargoRobot.root);
                  if (currentCustomerIdRef.current === npc.id) {
                    currentCustomerIdRef.current = null;
                    setActiveCustomer(null);
                    bonusTimerRef.current = null;
                  }
                    customers.splice(i, 1); continue;
                }
                if (npc.stage === 'walking-to-queue') {
                  npc.stage = 'waiting';
                }
              }
            } else if (npc.stage === 'leaving') {
              if (roomCustomerGroupRef.current) {
                roomCustomerGroupRef.current.remove(npc.visual.root);
              }
              disposeObject(npc.visual.root);
              if (npc.cargoRobot.root.parent) npc.cargoRobot.root.parent.remove(npc.cargoRobot.root);
              disposeObject(npc.cargoRobot.root);
              if (currentCustomerIdRef.current === npc.id) {
                currentCustomerIdRef.current = null;
                setActiveCustomer(null);
                bonusTimerRef.current = null;
              }
              customers.splice(i, 1); continue;
            }
            if (npc.stage === 'walking-to-queue' && !(npc.waypoints && npc.wpIndex !== undefined && npc.wpIndex < npc.waypoints.length)) {
              npc.stage = 'waiting';
            }
          } else {
            const step = Math.min(dist, npc.speed * delta);
            const sx = (dx / dist) * step;
            const sy = (dy / dist) * step;
            const blockCustomer = (px: number, py: number) => {
              const cs = workshopCustomersRef.current;
              for (let j = 0; j < cs.length; j++) {
                const n = cs[j];
                if (n.id !== npc.id && n.stage !== 'leaving' && Math.hypot(px - n.position.x, py - n.position.y) < 0.18) return true;
              }
              return false;
            };
            scratchVec2.current.set(npc.position.x + sx, npc.position.y + sy);
            if (!collidesWithAny(scratchVec2.current, roomObstacleHitboxesRef.current) && (npc.stage === 'leaving' || !blockCustomer(scratchVec2.current.x, scratchVec2.current.y))) {
              npc.position.x += sx;
              npc.position.y += sy;
            } else {
              scratchVec2.current.set(npc.position.x + sx, npc.position.y);
              if (!collidesWithAny(scratchVec2.current, roomObstacleHitboxesRef.current) && (npc.stage === 'leaving' || !blockCustomer(scratchVec2.current.x, scratchVec2.current.y))) {
                npc.position.x += sx;
              } else {
                scratchVec2.current.set(npc.position.x, npc.position.y + sy);
                if (!collidesWithAny(scratchVec2.current, roomObstacleHitboxesRef.current) && (npc.stage === 'leaving' || !blockCustomer(scratchVec2.current.x, scratchVec2.current.y))) {
                  npc.position.y += sy;
                }
              }
            }
          }

          const noRotationStages = ['waiting', 'awaiting-code'];
          const moving = dist > 0.06 && !noRotationStages.includes(npc.stage);
          if (npc.stage === 'awaiting-code') {
            if (npc.cargoRobot.root.parent !== workshopRegisterDockRef.current) {
              setCustomerRobotMode(npc, 'register');
            }
            animateRobotVisual(npc.cargoRobot, worldTime + npc.queueIndex * 0.35, 0.12, 0, 0);
          } else if (npc.stage === 'leaving') {
            // Robot follows behind customer on the ground
            const cr = npc.cargoRobot;
            if (cr.root.parent !== workshopRoomGroupRef.current) {
              workshopRoomGroupRef.current?.attach(cr.root);
              cr.root.position.set(npc.position.x, npc.position.y - 0.5, 0.251);
              cr.root.scale.set(0.35, 0.35, 0.35);
            }
            const rotZ = npc.visual.root.rotation.z;
            const behindX = npc.position.x + Math.sin(rotZ) * 0.5;
            const behindY = npc.position.y - Math.cos(rotZ) * 0.5;
            const targetDx = behindX - cr.root.position.x;
            const targetDy = behindY - cr.root.position.y;
            cr.root.position.x += targetDx * 0.08;
            cr.root.position.y += targetDy * 0.08;
            cr.root.rotation.set(0, 0, 0);
            cr.root.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.atan2(targetDx, -targetDy));
            animateRobotVisual(cr, worldTime + npc.queueIndex * 0.35, moving ? 0.55 : 0.16, 0, -1);
          } else {
            const isRegisterCutscene = registerCutscenePhaseRef.current !== 'idle' && registerCutsceneCustomerRef.current?.id === npc.id;
            if (!isRegisterCutscene) {
              if (npc.cargoRobot.root.parent !== npc.visual.root) {
                setCustomerRobotMode(npc, 'carry');
              }
            }
            animateRobotVisual(npc.cargoRobot, worldTime + npc.queueIndex * 0.35, moving ? 0.55 : 0.16, dx, dy);
          }
          if (moving) {
            npc.visual.root.rotation.y = -Math.atan2(dx, dy);
          }
          const swing = walkSin * 0.3 * (moving ? 1 : 0);
          if (npc.visual.leftLegPivot) npc.visual.leftLegPivot.rotation.x = swing;
          if (npc.visual.rightLegPivot) npc.visual.rightLegPivot.rotation.x = -swing;
          const customerArmSwing = Math.sin(worldTime * WALK_BOB_SPEED + Math.PI) * 0.2 * (moving ? 1 : 0);
          if (npc.visual.leftArm) {
            if (npc.stage === 'waiting') {
              npc.visual.leftArm.rotation.x = -Math.PI / 4;
              npc.visual.rightArm!.rotation.x = -Math.PI / 4;
              npc.visual.leftArmPivot!.rotation.y = -0.1;
              npc.visual.rightArmPivot!.rotation.y = 0.1;
            } else {
              npc.visual.leftArm.rotation.x = 0 + customerArmSwing;
              npc.visual.rightArm!.rotation.x = -Math.PI / 2 - customerArmSwing;
              npc.visual.leftArmPivot!.rotation.y = 0.42;
              npc.visual.rightArmPivot!.rotation.y = -0.42;
            }
          }
          const bobZ = moving ? walkSin * 0.03 : 0;
          npc.visual.nameSprite.position.y = 1.15 + Math.sin(worldTime * 2 + npc.position.y) * 0.03;
          // Defect animations (on cargo robot)
          const crRoot = npc.cargoRobot.root;
          if (crRoot) {
            const ud = crRoot.userData;
            if (ud.nameBroken) {
              // Head wobble
              crRoot.rotation.x = Math.sin(worldTime * 4) * 0.02;
              crRoot.rotation.y = Math.sin(worldTime * 3) * 0.02;
            }
            // sizeBroken flag kept for future use (no scale pulsing)
            // Cache toon materials once for defect animations
            let toonMats: THREE.MeshToonMaterial[] = ud.toonMats;
            if (!toonMats && (ud.activationBroken || ud.requiresChargingBroken || ud.hasRedundantSensorsBroken || ud.versionBroken)) {
              toonMats = [];
              crRoot.traverse((node) => {
                const m = node as THREE.Mesh;
                if (!m.isMesh) return;
                const mats = Array.isArray(m.material) ? m.material : [m.material];
                for (const mat of mats) {
                  if (mat instanceof THREE.MeshToonMaterial) toonMats.push(mat);
                }
              });
              ud.toonMats = toonMats;
            }
            if (ud.activationBroken && toonMats) {
              const pulse = (Math.sin(worldTime * 8) + 1) / 2;
              for (const mat of toonMats) { mat.emissive.setHex(0xef4444); mat.emissiveIntensity = pulse * 0.6; }
              crRoot.position.x += Math.sin(worldTime * 20) * 0.003;
            }
            if (ud.reinforcedFrameBroken) {
              const creak = Math.sin(worldTime * 5) * 0.002;
              crRoot.position.x += creak;
              crRoot.position.y += Math.sin(worldTime * 5 + 1) * 0.002;
            }
            if (ud.requiresChargingBroken && toonMats) {
              const dim = (Math.sin(worldTime * 3) + 1) / 2;
              for (const mat of toonMats) { mat.emissiveIntensity = dim * 0.3; }
            }
            if (ud.hasRedundantSensorsBroken && toonMats) {
              const blinkPhase = Math.floor(worldTime / 0.3) % 2;
              for (const mat of toonMats) {
                if (blinkPhase === 0) { mat.emissive.setHex(0x22c55e); mat.emissiveIntensity = 0.8; }
                else { mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0; }
              }
            }
            if (ud.versionBroken && toonMats) {
              const saw = (worldTime % 1) / 1;
              for (const mat of toonMats) {
                mat.emissive.setHex(saw > 0.5 ? 0xf97316 : 0xffffff);
                mat.emissiveIntensity = saw * 0.8;
              }
            }
          }
          npc.visual.root.position.set(npc.position.x, 0.26 + bobZ, -npc.position.y);
          }
        }

        const currentNpc = currentCustomerIdRef.current
          ? workshopCustomersRef.current.find((npc) => npc.id === currentCustomerIdRef.current) || null
          : null;
        const registerWire = workshopRegisterWireRef.current;
        const registerComputer = workshopRegisterComputerRef.current;
        if (registerWire && registerComputer && currentNpc && currentNpc.stage === 'awaiting-code') {
          const wireStart = scratchVec3.current;
          const wireEnd = scratchVec3b.current;
          currentNpc.cargoRobot.root.getWorldPosition(wireStart);
          const port = registerComputer.getObjectByName('usb-port');
          if (port) port.getWorldPosition(wireEnd);
          else registerComputer.getWorldPosition(wireEnd);
          wireStart.z += 0.02;
          wireEnd.z += 0.1;
          const dir = scratchVec3c.current.copy(wireEnd).sub(wireStart);
          const distWire = dir.length();
          if (distWire > 0.001) {
            dir.normalize();
            const mid = scratchVec3.current.copy(wireStart).add(wireEnd).multiplyScalar(0.5);
            registerWire.visible = true;
            registerWire.position.copy(mid);
            registerWire.scale.set(1, distWire, 1);
            registerWire.quaternion.setFromUnitVectors(scratchVec3UpY.current, dir);
            animateWirePulse(registerWire, worldTime);
          } else {
            registerWire.visible = false;
          }
        } else if (registerWire && registerCutscenePhaseRef.current === 'idle') {
          registerWire.visible = false;
        }
      }

      // Update bonus timer fraction for UI
      if (bonusTimerRef.current !== null) {
        const elapsed = (performance.now() - bonusTimerRef.current) / 1000;
        const frac = Math.max(0, 1 - elapsed / BONUS_DURATION);
        if (Math.abs(frac - bonusFraction) > 0.01) setBonusFraction(frac);
        if (frac <= 0) { bonusTimerRef.current = null; setBonusFraction(0); }
      } else if (bonusFraction !== 0) {
        setBonusFraction(0);
      }

      // Animate confetti particles
      const confettiParticles = confettiParticlesRef.current;
      for (let i = confettiParticles.length - 1; i >= 0; i--) {
        const cp = confettiParticles[i];
        cp.life -= delta * 1.2;
        cp.mesh.position.x += cp.vx * delta;
        cp.mesh.position.y += cp.vy * delta;
        cp.mesh.position.z += cp.vz * delta;
        cp.vy -= 3.5 * delta;
        cp.mesh.rotation.z += delta * 8;
        const mat = cp.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, cp.life);
        if (cp.life <= 0) {
          cp.mesh.geometry.dispose();
          mat.dispose();
          scene.remove(cp.mesh);
          confettiParticles.splice(i, 1);
        }
      }

      const currentRoom = inWorkshopRoomRef.current ? 'workshop' : inShopRoomRef.current ? 'shop' : inApartmentRoomRef.current ? 'apartment' : 'outside';
      for (const avatar of Object.values(remoteAvatarsRef.current)) {
        const showAvatar = currentRoom === avatar.room;
        avatar.root.visible = showAvatar;
        if (showAvatar) {
          const targetGroup =
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
        const roomZ = avatar.room === 'workshop' ? 0.26 : avatar.room === 'apartment' || avatar.room === 'shop' ? 0.28 : 0.24;
        avatar.root.position.y = roomZ;
        const velocity = Math.hypot(avatar.root.position.x - prevX, avatar.root.position.y - prevY);
        avatar.walkTime += delta * (1 + velocity * 20);
        const lookX = avatar.target.x - avatar.root.position.x;
        const lookY = avatar.target.y - avatar.root.position.y;
        const remoteSpeed = velocity > 0.001 ? 1 : 0;
        const remoteSwing = Math.sin(avatar.walkTime * WALK_BOB_SPEED) * 0.3 * remoteSpeed;
        avatar.leftLegPivot.rotation.x = remoteSwing;
        avatar.rightLegPivot.rotation.x = -remoteSwing;
        const remoteArmSwing = Math.sin(avatar.walkTime * WALK_BOB_SPEED + Math.PI) * 0.2 * remoteSpeed;
        avatar.leftArm.rotation.x = 0 + remoteArmSwing;
        avatar.rightArm.rotation.x = 0 - remoteArmSwing;
        if (Math.abs(lookX) > 0.001 || Math.abs(lookY) > 0.001) {
          avatar.root.rotation.y = Math.atan2(lookX, -lookY);
        } else {
          avatar.root.rotation.y = -avatar.facingRotation;
        }
      }

      const roomBg = inWorkshopRoomRef.current ? 0x3a2a18 : inShopRoomRef.current ? 0x3a3a1a : inApartmentRoomRef.current ? 0x3a2a2a : 0x4a4a5a;
        outdoorGroup.visible = !inWorkshopRoomRef.current && !inShopRoomRef.current && !inApartmentRoomRef.current;
        workshopRoomGroup.visible = inWorkshopRoomRef.current;
        apartmentRoomGroup.visible = inApartmentRoomRef.current;
        if (shopRoomGroupRef.current) shopRoomGroupRef.current.visible = inShopRoomRef.current;
        sceneBgColorRef.current.set(sceneBgOverrideRef.current ?? roomBg);
        scene.background = sceneBgColorRef.current;
        const camYaw = yawRef.current;
        const camPitch = cameraPitchRef.current;
        const px = localPositionRef.current.x;
        const pz = -localPositionRef.current.y; // -north in Y-up
        const sinYaw = Math.sin(camYaw), cosYaw = Math.cos(camYaw);
        const sinPitch = Math.sin(camPitch), cosPitch = Math.cos(camPitch);
        const inside = inWorkshopRoomRef.current || inShopRoomRef.current || inApartmentRoomRef.current;
        const room = inside ? currentRoom : 'outside';
        // Smooth ambient transition for indoor/outdoor contrast
        if (ambientLightRef.current) {
          const al = ambientLightRef.current;
          if (inside) {
            al.color.setHex(0x554433);
            al.intensity += (0.75 - al.intensity) * 0.03;
          } else {
            al.color.setHex(0xeeeeee);
            al.intensity += (0.5 - al.intensity) * 0.03;
          }
        }
        if (cinemCamActiveRef.current) {
          const phase = aptCutscenePhaseRef.current;
          const csSparky = apartmentSparkyRef.current;
          if (repairCutscenePhaseRef.current !== 'idle') {
            scratchVec3.current.set(2.9, 1.0, -2.2);
            camera.position.lerp(scratchVec3.current, 0.06);
            camera.lookAt(2.9, 0.3, 3.05);
          } else if (registerCutscenePhaseRef.current !== 'idle') {
            if (registerCutscenePhaseRef.current === 'place-robot') {
              scratchVec3.current.set(2.0, 1.5, -0.8);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(2.0, 0.3, 3.0);
            } else if (registerCutscenePhaseRef.current === 'player-to-robot') {
              scratchVec3.current.set(localPositionRef.current.x, 1.5, -localPositionRef.current.y + 1.5);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(localPositionRef.current.x, 0.3, -localPositionRef.current.y - 0.8);
            } else if (registerCutscenePhaseRef.current === 'player-to-laptop') {
              scratchVec3.current.set(0.5, 2.0, -2.2);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(2.0, 0.3, 2.7);
            } else if (registerCutscenePhaseRef.current === 'connect-wire' || registerCutscenePhaseRef.current === 'register-dlg') {
              scratchVec3.current.set(0.5, 2.0, -2.2);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(2.0, 0.3, 2.7);
            } else if (registerCutscenePhaseRef.current === 'laptop-ui' || registerCutscenePhaseRef.current === 'done') {
              const regComp = workshopRegisterComputerRef.current;
              if (regComp) {
                const lid = regComp.children[2] as THREE.Group;
                const display = lid.children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                // In Y-up, getWorldPosition gives (east, height, -north).
                // Camera above and behind: height+0.18, z offset
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.18, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }
            } else {
              scratchVec3.current.set(1.5, 1.2, -2.5);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(1.8, 0.4, 3.0);
            }
          } else if (installBatteryPhaseRef.current) {
            const ibPhase = installBatteryPhaseRef.current;
            if (ibPhase === 'approach' || ibPhase === 'hand-off') {
              scratchVec3.current.set(localPositionRef.current.x, 2.0, -localPositionRef.current.y + 1.0);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(localPositionRef.current.x, 0.3, -localPositionRef.current.y - 1.5);
            } else if (ibPhase === 'sparky-walk') {
              scratchVec3.current.set(-2.6, 1.8, 0.2);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.3, 0.6);
            } else {
              scratchVec3.current.set(-3.5, 1.8, -0.7);
              camera.position.lerp(scratchVec3.current, 0.08);
              camera.lookAt(-2.6, 0.3, 0.7);
            }
          } else if (csSparky) {
            const sp = csSparky.root.position;
            if (phase === 'fetch-laptop') {
              camera.position.set(-3.0, 1.5, 2.5);
              camera.lookAt(-3.0, 0.3, 1.15);
            } else if (phase === 'link-computer' || phase === 'electrocute') {
              scratchVec3.current.set(-3.0, 1.5, -2.5);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(-3.0, 0.3, 1.15);
            } else if (phase === 'walk-to-laptop') {
              scratchVec3.current.set(localPositionRef.current.x, 2.0, -localPositionRef.current.y - 1.3);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(localPositionRef.current.x, 0.3, -localPositionRef.current.y + 0.8);
            } else if (phase === 'string-tutorial') {
              scratchVec3.current.set(-3.4, 1.8, -1.6);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(-3.4, 0.3, 0.5);
            } else if (phase === 'laptop-ui') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }
            } else if (phase === 'antenna-glow') {
              const t = aptCutsceneTimerRef.current;
              if (t < 2.0) {
                scratchVec3.current.set(-3.0, 1.5, -0.8);
                camera.position.lerp(scratchVec3.current, 0.06);
                camera.lookAt(-2.6, 0.34, 1.2);
              } else {
                if (computerRef.current) {
                  const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                  display.getWorldPosition(scratchVec3.current);
                  scratchVec3b.current.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                  camera.position.lerp(scratchVec3b.current, 0.04);
                  camera.lookAt(scratchVec3.current);
                }
              }
            } else if (phase === 'date-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }
            } else if (phase === 'reboot') {
              scratchVec3.current.set(-3.0, 1.5, -0.8);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.34, 1.2);
            } else if (phase === 'version-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }
            } else if (phase === 'pre-boot') {
              scratchVec3.current.set(-3.0, 1.5, -0.8);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.34, 1.2);
            } else if (phase === 'boot-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }
            } else if (phase === 'boot') {
              scratchVec3.current.set(-3.0, 1.5, -0.8);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.34, 1.2);
            } else {
              scratchVec3.current.set(-2.7, 2.2, -3.0);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(sp.x, 0.3, sp.z);
            }
          }
        } else if (cutsceneActiveRef.current && inside && room === 'workshop') {
          // Rafiq meet cutscene — camera phases
          if (rafiqWalkPhaseRef.current === 'walking') {
            // Player walks forward (+Z). Camera behind (lower Z), looks ahead toward Rafiq.
            scratchVec3.current.set(localPositionRef.current.x, 1.8, -localPositionRef.current.y - 1.5);
            camera.position.lerp(scratchVec3.current, 0.04);
            camera.lookAt(localPositionRef.current.x, 0.3, -localPositionRef.current.y + 0.5);
          } else {
            // Centered two-shot: characters centered on screen
            const midX = (localPositionRef.current.x + ROOM_OWNER_POS.x) / 2;
            const midZ = (-localPositionRef.current.y + -ROOM_OWNER_POS.y) / 2;
            scratchVec3.current.set(midX, 1.6, midZ + 0.8);
            camera.position.lerp(scratchVec3.current, 0.04);
            camera.lookAt(midX, 0.3, midZ);
          }
        } else {
        const zoom = computeCameraZoom(
          px, pz,
          inside, room,
          buildingFootprints as BuildingFootprint[],
        );
        const cd = Math.max(0.1, zoom.camDist + zoomOffsetRef.current);
        const camY = zoom.height + sinPitch * cd;
        cameraTargetPosRef.current.set(
          px - sinYaw * cosPitch * cd,
          Math.max(0.05, camY),
          pz + cosYaw * cosPitch * cd
        );
        cameraLookTargetRef.current.set(
          px,
          inside ? 0.5 : 0.6,
          pz
        );
        camera.position.copy(cameraTargetPosRef.current);
        camera.lookAt(cameraLookTargetRef.current);

        // Clamp camera inside room so it never sees past walls into the void
        if (inside) {
          const limits: Record<string, number> = {
            workshop: 4.0, apartment: 3.0, shop: 2.5,
          };
          const lim = limits[room] ?? 20;
          camera.position.x = Math.max(-lim, Math.min(lim, camera.position.x));
          camera.position.z = Math.max(-lim, Math.min(lim, camera.position.z));
        } else {
          // Push camera outside building interiors — only when player is outside the footprint
          // (when player is inside, room camera clamping handles it)
          const cx = camera.position.x, cz = camera.position.z;
          const MARGIN = 0.15;
          for (const fp of buildingFootprints) {
            // fp uses north-positive coords; convert player's z (-north) to north for comparison
            const playerNorth = -pz;
            const playerInside = px >= fp.x1 && px <= fp.x2 && playerNorth >= fp.y1 && playerNorth <= fp.y2;
            if (playerInside) continue;
            // Convert camera z to north for comparison
            const camNorth = -cz;
            if (cx >= fp.x1 && cx <= fp.x2 && camNorth >= fp.y1 && camNorth <= fp.y2) {
              const dl = cx - fp.x1, dr = fp.x2 - cx;
              const db = camNorth - fp.y1, dt = fp.y2 - camNorth;
              const minD = Math.min(dl, dr, db, dt);
              if (minD === dl) camera.position.x = fp.x1 - MARGIN;
              else if (minD === dr) camera.position.x = fp.x2 + MARGIN;
              else if (minD === db) camera.position.z = -(fp.y1 - MARGIN);
              else camera.position.z = -(fp.y2 + MARGIN);
            }
          }
        }

        // Broadcast position via WebSocket when moving (or every 50ms if moving)
        if (moved && now >= sendAtRef.current) {
          sendAtRef.current = now + NETWORK_SYNC_MS;
          const sendPos = (() => {
            if (inWorkshopRoomRef.current) return { x: ROOM_SPAWN.x, y: ROOM_SPAWN.y, room: 'workshop' };
            if (inApartmentRoomRef.current) return { x: APARTMENT_SPAWN.x, y: APARTMENT_SPAWN.y, room: 'apartment' };
            if (inShopRoomRef.current) return { x: 0, y: 1.2, room: 'shop' };
            return { x: localPositionRef.current.x, y: localPositionRef.current.y };
          })();
          sendPosition(sendPos.x, sendPos.y, sendPos.room, yawRef.current);
        }
      }

      // Spatial QA phase capture (dev-only, triggered by Playwright)
      if ((window as any).__qaEnabled) {
        (window as any).__threeCamera = camera;
        (window as any).__playerPos = localPositionRef.current;
        if (apartmentSparkyRef.current) (window as any).__sparkyPos = apartmentSparkyRef.current.root.position;
        const qa = (window as any).__qaState as {
          lastPhase: string | null;
          phases: Array<{
            name: string;
            frame: number;
            timer: number;
            camera: { x: number; y: number; z: number };
            player: { x: number; y: number };
            sparky?: { x: number; y: number; z: number };
            scrap?: { x: number; y: number; z: number };
          }>;
          cutsceneName: string;
          framesSinceLastCapture: number;
        };
        qa.framesSinceLastCapture = (qa.framesSinceLastCapture || 0) + 1;
        const p: string | null = (installBatteryPhaseRef.current as string | null)
          ?? (aptCutscenePhaseRef.current as string)
          ?? (rafiqWalkPhaseRef.current as string)
          ?? (repairCutscenePhaseRef.current as string)
          ?? (registerCutscenePhaseRef.current as string);
        const shouldCapture = p && p !== 'idle' && p !== null && (p !== qa.lastPhase || qa.framesSinceLastCapture >= 120);
        if (p && p !== 'idle' && p !== null && p !== qa.lastPhase) {
          qa.lastPhase = p;
        }
        if (shouldCapture) {
          qa.framesSinceLastCapture = 0;
          const aptSparky = apartmentSparkyRef.current;
          const scrap = scrapRobotRef.current;
          if (installBatteryPhaseRef.current) qa.cutsceneName = 'battery-install';
          else if (aptCutscenePhaseRef.current !== 'idle') qa.cutsceneName = 'apartment-intro';
          else if (rafiqWalkPhaseRef.current !== 'idle') qa.cutsceneName = 'rafiq-letter';
          else if (repairCutscenePhaseRef.current !== 'idle') qa.cutsceneName = 'repair';
          else if (registerCutscenePhaseRef.current !== 'idle') qa.cutsceneName = 'register';
          qa.phases.push({
            name: p!,
            frame: animFrameCounterRef.current,
            timer: installBatteryTimerRef.current ?? aptCutsceneTimerRef.current ?? 0,
            camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            player: { x: localPositionRef.current.x, y: localPositionRef.current.y },
            sparky: aptSparky ? { x: aptSparky.root.position.x, y: aptSparky.root.position.y, z: aptSparky.root.position.z } : undefined,
            scrap: scrap ? { x: scrap.root.position.x, y: scrap.root.position.y, z: scrap.root.position.z } : undefined,
          });
        }
      }

      const beforeRender = performance.now();
      renderer.render(scene, camera);
      const afterRender = performance.now();
      rafRef.current = window.requestAnimationFrame(animate);
      // Per-frame stats for in-browser perf analysis via window.__perfStats
      if ((window as any).__perfStats) {
        const logicMs = beforeRender - logicStart;
        const renderMs = afterRender - beforeRender;
        const s = (window as any).__perfStats;
        s.frameCount++;
        s.totalLogicMs += logicMs;
        s.totalRenderMs += renderMs;
        if (logicMs > s.maxLogic) s.maxLogic = logicMs;
        if (renderMs > s.maxRender) s.maxRender = renderMs;
        if (logicMs < s.minLogic) s.minLogic = logicMs;
        if (renderMs < s.minRender) s.minRender = renderMs;
        s.drawCalls = renderer.info.render.calls;
        s.triangles = renderer.info.render.triangles;
        s.fps = fpsRef.current;
        // Log frames where logic or render takes >50ms
        if (logicMs > 50) {
          s.slowLogicFrames = (s.slowLogicFrames || 0) + 1;
          s.slowLogicDetails = s.slowLogicDetails || [];
          const sectionId = (window as any).__animSectionIdx || -1;
          if (s.slowLogicDetails.length < 20) s.slowLogicDetails.push({ frame: s.frameCount, logicMs: logicMs.toFixed(1), renderMs: renderMs.toFixed(1), room: inWorkshopRoomRef.current ? 'workshop' : inApartmentRoomRef.current ? 'apt' : inShopRoomRef.current ? 'shop' : 'outdoor', moving: moved, section: sectionId });
        }
        if (renderMs > 50) {
          s.slowRenderFrames = (s.slowRenderFrames || 0) + 1;
        }
      }
      // Update on-screen perf overlay every ~500ms
      const poEl = perfOverlayRef.current;
      if (poEl && (window as any).__perfStats && (perfOverlayUpdateRef.current % 30 === 0)) {
        const s = (window as any).__perfStats;
        const rr = typeof window !== 'undefined' ? ((window as any).__reactRenders || 0) : 0;
        poEl.textContent = `${s.fps || 0}fps | L:${s.avgLogic}ms R:${s.avgRender}ms | draws=${s.drawCalls || 0} tris=${s.triangles || 0} | maxR=${s.maxRender.toFixed(1)}ms | renders=${rr}`;
      }
      perfOverlayUpdateRef.current++;
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
    // Pre-compile all shaders before starting animation loop
    renderer.compileAsync(scene, camera).then(() => {
      // Pre-warm shadow pass programs with one render before animation loop
      renderer.render(scene, camera);
      rafRef.current = window.requestAnimationFrame(animate);
    });

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
      rightArmPivotRef.current = null;
      disposeObject(sparky.root);
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
      if (scrapFollowerRef.current) { disposeObject(scrapFollowerRef.current.root); scrapFollowerRef.current = null; }
      roomCustomerGroupRef.current = null;
      roomOwnerVisualRef.current = null;
      outdoorGroupRef.current = null;
      workshopRoomGroupRef.current = null;
      apartmentRoomGroupRef.current = null;
      obstacleHitboxesRef.current = [];
      roomObstacleHitboxesRef.current = [];
      workshopDoorHitboxRef.current = null;
      apartmentDoorHitboxRef.current = null;
      apartmentDoorMarkerRef.current = null;
      aptExitMarkerRef.current = null;
      shopDoorMarkerRef.current = null;
      workshopDoorMarkerRef.current = null;
      rafiqMarkerRef.current = null;
      workshopExitMarkerRef.current = null;
      shopExitMarkerRef.current = null;
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

  const syncMarkers = useCallback(() => {
    // Hide all markers during cutscenes/dialogs
    if (cutsceneActiveRef.current) {
      if (sparkyQuestMarkerRef.current) sparkyQuestMarkerRef.current.visible = false;
      if (workshopDoorMarkerRef.current) workshopDoorMarkerRef.current.visible = false;
      if (shopDoorMarkerRef.current) shopDoorMarkerRef.current.visible = false;
      if (apartmentDoorMarkerRef.current) apartmentDoorMarkerRef.current.visible = false;
      if (aptExitMarkerRef.current) aptExitMarkerRef.current.visible = false;
      if (workshopExitMarkerRef.current) workshopExitMarkerRef.current.visible = false;
      if (shopExitMarkerRef.current) shopExitMarkerRef.current.visible = false;
      if (rafiqMarkerRef.current) rafiqMarkerRef.current.visible = false;
      return;
    }
    const room: RoomType = inWorkshopRoomRef.current ? 'workshop' : inApartmentRoomRef.current ? 'apartment' : inShopRoomRef.current ? 'shop' : 'outside';
    const bp = gameStore.get('backpack') as ScrapPartId[];
    const vis = computeMarkerVisibility(
      room, sparkyQuestStageRef.current, bp,
      gameStore.get('money') ?? 0, cutsceneDoneRef.current,
      sparkyHomeArrivedRef.current, workshopIntroSeenRef.current,
      batteryInstalledRef.current,
    );
    if (sparkyQuestMarkerRef.current) sparkyQuestMarkerRef.current.visible = vis.sparkyOutdoor;
    if (workshopDoorMarkerRef.current) workshopDoorMarkerRef.current.visible = vis.workshopDoor;
    if (shopDoorMarkerRef.current) shopDoorMarkerRef.current.visible = vis.shopDoor;
    if (apartmentDoorMarkerRef.current) apartmentDoorMarkerRef.current.visible = vis.apartmentDoor;
    if (aptExitMarkerRef.current) aptExitMarkerRef.current.visible = vis.apartmentExit;
    if (workshopExitMarkerRef.current) workshopExitMarkerRef.current.visible = vis.workshopExit;
    if (shopExitMarkerRef.current) shopExitMarkerRef.current.visible = vis.shopExit;
    if (rafiqMarkerRef.current) rafiqMarkerRef.current.visible = vis.rafiqMarker;
  }, []);

  useEffect(() => {
    syncMarkers();
  }, [sparkyQuestStage, inApartmentRoom, inWorkshopRoom, inShopRoom, workshopIntroSeen, backpack, money, cutsceneTick]);

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
        const roomZ = remoteRoom === 'workshop' ? 0.26 : remoteRoom === 'apartment' || remoteRoom === 'shop' ? 0.28 : 0.24;
        pv.root.position.set(data.x, roomZ, -data.y);
        const initialRotation = (data as any).rotation ?? 0;
        pv.root.rotation.y = -initialRotation;
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

        setOutput(`✅ Nice! ${activePhase.title} complete.`);
        setSparkleBurst(false);
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
    // Pool customers instead of destroying — group visibility toggle handles hide/show
    // Clean up confetti particles only (they're scene-level, not group-level)
    const scene = sceneRef.current;
    if (confettiParticlesRef.current.length > 0) {
      for (const cp of confettiParticlesRef.current) {
        cp.mesh.geometry.dispose();
        (cp.mesh.material as THREE.MeshBasicMaterial).dispose();
        if (scene) scene.remove(cp.mesh);
      }
      confettiParticlesRef.current = [];
    }
    currentCustomerIdRef.current = null;
    interactionCandidateIdRef.current = null;
    interactionRequestedRef.current = false;
    worldInteractionRequestedRef.current = false;
    setActiveCustomer(null);
    setInteractionPromptName(null);
    setWorkshopCode('');
    setWorkshopOutput('');
    const outsideDoor = new THREE.Vector2(-6, -9.0);
    localPositionRef.current.copy(outsideDoor);
    yawRef.current = 0; // face north (away from workshop — door is on north wall)
    if (localRobotRef.current) {
      localRobotRef.current.root.position.set(outsideDoor.x, 0.24, -outsideDoor.y);
    }
    apiSync({ position: { x: outsideDoor.x, y: outsideDoor.y, rotation: yawRef.current, room: 'outside' } });
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
    yawRef.current = Math.atan2(-1, -1); // face southwest (out the door)
    if (localRobotRef.current) {
      localRobotRef.current.root.position.set(outsideDoor.x, 0.24, -outsideDoor.y);
    }
    apiSync({ position: { x: outsideDoor.x, y: outsideDoor.y, rotation: yawRef.current, room: 'outside' } });
  };

  const prepBatteryInstallProps = () => {
    if (computerRef.current) {
      computerRef.current.visible = true;
      computerRef.current.position.set(-3.41, 0.24, -0.96);
      computerRef.current.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    }
    if (cutsceneBoxRef.current) {
      cutsceneBoxRef.current.visible = true;
      cutsceneBoxRef.current.position.set(-2.8, 0.24, -1.9);
    }
    if (wireRef.current) {
      wireRef.current.visible = true;
      const lapPort = new THREE.Vector3(-3.4, 0.253, -1.025);
      const scrapPos = new THREE.Vector3(-2.6, 0.36, -0.976);
      const mid = new THREE.Vector3().addVectors(lapPort, scrapPos).multiplyScalar(0.5);
      wireRef.current.position.copy(mid);
      const dir = new THREE.Vector3().subVectors(scrapPos, lapPort);
      const dist = dir.length();
      dir.normalize();
      wireRef.current.scale.set(1, dist, 1);
      wireRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    if (scrapRobotRef.current) {
      scrapRobotRef.current.root.visible = true;
      scrapRobotRef.current.root.position.set(-2.6, 0.24, -1.2);
      scrapRobotRef.current.root.scale.set(0.65, 0.65, 0.65);
      scrapRobotRef.current.root.rotation.x = 0;
      scrapRobotRef.current.root.rotation.y = 0.08;
    }
    if (apartmentSparkyRef.current) {
      apartmentSparkyRef.current.root.visible = true;
    }
  };

  const runApartmentSparkyInteraction = useCallback(() => {
    const stage = sparkyQuestStageRef.current;
    const bp = gameStore.get('backpack');
    // Battery install takes priority — if player has a battery, trigger install cutscene
    if (bp.includes('battery') && !batteryInstalledRef.current) {
      if (installBatteryPhaseRef.current) return;
      prepBatteryInstallProps();
      installBatteryPhaseRef.current = 'approach';
      installBatteryTimerRef.current = 0;
      startCinematicCutscene();
      keyStateRef.current.clear();
      return;
    }
    if (stage === 'unit1-done') {
      setSparkyDlgFull('You have enough money! Go buy a battery at the Parts Shop near the water fountain — it will power up Scrap for good.');
      setShowSparkyDlg(true);
    } else if (stage === 'unit2-done' || stage === 'unit3-done') {
      setSparkyDlgFull('Scrap is getting stronger! But the battery is the key — buy one at the Parts Shop near the water fountain.');
      setShowSparkyDlg(true);
    } else if (stage === 'unit3' || stage === 'unit4') {
      const unitLabel = stage === 'unit3' ? 'Unit 3 (coming soon)' : 'Unit 4 (coming soon)';
      setSparkyDlgFull(`${unitLabel} isn't built yet! Check back later.`);
      setShowSparkyDlg(true);
    } else if (stage === 'all-done') {
      setSparkyDlgFull('Scrap is all yours now! Take him outside — people need help powering their robots at the repair kiosk.');
      setShowSparkyDlg(true);
    }
  }, []);

  const spawnConfetti = (pos: THREE.Vector2) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const colors = [0xfacc15, 0xef4444, 0x3b82f6, 0x22c55e, 0xa855f7, 0xec4899, 0xf97316];
    const particles = confettiParticlesRef.current;
    for (let i = 0; i < 50; i++) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06, 0.04),
        new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)], transparent: true, opacity: 1, side: THREE.DoubleSide })
      );
      p.position.set(pos.x + (Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.3, pos.y + (Math.random() - 0.5) * 0.5);
      p.rotation.y = Math.random() * Math.PI * 2;
      scene.add(p);
      particles.push({
        mesh: p,
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * 2 + 1,
        vz: (Math.random() - 0.5) * 2.5,
        life: 1.0,
      });
    }
  };

  const runWorkshopCode = () => {
    if (!activeCustomer) {
      setWorkshopOutput('Get close to the front customer and press Space to interact first.');
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

    const bonusNow = bonusTimerRef.current !== null
      ? Math.max(0, Math.round(5 * (1 - (performance.now() - bonusTimerRef.current) / 1000 / BONUS_DURATION)))
      : 0;
    bonusTimerRef.current = null;
    const totalEarned = 2 + bonusNow;
    const newMoney = gameStore.get('money') + totalEarned;
    gameStore.set('money', newMoney);
    fetch('/api/profile/money', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: newMoney }), keepalive: true }).catch(() => {});
    lastConfirmedMoneyRef.current = newMoney;
    playHappyChime();
    const billCount = Math.min(7, totalEarned);
    setMoneyAnim({active: true, bills: billCount, hits: 0, total: totalEarned});

    // Spawn confetti at customer position
    spawnConfetti(selectedNpc.position);

    if (!firstTransactionDoneRef.current) {
      firstTransactionDoneRef.current = true;
      setFirstTransactionDone(true);
      try { localStorage.setItem('rb_first_tx_done', '1'); } catch {}
      setShowFirstSaleModal(true);
    }

    const bonusText = bonusNow > 0 ? ` (+$${bonusNow} speed bonus!)` : '';
    repairOutputRef.current = `✅ ${activeCustomer.customerName}: "Thank you!" You earned $${totalEarned}${bonusText}.`;
    setWorkshopCode('');
    (document.activeElement as HTMLElement)?.blur();

    // Close modal, save output for after cutscene
    setWorkshopCode('');
    setActiveCustomer(null);
    (document.activeElement as HTMLElement)?.blur();
    const reLockEl = rendererRef.current?.domElement;
    if (reLockEl && document.pointerLockElement !== reLockEl) {
      try { reLockEl.requestPointerLock(); } catch {}
    }

    // Start repair cutscene — customer leaving deferred to cutscene 'done' phase
    repairCustomerRef.current = selectedNpc;
    repairCutscenePhaseRef.current = 'glow';
    repairCutsceneTimerRef.current = 0;
    startCinematicCutscene();
  };

  const handleRegLaptopSubmit = () => {
    if (!activeCustomer) return;
    const selectedId = currentCustomerIdRef.current;
    const selectedNpc = selectedId === null ? undefined : workshopCustomersRef.current.find((npc) => npc.id === selectedId);
    if (!selectedNpc) return;
    const result = validateWorkshopCode(regLaptopCode, activeCustomer);
    if (!result.valid) {
      setRegLaptopOutput(`❌ ${result.error}`);
      return;
    }
    const req = selectedNpc.request;
    const maxBonus = req.isSpecSheet ? req.bonusReward : 5;
    const basePay = req.isSpecSheet ? req.baseReward : 2;
    const bonusNow = bonusTimerRef.current !== null
      ? Math.max(0, Math.round(maxBonus * (1 - (performance.now() - bonusTimerRef.current) / 1000 / BONUS_DURATION)))
      : 0;
    bonusTimerRef.current = null;
    const totalEarned = basePay + bonusNow;
    const newMoney = gameStore.get('money') + totalEarned;
    gameStore.set('money', newMoney);
    fetch('/api/profile/money', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: newMoney }), keepalive: true }).catch(() => {});
    lastConfirmedMoneyRef.current = newMoney;
    playHappyChime();
    spawnConfetti(selectedNpc.position);
    if (!firstTransactionDoneRef.current) {
      firstTransactionDoneRef.current = true;
      setFirstTransactionDone(true);
      try { localStorage.setItem('rb_first_tx_done', '1'); } catch {}
    }
    clearDefectFromRequest(req, selectedNpc.cargoRobot.root);
    repairsDoneRef.current += req.isSpecSheet ? 2 : 1;
    regPanelShownRef.current = false;
    setShowRegLaptopUI(false);
    setRegLaptopCode('');
    setRegLaptopOutput('');
    setActiveCustomer(null);
    currentCustomerIdRef.current = null;
    const leavingIdx = selectedNpc.queueIndex;
    const frontY = CUSTOMER_QUEUE_POSITIONS[leavingIdx].y;
    selectedNpc.waypoints = [new THREE.Vector2(0, frontY), new THREE.Vector2(0, -5.5)];
    selectedNpc.wpIndex = 0;
    selectedNpc.target.copy(selectedNpc.waypoints[0]);
    for (const npc of workshopCustomersRef.current) {
      if (npc.stage !== 'leaving' && npc.queueIndex > leavingIdx) {
        npc.queueIndex--;
        npc.waypoints = undefined;
        npc.target.copy(CUSTOMER_QUEUE_POSITIONS[npc.queueIndex]);
        (npc as any).startedAtMs = performance.now();
        if (npc.stage === 'waiting') { npc.stage = 'walking-to-queue'; }
      }
    }
    spawnCustomerRef.current?.();
    selectedNpc.stage = 'leaving';
    registerCutscenePhaseRef.current = 'done';
    endCinematicCutscene();
    const reLockEl = rendererRef.current?.domElement;
    if (reLockEl && document.pointerLockElement !== reLockEl) {
      try { reLockEl.requestPointerLock(); } catch {}
    }
  };

  // Register laptop Enter key handler
  const handleRegLaptopSubmitRef = useRef(handleRegLaptopSubmit);
  handleRegLaptopSubmitRef.current = handleRegLaptopSubmit;
  useEffect(() => {
    if (!showRegLaptopUI) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '1') { e.preventDefault(); handleRegLaptopSubmitRef.current(); return; }
      if (e.ctrlKey && e.key === '2') { e.preventDefault(); setShowSparkyExamples(true); return; }
      const t = e.target as HTMLElement;
      if (t?.tagName === 'TEXTAREA' || t?.tagName === 'INPUT' || t?.isContentEditable) return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRegLaptopUI]);

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

  // Track React re-renders
  if (typeof window !== 'undefined') {
    (window as any).__reactRenders = ((window as any).__reactRenders || 0) + 1;
    const rr = (window as any).__reactRenders;
    if (rr > 0 && rr % 10 === 0) {
      console.log(`[RENDER#${rr}] triggered`);
    }
  }
  return (
    <div className="relative" suppressHydrationWarning>
      <style>{`
        @keyframes money-bill {
          0% { transform: translate(0,0) scale(0.3) rotate(-10deg); opacity: 0; }
          10% { transform: translate(0,-30px) scale(1.3) rotate(5deg); opacity: 1; }
          20% { transform: translate(0,-10px) scale(1) rotate(-3deg); }
          30% { transform: translate(0,-20px) scale(1.1) rotate(3deg); }
          100% { transform: translate(60vw, 40vh) scale(0.3); opacity: 0; }
        }
        @keyframes fade-up {
          0% { opacity: 0; transform: translateY(10px) scale(0.8); }
          20% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-30px) scale(0.9); }
        }
        .animate-money-bill {
          animation: money-bill 1.2s ease-out forwards;
        }
        .animate-fade-up {
          animation: fade-up 1s ease-out forwards;
        }
        @keyframes modal-pop {
          0% { opacity: 0; transform: scale(0.5) translateY(20px); }
          60% { opacity: 1; transform: scale(1.05) translateY(-5px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-pop {
          animation: modal-pop 0.4s ease-out forwards;
        }
      `}</style>
      {showSparkyExamples && inWorkshopRoom && (() => {
        const exMap = { String: { n: 'greeting', v: '"Hello"' }, int: { n: 'count', v: '42' }, double: { n: 'price', v: '3.5' }, boolean: { n: 'isCharged', v: 'true' } } as const;
        const exVal = (t: string) => (exMap as any)[t]?.v ?? '0';
        const typeOf = (r: string) => r === 'name' || r === 'color' ? 'String' : r === 'size' ? 'int' : r === 'version' ? 'double' : 'boolean';
        const extraTypes: string[] = [...new Set((activeCustomer?.required ?? []).map(typeOf))];
        const ttsLine = (text: string) => (
          <div className="flex items-center gap-1">
            <span className="text-slate-300 text-sm">{renderFormattedSpecLine(text)}</span>
            <button onClick={() => playLineTts(text)} className="shrink-0 p-1 rounded hover:bg-white/10 text-amber-300/70 hover:text-amber-300 transition-colors" title={ttsActiveTextRef.current === text ? 'Stop' : 'Read aloud'}>
              {ttsActiveTextRef.current === text ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </button>
          </div>
        );
        return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4" onClick={() => setShowSparkyExamples(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-amber-200/50 shadow-2xl p-5 text-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-bold text-amber-300 mb-3">Example</div>
            <div className="space-y-3">
              {activeCustomer?.isSpecSheet && activeCustomer.specSheetPrompts?.map((p, i) => (
                <div key={i} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                  {ttsLine(p.exampleLines[0])}
                  <div className="mb-2">{ttsLine(p.exampleLines[1])}</div>
                  {ttsLine(`→ ${p.exampleCode}`)}
                </div>
              ))}
              {extraTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {extraTypes.map(t => (
                    <div key={t} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      {ttsLine(`${t} ${(exMap as any)[t]?.n ?? 'value'} = ${exVal(t)};`)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 text-right">
              <button className="rounded bg-emerald-500 px-5 py-2 text-base font-semibold text-white hover:bg-emerald-400" onClick={() => setShowSparkyExamples(false)}>Got it!</button>
            </div>
          </div>
        </div>);
      })()}

      <TFB show={inWorkshopRoom && !workshopIntroSeen && profileLoadedRef.current}
        step={workshopIntroStep} steps={WORKSHOP_INTRO_STEPS} text={workshopIntroText}
        icon="person" onEnter={nextWorkshopIntroStep}
        ttsOn={ttsUtteranceRef.current !== null} ttsCharIdx={ttsCharIndexRef.current}
        onTtsToggle={onTtsToggle} />

      {!showRegLaptopUI && <WorkshopPanel activeCustomer={activeCustomer} workshopCode={workshopCode} setWorkshopCode={setWorkshopCode} workshopOutput={workshopOutput} inWorkshopRoom={inWorkshopRoom} runWorkshopCode={runWorkshopCode} reopenWorkshopIntro={reopenWorkshopIntro} showSparkyExamples={() => setShowSparkyExamples(true)} bonusFraction={bonusFraction} bonusDuration={BONUS_DURATION} firstTransactionDone={firstTransactionDone} />}

      {showRegLaptopUI && activeCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-[min(90vw,36rem)] max-h-[90vh] pointer-events-auto">
            <div className="flex items-center gap-2 bg-slate-800 px-4 py-3 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-slate-400 text-sm font-medium ml-2">{activeCustomer.customerName}'s Request</span>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-52px)]">
              {activeCustomer.isSpecSheet ? (
                <div className="mb-3">
                  {(() => {
                    let ln = 0;
                    const el: any[] = [];
                    const addNumLine = (text: string) => {
                      ln++;
                      const play = () => playLineTts(text);
                      const isPlaying = ttsActiveTextRef.current === text;
                      el.push(
                        <div key={ln} className="flex items-center gap-1 mb-1 text-sm">
                          <span className="text-cyan-300 font-bold shrink-0 min-w-[1.2rem]">{ln})</span>
                          <span className="text-slate-100">{renderFormattedSpecLine(text)}</span>
                          <button onClick={play} className="shrink-0 p-1 rounded hover:bg-white/10 text-amber-300/70 hover:text-amber-300 transition-colors" title={isPlaying ? 'Stop' : 'Read aloud'}>
                            {isPlaying ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            )}
                          </button>
                        </div>
                      );
                    };
                    activeCustomer?.specSheetPrompts?.forEach(p => {
                      ln++;
                      const t0 = p.lines[0], t1 = p.lines[1];
                      const p0 = () => playLineTts(t0);
                      const p1 = () => playLineTts(t1);
                      const ip0 = ttsActiveTextRef.current === t0;
                      const ip1 = ttsActiveTextRef.current === t1;
                      el.push(
                        <div key={`p${ln}-0`} className="flex items-center gap-1 mb-0.5 text-sm">
                          <span className="text-cyan-300 font-bold shrink-0 min-w-[1.2rem]">{ln})</span>
                          <span className="text-slate-100">{renderFormattedSpecLine(t0)}</span>
                          <button onClick={p0} className="shrink-0 p-1 rounded hover:bg-white/10 text-amber-300/70 hover:text-amber-300 transition-colors" title={ip0 ? 'Stop' : 'Read aloud'}>
                            {ip0 ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            )}
                          </button>
                        </div>,
                        <div key={`p${ln}-1`} className="flex items-center gap-1 mb-1 text-sm pl-[1.8rem]">
                          <span className="text-slate-100">{renderFormattedSpecLine(t1)}</span>
                          <button onClick={p1} className="shrink-0 p-1 rounded hover:bg-white/10 text-amber-300/70 hover:text-amber-300 transition-colors" title={ip1 ? 'Stop' : 'Read aloud'}>
                            {ip1 ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            )}
                          </button>
                        </div>
                      );
                    });
                    if (activeCustomer?.required.includes('name')) addNumLine(`Robot's name is ${activeCustomer.petName}`);
                    if (activeCustomer?.required.includes('color')) addNumLine(`Color is ${activeCustomer.petColor}`);
                    if (activeCustomer?.required.includes('size')) addNumLine(`Size is ${activeCustomer.petSize}`);
                    if (activeCustomer?.required.includes('version')) addNumLine(`Version is 1.0`);
                    return el;
                  })()}
                </div>
              ) : (
                <>
                  {activeCustomer.required.includes('name') && makeLine(null, `Robot's name is ${activeCustomer.petName}.`)}
                  {activeCustomer.required.includes('color') && makeLine(null, `Color is ${activeCustomer.petColor}.`)}
                  {activeCustomer.required.includes('size') && makeLine(null, `Size is ${activeCustomer.petSize}.`)}
                  {activeCustomer.required.includes('hasWireSurge') && makeLine(null, 'Robot has a wire surge. Store it in hasWireSurge.')}
                  {activeCustomer.required.includes('version') && makeLine(null, 'Version is 1.0.')}
                  {makeLine(null, '"I want my robot to have these settings!"')}
                </>
              )}
              {bonusFraction > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                    <span>Speed bonus: ${Math.round((activeCustomer?.bonusReward ?? 5) * bonusFraction)}</span>
                    <span>{Math.ceil(bonusFraction * BONUS_DURATION)}s left</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${bonusFraction * 100}%`,
                        background: bonusFraction > 0.5
                          ? 'linear-gradient(90deg, #22c55e, #eab308)'
                          : 'linear-gradient(90deg, #eab308, #ef4444)',
                      }}
                    />
                  </div>
                  {!firstTransactionDone && (
                    <div className="mt-1 text-xs text-amber-400 animate-pulse">↑ If you do it fast, you get a bonus!</div>
                  )}
                </div>
              )}
              <CodeInput
                value={regLaptopCode}
                onChange={(v) => { setRegLaptopCode(v); setRegLaptopOutput(''); }}
                autoFocus
                textareaClassName="bg-slate-950 text-amber-300 text-sm p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-500/60"
                minHeight="7rem"
              />
              {regLaptopOutput && (
                <div className="mt-3 p-3 rounded-lg text-base font-medium bg-red-900/40 text-red-300 border border-red-700/50">
                  {regLaptopOutput}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <button
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-400 transition-colors"
                  onClick={handleRegLaptopSubmit}
                >
                  <span className="flex items-center justify-center rounded-full bg-black/20 text-[11px] font-bold text-white/60 shrink-0 px-2 py-0.5">Ctrl+1</span>
                  Submit Java Code
                </button>
                <button
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500 transition-colors"
                  onClick={() => setShowSparkyExamples(true)}
                >
                  <span className="flex items-center justify-center rounded-full bg-black/20 text-[11px] font-bold text-white shrink-0 px-2 py-0.5">Ctrl+2</span>
                  Need help?
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {!hideGameUiRef.current && (
      <div className="fixed bottom-6 right-6 z-40 rounded-xl border border-emerald-300/50 bg-emerald-500/20 px-6 py-3 text-3xl font-black text-emerald-300 shadow-xl md:text-4xl">
        ${money}
      </div>
      )}

      <div className="absolute top-4 left-4 bg-black/45 text-white text-base md:text-lg px-4 py-2 rounded-full">
        {connected ? `🟢 Live island • ${Object.keys(players).length + 1} player${Object.keys(players).length + 1 !== 1 ? 's' : ''}` : '🟡 Connecting to island...'}
      </div>
      {showPerfOverlay && (
        <div ref={perfOverlayRef} id="perf-overlay" className="absolute top-16 left-4 z-50 rounded-lg bg-black/70 px-3 py-2 text-xs font-mono text-cyan-300 space-y-0.5 min-w-[300px]">
          0fps | L:0ms R:0ms | draws=0 tris=0 | maxR=0ms
        </div>
      )}

      {debugMode && (
        <div className="absolute top-20 left-4 z-50 rounded-lg bg-black/60 px-3 py-2 text-xs font-mono text-emerald-300 space-y-0.5">
          <div>FPS: {debugDisplay.fps}</div>
          <div>X: {debugDisplay.x}</div>
          <div>Y: {debugDisplay.y}</div>
          <div>Z: {debugDisplay.z}</div>
        </div>
      )}

      {showWasmHint && sparkyQuestStage === 'intro' && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-slate-400/40 text-sm animate-pulse">
          WASD / Arrow keys — move
        </div>
      )}

      {missionText && !anyDialogActive && !hideGameUiRef.current && (
        <div className="absolute bottom-4 left-4 max-w-[min(90vw,32rem)] rounded-lg border border-amber-300/40 bg-slate-950/80 px-5 py-4 text-base md:text-lg text-amber-100 shadow-lg">
          <div className="font-semibold text-amber-300">Mission</div>
          <div className="mt-1">{missionText}</div>
          {(sparkyQuestStage === 'intro' && workshopIntroSeen && !backpack.includes('letter') && !backpack.includes('battery') && (gameStore.get('money') ?? 0) < 10) && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div className="h-full rounded-full bg-amber-400 transition-all duration-300" style={{ width: `${Math.min(100, ((gameStore.get('money') ?? 0) / 10) * 100)}%` }} />
            </div>
          )}
          {(sparkyQuestStage === 'intro-done' && (gameStore.get('money') ?? 0) < 100) && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div className="h-full rounded-full bg-amber-400 transition-all duration-300" style={{ width: `${Math.min(100, ((gameStore.get('money') ?? 0) / 100) * 100)}%` }} />
            </div>
          )}
          {sparkyQuestStage !== 'intro' && sparkyQuestStage !== 'all-done' && !backpack.includes('battery') && (gameStore.get('money') ?? 0) < 10 && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div className="h-full rounded-full bg-amber-400 transition-all duration-300" style={{ width: `${Math.min(100, ((gameStore.get('money') ?? 0) / 10) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {!hideGameUiRef.current && moneyAnim.active && (
        <div className="fixed inset-0 z-[80] pointer-events-none select-none overflow-hidden">
          {Array.from({length: moneyAnim.bills}).map((_, i) => (
            <div
              key={i}
              className="absolute text-4xl animate-money-bill"
              style={{
                left: `${42 + (i % 3) * 8}%`,
                top: `${30 + Math.floor(i / 3) * 10}%`,
                animationDelay: `${i * 0.08}s`,
              }}
            >
              💵
            </div>
          ))}
          {moneyAnim.hits > 0 && (
            <div className="absolute bottom-28 right-8 text-3xl font-bold text-green-400 animate-fade-up">
              +${moneyAnim.hits}
            </div>
          )}
        </div>
      )}

      <TFB show={showSparkyDlg} step={0} steps={[{ speaker: 'Sparky', text: sparkyDlgFull }]} text={sparkyDlgText}
        icon="person" onEnter={() => { onSparkyDlgCloseRef.current?.(); setShowSparkyDlg(false); }}
        ttsOn={ttsUtteranceRef.current !== null} ttsCharIdx={ttsCharIndexRef.current}
        onTtsToggle={onTtsToggle} hideEnter={hideGameUiRef.current} />

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
                const isUnlocked = true;
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
      {showFirstSaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" onClick={() => setShowFirstSaleModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-200/50 shadow-2xl p-6 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">First sale!</h2>
            <p className="text-slate-300 mb-2">You earned money by writing code. Keep going to buy parts for Scrap!</p>
            <p className="text-amber-400 text-sm mb-6">💡 Bonus for speed — faster code = more $!</p>
            <button className="rounded-lg bg-amber-500 px-8 py-3 text-lg font-semibold text-slate-900 hover:bg-amber-400" onClick={() => setShowFirstSaleModal(false)}>Awesome!</button>
          </div>
        </div>
      )}

      {showControlsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4" onClick={() => setShowControlsModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-cyan-300/50 shadow-2xl p-8 text-slate-100" onClick={e => e.stopPropagation()}>
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
              <button autoFocus className="rounded-lg bg-cyan-500 px-8 py-3 text-lg font-semibold text-slate-900 hover:bg-cyan-400" onClick={() => {
                setShowControlsModal(false);
              }}>Got it!</button>
            </div>
          </div>
        </div>
      )}

      <TFB show={showBatteryDlg} step={batteryDlgStep} steps={BATTERY_DLG_STEPS} text={batteryDlgText}
        icon="robot" onEnter={() => {
          stopTts();
          const next = batteryDlgStep + 1;
          if (next < BATTERY_DLG_STEPS.length) { setBatteryDlgStep(next); } else {
            const bp = gameStore.get('backpack');
            if (!bp.includes('letter' as ScrapPartId)) {
              const newBackpack: ScrapPartId[] = [...bp, 'letter']; gameStore.set('backpack', newBackpack);
              fetch('/api/profile/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: newBackpack }), keepalive: true }).catch(() => {}); lastConfirmedBackpackRef.current = newBackpack;
            }
            setShowBatteryDlg(false); aptCutscenePhaseRef.current = 'done'; aptCutsceneTimerRef.current = 0;
          }
        }}
        ttsOn={ttsUtteranceRef.current !== null} ttsCharIdx={ttsCharIndexRef.current}
        onTtsToggle={onTtsToggle} />

      <TFB show={showWhoDlg} step={whoStep} steps={RAFIQ_GREET_STEPS} text={whoText}
        icon="person" onEnter={() => {
          stopTts(); const next = whoStep + 1;
          if (next < RAFIQ_GREET_STEPS.length) { setWhoStep(next); } else {
            setShowWhoDlg(false);
            if (rafiqWalkPhaseRef.current === 'greeting') {
              rafiqWalkPhaseRef.current = 'handing-letter'; rafiqCutsceneTimerRef.current = 0;
            }
          }
        }}
        ttsOn={ttsUtteranceRef.current !== null} ttsCharIdx={ttsCharIndexRef.current}
        onTtsToggle={onTtsToggle} />

      <TFB show={showRafiqLetterDlg} step={rafiqLetterStep} steps={RAFIQ_MEET_STEPS} text={rafiqLetterText}
        icon="person" onEnter={() => {
          stopTts(); const next = rafiqLetterStep + 1;
          if (next < RAFIQ_MEET_STEPS.length) {
            if (rafiqLetterStep === 0) consumeLetterInDialog(); setRafiqLetterStep(next);
          } else {
            setShowRafiqLetterDlg(false); rafiqWalkPhaseRef.current = 'idle';
            cutsceneActiveRef.current = false;
            const reLockEl2 = rendererRef.current?.domElement;
            if (reLockEl2 && document.pointerLockElement !== reLockEl2) {
              try { reLockEl2.requestPointerLock(); } catch {}
            }
            workshopIntroSeenRef.current = true; setWorkshopIntroSeen(true);
            fetch('/api/profile/workshop-intro', { method: 'POST', keepalive: true }).catch(() => {});
            if (roomOwnerVisualRef.current) {
              roomOwnerVisualRef.current.root.quaternion.copy(rafiqBaseQuatRef.current);
              if (roomOwnerVisualRef.current.rightArm) roomOwnerVisualRef.current.rightArm.rotation.z = -0.3;
            }
          }
        }}
        ttsOn={ttsUtteranceRef.current !== null} ttsCharIdx={ttsCharIndexRef.current}
        onTtsToggle={onTtsToggle} />

      <TFB show={showElectrocuteDlg} step={electrocuteStep} steps={cutsceneDlgSteps} text={electrocuteText}
        icon="auto" onEnter={() => {
          stopTts(); const next = electrocuteStep + 1;
          if (next < cutsceneDlgSteps.length) { setElectrocuteStep(next); } else {
            setShowElectrocuteDlg(false); electrocuteDlgShownRef.current = false;
            aptCutscenePhaseRef.current = 'walk-to-laptop'; aptCutsceneTimerRef.current = 0;
          }
        }}
        ttsOn={ttsUtteranceRef.current !== null} ttsCharIdx={ttsCharIndexRef.current}
        onTtsToggle={onTtsToggle} />

      <TFB show={showStringDlg} step={stringDlgStep} steps={stringDlgSteps} text={stringDlgText}
        icon="robot" codeBlocks onEnter={() => {
          stopTts(); const next = stringDlgStep + 1;
          if (next < stringDlgSteps.length) { setStringDlgStep(next); } else {
            setShowStringDlg(false);
            if (stringDlgIsHelpRef.current) { stringDlgIsHelpRef.current = false; setShowLaptopUI(true); }
            else { aptCutscenePhaseRef.current = 'laptop-ui'; aptCutsceneTimerRef.current = 0; }
          }
        }}
        ttsOn={ttsUtteranceRef.current !== null} ttsCharIdx={ttsCharIndexRef.current}
        onTtsToggle={onTtsToggle} />

      <TFB show={showDateDlg} step={dateDlgStep} steps={stringDlgIsHelpRef.current ? dateHelpSteps : dateDlgSteps} text={dateDlgText}
        icon="robot" codeBlocks onEnter={() => {
          stopTts(); const next = dateDlgStep + 1;
          const steps = stringDlgIsHelpRef.current ? dateHelpSteps : dateDlgSteps;
          if (next < steps.length) { setDateDlgStep(next); } else {
            setShowDateDlg(false);
            if (stringDlgIsHelpRef.current) { stringDlgIsHelpRef.current = false; setShowLaptopUI(true); }
            else { dateCodingShownRef.current = false; aptCutscenePhaseRef.current = 'date-coding'; aptCutsceneTimerRef.current = 0; }
          }
        }}
        ttsOn={ttsUtteranceRef.current !== null} ttsCharIdx={ttsCharIndexRef.current}
        onTtsToggle={onTtsToggle} />

      {showVersionDlg && (() => {
        const steps = stringDlgIsHelpRef.current ? versionHelpSteps : versionDlgSteps;
        const cur = steps[versionDlgStep] ?? steps[0];
        const ttsOn = ttsUtteranceRef.current !== null;
        const ttsBody = (() => {
          if (!ttsOn || ttsCharIndexRef.current === null) return versionDlgText.split(/(`[^`]+`)/g).map((seg, i) =>
            seg.startsWith('`') && seg.endsWith('`')
              ? <code key={i} className="font-mono text-amber-300 bg-slate-800 px-1.5 rounded">{seg.slice(1, -1)}</code>
              : seg
          );
          const bounds: Array<{ start: number; end: number }> = [];
          const re = /\S+/g; let m;
          while ((m = re.exec(cur.text)) !== null) bounds.push({ start: m.index, end: m.index + m[0].length });
          const w = bounds.find(b => ttsCharIndexRef.current! >= b.start && ttsCharIndexRef.current! < b.end);
          const txt = versionDlgText;
          const wrap = (s: string, cls?: string) => s.split(/(`[^`]+`)/g).map((seg, i) =>
            seg.startsWith('`') && seg.endsWith('`')
              ? <code key={i} className="font-mono text-amber-300 bg-slate-800 px-1.5 rounded">{seg.slice(1, -1)}</code>
              : <span key={i} className={cls}>{seg}</span>
          );
          if (!w || w.start > txt.length) return wrap(txt);
          return <>{wrap(txt.slice(0, w.start))}<span className="underline decoration-amber-400 decoration-2 underline-offset-4">{wrap(txt.slice(w.start, Math.min(w.end, txt.length)))}</span>{wrap(txt.slice(Math.min(w.end, txt.length)))}</>;
        })();
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
                  <button onClick={() => onTtsToggle(cur.text)} className="ml-auto p-1.5 rounded hover:bg-white/10 text-amber-300/70 hover:text-amber-300 transition-colors" title={ttsOn ? 'Stop' : 'Read aloud'}>
                    {ttsOn ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    )}
                  </button>
                </div>
                <p className="text-xl md:text-2xl text-slate-100 leading-relaxed font-medium min-h-[2rem]">
                  {ttsBody}<span className="animate-pulse text-amber-400/80">▌</span>
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
                      stopTts();
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

      <TFB show={showBootDlg} step={bootDlgStep} steps={stringDlgIsHelpRef.current ? bootHelpSteps : bootDlgSteps} text={bootDlgText}
        icon="robot" codeBlocks onEnter={() => {
          stopTts(); const next = bootDlgStep + 1;
          const steps = stringDlgIsHelpRef.current ? bootHelpSteps : bootDlgSteps;
          if (next < steps.length) { setBootDlgStep(next); } else {
            setShowBootDlg(false);
            if (stringDlgIsHelpRef.current) { stringDlgIsHelpRef.current = false; setShowLaptopUI(true); }
            else { bootCodingShownRef.current = false; aptCutscenePhaseRef.current = 'boot-coding'; aptCutsceneTimerRef.current = 0; }
          }
        }}
        ttsOn={ttsUtteranceRef.current !== null} ttsCharIdx={ttsCharIndexRef.current}
        onTtsToggle={onTtsToggle} />

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
              {/* Per-line TTS prompts — spec sheet style */}
              {(() => {
                const lines: string[] = laptopMode === 'name' ? ['String name = "Scrap";'] :
                  laptopMode === 'date' ? ['int year = 2026;', 'int month = 5;', 'int day = 6;'] :
                  laptopMode === 'version' ? ['double version = 1.0;', 'String mode = "normal";'] :
                  laptopMode === 'boot' ? ['boolean ready = true;'] : [];
                return lines.map((text, i) => {
                  const play = () => playLineTts(text);
                  const isPlaying = ttsActiveTextRef.current === text;
                  return (
                    <div key={i} className="flex items-center gap-1 mb-1 text-sm">
                      <span className="text-cyan-300 font-bold shrink-0 min-w-[1.2rem]">{i + 1})</span>
                      <span className="text-slate-100">{renderFormattedSpecLine(text)}</span>
                      <button onClick={play} className="shrink-0 p-1 rounded hover:bg-white/10 text-amber-300/70 hover:text-amber-300 transition-colors" title={isPlaying ? 'Stop' : 'Read aloud'}>
                        {isPlaying ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        )}
                      </button>
                    </div>
                  );
                });
              })()}
              <CodeInput
                value={laptopCode}
                onChange={(v) => { setLaptopCode(v); setLaptopOutput(''); setLaptopSuccess(false); setShowSemicolonArrow(false); }}
                autoFocus
                textareaClassName="bg-slate-950 text-amber-300 text-sm p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-500/60"
                minHeight={laptopMode === 'date' ? '7rem' : laptopMode === 'version' ? '7rem' : laptopMode === 'boot' ? '3.5rem' : '5.25rem'}
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

      {!rafiqCutsceneActive && !hideGameUiRef.current && backpack.length > 0 && (
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

      {missionModal.show && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70" onClick={() => setMissionModal({show: false, msg: ''})}>
          <div className="text-center animate-modal-pop">
            <div className="text-4xl font-bold text-amber-300 tracking-wider mb-4">⚡ NEW MISSION ⚡</div>
            <div className="text-2xl text-slate-100 font-medium">{missionModal.msg}</div>
            <div className="mt-6 text-sm text-slate-500 animate-pulse">click anywhere to continue</div>
          </div>
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
