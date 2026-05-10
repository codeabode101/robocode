'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '@/hooks/useMultiplayer';

interface GameMapProps {
  userId: string;
  apinatorAppKey: string;
  apinatorCluster: 'us' | 'eu';
}

const ISLAND_RADIUS = 40;
const PLAYER_RADIUS = 0.48;
const MOVE_SPEED = 7.4;
const NETWORK_SYNC_MS = 90;
const NPC_POSITION = new THREE.Vector2(3.6, 1.8);
const WALK_BOB_SPEED = 14;
const REMOTE_LERP = 0.18;
const CAMERA_OFFSET = new THREE.Vector3(0, -22, 34);
const CAMERA_LOOK_AHEAD = new THREE.Vector3(0, 4.0, 0);
const ROOM_SPAWN = new THREE.Vector2(0, -3.7);
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
const MASALA_CHAI_SHOP_POS = new THREE.Vector2(-3.85, -1.8);
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

type RobotVisual = {
  root: THREE.Group;
  nameSprite: THREE.Sprite;
  body: THREE.Mesh;
  shadow: THREE.Mesh;
  leftPupil: THREE.Object3D; // sprite or mesh
  rightPupil: THREE.Object3D;
  antennaTip: THREE.Mesh;
};

type RemoteAvatar = {
  visual: RobotVisual;
  target: THREE.Vector2;
  name: string;
  walkTime: number;
};

type HumanVisual = {
  root: THREE.Group;
  nameSprite: THREE.Sprite;
};

type CustomerProperty = 'name' | 'color' | 'size';

type CustomerRequest = {
  customerName: string;
  petName: string;
  petColor: string;
  petSize: number;
  required: CustomerProperty[];
};

type SparkyQuestStage = 'intro' | 'earn-money' | 'buy-chai' | 'gift-ready' | 'done';

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

type TutorialChallenge = {
  concept: 'string-name' | 'string-color' | 'int-age';
  title: string;
  prompt: string;
  hint: string;
  starterCode: string;
};

type TutorialPhase =
  | {
      kind: 'dialogue';
      npcText: string;
    }
  | ({
      kind: 'challenge';
      npcText: string;
    } & TutorialChallenge);

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

function createLabelSprite(
  label: string,
  textColor: string,
  backgroundColor: string,
  borderColor: string,
  canvasWidth = 256,
  canvasHeight = 72,
  paddingX = 10,
  paddingY = 10,
  fontSize = 26
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(material);
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = backgroundColor;
  context.strokeStyle = borderColor;
  context.lineWidth = 3;
  const radius = Math.min(14, Math.max(6, Math.min(canvas.width, canvas.height) * 0.18));
  const boxWidth = canvas.width - paddingX * 2;
  const boxHeight = canvas.height - paddingY * 2;
  const x = paddingX;
  const y = paddingY;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + boxWidth - radius, y);
  context.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
  context.lineTo(x + boxWidth, y + boxHeight - radius);
  context.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
  context.lineTo(x + radius, y + boxHeight);
  context.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = textColor;
  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  const textMetrics = context.measureText(label);
  const textLeft = paddingX - (textMetrics.actualBoundingBoxLeft || 0);
  context.fillText(label, textLeft, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  return new THREE.Sprite(material);
}

function createNameSprite(label: string, color: THREE.Color) {
  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  let textWidth = 48;
  let textBoundsWidth = 48;
  if (measureContext) {
    measureContext.font = '700 26px system-ui, sans-serif';
    const metrics = measureContext.measureText(label);
    textWidth = Math.ceil(metrics.width);
    textBoundsWidth = Math.ceil((metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || metrics.width));
  }
  const paddingX = 4;
  const paddingY = 4;
  const canvasWidth = Math.max(38, Math.min(150, Math.max(textWidth, textBoundsWidth) + paddingX * 2));
  const canvasHeight = 40;
  const sprite = createLabelSprite(
    label,
    '#f8fafc',
    'rgba(8, 15, 30, 0.72)',
    `#${color.getHexString()}`,
    canvasWidth,
    canvasHeight,
    paddingX,
    paddingY,
    22
  );
  sprite.scale.set((canvasWidth / canvasHeight) * 0.82, 0.6, 1);
  sprite.center.set(0.5, 0.05);
  sprite.position.set(0, 2.22, 0.96);
  sprite.renderOrder = 40;
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

function createLitMaterial(color: number | THREE.Color, roughness = 0.78, metalness = 0.06) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function applyShadows(object: THREE.Object3D, cast = true, receive = true) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
  });
}

function createRobotVisual(color: THREE.Color, name: string) {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
  );
  shadow.scale.set(1.3, 0.8, 1);
  shadow.position.set(0, -0.12, 0.25);
  group.add(shadow);

  const feet = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.22, 0.28),
    createLitMaterial(0x1f2937, 0.62, 0.2)
  );
  feet.position.set(0, -0.5, 0.38);
  group.add(feet);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 1.3, 0.3),
    createLitMaterial(color, 0.7, 0.07)
  );
  body.position.set(0, 0.1, 0.5);
  group.add(body);

  const armLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.42, 0.14),
    createLitMaterial(color, 0.72, 0.06)
  );
  armLeft.position.set(-0.44, 0.18, 0.36);
  armLeft.rotation.z = 0.08;
  group.add(armLeft);

  const armRight = armLeft.clone();
  armRight.position.x = 0.44;
  armRight.rotation.z = -0.08;
  group.add(armRight);

  const facePanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.42, 0.08),
    createLitMaterial(0xe2e8f0, 0.5, 0.15)
  );
  facePanel.position.set(0, 0.93, 0.15);
  group.add(facePanel);

  // build each eye as a small group so pupil movement is local to the eye
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.position.set(-0.11, 0.97, 0.26);
  const eyeLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xd1d5db })
  );
  eyeLeft.position.set(0, 0, 0);
  leftEyeGroup.add(eyeLeft);

  // create small mesh pupils (mesh is simpler and avoids sprite depth/layer issues)
  const createPupilMesh = () => {
    const geom = new THREE.SphereGeometry(0.024, 10, 10);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x050505,
      depthTest: false,
      depthWrite: false,
    });
    const pupil = new THREE.Mesh(geom, mat);
    pupil.renderOrder = 50;
    return pupil;
  };

  const leftPupil = createPupilMesh();
  // place slightly in front of the eye sphere so it reads as a pupil
  leftPupil.position.set(0, 0, 0.06);
  leftEyeGroup.add(leftPupil);
  group.add(leftEyeGroup);

  // build right eye separately (avoid clone and shared references)
  const rightEyeGroup = new THREE.Group();
  rightEyeGroup.position.set(0.11, 0.97, 0.26);
  const eyeRight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xd1d5db })
  );
  eyeRight.position.set(0, 0, 0);
  rightEyeGroup.add(eyeRight);
  const rightPupil = createPupilMesh();
  rightPupil.position.set(0, 0, 0.06);
  rightEyeGroup.add(rightPupil);
  group.add(rightEyeGroup);

  const antennaStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.18, 10),
    createLitMaterial(0x64748b, 0.4, 0.45)
  );
  antennaStem.position.set(0, 1.32, 0.18);
  group.add(antennaStem);

  const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 12),
    createLitMaterial(0xf43f5e, 0.5, 0.18)
  );
  antennaTip.position.set(0, 1.44, 0.18);
  group.add(antennaTip);

  const nameSprite = createNameSprite(name, color);
  group.add(nameSprite);
  applyShadows(group, true, true);

  // Rotate y-up geometry into the world's z-up orientation.
  group.rotation.set(Math.PI / 2, 0, 0);
  group.scale.set(2.35, 2.35, 2.35);
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
  tree.position.set(x, y, 0);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 2.6, 12),
    createLitMaterial(0x8b5a2b, 0.85, 0.05)
  );
  trunk.position.set(0, 0, 1.4);
  trunk.rotation.set(Math.PI / 2, 0, 0);
  tree.add(trunk);

  const leafMaterial = createLitMaterial(0x2e9f59, 0.9, 0.02);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), leafMaterial);
    const angle = (Math.PI * 2 * i) / 6;
    // position leaves higher and make them sweep upward so trees read as vertical
    leaf.scale.set(2.4, 1.1, 0.9);
    leaf.position.set(Math.cos(angle) * 0.5, Math.sin(angle) * 0.35, 2.85);
    leaf.rotation.set(Math.PI / 2 - 0.3, 0, angle);
    tree.add(leaf);
  }
  // ensure tree group is upright
  tree.rotation.set(0, 0, 0);
  applyShadows(tree, true, true);
  return tree;
}

function createBazaarShop(
  x: number,
  y: number,
  baseColor: number,
  awningColor: number,
  label: string
) {
  const stall = new THREE.Group();

  const baseShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 })
  );
  baseShadow.scale.set(1.28, 0.72, 1);
  baseShadow.position.set(x, y - 0.08, 0.12);
  stall.add(baseShadow);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 1.06, 0.56),
    createLitMaterial(baseColor, 0.74, 0.06)
  );
  wall.position.set(x, y, 0.42);
  stall.add(wall);

  const doorway = new THREE.Mesh(
    createRoundedRectGeometry(0.5, 0.66, 0.1),
    createLitMaterial(0x111827, 0.4, 0.3)
  );
  doorway.position.set(x, y - 0.13, 0.71);
  stall.add(doorway);

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.44, 0.24),
    createLitMaterial(awningColor, 0.68, 0.1)
  );
  awning.position.set(x, y + 0.52, 0.7);
  stall.add(awning);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.08, 0.25),
    createLitMaterial(0xf8fafc, 0.55, 0.12)
  );
  trim.position.set(x, y + 0.33, 0.7);
  stall.add(trim);

  const sign = createLabelSprite(
    label,
    '#fff7ed',
    'rgba(2, 6, 23, 0.88)',
    '#fbbf24',
    280,
    78
  );
  sign.scale.set(2.45, 0.72, 1);
  sign.center.set(0.5, 0);
  sign.position.set(x, y + 0.96, 1.1);
  sign.renderOrder = 30;
  stall.add(sign);

  const lampLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 12),
    createLitMaterial(0xfef08a, 0.3, 0.3)
  );
  lampLeft.position.set(x - 0.58, y + 0.32, 0.89);
  stall.add(lampLeft);

  const lampRight = lampLeft.clone();
  lampRight.position.x = x + 0.58;
  stall.add(lampRight);

  // make bazaar stalls feel like separate storefronts instead of a tight row
  stall.scale.set(3.12, 3.12, 3.12);
  applyShadows(stall, true, true);
  return stall;
}

function createRangoli(x: number, y: number) {
  const rangoli = new THREE.Group();
  const colors = [0xfb7185, 0xfacc15, 0x60a5fa, 0x34d399];

  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 14, 14),
    createLitMaterial(0xffffff, 0.42, 0.15)
  );
  center.position.set(x, y, 0.2);
  rangoli.add(center);

  for (let i = 0; i < 8; i += 1) {
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      createLitMaterial(colors[i % colors.length], 0.68, 0.06)
    );
    const angle = (Math.PI * 2 * i) / 8;
    petal.position.set(x + Math.cos(angle) * 0.24, y + Math.sin(angle) * 0.24, 0.2);
    petal.scale.set(1.2, 0.72, 0.6);
    petal.rotation.z = angle;
    rangoli.add(petal);
  }
  applyShadows(rangoli, true, true);

  return rangoli;
}

function createBigPetShop(x: number, y: number) {
  const shop = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8.1, 5.1, 2.55),
    createLitMaterial(0xf8bbd0, 0.7, 0.06)
  );
  base.position.set(x, y, 1.8);
  shop.add(base);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(9, 2.025, 2.85),
    createLitMaterial(0x2563eb, 0.62, 0.08)
  );
  roof.position.set(x, y + 2.9, 3.4);
  shop.add(roof);

  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.325, 0.42, 3.15),
    createLitMaterial(0xfde68a, 0.55, 0.14)
  );
  doorFrame.position.set(x, y - 2.34, 1.9);
  shop.add(doorFrame);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.27, 2.7),
    createLitMaterial(0x0f172a, 0.36, 0.35)
  );
  door.position.set(x, y - 2.38, 1.9);
  shop.add(door);

  const doorWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.15, 0.57),
    createLitMaterial(0x93c5fd, 0.2, 0.45)
  );
  doorWindow.position.set(x, y - 2.48, 2.6);
  shop.add(doorWindow);

  const doormat = new THREE.Mesh(
    new THREE.BoxGeometry(2.175, 1.11, 0.12),
    createLitMaterial(0x7c3aed, 0.7, 0.08)
  );
  doormat.position.set(x, y - 3.54, 0.28);
  shop.add(doormat);

  const doorLabel = createLabelSprite('ENTER', '#0f172a', 'rgba(253,224,71,0.95)', '#f8fafc', 160, 74);
  doorLabel.scale.set(2.4, 0.9, 1);
  doorLabel.center.set(0.5, 0);
  doorLabel.position.set(x, y - 2.38, 3.25);
  doorLabel.renderOrder = 36;
  shop.add(doorLabel);

  const sign = createLabelSprite('PET WORKSHOP', '#f8fafc', 'rgba(15,23,42,0.92)', '#fde68a', 360, 90);
  sign.scale.set(5.78, 1.6, 1);
  sign.center.set(0.5, 0);
  sign.position.set(x, y + 2.9, 4.5);
  sign.renderOrder = 32;
  shop.add(sign);

  applyShadows(shop, true, true);
  return shop;
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createHumanVisual(name: string) {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
  );
  shadow.scale.set(1.08, 0.62, 1);
  shadow.position.set(0, -0.1, 0.15);
  group.add(shadow);

  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.2, 0.18),
    createLitMaterial(0x1e293b, 0.72, 0.08)
  );
  legs.position.set(0, -0.35, 0.24);
  group.add(legs);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.66, 0.26),
    createLitMaterial(0x2563eb, 0.6, 0.1)
  );
  body.position.set(0, 0.02, 0.42);
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    createLitMaterial(0xfccca5, 0.5, 0.08)
  );
  head.position.set(0, 0.48, 0.55);
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 16),
    createLitMaterial(0x1f2937, 0.7, 0.06)
  );
  hair.scale.set(1, 0.72, 0.8);
  hair.position.set(0, 0.58, 0.62);
  group.add(hair);

  const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), createLitMaterial(0x0f172a, 0.5, 0.2));
  eyeLeft.position.set(-0.07, 0.5, 0.74);
  group.add(eyeLeft);

  const eyeRight = eyeLeft.clone();
  eyeRight.position.x = 0.07;
  group.add(eyeRight);

  const nameSprite = createNameSprite(name, new THREE.Color(0x22c55e));
  group.add(nameSprite);

  applyShadows(group, true, true);
  group.rotation.set(Math.PI / 2, 0, 0);
  group.scale.set(3.0, 3.0, 3.0);
  return { root: group, nameSprite };
}

function validateWorkshopCode(input: string, request: CustomerRequest) {
  const normalized = input.replace(/\s+/g, ' ').trim();
  const escapedName = request.petName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedColor = request.petColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = new RegExp(`String\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*"${escapedName}"\\s*;`, 'i');
  const colorPattern = new RegExp(`String\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*"${escapedColor}"\\s*;`, 'i');
  const sizePattern = new RegExp(`int\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*${request.petSize}\\s*;`);

  for (const requirement of request.required) {
    if (requirement === 'name' && !namePattern.test(normalized)) {
      return { valid: false, error: `Need a String line for pet name "${request.petName}".` };
    }
    if (requirement === 'color' && !colorPattern.test(normalized)) {
      return { valid: false, error: `Need a String line for pet color "${request.petColor}".` };
    }
    if (requirement === 'size' && !sizePattern.test(normalized)) {
      return { valid: false, error: `Need an int line for pet size ${request.petSize}.` };
    }
  }

  return { valid: true, error: '' };
}

function getWorkshopRequestSignature(request: CustomerRequest) {
  return `${request.required.slice().sort().join('+')}|${request.petName}|${request.petColor}|${request.petSize}`;
}

function animateRobotVisual(visual: RobotVisual, time: number, speedFactor: number, lookX: number, lookY: number) {
  const walkAmount = Math.min(1, speedFactor);
  const bob = Math.sin(time * WALK_BOB_SPEED) * 0.035 * walkAmount;
  visual.body.position.y = 0.02 + bob;
  visual.shadow.scale.set(1.08 + walkAmount * 0.06, 0.62 - walkAmount * 0.07, 1);
  // keep antenna around its original head height and bob slightly (use original create height 1.44)
  if (visual.antennaTip) visual.antennaTip.position.y = 1.44 + Math.sin(time * 9) * 0.02;

  // ensure pupils have steady scale (sprites won't pulse)
  if (visual.leftPupil.scale) visual.leftPupil.scale.set(1, 1, 1);
  if (visual.rightPupil.scale) visual.rightPupil.scale.set(1, 1, 1);

  const eyeX = Math.max(-0.035, Math.min(0.035, lookX * 0.03));
  const eyeY = Math.max(-0.02, Math.min(0.02, lookY * 0.02));
  // Pupils are sprites attached to their eye groups; move them locally so each eye keeps its own pupil.
  visual.leftPupil.position.set(eyeX, eyeY, 0.035);
  visual.rightPupil.position.set(eyeX, eyeY, 0.035);
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
  const tutorialCompleteRef = useRef(false);
  const shopUnlockedRef = useRef(false);
  const inWorkshopRoomRef = useRef(false);
  const sendAtRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const petShopRef = useRef<THREE.Group | null>(null);
  const petShopMarkerRef = useRef<THREE.Sprite | null>(null);
  const outdoorGroupRef = useRef<THREE.Group | null>(null);
  const workshopRoomGroupRef = useRef<THREE.Group | null>(null);
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

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
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

  const tutorialPhases: TutorialPhase[] = [
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

  useEffect(() => {
    sparkyQuestStageRef.current = sparkyQuestStage;
  }, [sparkyQuestStage]);

  useEffect(() => {
    if (sparkyQuestMarkerRef.current) {
      sparkyQuestMarkerRef.current.visible = sparkyQuestStage !== 'done';
    }
  }, [sparkyQuestStage]);

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

    const outdoorGroup = new THREE.Group();
    scene.add(outdoorGroup);
    outdoorGroupRef.current = outdoorGroup;

    const workshopRoomGroup = new THREE.Group();
    workshopRoomGroup.visible = false;
    scene.add(workshopRoomGroup);
    workshopRoomGroupRef.current = workshopRoomGroup;

    const aspect = mountElement.clientWidth / mountElement.clientHeight;
    const viewHeight = 26;
    const camera = new THREE.OrthographicCamera(
      (-viewHeight * aspect) / 2,
      (viewHeight * aspect) / 2,
      viewHeight / 2,
      -viewHeight / 2,
      0.1,
      100
    );
    camera.position.copy(CAMERA_OFFSET);
    camera.lookAt(CAMERA_LOOK_AHEAD);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountElement.clientWidth, mountElement.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mountElement.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const hemiLight = new THREE.HemisphereLight(0xfff7d1, 0x345b2a, 0.8);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1b6, 1.15);
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
      createLitMaterial(0xffe066, 0.2, 0.05)
    );
    sun.position.set(8.5, 6.8, 5.2);
    outdoorGroup.add(sun);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(ISLAND_RADIUS + 10, 120),
      createLitMaterial(0x4aa6ff, 0.15, 0.2)
    );
    water.position.z = 0.02;
    water.receiveShadow = true;
    outdoorGroup.add(water);

    const beach = new THREE.Mesh(
      new THREE.RingGeometry(ISLAND_RADIUS - 1, ISLAND_RADIUS + 1.4, 120),
      createLitMaterial(0xf5d17c, 0.92, 0.02)
    );
    beach.position.z = 0.09;
    beach.receiveShadow = true;
    outdoorGroup.add(beach);

    const island = new THREE.Mesh(
      new THREE.CircleGeometry(ISLAND_RADIUS, 120),
      createLitMaterial(0x5ac66f, 0.88, 0.02)
    );
    island.position.z = 0.13;
    island.receiveShadow = true;
    outdoorGroup.add(island);
    outdoorGroup.add(createGrid(ISLAND_RADIUS - 1, 1, 0x2b7a38));

    const bazaarPad = new THREE.Mesh(
      createRoundedRectGeometry(6.5, 3.4, 0.44),
      createLitMaterial(0xd8b47b, 0.86, 0.03)
    );
    bazaarPad.position.set(0.65, -1.75, 0.22);
    bazaarPad.receiveShadow = true;
    outdoorGroup.add(bazaarPad);

    const stonePath = new THREE.Mesh(
      createRoundedRectGeometry(1.15, 5.8, 0.2),
      createLitMaterial(0xe2cf9e, 0.82, 0.03)
    );
    stonePath.position.set(1.7, 0.15, 0.23);
    stonePath.rotation.z = -0.38;
    stonePath.receiveShadow = true;
    outdoorGroup.add(stonePath);

    const palmTrees = [
      createPalmTree(-8.5, 4.6),
      createPalmTree(8.1, 4.9),
      createPalmTree(-6.8, -5.6),
      createPalmTree(7.2, -6),
      createPalmTree(-16.5, 12),
      createPalmTree(17.8, 11.4),
      createPalmTree(-18.7, -9.8),
      createPalmTree(16.1, -12.2),
      createPalmTree(-3.2, 20.8),
      createPalmTree(5.1, -21.2),
      createPalmTree(21.7, -1.9),
      createPalmTree(-22.3, 1.3),
      createPalmTree(12.4, 17.1),
      createPalmTree(-13.5, 16.4),
    ];
    palmTrees.forEach((tree) => outdoorGroup.add(tree));

    const flowers = new THREE.Group();
    for (let i = 0; i < 72; i += 1) {
      const flower = new THREE.Mesh(
        new THREE.CircleGeometry(0.08, 10),
        createLitMaterial([0xff7ab6, 0xfff06a, 0x7ee6ff][i % 3], 0.65, 0.03)
      );
      const angle = (Math.PI * 2 * i) / 72;
      const radius = 7 + (i % 9) * 2;
      flower.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.16);
      flowers.add(flower);
    }
    applyShadows(flowers, true, true);
    outdoorGroup.add(flowers);

    const shops = [
      createBazaarShop(-3.85, -1.8, 0xe879f9, 0xf97316, 'Masala Chai'),
      createBazaarShop(0.9, -1.8, 0x60a5fa, 0xfb7185, 'Code Bazaar'),
      createBazaarShop(5.65, -1.8, 0x34d399, 0xfacc15, 'Snack Stop'),
    ];
    shops.forEach((shop) => outdoorGroup.add(shop));

    const marketLamps = new THREE.Group();
    for (let i = 0; i < 9; i += 1) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        createLitMaterial(0xfef08a, 0.28, 0.3)
      );
      lamp.position.set(-2.1 + i * 0.8, -0.66 + Math.sin(i * 0.5) * 0.08, 1.12);
      marketLamps.add(lamp);
    }
    applyShadows(marketLamps, true, true);
    outdoorGroup.add(marketLamps);

    const rangoli = createRangoli(3.98, -2.02);
    outdoorGroup.add(rangoli);

    const petShop = createBigPetShop(-14, -10);
    petShop.visible = true;
    outdoorGroup.add(petShop);
    petShopRef.current = petShop;

    chaiShopHitboxRef.current = {
      shape: 'circle',
      center: MASALA_CHAI_SHOP_POS.clone(),
      radius: 1.15,
    };

    const petShopMarker = createLabelSprite('!', '#ffffff', 'rgba(220,38,38,0.95)', '#fee2e2', 120, 120);
    petShopMarker.scale.set(1.02, 1.02, 1);
    petShopMarker.position.set(-9.6, -3.8, 4.1);
    petShopMarker.renderOrder = 60;
    petShopMarker.visible = shopUnlockedRef.current;
    outdoorGroup.add(petShopMarker);
    petShopMarkerRef.current = petShopMarker;

    const obstacleHitboxes: Hitbox[] = [
      { shape: 'circle', center: new THREE.Vector2(3.98, -2.02), radius: 0.42 },
      { shape: 'circle', center: new THREE.Vector2(3.6, 1.8), radius: 0.95 },
      { shape: 'circle', center: new THREE.Vector2(-3.85, -1.8), radius: 1.08 },
      { shape: 'circle', center: new THREE.Vector2(0.9, -1.8), radius: 1.08 },
      { shape: 'circle', center: new THREE.Vector2(5.65, -1.8), radius: 1.08 },
      // Pet workshop footprint (centered at shop) - reduced slightly so door area remains reachable
      { shape: 'box', center: new THREE.Vector2(-14, -10), halfWidth: 3.8, halfHeight: 2.2 },
    ];
    const palmTreePositions = [
      new THREE.Vector2(-8.5, 4.6),
      new THREE.Vector2(8.1, 4.9),
      new THREE.Vector2(-6.8, -5.6),
      new THREE.Vector2(7.2, -6),
      new THREE.Vector2(-16.5, 12),
      new THREE.Vector2(17.8, 11.4),
      new THREE.Vector2(-18.7, -9.8),
      new THREE.Vector2(16.1, -12.2),
      new THREE.Vector2(-3.2, 20.8),
      new THREE.Vector2(5.1, -21.2),
      new THREE.Vector2(21.7, -1.9),
      new THREE.Vector2(-22.3, 1.3),
      new THREE.Vector2(12.4, 17.1),
      new THREE.Vector2(-13.5, 16.4),
    ];
    palmTreePositions.forEach((position) => {
      obstacleHitboxes.push({ shape: 'circle', center: position, radius: 0.88 });
    });
    obstacleHitboxesRef.current = obstacleHitboxes;
    workshopDoorHitboxRef.current = {
      shape: 'circle',
      center: new THREE.Vector2(-14, -12.38),
      radius: 1.8,
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
    const localRobot = createRobotVisual(localColor, 'You');
    localRobot.root.position.set(0, 0, 0);
    localPositionRef.current.set(0, 0);
    scene.add(localRobot.root);
    localRobotRef.current = localRobot;

    const sparky = createRobotVisual(new THREE.Color(0xfacc15), 'Sparky');
    // nudge Sparky a bit further 'up' on the map (y axis) and raise slightly so body isn't clipped
    sparky.root.position.set(NPC_POSITION.x, NPC_POSITION.y + 1.02, 0.22);
    outdoorGroup.add(sparky.root);
    // ensure Sparky's body is visible (sometimes geometry/materials can be toggled during hot edits)
    if (sparky.body) sparky.body.visible = true;
    const sparkyQuestMarker = createLabelSprite('!', '#ffffff', 'rgba(220,38,38,0.95)', '#fee2e2', 120, 120);
    sparkyQuestMarker.scale.set(1.02, 1.02, 1);
    sparkyQuestMarker.center.set(0.5, 0);
    sparkyQuestMarker.position.set(0, 2.72, 1.02);
    sparkyQuestMarker.renderOrder = 61;
    sparky.root.add(sparkyQuestMarker);
    sparkyQuestMarkerRef.current = sparkyQuestMarker;

    const workshopFloor = new THREE.Mesh(
      new THREE.BoxGeometry(10.6, 10.6, 0.24),
      createLitMaterial(0xf8fafc, 0.86, 0.03)
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
        createLitMaterial(0x334155, 0.72, 0.05)
      );
      wall.position.copy(position);
      workshopRoomGroup.add(wall);
    });

    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.45, 1.45),
      createLitMaterial(0x8b5a2b, 0.7, 0.08)
    );
    shelf.position.set(-3.2, 3.25, 0.82);
    workshopRoomGroup.add(shelf);

    const petBed = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.82, 0.2),
      createLitMaterial(0xf59e0b, 0.64, 0.07)
    );
    petBed.position.set(3.4, -2.4, 0.21);
    workshopRoomGroup.add(petBed);

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.7, 0.75),
      createLitMaterial(0x7c3aed, 0.62, 0.08)
    );
    desk.position.set(2.9, 3.05, 0.48);
    workshopRoomGroup.add(desk);

    const owner = createRobotVisual(new THREE.Color(0x14b8a6), 'Rafiq');
    owner.root.position.set(ROOM_OWNER_POS.x, ROOM_OWNER_POS.y, 0.05);
    workshopRoomGroup.add(owner.root);
    roomOwnerVisualRef.current = owner;

    const petDisplay = createRobotVisual(new THREE.Color(0x60a5fa), 'Shop Pet');
    petDisplay.root.position.set(-1.9, 0.5, 0.05);
    workshopRoomGroup.add(petDisplay.root);
    roomPetVisualRef.current = petDisplay;

    const customerGroup = new THREE.Group();
    workshopRoomGroup.add(customerGroup);
    roomCustomerGroupRef.current = customerGroup;

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const nextAspect = mountElement.clientWidth / mountElement.clientHeight;
      const nextHeight = viewHeight;
      cameraRef.current.left = (-nextHeight * nextAspect) / 2;
      cameraRef.current.right = (nextHeight * nextAspect) / 2;
      cameraRef.current.top = nextHeight / 2;
      cameraRef.current.bottom = -nextHeight / 2;
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
      if (event.code === 'Space' && !inWorkshopRoomRef.current) {
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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

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
      const visual = createHumanVisual(customerName);
      const start = new THREE.Vector2(-4.8, -4.2 + Math.random() * 1.8);
      visual.root.position.set(start.x, start.y, 0.04);
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

            if (atWorkshopDoor) {
              workshopDoorArmedRef.current = false;
              setInWorkshopRoom(true);
              setWorkshopIntroStep(0);
              setWorkshopIntroSeen(false);
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

      const lookDirection = moved ? moveDirection : new THREE.Vector2(0.3, 0);
      animateRobotVisual(localRobot, worldTime, moved ? 1 : 0, lookDirection.x, lookDirection.y);

      if (!inWorkshopRoomRef.current) {
        const distanceToSparky = localPositionRef.current.distanceTo(NPC_POSITION);
        const chaiHitbox = chaiShopHitboxRef.current;
        let outsidePrompt: string | null = null;

        if (distanceToSparky < SPARKY_INTERACTION_DISTANCE && !showTutorialRef.current && !tutorialCompleteRef.current) {
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
          if (
            sparkyQuestStageRef.current === 'buy-chai' &&
            chaiHitbox &&
            isInsideHitbox(localPositionRef.current, chaiHitbox)
          ) {
            if (moneyRef.current >= 10) {
              setMoney((prev) => prev - 10);
              setSparkyQuestStage('gift-ready');
            } else {
              setWorkshopOutput('You need $10 before you can buy Sparky masala chai.');
            }
          } else if (
            sparkyQuestStageRef.current === 'gift-ready' &&
            distanceToSparky < SPARKY_INTERACTION_DISTANCE
          ) {
            setMoney((prev) => prev + 5);
            setSparkyQuestStage('done');
            setWorkshopOutput('🎁 Sparky: Thanks! You got a gift.');
          }
        }

        setInteractionPromptName(outsidePrompt);
        interactionCandidateIdRef.current = null;
      }

      const bob = Math.sin(now * 0.006) * 0.04;
      sparky.root.position.z = 0.01 + bob;
      animateRobotVisual(sparky, worldTime, 0.35, -0.3, 0.15);
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
          npc.visual.root.position.set(npc.position.x, npc.position.y, 0.04);
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
      if (petShopMarker.visible) {
        petShopMarker.position.y = -3.8 + Math.sin(worldTime * 3.8) * 0.22;
      }

      if (inWorkshopRoomRef.current) {
        outdoorGroup.visible = false;
        workshopRoomGroup.visible = true;
        scene.background = new THREE.Color(0x030712);
        camera.position.x += (localPositionRef.current.x - camera.position.x) * 0.08;
        camera.position.y += (localPositionRef.current.y - 4.6 - camera.position.y) * 0.08;
        camera.position.z += (11.6 - camera.position.z) * 0.08;
        camera.lookAt(localPositionRef.current.x, localPositionRef.current.y, 0);
      } else {
        outdoorGroup.visible = true;
        workshopRoomGroup.visible = false;
        scene.background = new THREE.Color(0x8ed6ff);
        const cameraTargetX = localPositionRef.current.x * 0.5;
        const cameraTargetY = localPositionRef.current.y * 0.5;
        camera.position.x += (cameraTargetX + CAMERA_OFFSET.x - camera.position.x) * 0.14;
        camera.position.y += (cameraTargetY + CAMERA_OFFSET.y - camera.position.y) * 0.14;
        camera.position.z += (CAMERA_OFFSET.z - camera.position.z) * 0.14;
        camera.lookAt(
          cameraTargetX + CAMERA_LOOK_AHEAD.x,
          cameraTargetY + CAMERA_LOOK_AHEAD.y,
          CAMERA_LOOK_AHEAD.z
        );
      }

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
      shops.forEach((shop) => disposeObject(shop));
      disposeObject(marketLamps);
      disposeObject(bazaarPad);
      disposeObject(stonePath);
      disposeObject(rangoli);
      disposeObject(petShop);
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
      obstacleHitboxesRef.current = [];
      roomObstacleHitboxesRef.current = [];
      workshopDoorHitboxRef.current = null;
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
  }, [shopUnlocked, inWorkshopRoom]);

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
      const res = await fetch('/api/tutorial/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, concept: activePhase.concept }),
      });
      const data = await res.json();

      if (data.valid) {
        const nextStep = tutorialStep + 1;
        const nextPhase = tutorialPhases[nextStep];

        setSuccess(true);
        setSparkleBurst(true);
        playHappyChime();

        if (nextPhase && nextPhase.kind === 'challenge') {
          setOutput(`✅ Nice! ${activePhase.title} complete.`);
          setTimeout(() => {
            setSparkleBurst(false);
            setSuccess(false);
            setTutorialStep(nextStep);
            setCode(nextPhase.starterCode);
            setOutput('');
          }, 850);
        } else {
          setOutput('✅ Amazing! You finished name, color, and age variables. Get $10 to buy me masala chai and I\'ll get you a gift.');
          setTutorialComplete(true);
          setShopUnlocked(true);
          setSparkyQuestStage('earn-money');
          setTimeout(() => setSparkleBurst(false), 900);
          setTimeout(() => {
            setShowTutorial(false);
            setTutorialStep(0);
            setOutput('');
          }, 1600);
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
    const outsideDoor = new THREE.Vector2(-9.6, -9.7);
    localPositionRef.current.copy(outsideDoor);
    if (localRobotRef.current) {
      localRobotRef.current.root.position.set(outsideDoor.x, outsideDoor.y, 0.01);
    }
    if (sparkyQuestStageRef.current === 'earn-money' && moneyRef.current >= 10) {
      setSparkyQuestStage('buy-chai');
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
  };

  return (
    <div className="relative">
      {inWorkshopRoom && !workshopIntroSeen && (
        <>
          <div className="absolute left-4 top-20 z-40 w-[min(90vw,24rem)] rounded-2xl border border-amber-200/50 bg-slate-900/94 px-5 py-4 text-base text-slate-100 shadow-2xl">
            <div className="font-semibold text-amber-300 text-lg">{WORKSHOP_INTRO_PAGES[workshopIntroStep].title}</div>
            <div className="mt-2 text-slate-100">{WORKSHOP_INTRO_PAGES[workshopIntroStep].body}</div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className="rounded bg-emerald-500 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-400"
                onClick={nextWorkshopIntroStep}
              >
                {workshopIntroStep >= WORKSHOP_INTRO_PAGES.length - 1 ? 'Start jobs' : 'Next'}
              </button>
              <button
                type="button"
                className="rounded bg-slate-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-slate-600"
                onClick={finishWorkshopIntro}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {inWorkshopRoom && workshopIntroSeen && activeCustomer && (
        <div className="absolute left-4 top-20 z-40 w-[min(90vw,24rem)] rounded-2xl border border-cyan-200/50 bg-slate-900/94 px-5 py-4 text-base text-slate-100 shadow-2xl">
          <div className="text-sky-300 text-lg font-semibold">{activeCustomer.customerName}&apos;s Request</div>
          {activeCustomer.required.includes('name') && (
            <div className="mt-1">
              Name: <span className="font-semibold text-emerald-300">{activeCustomer.petName}</span>
            </div>
          )}
          {activeCustomer.required.includes('color') && (
            <div className="mt-1">
              Color: <span className="font-semibold text-emerald-300">{activeCustomer.petColor}</span>
            </div>
          )}
          {activeCustomer.required.includes('size') && (
            <div className="mt-1">
              Size (int): <span className="font-semibold text-emerald-300">{activeCustomer.petSize}</span>
            </div>
          )}
          <div className="mt-1 text-sky-100">&quot;I want a pet with these settings!&quot;</div>

          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
            <div className="px-4 py-2 text-base text-slate-200 border-b border-slate-800">Java Workshop Editor</div>
            <textarea
              value={workshopCode}
              onChange={(event) => setWorkshopCode(event.target.value)}
              spellCheck={false}
              wrap="off"
              className="h-28 w-full resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-base leading-7 text-slate-100 [font-variant-ligatures:none]"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              className="rounded bg-emerald-500 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-400"
              onClick={runWorkshopCode}
            >
              Submit Java Code
            </button>
          </div>
        </div>
      )}

      {inWorkshopRoom && workshopIntroSeen && workshopOutput && (
        <div className="absolute left-4 bottom-20 z-40 w-[min(90vw,24rem)] rounded-xl border border-emerald-300/40 bg-emerald-950/70 px-4 py-3 text-base text-emerald-100 shadow-xl">
          {workshopOutput}
        </div>
      )}

      {inWorkshopRoom && (
        <div className="absolute right-4 top-20 z-40 flex gap-3">
          <button
            type="button"
            className="rounded bg-slate-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-slate-600"
            onClick={reopenWorkshopIntro}
          >
            Workshop guide
          </button>
          <button
            type="button"
            className="rounded bg-blue-500 px-4 py-2.5 text-base font-semibold text-white hover:bg-blue-400"
            onClick={leaveWorkshopRoom}
          >
            Exit workshop
          </button>
        </div>
      )}

      {roomEntryFlash && <div className="pointer-events-none fixed inset-0 z-[70] animate-pulse bg-cyan-200/35 backdrop-blur-[1px]" />}

      <div className="w-full h-screen" ref={mountRef} />

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
                <h2 className="text-white text-2xl font-bold">Sparky</h2>
                <p
                  className="mt-2 text-lg text-slate-100"
                  dangerouslySetInnerHTML={{ __html: tutorialPhases[tutorialStep].npcText }}
                />
              </div>
            </div>

            {tutorialPhases[tutorialStep].kind === 'challenge' && (
              <div className="mb-4">
                <div className="mb-3 rounded-lg border border-slate-700/70 bg-slate-800/70 px-4 py-3 text-base text-slate-100">
                  <div className="font-semibold text-slate-100 text-lg">{tutorialPhases[tutorialStep].title}</div>
                  <div className="mt-1">{tutorialPhases[tutorialStep].prompt}</div>
                  <div className="mt-2 text-sky-300" dangerouslySetInnerHTML={{ __html: tutorialPhases[tutorialStep].hint }} />
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
                  <div className="px-4 py-2 text-sm text-slate-200 border-b border-slate-800">
                    Java Editor
                  </div>
                  <div className="relative h-40">
                    <pre
                      ref={codePreviewRef}
                      className="pointer-events-none absolute inset-0 m-0 p-4 overflow-auto whitespace-pre font-mono text-base leading-7 text-slate-100 [font-variant-ligatures:none]"
                      dangerouslySetInnerHTML={{ __html: `${highlightedCode}\n` }}
                    />
                    <textarea
                      ref={codeInputRef}
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      onScroll={onEditorScroll}
                      spellCheck={false}
                      wrap="off"
                      className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-base leading-7 text-transparent caret-green-300 [font-variant-ligatures:none]"
                    />
                  </div>
                </div>
                {output && (
                  <div
                    className={`mt-3 rounded-lg px-4 py-3 text-base ${
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
                {tutorialPhases.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full ${
                      tutorialStep === i ? 'bg-blue-500' : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>

              {tutorialPhases[tutorialStep].kind === 'dialogue' ? (
                <button
                  onClick={() => setTutorialStep((step) => step + 1)}
                  className="rounded-lg bg-blue-600 px-6 py-3 text-base text-white font-semibold hover:bg-blue-500"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={checkAnswer}
                  disabled={success}
                  className={`rounded-lg px-6 py-3 text-base font-semibold ${
                    success
                      ? 'bg-emerald-600 text-white cursor-not-allowed'
                      : 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                  }`}
                >
                  {success ? 'Great! ✨' : 'Run Code'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
