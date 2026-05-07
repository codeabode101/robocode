'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '@/hooks/useMultiplayer';

interface GameMapProps {
  userId: string;
  apinatorAppKey: string;
  apinatorCluster: 'us' | 'eu';
}

const ISLAND_RADIUS = 12;
const PLAYER_RADIUS = 0.48;
const MOVE_SPEED = 5.4;
const NETWORK_SYNC_MS = 90;
const NPC_POSITION = new THREE.Vector2(3.6, 1.8);
const WALK_BOB_SPEED = 14;
const REMOTE_LERP = 0.18;

type RobotVisual = {
  root: THREE.Group;
  nameSprite: THREE.Sprite;
  body: THREE.Mesh;
  shadow: THREE.Mesh;
  leftPupil: THREE.Mesh;
  rightPupil: THREE.Mesh;
  antennaTip: THREE.Mesh;
};

type RemoteAvatar = {
  visual: RobotVisual;
  target: THREE.Vector2;
  name: string;
  walkTime: number;
};

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function highlightJava(input: string) {
  let highlighted = escapeHtml(input);
  highlighted = highlighted.replace(
    /\b(String|int|double|boolean|char|float|long|short|byte)\b/g,
    '<span style="color:#60a5fa">$1</span>'
  );
  highlighted = highlighted.replace(
    /("[^"\n]*")/g,
    '<span style="color:#f59e0b">$1</span>'
  );
  highlighted = highlighted.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?=\s*=)/g,
    '<span style="color:#a78bfa">$1</span>'
  );
  return highlighted;
}

function hashColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  const color = new THREE.Color();
  color.setHSL(hue / 360, 0.72, 0.58);
  return color;
}

function createNameSprite(label: string, color: THREE.Color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const context = canvas.getContext('2d');
  if (!context) {
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(material);
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(8, 15, 30, 0.68)';
  context.strokeStyle = `#${color.getHexString()}`;
  context.lineWidth = 3;
  const radius = 14;
  const width = canvas.width - 20;
  const height = canvas.height - 20;
  const x = 10;
  const y = 10;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = '#f8fafc';
  context.font = '700 26px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.9, 0.82, 1);
  sprite.position.set(0, 1.15, 0.3);
  return sprite;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        const materialWithMap = m as THREE.Material & { map?: THREE.Texture };
        if (materialWithMap.map) materialWithMap.map.dispose();
        m.dispose();
      });
    } else if (mat) {
      const materialWithMap = mat as THREE.Material & { map?: THREE.Texture };
      if (materialWithMap.map) materialWithMap.map.dispose();
      mat.dispose();
    }
  });
}

function createRoundedRectGeometry(width: number, height: number, radius: number) {
  const halfW = width / 2;
  const halfH = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + radius, -halfH);
  shape.lineTo(halfW - radius, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + radius);
  shape.lineTo(halfW, halfH - radius);
  shape.quadraticCurveTo(halfW, halfH, halfW - radius, halfH);
  shape.lineTo(-halfW + radius, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - radius);
  shape.lineTo(-halfW, -halfH + radius);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + radius, -halfH);
  return new THREE.ShapeGeometry(shape);
}

function createRobotVisual(color: THREE.Color, name: string) {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
  );
  shadow.scale.set(1.08, 0.62, 1);
  shadow.position.set(0, -0.1, 0.19);
  group.add(shadow);

  const feet = new THREE.Mesh(
    createRoundedRectGeometry(0.52, 0.17, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x1f2937 })
  );
  feet.position.set(0, -0.42, 0.23);
  group.add(feet);

  const body = new THREE.Mesh(
    createRoundedRectGeometry(0.95, 0.94, 0.28),
    new THREE.MeshBasicMaterial({ color })
  );
  body.position.set(0, 0.02, 0.24);
  group.add(body);

  const facePanel = new THREE.Mesh(
    createRoundedRectGeometry(0.62, 0.5, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })
  );
  facePanel.position.set(0, 0.12, 0.25);
  group.add(facePanel);

  const belly = new THREE.Mesh(
    createRoundedRectGeometry(0.45, 0.25, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc })
  );
  belly.position.set(0, -0.18, 0.25);
  group.add(belly);

  const armLeft = new THREE.Mesh(
    createRoundedRectGeometry(0.14, 0.36, 0.06),
    new THREE.MeshBasicMaterial({ color })
  );
  armLeft.position.set(-0.58, -0.03, 0.22);
  armLeft.rotation.z = 0.15;
  group.add(armLeft);

  const armRight = armLeft.clone();
  armRight.position.x = 0.58;
  armRight.rotation.z = -0.15;
  group.add(armRight);

  const cheekLeft = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 12),
    new THREE.MeshBasicMaterial({ color: 0xfda4af, transparent: true, opacity: 0.9 })
  );
  cheekLeft.position.set(-0.2, -0.01, 0.26);
  group.add(cheekLeft);

  const cheekRight = cheekLeft.clone();
  cheekRight.position.x = 0.2;
  group.add(cheekRight);

  const eyeLeft = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  eyeLeft.position.set(-0.15, 0.16, 0.26);
  group.add(eyeLeft);

  const eyeRight = eyeLeft.clone();
  eyeRight.position.x = 0.15;
  group.add(eyeRight);

  const leftPupil = new THREE.Mesh(
    new THREE.CircleGeometry(0.034, 12),
    new THREE.MeshBasicMaterial({ color: 0x0f172a })
  );
  leftPupil.position.set(-0.15, 0.16, 0.27);
  group.add(leftPupil);

  const rightPupil = leftPupil.clone();
  rightPupil.position.x = 0.15;
  group.add(rightPupil);

  const antennaStem = new THREE.Mesh(
    new THREE.PlaneGeometry(0.06, 0.18),
    new THREE.MeshBasicMaterial({ color: 0x64748b })
  );
  antennaStem.position.set(0, 0.58, 0.26);
  group.add(antennaStem);

  const antennaTip = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 14),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e })
  );
  antennaTip.position.set(0, 0.7, 0.27);
  group.add(antennaTip);

  const nameSprite = createNameSprite(name, color);
  group.add(nameSprite);

  return { root: group, nameSprite, body, shadow, leftPupil, rightPupil, antennaTip };
}

function createGrid(size: number, step: number, color: number) {
  const points: number[] = [];
  for (let i = -size; i <= size; i += step) {
    points.push(-size, i, 0.12, size, i, 0.12);
    points.push(i, -size, 0.12, i, size, 0.12);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.18 });
  return new THREE.LineSegments(geometry, material);
}

function createPalmTree(x: number, y: number) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    createRoundedRectGeometry(0.24, 1.25, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x8b5a2b })
  );
  trunk.position.set(x, y, 0.2);
  tree.add(trunk);

  const leafMaterial = new THREE.MeshBasicMaterial({ color: 0x2e9f59 });
  for (let i = 0; i < 5; i += 1) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.35, 18), leafMaterial);
    const angle = (Math.PI * 2 * i) / 5;
    leaf.scale.set(1.5, 0.65, 1);
    leaf.position.set(x + Math.cos(angle) * 0.26, y + 0.7 + Math.sin(angle) * 0.22, 0.22);
    leaf.rotation.z = angle;
    tree.add(leaf);
  }
  return tree;
}

function animateRobotVisual(visual: RobotVisual, time: number, speedFactor: number, lookX: number, lookY: number) {
  const walkAmount = Math.min(1, speedFactor);
  const bob = Math.sin(time * WALK_BOB_SPEED) * 0.035 * walkAmount;
  visual.body.position.y = 0.02 + bob;
  visual.shadow.scale.set(1.08 + walkAmount * 0.06, 0.62 - walkAmount * 0.07, 1);
  visual.antennaTip.position.y = 0.7 + Math.sin(time * 9) * 0.02;

  const blink = Math.max(0.12, Math.abs(Math.sin(time * 0.7)) > 0.98 ? 0.25 : 1);
  visual.leftPupil.scale.y = blink;
  visual.rightPupil.scale.y = blink;

  const eyeX = Math.max(-0.02, Math.min(0.02, lookX * 0.018));
  const eyeY = Math.max(-0.02, Math.min(0.02, lookY * 0.018));
  visual.leftPupil.position.x = -0.15 + eyeX;
  visual.rightPupil.position.x = 0.15 + eyeX;
  visual.leftPupil.position.y = 0.16 + eyeY;
  visual.rightPupil.position.y = 0.16 + eyeY;
}

export default function GameMap({ userId, apinatorAppKey, apinatorCluster }: GameMapProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLTextAreaElement>(null);
  const codePreviewRef = useRef<HTMLPreElement>(null);
  const { players, connected, sendPosition } = useMultiplayer(userId, apinatorAppKey, apinatorCluster);

  const localPositionRef = useRef(new THREE.Vector2(0, 0));
  const localRobotRef = useRef<RobotVisual | null>(null);
  const remoteAvatarsRef = useRef<Record<string, RemoteAvatar>>({});
  const keyStateRef = useRef<Set<string>>(new Set());
  const showTutorialRef = useRef(false);
  const sendAtRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [code, setCode] = useState('String robotName = "Sparky";');
  const [output, setOutput] = useState('');
  const [success, setSuccess] = useState(false);
  const [sparkleBurst, setSparkleBurst] = useState(false);

  const highlightedCode = useMemo(() => highlightJava(code), [code]);

  const tutorialSteps = [
    {
      npcText:
        "Hey coder! I'm Sparky 🤖. I need a cool name tag before I can join your team. Let's learn variables!",
      showEditor: false,
    },
    {
      npcText:
        'In Java, variables store info. For text, we use <code>String</code>. Example: <code>String petName = "Nova";</code>',
      showEditor: false,
    },
    {
      npcText:
        'Your turn! Type this exactly: <code>String robotName = "Sparky";</code> then press Run ✨',
      showEditor: true,
    },
  ];

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
    if (connected) {
      fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: localPositionRef.current.x, y: localPositionRef.current.y }),
      });
    }
  }, [connected]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mountElement = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ed6ff);
    sceneRef.current = scene;

    const aspect = mountElement.clientWidth / mountElement.clientHeight;
    const viewHeight = 24;
    const camera = new THREE.OrthographicCamera(
      (-viewHeight * aspect) / 2,
      (viewHeight * aspect) / 2,
      viewHeight / 2,
      -viewHeight / 2,
      0.1,
      100
    );
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountElement.clientWidth, mountElement.clientHeight);
    mountElement.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 30),
      new THREE.MeshBasicMaterial({ color: 0xffe066 })
    );
    sun.position.set(8.5, 6.8, 0.02);
    scene.add(sun);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(ISLAND_RADIUS + 7, 80),
      new THREE.MeshBasicMaterial({ color: 0x4aa6ff })
    );
    water.position.z = 0;
    scene.add(water);

    const beach = new THREE.Mesh(
      new THREE.RingGeometry(ISLAND_RADIUS - 0.9, ISLAND_RADIUS + 1, 80),
      new THREE.MeshBasicMaterial({ color: 0xf5d17c })
    );
    beach.position.z = 0.05;
    scene.add(beach);

    const island = new THREE.Mesh(
      new THREE.CircleGeometry(ISLAND_RADIUS, 80),
      new THREE.MeshBasicMaterial({ color: 0x5ac66f })
    );
    island.position.z = 0.08;
    scene.add(island);
    scene.add(createGrid(ISLAND_RADIUS - 1, 1, 0x2b7a38));

    const palmTrees = [
      createPalmTree(-8.5, 4.6),
      createPalmTree(8.1, 4.9),
      createPalmTree(-6.8, -5.6),
      createPalmTree(7.2, -6),
    ];
    palmTrees.forEach((tree) => scene.add(tree));

    const flowers = new THREE.Group();
    for (let i = 0; i < 18; i += 1) {
      const flower = new THREE.Mesh(
        new THREE.CircleGeometry(0.08, 10),
        new THREE.MeshBasicMaterial({
          color: [0xff7ab6, 0xfff06a, 0x7ee6ff][i % 3],
        })
      );
      const angle = (Math.PI * 2 * i) / 18;
      const radius = 5.8 + (i % 4) * 0.8;
      flower.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.16);
      flowers.add(flower);
    }
    scene.add(flowers);

    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 3; i += 1) {
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
      cloud.position.set(-10 + i * 8.5, 8 - i * 0.8, 0.02);
      clouds.push(cloud);
      scene.add(cloud);
    }

    const localColor = hashColor(userId || 'local-user');
    const localRobot = createRobotVisual(localColor, 'You');
    localRobot.root.position.set(0, 0, 0);
    localPositionRef.current.set(0, 0);
    scene.add(localRobot.root);
    localRobotRef.current = localRobot;

    const sparky = createRobotVisual(new THREE.Color(0xfacc15), 'Sparky');
    sparky.root.position.set(NPC_POSITION.x, NPC_POSITION.y, 0.01);
    scene.add(sparky.root);

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const nextAspect = mountElement.clientWidth / mountElement.clientHeight;
      const nextHeight = 24;
      cameraRef.current.left = (-nextHeight * nextAspect) / 2;
      cameraRef.current.right = (nextHeight * nextAspect) / 2;
      cameraRef.current.top = nextHeight / 2;
      cameraRef.current.bottom = -nextHeight / 2;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountElement.clientWidth, mountElement.clientHeight);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastTime = performance.now();
    const animate = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const worldTime = now / 1000;

      let moved = false;
      let moveDirection = new THREE.Vector2(0, 0);
      if (!showTutorialRef.current) {
        let dx = 0;
        let dy = 0;
        const keys = keyStateRef.current;
        if (keys.has('arrowup') || keys.has('w')) dy += 1;
        if (keys.has('arrowdown') || keys.has('s')) dy -= 1;
        if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
        if (keys.has('arrowright') || keys.has('d')) dx += 1;

        if (dx || dy) {
          moved = true;
          const direction = new THREE.Vector2(dx, dy).normalize();
          moveDirection = direction;
          const candidate = localPositionRef.current
            .clone()
            .add(direction.multiplyScalar(MOVE_SPEED * delta));
          const maxRadius = ISLAND_RADIUS - PLAYER_RADIUS - 0.35;
          if (candidate.length() > maxRadius) candidate.setLength(maxRadius);
          localPositionRef.current.copy(candidate);
          localRobot.root.position.set(candidate.x, candidate.y, 0.01);
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

      const lookDirection = moved ? moveDirection : new THREE.Vector2(0.3, 0);
      animateRobotVisual(localRobot, worldTime, moved ? 1 : 0, lookDirection.x, lookDirection.y);

      const distanceToSparky = localPositionRef.current.distanceTo(NPC_POSITION);
      if (distanceToSparky < 1.7 && !showTutorialRef.current) {
        setShowTutorial(true);
        setTutorialStep(0);
      } else if (distanceToSparky > 2.25 && showTutorialRef.current) {
        setShowTutorial(false);
        setTutorialStep(0);
        setSuccess(false);
        setOutput('');
      }

      const bob = Math.sin(now * 0.006) * 0.04;
      sparky.root.position.z = 0.01 + bob;
      animateRobotVisual(sparky, worldTime, 0.35, -0.3, 0.15);

      for (const avatar of Object.values(remoteAvatarsRef.current)) {
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

      camera.position.x += (localPositionRef.current.x * 0.12 - camera.position.x) * 0.06;
      camera.position.y += (localPositionRef.current.y * 0.12 - camera.position.y) * 0.06;
      camera.lookAt(camera.position.x, camera.position.y, 0);

      renderer.render(scene, camera);
      rafRef.current = window.requestAnimationFrame(animate);
    };

    rafRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      Object.values(remoteAvatarsRef.current).forEach((avatar) => disposeObject(avatar.visual.root));
      remoteAvatarsRef.current = {};
      disposeObject(localRobot.root);
      disposeObject(sparky.root);
      palmTrees.forEach((tree) => disposeObject(tree));
      disposeObject(flowers);
      clouds.forEach((cloud) => disposeObject(cloud));
      scene.clear();
      renderer.dispose();
      mountElement.removeChild(renderer.domElement);
      rendererRef.current = null;
    };
  }, [sendPosition, userId]);

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
        scene.add(visual.root);
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
      scene.remove(avatar.visual.root);
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
    try {
      const res = await fetch('/api/tutorial/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, concept: 'string-variable' }),
      });
      const data = await res.json();

      if (data.valid) {
        setSuccess(true);
        setSparkleBurst(true);
        setOutput('✅ Sparky is thrilled! You just created your first Java variable.');
        playHappyChime();
        setTimeout(() => setSparkleBurst(false), 900);
        setTimeout(() => {
          setShowTutorial(false);
          setTutorialStep(0);
          setSuccess(false);
          setOutput('');
        }, 1800);
      } else {
        setOutput(`❌ ${data.error || 'Almost there — try again!'}`);
      }
    } catch {
      setOutput('❌ Oops! Could not validate right now.');
    }
  };

  return (
    <div className="relative">
      <div className="w-full h-screen" ref={mountRef} />

      <div className="absolute top-4 left-4 bg-black/45 text-white text-sm px-3 py-1 rounded-full">
        {connected ? `🟢 Live island • ${Object.keys(players).length + 1} robots` : '🟡 Connecting to island...'}
      </div>

      <div className="absolute bottom-4 left-4 bg-black/40 text-white text-xs md:text-sm px-3 py-2 rounded-lg">
        Arrow Keys / WASD to move • Meet Sparky 🤖 • Type your first Java variable
      </div>

      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
            {sparkleBurst && (
              <div className="pointer-events-none absolute inset-0">
                <span className="absolute left-8 top-6 text-yellow-300 animate-ping">✨</span>
                <span className="absolute right-10 top-12 text-pink-300 animate-ping">✨</span>
                <span className="absolute right-16 bottom-8 text-cyan-300 animate-ping">✨</span>
              </div>
            )}

            <div className="flex items-start gap-4 mb-5">
              <div className={`text-4xl ${success ? 'animate-bounce' : ''}`}>🤖</div>
              <div className="flex-1">
                <h2 className="text-white text-xl font-bold">Sparky</h2>
                <p
                  className="text-slate-200 mt-1"
                  dangerouslySetInnerHTML={{ __html: tutorialSteps[tutorialStep].npcText }}
                />
              </div>
            </div>

            {tutorialSteps[tutorialStep].showEditor && (
              <div className="mb-4">
                <div className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
                  <div className="px-3 py-2 text-xs text-slate-300 border-b border-slate-800">
                    Java Editor
                  </div>
                  <div className="relative h-32">
                    <pre
                      ref={codePreviewRef}
                      className="absolute inset-0 m-0 p-3 overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-slate-100"
                      dangerouslySetInnerHTML={{ __html: `${highlightedCode}\n` }}
                    />
                    <textarea
                      ref={codeInputRef}
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      onScroll={onEditorScroll}
                      spellCheck={false}
                      className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-3 font-mono text-sm leading-6 text-transparent caret-green-300"
                    />
                  </div>
                </div>
                {output && (
                  <div
                    className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                      success ? 'bg-emerald-900/70 text-emerald-100' : 'bg-rose-900/70 text-rose-100'
                    }`}
                  >
                    {output}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {tutorialSteps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full ${
                      tutorialStep === i ? 'bg-blue-500' : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>

              {tutorialStep < tutorialSteps.length - 1 ? (
                <button
                  onClick={() => setTutorialStep((step) => step + 1)}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-white font-semibold hover:bg-blue-500"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={checkAnswer}
                  disabled={success}
                  className={`rounded-lg px-5 py-2 font-semibold ${
                    success
                      ? 'bg-emerald-600 text-white cursor-not-allowed'
                      : 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                  }`}
                >
                  {success ? 'Sparky is happy! 🎉' : 'Run Code'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
