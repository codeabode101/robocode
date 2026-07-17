import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const LABEL_BUILD_TAG = 'label-build-20260510-0342';

// === SHARED BUILDING MATERIALS (created once, reused across all buildings) ===
const _bldgSharedMats = {
  dark: createToonMaterial(0x1a1a22),
  glass: createToonMaterial(0x2a3a4a),
  board: createToonMaterial(0x8b6b4a),
  veg: createToonMaterial(0x3a6a2a),
  rust: createToonMaterial(0x8b4513),
  steel: createToonMaterial(0x5a5a6a),
  brick: createToonMaterial(0x7a4030),
  crack: createToonMaterial(0x2a2a2a),
  red: createToonMaterial(0xdd3333),
  dumpBody: createToonMaterial(0x2d5a27),
  dumpLid: createToonMaterial(0x3a7a33),
  graffiti: [0xdd3333, 0x3366dd, 0x33aa55, 0xddaa33, 0xff66aa].map(c => createToonMaterial(c)),
};
// Per-palette materials cached after first use
const _bldgPaletteMats = new Map<string, {
  wall: THREE.Material; wallDark: THREE.Material; trim: THREE.Material;
  accent: THREE.Material; roof: THREE.Material;
}>();

export function hashColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  const color = new THREE.Color();
  color.setHSL(hue / 360, 0.72, 0.58);
  return color;
}

export function createLabelSprite(
  label: string,
  textColor: string,
  backgroundColor: string,
  borderColor: string,
  canvasWidth = 256,
  canvasHeight = 72,
  paddingX = 2,
  paddingY = 8,
  fontSize = 26
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  let context = canvas.getContext('2d');
  if (!context) {
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(material);
  }

  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  const metrics = context.measureText(label);
  const leftBound = typeof metrics.actualBoundingBoxLeft === 'number' ? Math.abs(metrics.actualBoundingBoxLeft) : 0;
  const rightBound = typeof metrics.actualBoundingBoxRight === 'number' ? metrics.actualBoundingBoxRight : metrics.width;
  const measuredTextWidth = Math.ceil(leftBound + rightBound);
  const desiredCanvasWidth = Math.max(18, measuredTextWidth + paddingX * 2);

  if (canvasWidth === 256 && desiredCanvasWidth !== canvas.width) {
    canvas.width = desiredCanvasWidth;
    context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.font = `700 ${fontSize}px system-ui, sans-serif`;
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
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);

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

export function createExclamationMarker() {
  return createLabelSprite('!', '#ffffff', 'rgba(220,38,38,0.95)', '#fee2e2', 64, 64, 6, 6, 48);
}

export function createNameSprite(label: string, color: THREE.Color) {
  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  const paddingX = 10;
  const paddingY = 5;
  const baseFontSize = 20;
  const minCanvasWidth = 56;
  const maxCanvasWidth = 132;
  let fontSize = baseFontSize;
  let textWidth = 48;
  let textBoundsWidth = 48;

  if (measureContext) {
    const measureAtSize = (size: number) => {
      measureContext.font = `700 ${size}px system-ui, sans-serif`;
      const metrics = measureContext.measureText(label);
      return Math.ceil((metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || metrics.width));
    };

    textBoundsWidth = measureAtSize(baseFontSize);
    if (textBoundsWidth + paddingX * 2 > maxCanvasWidth) {
      fontSize = Math.max(16, Math.floor(baseFontSize * ((maxCanvasWidth - paddingX * 2) / textBoundsWidth)));
      textBoundsWidth = measureAtSize(fontSize);
    }

    textWidth = textBoundsWidth;
  }

  const canvasWidth = Math.max(minCanvasWidth, Math.min(maxCanvasWidth, Math.ceil(textWidth) + paddingX * 2));
  const canvasHeight = 34;
  const sprite = createLabelSprite(
    label,
    '#f8fafc',
    'rgba(8, 15, 30, 0.5)',
    `#${color.getHexString()}`,
    canvasWidth,
    canvasHeight,
    paddingX,
    paddingY,
    fontSize
  );
  const baseScaleY = 0.5;
  sprite.scale.set((canvasWidth / canvasHeight) * baseScaleY, baseScaleY, 1);
  sprite.center.set(0.5, 0.05);
  sprite.position.set(0, 1.8, 0);
  sprite.renderOrder = 40;
  sprite.name = LABEL_BUILD_TAG;
  return sprite;
}

export function disposeObject(object: THREE.Object3D) {
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

export function createRoundedRectGeometry(width: number, height: number, radius: number) {
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

export function createGradientTexture(steps = 3) {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = steps;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const v = Math.floor(30 + t * 200);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, i, 8, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

export function createToonMaterial(color: number | THREE.Color, lightness = 0.7, _roughness = 0.05) {
  return new THREE.MeshToonMaterial({
    color: color,
    gradientMap: createGradientTexture(5),
  });
}

const tileLoader = new THREE.TextureLoader();
const tileCache: Record<string, THREE.Texture> = {};

export function getTileTexture(tileName: string) {
  if (!tileCache[tileName]) {
    tileCache[tileName] = tileLoader.load(`/kenney-topdown/PNG/Tiles/${tileName}`);
    tileCache[tileName].magFilter = THREE.NearestFilter;
    tileCache[tileName].minFilter = THREE.NearestFilter;
  }
  return tileCache[tileName];
}

export function createTexturedToonMaterial(tileName: string, repeatX: number, repeatY: number, color?: number | THREE.Color, smooth?: boolean) {
  const cacheKey = smooth ? `smooth_${tileName}` : tileName;
  if (!tileCache[cacheKey]) {
    const tex = tileLoader.load(`/kenney-topdown/PNG/Tiles/${tileName}`);
    if (smooth) { tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; }
    else { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; }
    tileCache[cacheKey] = tex;
  }
  const texture = tileCache[cacheKey];
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  const mat = new THREE.MeshToonMaterial({
    map: texture,
    gradientMap: createGradientTexture(3),
  });
  if (color !== undefined) mat.color = new THREE.Color(color);
  return mat;
}

export function createCharacterSprite(imagePath: string, scale = 1) {
  const map = tileLoader.load(imagePath);
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  const material = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

export type RobotVisual = {
  root: THREE.Group;
  nameSprite: THREE.Sprite;
  body: THREE.Mesh;
  shadow: THREE.Mesh;
  leftPupil: THREE.Object3D;
  rightPupil: THREE.Object3D;
  antennaTip: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
};

export type HumanVisual = {
  root: THREE.Group;
  nameSprite: THREE.Sprite;
};

export function createPlayerSprite(imagePath: string, color: THREE.Color, name: string): RobotVisual {
  const group = new THREE.Group();

  // shadow handled by Three.js shadow mapping

  const sprite = createCharacterSprite(imagePath, 0.7);
  sprite.position.set(0, 0.07, 0.55);
  group.add(sprite);

  const nameSprite = createNameSprite(name, color);
  group.add(nameSprite);

  const dummyBody = new THREE.Object3D();
  dummyBody.position.set(0, 0.02, 0);
  const antennaTip = new THREE.Object3D();
  const leftPupil = new THREE.Object3D();
  const rightPupil = new THREE.Object3D();
  const leftArm = new THREE.Object3D() as unknown as THREE.Mesh;
  const rightArm = new THREE.Object3D() as unknown as THREE.Mesh;
  const leftLeg = new THREE.Object3D() as unknown as THREE.Mesh;
  const rightLeg = new THREE.Object3D() as unknown as THREE.Mesh;

  applyShadows(group, true, true);
  group.scale.set(2.35, 2.35, 2.35);
  return { root: group, nameSprite, body: dummyBody as unknown as THREE.Mesh, shadow: new THREE.Object3D() as unknown as THREE.Mesh, leftPupil, rightPupil, antennaTip: antennaTip as unknown as THREE.Mesh, leftArm, rightArm, leftLeg, rightLeg };
}

export function addOutline(mesh: THREE.Mesh, color = 0x2d2d3d) {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 }));
  mesh.parent?.add(line);
}

export function applyShadows(object: THREE.Object3D, cast = true, receive = true) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
  });
}

export function createRobotVisual(color: THREE.Color, name: string, facing: 'south' | 'north' = 'south') {
  const group = new THREE.Group();

  // shadow handled by Three.js shadow mapping

  const footMat = createToonMaterial(0x374151);
  const bodyMat = createToonMaterial(color);
  const legMat = createToonMaterial(color);
  const armMat = createToonMaterial(color);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), legMat);
  leftLeg.position.set(-0.16, 0.07, 0.42);
  group.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.16;
  group.add(rightLeg);

  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.2), footMat);
  leftFoot.position.set(-0.16, -0.03, 0.42);
  group.add(leftFoot);

  const rightFoot = leftFoot.clone();
  rightFoot.position.x = 0.16;
  group.add(rightFoot);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.32, 0.32),
    bodyMat
  );
  body.position.set(0, 0.3, 0.5);
  group.add(body);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), armMat);
  leftArm.position.set(-0.33, 0.26, 0.5);
  leftArm.rotation.z = 0.3;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), armMat);
  rightArm.position.set(0.33, 0.26, 0.5);
  rightArm.rotation.z = -0.3;
  group.add(rightArm);

  const headBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.22, 0.34),
    bodyMat
  );
  headBlock.position.set(0, 0.56, 0.5);
  group.add(headBlock);

  const facePanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.18, 0.04),
    createToonMaterial(0x475569)
  );
  facePanel.position.set(0, 0.58, 0.7);
  group.add(facePanel);

  const leftEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  leftEye.position.set(-0.07, 0.6, 0.73);
  group.add(leftEye);

  const leftPupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  leftPupil.position.set(-0.07, 0.6, 0.745);
  group.add(leftPupil);

  const rightEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  rightEye.position.set(0.07, 0.6, 0.73);
  group.add(rightEye);

  const rightPupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  rightPupil.position.set(0.07, 0.6, 0.745);
  group.add(rightPupil);

  const antennaStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6),
    createToonMaterial(0x94a3b8)
  );
  antennaStem.position.set(0, 0.74, 0.5);
  group.add(antennaStem);

  const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    createToonMaterial(0xef4444)
  );
  antennaTip.position.set(0, 0.82, 0.5);
  group.add(antennaTip);

  const nameSprite = createNameSprite(name, color);
  group.add(nameSprite);
  applyShadows(group, true, true);

  group.rotation.set(Math.PI / 2, 0, 0);
  if (facing === 'north') {
    // Rotate 180° around Y in Y-up space (to face opposite direction)
    // before the X rotation lays it down. Q = Qx(PI/2) * Qy(PI)
    // → Qy applied first (face -Z), then Qx (map -Z to +Y)
    group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
  }
  group.scale.set(2.35, 2.35, 2.35);
  return { root: group, nameSprite, body, shadow: new THREE.Object3D() as unknown as THREE.Mesh, leftPupil, rightPupil, antennaTip, leftArm, rightArm, leftLeg, rightLeg };
}

export function buildPlayerVisual(clothColor: number, name: string) {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshToonMaterial({ color: 0xf5d6c6, gradientMap: createGradientTexture(3) });
  const clothMat = new THREE.MeshToonMaterial({ color: clothColor, gradientMap: createGradientTexture(3) });
  const darkMat = new THREE.MeshToonMaterial({ color: 0x1f2937, gradientMap: createGradientTexture(3) });
  const hairMat = new THREE.MeshToonMaterial({ color: 0x3a2a1a, gradientMap: createGradientTexture(3) });

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.08, 0, 0.20);
  group.add(leftLegPivot);
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8), darkMat);
  leftLeg.rotation.x = Math.PI / 2;
  leftLeg.position.set(0, 0, -0.06);
  leftLegPivot.add(leftLeg);
  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.03), darkMat);
  leftFoot.position.set(0, 0, -0.185);
  leftLegPivot.add(leftFoot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.08, 0, 0.20);
  group.add(rightLegPivot);
  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8), darkMat);
  rightLeg.rotation.x = Math.PI / 2;
  rightLeg.position.set(0, 0, -0.06);
  rightLegPivot.add(rightLeg);
  const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.03), darkMat);
  rightFoot.position.set(0, 0, -0.185);
  rightLegPivot.add(rightFoot);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.22, 12), clothMat);
  torso.rotation.x = Math.PI / 2;
  torso.position.set(0, 0, 0.35);
  group.add(torso);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.12, 0, 0.43);
  leftArmPivot.rotation.y = 0.42;
  group.add(leftArmPivot);
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.24, 8), clothMat);
  leftArm.rotation.x = -Math.PI / 2;
  leftArm.position.set(0, 0, -0.12);
  leftArmPivot.add(leftArm);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), skinMat);
  leftHand.position.set(0, 0.12, 0);
  leftArm.add(leftHand);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.12, 0, 0.43);
  rightArmPivot.rotation.y = -0.42;
  group.add(rightArmPivot);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.24, 8), clothMat);
  rightArm.rotation.x = -Math.PI / 2;
  rightArm.position.set(0, 0, -0.12);
  rightArmPivot.add(rightArm);
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), skinMat);
  rightHand.position.set(0, 0.12, 0);
  rightArm.add(rightHand);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.06, 8), skinMat);
  neck.rotation.x = Math.PI / 2;
  neck.position.set(0, 0, 0.51);
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), skinMat);
  head.position.set(0, 0, 0.57);
  group.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), hairMat);
  hair.position.set(0, -0.08, 0.59);
  group.add(hair);

  for (let s = -1; s <= 1; s += 2) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(s * 0.035, 0.066, 0.53);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    pupil.position.set(s * 0.035, 0.075, 0.53);
    group.add(pupil);
  }

  const nameSprite = createNameSprite(name, new THREE.Color(clothColor));
  nameSprite.position.set(0, 0, 1.8);
  if (name) group.add(nameSprite);
  applyShadows(group, true, true);

  return { root: group, nameSprite, torso, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, leftArm, rightArm };
}

export function createGrid(size: number, step: number, color: number) {
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

export function createPalmTree(x: number, y: number) {
  const tree = new THREE.Group();
  tree.position.set(x, y, 0);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 2.6, 12),
    createToonMaterial(0x8b5a2b)
  );
  trunk.position.set(0, 0, 1.4);
  trunk.rotation.set(Math.PI / 2, 0, 0);
  tree.add(trunk);

  const leafMaterial = createToonMaterial(0x5a9e5a);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), leafMaterial);
    const angle = (Math.PI * 2 * i) / 6;
    leaf.scale.set(2.4, 1.1, 0.9);
    leaf.position.set(Math.cos(angle) * 0.5, Math.sin(angle) * 0.35, 2.85);
    leaf.rotation.set(Math.PI / 2 - 0.3, 0, angle);
    tree.add(leaf);
  }
  tree.rotation.set(0, 0, 0);
  applyShadows(tree, true, true);
  return tree;
}

export function createBazaarShop(
  x: number,
  y: number,
  baseColor: number,
  awningColor: number,
  label: string,
  scale = 3.12
) {
  const stall = new THREE.Group();

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.08), createTexturedToonMaterial('tile_21.png', 3, 1, baseColor));
  backWall.position.set(0, 0.35, -0.25); stall.add(backWall);

  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.35), createTexturedToonMaterial('tile_43.png', 3, 1, 0x8b6b4a));
  counter.position.set(0, 0.55, 0.3); stall.add(counter);

  for (let side = -1; side <= 1; side += 2) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), createToonMaterial(0x4a3a2a));
    leg.position.set(side * 0.7, 0.28, 0.3); stall.add(leg);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.6), createTexturedToonMaterial('tile_33.png', 3, 1, awningColor));
  roof.position.set(0, 0.95, 0.05); stall.add(roof);

  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), createToonMaterial(0x64748b));
      pole.position.set(sx * 0.75, 0.7, sz * 0.25); stall.add(pole);
    }
  }

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256; signCanvas.height = 64;
  const sctx = signCanvas.getContext('2d')!;
  sctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
  const rad = 8;
  sctx.beginPath(); sctx.moveTo(rad, 0); sctx.lineTo(256 - rad, 0);
  sctx.quadraticCurveTo(256, 0, 256, rad); sctx.lineTo(256, 64 - rad);
  sctx.quadraticCurveTo(256, 64, 256 - rad, 64); sctx.lineTo(rad, 64);
  sctx.quadraticCurveTo(0, 64, 0, 64 - rad); sctx.lineTo(0, rad);
  sctx.quadraticCurveTo(0, 0, rad, 0); sctx.closePath(); sctx.fill();
  sctx.fillStyle = '#fbbf24'; sctx.font = '700 28px system-ui'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.fillText(label, 128, 34);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.minFilter = THREE.LinearFilter;
  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.04), new THREE.MeshBasicMaterial({ map: signTex }));
  signMesh.position.set(0, 0.96, 0.35); stall.add(signMesh);

  for (let i = -2; i <= 2; i++) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    light.position.set(i * 0.35, 0.85, 0.3); stall.add(light);
  }

  stall.scale.set(scale, scale, scale);
  stall.position.set(x, y, 0);
  stall.rotation.set(Math.PI / 2, 0, 0);
  applyShadows(stall, true, true);
  return stall;
}

export function createRangoli(x: number, y: number) {
  const rangoli = new THREE.Group();
  const colors = [0xfb7185, 0xfacc15, 0x60a5fa, 0x34d399];

  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 14, 14),
    createToonMaterial(0xffffff, 0.42, 0.15)
  );
  center.position.set(x, y, 0.2);
  rangoli.add(center);

  for (let i = 0; i < 8; i += 1) {
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      createToonMaterial(colors[i % colors.length], 0.68, 0.06)
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

export function addWindows(building: THREE.Group, bx: number, by: number, bw: number, bh: number, bd: number) {
  const winW = 0.3;
  const winH = 0.4;
  const gapX = 0.65;
  const gapY = 0.75;
  const rows = Math.max(1, Math.floor((bh - 0.4) / gapY));
  const cols = Math.max(1, Math.floor((bw - 0.4) / gapX));
  const startX = -bw / 2 + 0.45;
  const startY = -bh / 2 + 0.5;
  const group = new THREE.Group();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() < 0.75;
      const opacity = lit ? 0.6 + Math.random() * 0.4 : 0.05 + Math.random() * 0.08;
      const winColor = lit ? 0xfef08a : 0x1a1a2e;
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(winW, winH),
        new THREE.MeshBasicMaterial({ color: winColor, transparent: true, opacity })
      );
      win.position.set(startX + c * gapX, startY + r * gapY, bd / 2 + 0.01);
      group.add(win);
    }
  }
  building.add(group);
}

export function createBigPetShop(x: number, y: number, scale = 1) {
  const shop = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8.1, 5.1, 2.55),
    createTexturedToonMaterial('tile_23.png', 16, 5, 0xf8bbd0)
  );
  base.position.set(x, y, 1.8);
  shop.add(base);
  addOutline(base);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(9, 2.025, 2.85),
    createTexturedToonMaterial('tile_25.png', 18, 6, 0x2563eb)
  );
  roof.position.set(x, y + 2.9, 3.4);
  shop.add(roof);

  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.325, 0.42, 3.15),
    createToonMaterial(0xfde68a, 0.55, 0.14)
  );
  doorFrame.position.set(x, y - 2.34, 1.9);
  shop.add(doorFrame);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.27, 2.7),
    createToonMaterial(0x0f172a, 0.36, 0.35)
  );
  door.position.set(x, y - 2.38, 1.9);
  shop.add(door);

  const doorWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.15, 0.57),
    createToonMaterial(0x93c5fd, 0.2, 0.45)
  );
  doorWindow.position.set(x, y - 2.48, 2.6);
  shop.add(doorWindow);

  const doormat = new THREE.Mesh(
    new THREE.BoxGeometry(2.175, 1.11, 0.12),
    createToonMaterial(0x7c3aed, 0.7, 0.08)
  );
  doormat.position.set(x, y - 3.54, 0.28);
  shop.add(doormat);

  const doorLabel = createLabelSprite('ENTER', '#0f172a', 'rgba(253,224,71,0.95)', '#f8fafc', 160, 74);
  doorLabel.scale.set(2.4, 0.9, 1);
  doorLabel.center.set(0.5, 0);
  doorLabel.position.set(x, y - 2.38, 3.25);
  doorLabel.renderOrder = 36;
  shop.add(doorLabel);

  const sign = createLabelSprite("RAFIQ'S ROBOTS", '#f8fafc', 'rgba(15,23,42,0.92)', '#fde68a', 360, 90);
  sign.scale.set(5.78, 1.6, 1);
  sign.center.set(0.5, 0);
  sign.position.set(x, y + 2.9, 4.5);
  sign.renderOrder = 32;
  shop.add(sign);

  if (scale !== 1) shop.scale.set(scale, scale, scale);
  applyShadows(shop, true, true);
  return shop;
}

export function createHumanVisual(name: string, spritePath: string) {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
  );
  shadow.scale.set(1.08, 0.62, 1);
  shadow.position.set(0, -0.1, 0.15);
  group.add(shadow);

  const sprite = createCharacterSprite(spritePath);
  sprite.scale.set(0.65, 0.65, 1);
  sprite.position.set(0, 0, 0.55);
  group.add(sprite);

  const nameSprite = createNameSprite(name, new THREE.Color(0x22c55e));
  group.add(nameSprite);

  applyShadows(group, true, true);
  group.rotation.set(Math.PI / 2, 0, 0);
  group.scale.set(3.0, 3.0, 3.0);
  return { root: group, nameSprite };
}

export const WALK_BOB_SPEED = 14;

export function animateRobotVisual(visual: RobotVisual, time: number, speedFactor: number, lookX: number, lookY: number) {
  const walkAmount = Math.min(1, speedFactor);
  const bob = Math.sin(time * WALK_BOB_SPEED) * 0.03 * walkAmount;
  visual.body.position.y = 0.3 + bob;
  if (visual.antennaTip) visual.antennaTip.position.y = 0.82 + Math.sin(time * 9) * 0.015;

  if (visual.leftPupil.scale) visual.leftPupil.scale.set(1, 1, 1);
  if (visual.rightPupil.scale) visual.rightPupil.scale.set(1, 1, 1);

  const eyeX = Math.max(-0.025, Math.min(0.025, lookX * 0.018));
  const eyeY = Math.max(-0.015, Math.min(0.015, lookY * 0.012));
  visual.leftPupil.position.set(-0.07 + eyeX, 0.6 + eyeY, 0.75);
  visual.rightPupil.position.set(0.07 + eyeX, 0.6 + eyeY, 0.75);

  // Leg swing
  const legSwing = Math.sin(time * WALK_BOB_SPEED) * 0.3 * walkAmount;
  visual.leftLeg.rotation.z = legSwing;
  visual.rightLeg.rotation.z = -legSwing;

  // Arm swing (opposite to legs)
  const armSwing = Math.sin(time * WALK_BOB_SPEED + Math.PI) * 0.2 * walkAmount;
  visual.leftArm.rotation.z = 0.3 + armSwing;
  visual.rightArm.rotation.z = -0.3 - armSwing;
}

export function createRepairKiosk() {
  const kiosk = new THREE.Group();

  const metalMat = createToonMaterial(0x475569);
  const darkMat = createToonMaterial(0x1e293b);
  const accentMat = createToonMaterial(0xc2410c);
  const pipeMat = createToonMaterial(0x334155);
  const emissiveMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });

  // Exposed metal floor grating
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.04), darkMat);
  floor.position.set(0, 0, 0.02);
  floor.receiveShadow = true;
  kiosk.add(floor);
  // Grating lines
  for (let i = -4; i <= 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.005, 0.005), metalMat);
    bar.position.set(0, i * 0.065, 0.045);
    kiosk.add(bar);
  }

  // Back wall — riveted metal
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.06), metalMat);
  backWall.position.set(0, 0, 0.45);
  backWall.receiveShadow = true;
  kiosk.add(backWall);
  // Rivets
  for (let rx = -2; rx <= 2; rx++) {
    for (let ry = -1; ry <= 1; ry++) {
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), darkMat);
      rivet.position.set(rx * 0.2, ry * 0.2, 0.48);
      kiosk.add(rivet);
    }
  }

  // Side wall frames (open front)
  for (let s = -1; s <= 1; s += 2) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.38), darkMat);
    frame.position.set(s * 0.475, 0.01, 0.26);
    kiosk.add(frame);
    // Vertical pipe along frame
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.45, 6), pipeMat);
    pipe.position.set(s * 0.50, 0, 0.38);
    pipe.rotation.x = Math.PI / 2;
    kiosk.add(pipe);
  }

  // Cross beam at top of frame
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.04), darkMat);
  beam.position.set(0, 0, 0.70);
  kiosk.add(beam);

  // Workbench — metal top
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.02), metalMat);
  bench.position.set(0, -0.05, 0.44);
  kiosk.add(bench);
  // Bench legs — angled struts
  for (let bx = -1; bx <= 1; bx += 2) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 5), darkMat);
    strut.position.set(bx * 0.22, -0.05, 0.37);
    kiosk.add(strut);
    const strut2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 5), darkMat);
    strut2.position.set(bx * 0.22, 0.04, 0.37);
    kiosk.add(strut2);
  }

  // Diagnostic terminal — holographic screen
  const screenBorder = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.005), darkMat);
  screenBorder.position.set(-0.15, -0.05, 0.52);
  kiosk.add(screenBorder);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.07), emissiveMat);
  screen.position.set(-0.15, -0.05, 0.525);
  screen.userData.animated = 'screen';
  kiosk.add(screen);
  const screenGlow = new THREE.Mesh(new THREE.EdgesGeometry(screen.geometry), new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.5 }));
  screenGlow.position.copy(screen.position);
  screenGlow.userData.animated = 'screen';
  kiosk.add(screenGlow);

  // Small status LEDs on screen border
  for (let i = 0; i < 3; i++) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), new THREE.MeshBasicMaterial({ color: [0x22c55e, 0xfacc15, 0xef4444][i] }));
    led.position.set(-0.15 + (i - 1) * 0.03, -0.09, 0.528);
    kiosk.add(led);
  }

  // Broken robot arm on workbench (replaces drone)
  const armBase = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.03), metalMat);
  armBase.position.set(0.12, -0.05, 0.49);
  kiosk.add(armBase);
  const armSeg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.025), new THREE.MeshToonMaterial({ color: 0x94a3b8 }));
  armSeg.position.set(0.12, -0.02, 0.52);
  kiosk.add(armSeg);
  const armClaw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.012), accentMat);
  armClaw.position.set(0.12, 0.02, 0.53);
  kiosk.add(armClaw);
  // Wires from arm
  for (let i = 0; i < 3; i++) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.003, 0.04, 4), new THREE.MeshToonMaterial({ color: [0xef4444, 0x22c55e, 0x3b82f6][i] }));
    wire.position.set(0.12 + (i - 1) * 0.015, -0.07, 0.48);
    wire.rotation.x = 0.5;
    kiosk.add(wire);
  }

  // Conduit pipes on back wall
  for (let i = 0; i < 3; i++) {
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.22, 5), pipeMat);
    conduit.position.set(-0.3 + i * 0.3, -0.1, 0.42);
    conduit.rotation.x = Math.PI / 2;
    kiosk.add(conduit);
    // Connector box
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.015), darkMat);
    box.position.set(-0.3 + i * 0.3, -0.1, 0.31);
    kiosk.add(box);
  }

  // Overhead articulating work light
  const lightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.25, 5), metalMat);
  lightArm.position.set(0.2, 0, 0.75);
  lightArm.rotation.x = 0.3;
  kiosk.add(lightArm);
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.03, 8), darkMat);
  lampShade.position.set(0.2, -0.02, 0.64);
  kiosk.add(lampShade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  bulb.position.set(0.2, -0.02, 0.62);
  bulb.userData.animated = 'bulb';
  kiosk.add(bulb);

  // Exhaust fan on back wall
  const fanFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 10), darkMat);
  fanFrame.position.set(0.3, 0.1, 0.46);
  fanFrame.rotation.x = Math.PI / 2;
  kiosk.add(fanFrame);
  const fanBlade = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.08, 0.005), metalMat);
  fanBlade.position.set(0.3, 0.1, 0.468);
  fanBlade.rotation.x = Math.PI / 2;
  fanBlade.userData.animated = 'fan';
  kiosk.add(fanBlade);
  const fanHub = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), accentMat);
  fanHub.position.set(0.3, 0.1, 0.47);
  kiosk.add(fanHub);

  // Vertical sign — post and board
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.5, 6), darkMat);
  signPost.position.set(-0.45, -0.1, 0.25);
  kiosk.add(signPost);
  const signAngle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), metalMat);
  signAngle.position.set(-0.45, -0.1, 0.50);
  signAngle.rotation.x = 0.2;
  kiosk.add(signAngle);

  // The sign board — vertical, facing south toward player approach
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256; signCanvas.height = 64;
  const sctx = signCanvas.getContext('2d')!;
  sctx.fillStyle = '#1e293b';
  const rad = 8;
  sctx.beginPath(); sctx.moveTo(rad, 0); sctx.lineTo(256 - rad, 0);
  sctx.quadraticCurveTo(256, 0, 256, rad); sctx.lineTo(256, 64 - rad);
  sctx.quadraticCurveTo(256, 64, 256 - rad, 64); sctx.lineTo(rad, 64);
  sctx.quadraticCurveTo(0, 64, 0, 64 - rad); sctx.lineTo(0, rad);
  sctx.quadraticCurveTo(0, 0, rad, 0); sctx.closePath(); sctx.fill();
  sctx.fillStyle = '#fbbf24'; sctx.font = '700 24px system-ui'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.fillText('REPAIR', 128, 26);
  sctx.fillStyle = '#94a3b8'; sctx.font = '600 14px system-ui'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.fillText('KIOSK', 128, 48);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.minFilter = THREE.LinearFilter;
  // Stand the sign vertical (face normal -Y, southward)
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.14), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }));
  signMesh.position.set(-0.45, -0.1, 0.50);
  signMesh.rotation.x = Math.PI / 2;
  kiosk.add(signMesh);

  // Hanging tools on pegboard
  for (let i = 0; i < 4; i++) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 4), metalMat);
    peg.position.set(-0.3 + i * 0.2, -0.25, 0.43);
    kiosk.add(peg);
    const tool = new THREE.Mesh(
      [new THREE.BoxGeometry(0.008, 0.025, 0.005), new THREE.BoxGeometry(0.005, 0.03, 0.008), new THREE.BoxGeometry(0.012, 0.02, 0.005), new THREE.BoxGeometry(0.006, 0.028, 0.006)][i],
      new THREE.MeshToonMaterial({ color: [0x94a3b8, 0xf59e0b, 0x6b7280, 0xef4444][i] })
    );
    tool.position.set(-0.3 + i * 0.2, -0.27, 0.41);
    tool.userData.animated = 'tool';
    kiosk.add(tool);
  }

  // Welding torch on bench
  const torchHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.05, 5), darkMat);
  torchHandle.position.set(-0.22, -0.08, 0.50);
  torchHandle.rotation.x = Math.PI / 3;
  kiosk.add(torchHandle);
  const torchTip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.015, 6), accentMat);
  torchTip.position.set(-0.23, -0.06, 0.54);
  torchTip.userData.animated = 'torch';
  kiosk.add(torchTip);

  // Gear decoration on side
  const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 8), new THREE.MeshToonMaterial({ color: 0x64748b }));
  gear.position.set(0.48, 0.12, 0.35);
  gear.rotation.x = Math.PI / 2;
  gear.userData.animated = 'gear';
  kiosk.add(gear);
  // Teeth on gear
  for (let i = 0; i < 8; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.012), metalMat);
    const angle = (i / 8) * Math.PI * 2;
    tooth.position.set(0.48 + Math.cos(angle) * 0.045, 0.12 + Math.sin(angle) * 0.045, 0.35);
    tooth.userData.animated = 'gear';
    kiosk.add(tooth);
  }

  // Spark catcher tray at bottom
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.005), darkMat);
  tray.position.set(0, -0.22, 0.08);
  kiosk.add(tray);

  // Scrap metal parts on tray
  for (let i = 0; i < 4; i++) {
    const scrap = new THREE.Mesh(
      [new THREE.BoxGeometry(0.015, 0.01, 0.005), new THREE.SphereGeometry(0.008, 5, 5), new THREE.CylinderGeometry(0.006, 0.01, 0.01, 5), new THREE.BoxGeometry(0.01, 0.015, 0.004)][i],
      new THREE.MeshToonMaterial({ color: [0x6b7280, 0x94a3b8, 0xf59e0b, 0xef4444][i] })
    );
    scrap.position.set(-0.15 + i * 0.08, -0.22, 0.085);
    kiosk.add(scrap);
  }

  applyShadows(kiosk, true, true);
  return kiosk;
}

export function animateRepairKiosk(kiosk: THREE.Group, time: number) {
  kiosk.children.forEach(child => {
    if (!(child instanceof THREE.Mesh) || !child.userData.animated) return;
    const tag = child.userData.animated as string;

    if (tag === 'screen') {
      // Flicker
      if (child.material instanceof THREE.MeshBasicMaterial) {
        const f = Math.random() < 0.04 ? 0.2 + Math.random() * 0.8 : 1;
        child.material.opacity = f;
        child.material.transparent = true;
      }
    } else if (tag === 'bulb') {
      // Pulse
      if (child.material instanceof THREE.MeshBasicMaterial) {
        const i = 0.4 + Math.sin(time * 3) * 0.3;
        child.material.color.setHSL(0.12, 1.0, i);
      }
    } else if (tag === 'fan') {
      child.rotation.z += 0.08;
    } else if (tag === 'gear') {
      child.rotation.z += 0.03;
    } else if (tag === 'tool') {
      // Gentle sway
      child.rotation.z = Math.sin(time * 2 + child.position.x) * 0.02;
    } else if (tag === 'torch') {
      // Tiny wobble
      child.rotation.x = Math.PI / 3 + Math.sin(time * 4) * 0.02;
    }
  });
}

export function animateRepairSparky(visual: RobotVisual, time: number, repairPhase: number) {
  const bob = Math.sin(time * 3) * 0.015;
  visual.body.position.y = 0.3 + bob;
  if (visual.antennaTip) visual.antennaTip.position.y = 0.82 + Math.sin(time * 9) * 0.015;

  // Pupils look toward kiosk workbench
  const eyeX = Math.max(-0.025, Math.min(0.025, 0.05 * 0.018));
  const eyeY = Math.max(-0.015, Math.min(0.015, 0.25 * 0.012));
  visual.leftPupil.position.set(-0.07 + eyeX, 0.6 + eyeY, 0.75);
  visual.rightPupil.position.set(0.07 + eyeX, 0.6 + eyeY, 0.75);

  // Arm animation based on repair phase (0-1, cycles)
  const armSwing = Math.sin(repairPhase * Math.PI * 2) * 0.3;
  visual.rightArm.rotation.z = -0.3 + Math.max(0, armSwing) * 0.8;
  visual.rightArm.rotation.x = Math.max(0, armSwing) * 0.4;
  visual.leftArm.rotation.z = 0.3 + Math.min(0, armSwing) * 0.8;
  visual.leftArm.rotation.x = Math.min(0, armSwing) * 0.4;
}

export function animateSparkyWave(visual: RobotVisual, time: number) {
  const bob = Math.sin(time * 2.5) * 0.008;
  visual.body.position.y = 0.3 + bob;
  if (visual.antennaTip) visual.antennaTip.position.y = 0.82 + Math.sin(time * 8) * 0.015;

  // Pupils look toward player
  visual.leftPupil.position.set(-0.07 + 0.02, 0.6 + 0.01, 0.75);
  visual.rightPupil.position.set(0.07 + 0.02, 0.6 + 0.01, 0.75);

  // Wave: right arm raised ~60° with side-to-side sway
  visual.rightArm.rotation.z = -Math.PI / 3 + Math.sin(time * 4) * 0.3;
  visual.rightArm.rotation.x = -0.3;

  // Left arm hangs naturally
  visual.leftArm.rotation.z = 0.3;
  visual.leftArm.rotation.x = 0;
}

export function createPartsShop(x: number, y: number, bw = 8.0, bd = 4.0) {
  const shop = new THREE.Group();
  const bh = 1.8;
  const wallMat = createTexturedToonMaterial('tile_23.png', 8, 4, 0xf5e6d0);
  const trimMat = createToonMaterial(0x8b4513);
  const roofMat = createToonMaterial(0xc2410c);

  // Foundation slab — lifts the building off the ground
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(bw + 0.4, bd + 0.4, 0.1),
    createToonMaterial(0x94a3b8)
  );
  foundation.position.set(0, 0, 0.05);
  shop.add(foundation);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(bw, bd, 0.04),
    createTexturedToonMaterial('tile_43.png', 8, 4, 0x8b6b4a)
  );
  floor.position.set(0, 0, 0.12);
  shop.add(floor);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(bw, 0.08, bh),
    wallMat
  );
  backWall.position.set(0, -bd / 2, 0.1 + bh / 2);
  shop.add(backWall);

  for (let s = -1; s <= 1; s += 2) {
    const sideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, bd, bh),
      wallMat
    );
    sideWall.position.set(s * bw / 2, 0, 0.1 + bh / 2);
    shop.add(sideWall);
  }

  // Peaked roof (gable) with sloped panels
  const wallZ = 0.1 + bh;
  const rh = 0.5;
  const ew = bw + 0.6;
  const eh = bd / 2 + 0.3;
  const ridgeZ = wallZ + rh;
  const roofTrimMat = createToonMaterial(0x7c2d12);
  const roofSideMat = new THREE.MeshToonMaterial({
    color: 0xc2410c,
    gradientMap: createGradientTexture(5),
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const verts = new Float32Array([
      -ew / 2, 0, ridgeZ,
      ew / 2, 0, ridgeZ,
      -ew / 2, side * eh, wallZ,
      ew / 2, side * eh, wallZ,
    ]);
    const idx = [0, 1, 2, 1, 3, 2];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const slope = new THREE.Mesh(geo, roofSideMat);
    slope.castShadow = true;
    shop.add(slope);
  }
  // Ridge beam
  const ridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(ew, 0.08, 0.06),
    roofTrimMat
  );
  ridgeBeam.position.set(0, 0, ridgeZ);
  ridgeBeam.castShadow = true;
  shop.add(ridgeBeam);
  // Gable end fill (triangles)
  for (const side of [-1, 1]) {
    const verts = new Float32Array([
      side * ew / 2, 0, ridgeZ,
      side * ew / 2, -eh, wallZ,
      side * ew / 2, eh, wallZ,
    ]);
    const idx = [0, 1, 2];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const gable = new THREE.Mesh(geo, roofSideMat);
    shop.add(gable);
  }

  const fwY = bd / 2;
  const doorW = 0.8, doorH = 0.9;

  const frontMat = createTexturedToonMaterial('tile_23.png', 8, 4, 0xf5e6d0);
  for (let s = -1; s <= 1; s += 2) {
    const segStart = s === -1 ? -bw / 2 : doorW / 2 + 0.1;
    const segEnd = s === -1 ? -doorW / 2 - 0.1 : bw / 2;
    const segW = segEnd - segStart;
    if (segW < 0.01) continue;
    const segCx = (segStart + segEnd) / 2;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(segW, 0.08, bh),
      frontMat
    );
    wall.position.set(segCx, fwY, 0.1 + bh / 2);
    shop.add(wall);

    // Display window with warm interior glow
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(segW - 0.4, 0.04, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    win.position.set(segCx, fwY, 0.35);
    shop.add(win);

    // Window frame
    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(segW - 0.35, 0.06, 0.06),
      trimMat
    );
    winFrame.position.set(segCx, fwY, 0.62);
    shop.add(winFrame);
  }

  // Door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, 0.08, doorH),
    createToonMaterial(0x0f172a)
  );
  door.position.set(0, fwY, 0.1 + doorH / 2);
  shop.add(door);

  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + 0.1, 0.08, doorH + 0.06),
    trimMat
  );
  doorFrame.position.set(0, fwY, 0.1 + (doorH + 0.06) / 2);
  shop.add(doorFrame);

  // Porch step — wide solid slab in front of door
  const porchStep = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + 0.6, 0.3, 0.08),
    createToonMaterial(0x9ca3af)
  );
  porchStep.position.set(0, fwY + 0.15, 0.04);
  shop.add(porchStep);

  // Awning — red/white striped canopy over door
  const awningMat = createTexturedToonMaterial('tile_33.png', 6, 1, 0xdc2626);
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(bw - 0.4, 0.06, 0.15),
    awningMat
  );
  awning.position.set(0, fwY, 0.1 + bh + 0.08);
  shop.add(awning);

  // String lights across the facade
  for (let i = -2; i <= 2; i++) {
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    light.position.set(i * 1.2, fwY, 0.1 + bh - 0.02);
    shop.add(light);
  }

  // Rooftop sign — "PARTS & GEAR" on poles standing on the roof
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 500; signCanvas.height = 120;
  const sctx = signCanvas.getContext('2d')!;
  sctx.fillStyle = 'rgba(220,38,38,0.95)';
  const rad = 14;
  sctx.beginPath(); sctx.moveTo(rad, 0); sctx.lineTo(500 - rad, 0);
  sctx.quadraticCurveTo(500, 0, 500, rad); sctx.lineTo(500, 120 - rad);
  sctx.quadraticCurveTo(500, 120, 500 - rad, 120); sctx.lineTo(rad, 120);
  sctx.quadraticCurveTo(0, 120, 0, 120 - rad); sctx.lineTo(0, rad);
  sctx.quadraticCurveTo(0, 0, rad, 0); sctx.closePath(); sctx.fill();
  sctx.shadowColor = '#000'; sctx.shadowBlur = 6;
  sctx.fillStyle = '#f8fafc'; sctx.font = '700 52px system-ui'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.fillText('PARTS', 250, 46);
  sctx.fillText('& GEAR', 250, 92);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.minFilter = THREE.LinearFilter;
  signTex.flipY = false;

  const signZ = ridgeZ + 0.12;
  for (let px = -1; px <= 1; px += 2) {
    const pole = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.10),
      createToonMaterial(0x1a1a1a)
    );
    pole.position.set(px * 0.9, fwY, ridgeZ + 0.01 + 0.05);
    shop.add(pole);
  }
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.06, 0.44),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  signBoard.position.set(0, fwY, signZ);
  signBoard.scale.x = -1;
  shop.add(signBoard);

  shop.position.set(x, y, 0);
  applyShadows(shop, true, true);
  return shop;
}

export function createPartModel(partId: string): THREE.Group {
  const g = new THREE.Group();

  if (partId === 'battery') {
    // Battery body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.05, 0.018),
      new THREE.MeshToonMaterial({ color: 0x22c55e, gradientMap: createGradientTexture(3) })
    );
    body.position.set(0, 0, 0);
    g.add(body);
    // Positive terminal (red, raised)
    const posTerm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.008, 0.012, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    posTerm.rotation.x = Math.PI / 2;
    posTerm.position.set(0, 0.031, 0);
    g.add(posTerm);
    // Negative terminal (flat)
    const negTerm = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.003, 0.012),
      createToonMaterial(0x64748b)
    );
    negTerm.position.set(0, -0.028, 0);
    g.add(negTerm);
    // Charge indicator LED
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.003, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 })
    );
    led.position.set(0.016, 0.01, 0.009);
    g.add(led);
    // Battery band label
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.041, 0.008, 0.001),
      new THREE.MeshToonMaterial({ color: 0x166534 })
    );
    band.position.set(0, 0, 0.009);
    g.add(band);
  } else if (partId === 'letter') {
    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.03, 0.002),
      new THREE.MeshToonMaterial({ color: 0xf5e6c8 })
    );
    paper.position.set(0, 0, 0);
    g.add(paper);
    const flap = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.015, 0.001),
      new THREE.MeshToonMaterial({ color: 0xe8d5a0 })
    );
    flap.position.set(0, 0.007, 0.001);
    flap.rotation.x = -0.3;
    g.add(flap);
    const seal = new THREE.Mesh(
      new THREE.CircleGeometry(0.006, 8),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    seal.position.set(0, 0, 0.002);
    g.add(seal);
  }

  return g;
}

export function addExclamationMarker(parent: THREE.Group) {
  const marker = createExclamationMarker();
  marker.renderOrder = 61;
  const s = parent.scale.x;
  const worldSize = 0.5;
  marker.scale.set(worldSize / s, worldSize / s, 1);
  if (parent.rotation.x >= 1) {
    marker.position.set(0, 1.0, 0.46);
  } else {
    marker.position.set(0, 0, 0.5);
  }
  parent.add(marker);
  return marker;
}

export function createApartmentBuilding(x: number, y: number, bw = 4.0, bd = 4.0, doorX = 0) {
  const building = new THREE.Group();
  const storyH = 1.0, bh = storyH * 2;
  const wallMat = createTexturedToonMaterial('tile_23.png', 4, 4, 0xe8dcc8);
  const trimMat = createToonMaterial(0x6b4a3d);
  const roofMat = createToonMaterial(0x4a3728);
  const roofTrimMat = createToonMaterial(0x3a2718);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.2 });
  const warmGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
  const doorMat = createToonMaterial(0x0f172a);
  const stepMat = createToonMaterial(0x9ca3af);
  const fwY = bd / 2;

  // Foundation
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.4, bd + 0.4, 0.1), createToonMaterial(0x94a3b8));
  foundation.position.set(0, 0, 0.05);
  building.add(foundation);

  // Ground floor north (back) wall — solid, no door
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, storyH), wallMat);
  backWall.position.set(0, fwY, 0.1 + storyH / 2);
  building.add(backWall);

  // Ground floor side walls
  for (let s = -1; s <= 1; s += 2) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, bd, storyH), wallMat);
    side.position.set(s * bw / 2, 0, 0.1 + storyH / 2);
    building.add(side);
  }

  // Ground floor south (front) wall segments with door cutout at doorX
  const doorW = 0.7, doorH = 0.7;
  const segments: { start: number; end: number }[] = [];
  const gapL = doorX - doorW / 2 - 0.1;
  const gapR = doorX + doorW / 2 + 0.1;
  if (-bw / 2 < gapL) segments.push({ start: -bw / 2, end: gapL });
  if (gapR < bw / 2) segments.push({ start: gapR, end: bw / 2 });
  segments.forEach(({ start, end }) => {
    const segW = end - start;
    if (segW < 0.01) return;
    const segCx = (start + end) / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.08, storyH), wallMat);
    wall.position.set(segCx, -fwY, 0.1 + storyH / 2);
    building.add(wall);

    const win = new THREE.Mesh(new THREE.BoxGeometry(segW - 0.3, 0.04, 0.5), warmGlowMat);
    win.position.set(segCx, -fwY, 0.35);
    building.add(win);

    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(segW - 0.25, 0.06, 0.06), trimMat);
    winFrame.position.set(segCx, -fwY, 0.62);
    building.add(winFrame);
  });

  // Reception furniture visible through glass (south side)
  const furnMat = createToonMaterial(0x6b4226);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.5), furnMat);
  counter.position.set(-0.8, -0.5, 0.45);
  building.add(counter);

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.04), createToonMaterial(0x92400e));
  counterTop.position.set(-0.8, -0.5, 0.72);
  building.add(counterTop);

  const chairBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 8), createToonMaterial(0x334155));
  chairBase.position.set(0.7, -0.5, 0.14);
  building.add(chairBase);

  const chairSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.03, 8), createToonMaterial(0x475569));
  chairSeat.position.set(0.7, -0.5, 0.18);
  building.add(chairSeat);

  const lampPole = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.35), createToonMaterial(0x1e293b));
  lampPole.position.set(-1.0, 0.8, 0.3);
  building.add(lampPole);

  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  lampGlow.position.set(-1.0, 0.8, 0.55);
  building.add(lampGlow);

  // Door — south wall at doorX (z above wall z=0.6 so it renders in front)
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.08, doorH), doorMat);
  door.position.set(doorX, -fwY, 0.1 + storyH / 2 + 0.04);
  building.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.1, 0.08, doorH + 0.06), trimMat);
  doorFrame.position.set(doorX, -fwY, 0.1 + storyH / 2 + 0.04);
  building.add(doorFrame);

  // Door step
  const step = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.4, 0.3, 0.06), stepMat);
  step.position.set(doorX, -fwY, 0.03);
  building.add(step);

  // Floor divider between floors
  const floorDiv = new THREE.Mesh(new THREE.BoxGeometry(bw, bd, 0.04), createTexturedToonMaterial('tile_43.png', 5, 4, 0x8b6b4a));
  floorDiv.position.set(0, 0, 0.1 + storyH);
  building.add(floorDiv);

  // Second floor north (back) wall
  const upperBack = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, storyH), wallMat);
  upperBack.position.set(0, fwY, 0.1 + storyH + storyH / 2);
  building.add(upperBack);

  // Second floor side walls
  for (let s = -1; s <= 1; s += 2) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, bd, storyH), wallMat);
    side.position.set(s * bw / 2, 0, 0.1 + storyH + storyH / 2);
    building.add(side);
  }

  // Second floor south (front) wall
  const upperFront = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, storyH), wallMat);
  upperFront.position.set(0, -fwY, 0.1 + storyH + storyH / 2);
  building.add(upperFront);

  // Second floor south windows
  const winCount = 3;
  const winSpacing = bw / (winCount + 1);
  for (let i = 0; i < winCount; i++) {
    const wx = -bw / 2 + winSpacing * (i + 1);
    const ww = 0.6, wh = 0.5;
    const wz = 0.1 + storyH + storyH / 2;

    const winGlass = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.04, wh), glassMat);
    winGlass.position.set(wx, -fwY, wz);
    building.add(winGlass);

    const winGlow = new THREE.Mesh(new THREE.BoxGeometry(ww - 0.1, 0.02, wh - 0.1), glowMat);
    winGlow.position.set(wx, -fwY, wz + 0.05);
    building.add(winGlow);

    // Window frame (4 sides)
    const fH = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.08, 0.06, 0.04), trimMat);
    fH.position.set(wx, -fwY, wz + wh / 2 + 0.02);
    building.add(fH);
    const fH2 = fH.clone();
    fH2.position.set(wx, -fwY, wz - wh / 2 - 0.02);
    building.add(fH2);
    const fV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, wh + 0.08), trimMat);
    fV.position.set(wx - ww / 2 - 0.04, -fwY, wz);
    building.add(fV);
    const fV2 = fV.clone();
    fV2.position.set(wx + ww / 2 + 0.04, -fwY, wz);
    building.add(fV2);
  }

  // Awning over door
  const awningMat = createTexturedToonMaterial('tile_33.png', 6, 1, 0xdc2626);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.6, 0.06, 0.12), awningMat);
  awning.position.set(doorX, -fwY, 0.1 + storyH - 0.02);
  building.add(awning);

  // Sign above door
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 400; signCanvas.height = 100;
  const sctx = signCanvas.getContext('2d')!;
  sctx.fillStyle = 'rgba(30,41,59,0.94)';
  const rad = 10;
  sctx.beginPath(); sctx.moveTo(rad, 0); sctx.lineTo(400 - rad, 0);
  sctx.quadraticCurveTo(400, 0, 400, rad); sctx.lineTo(400, 100 - rad);
  sctx.quadraticCurveTo(400, 100, 400 - rad, 100); sctx.lineTo(rad, 100);
  sctx.quadraticCurveTo(0, 100, 0, 100 - rad); sctx.lineTo(0, rad);
  sctx.quadraticCurveTo(0, 0, rad, 0); sctx.closePath(); sctx.fill();
  sctx.fillStyle = '#fbbf24'; sctx.font = '700 32px system-ui'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.fillText("SPARKY'S APT", 200, 48);
  sctx.font = '500 18px system-ui';
  sctx.fillStyle = '#94a3b8';
  sctx.fillText('RECEPTION', 200, 78);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.minFilter = THREE.LinearFilter;
  signTex.flipY = false;
  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.12), new THREE.MeshBasicMaterial({ map: signTex }));
  signMesh.position.set(doorX, -fwY, 0.1 + storyH + 0.08);
  building.add(signMesh);

  // Roof
  const roofBase = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, bd + 0.4, 0.12), roofMat);
  roofBase.position.set(0, 0, 0.1 + bh + 0.06);
  building.add(roofBase);
  const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.7, bd + 0.5, 0.04), roofTrimMat);
  roofTrim.position.set(0, 0, 0.1 + bh + 0.14);
  building.add(roofTrim);

  // Door glow (subtle warm light spilling from the door)
  const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.2, 0.02, 0.04), new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.08 }));
  doorGlow.position.set(doorX, -fwY, 0.06);
  building.add(doorGlow);

  building.position.set(x, y, 0);
  return building;
}

export function createAbandonedBuilding(x: number, y: number, bw: number, bd: number, palette: 'concrete' | 'brick' | 'slate' | 'wood', heightOverride?: number) {
  const bldg = new THREE.Group();
  const bh = heightOverride ?? 2.5;

  // Reuse palette materials across all buildings
  const palettes = {
    concrete: { wall: 0x8a8a92, trim: 0x6b6b73, accent: 0x55555d, roof: 0x4a4a52, wallDark: 0x6e6e76 },
    brick:    { wall: 0x9c6b4c, trim: 0x7a4a2e, accent: 0xb07850, roof: 0x6b3a1e, wallDark: 0x7a5038 },
    slate:    { wall: 0x6a7a8a, trim: 0x4a5a6a, accent: 0x5a6a7a, roof: 0x3a4a5a, wallDark: 0x556670 },
    wood:     { wall: 0x8a6a4a, trim: 0x6a4a2a, accent: 0x9a7a5a, roof: 0x5a3a1a, wallDark: 0x6e5030 },
  };
  if (!_bldgPaletteMats.has(palette)) {
    const p = palettes[palette];
    _bldgPaletteMats.set(palette, {
      wall: createToonMaterial(p.wall), wallDark: createToonMaterial(p.wallDark),
      trim: createToonMaterial(p.trim), accent: createToonMaterial(p.accent),
      roof: createToonMaterial(p.roof),
    });
  }
  const pm = _bldgPaletteMats.get(palette)!;
  const { wall: wallMat, wallDark: wallDarkMat, trim: trimMat, accent: accentMat, roof: roofMat } = pm;
  wallMat.side = THREE.DoubleSide;
  wallDarkMat.side = THREE.DoubleSide;
  const { dark: darkMat, glass: glassMat, board: boardMat, veg: vegMat, rust: rustMat,
          steel: steelMat, brick: brickMat, crack: crackMat, red: redMat,
          dumpBody: dumpsterBodyMat, dumpLid: dumpsterLidMat, graffiti: graffitiMats } = _bldgSharedMats;

  const wallH = bh - 0.15;
  const southY = -bd / 2;

  // Foundation
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.4, bd + 0.4, 0.12), trimMat);
  foundation.position.set(0, 0, 0.06);
  bldg.add(foundation);

  // Interior floor — dark slab so you can't see grass through windows
  const floor = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.2, bd - 0.2, 0.08), darkMat);
  floor.position.set(0, 0, 0.16);
  bldg.add(floor);

  // === COLLAPSE ZONE (computed early so walls can skip it) ===
  const doCollapse = Math.random() > 0.55;
  let collapseX = 0, collapseY = 0, gapW = 0, gapD = 0;
  let csx = 1, csy = 1;
  if (doCollapse) {
    csx = Math.random() > 0.5 ? -1 : 1;
    csy = Math.random() > 0.5 ? -1 : 1;
    collapseX = csx * (bw / 2 - 0.3);
    collapseY = csy * (bd / 2 - 0.3);
    gapW = 0.6 + Math.random() * 0.5;
    gapD = 0.5 + Math.random() * 0.4;
  }

  // Helper: build a wall segment, splitting around collapse gap if needed
  const halfH = wallH / 2;
  function buildWallSegs(
    axis: 'x' | 'y', wallPos: number, wallLen: number, isLower: boolean,
    mat: THREE.Material, hasGap = false, thick = 0.18,
  ) {
    const segH = halfH;
    const zBase = isLower ? 0.1 + halfH / 2 : 0.1 + halfH + halfH / 2;

    // Determine if this wall overlaps the collapse gap
    const gapMin = axis === 'x' ? collapseX - gapW / 2 : collapseY - gapD / 2;
    const gapMax = axis === 'x' ? collapseX + gapW / 2 : collapseY + gapD / 2;
    const wallMin = -wallLen / 2;
    const wallMax = wallLen / 2;

    if (!hasGap || !doCollapse || gapMin >= wallMax || gapMax <= wallMin) {
      // No overlap — full wall
      const w = axis === 'x' ? new THREE.BoxGeometry(wallLen, thick, segH) : new THREE.BoxGeometry(thick, wallLen, segH);
      const mesh = new THREE.Mesh(w, mat);
      if (axis === 'x') mesh.position.set(0, wallPos, zBase);
      else mesh.position.set(wallPos, 0, zBase);
      bldg.add(mesh);
    } else {
      // Overlap — split into up to 2 segments, skip the gap
      const clampedMin = Math.max(gapMin, wallMin);
      const clampedMax = Math.min(gapMax, wallMax);
      const segments: [number, number][] = [];
      if (clampedMin > wallMin + 0.1) segments.push([wallMin, clampedMin]);
      if (clampedMax < wallMax - 0.1) segments.push([clampedMax, wallMax]);
      for (const [s, e] of segments) {
        const segLen = e - s;
        const segCenter = (s + e) / 2;
        const w = axis === 'x' ? new THREE.BoxGeometry(segLen, thick, segH) : new THREE.BoxGeometry(thick, segLen, segH);
        const mesh = new THREE.Mesh(w, mat);
        if (axis === 'x') mesh.position.set(segCenter, wallPos, zBase);
        else mesh.position.set(wallPos, segCenter, zBase);
        bldg.add(mesh);
      }
      // Jagged broken edges at gap boundaries
      for (const edge of [clampedMin, clampedMax]) {
        if (edge <= wallMin + 0.05 || edge >= wallMax - 0.05) continue;
        for (let ji = 0; ji < 3; ji++) {
          const jH = 0.15 + Math.random() * 0.35;
          const jW = 0.06 + Math.random() * 0.1;
          const jm = new THREE.Mesh(new THREE.BoxGeometry(jW, 0.08, jH), wallDarkMat);
          const jitter = (Math.random() - 0.5) * 0.08;
          if (axis === 'x') jm.position.set(edge + jitter, wallPos, 0.1 + jH / 2);
          else jm.position.set(wallPos, edge + jitter, 0.1 + jH / 2);
          jm.rotation.z = (Math.random() - 0.5) * 0.3;
          bldg.add(jm);
        }
      }
    }
  }

  // === SOUTH WALL ===
  buildWallSegs('x', southY, bw, true, wallDarkMat);
  buildWallSegs('x', southY, bw, false, wallMat);

  // === NORTH WALL ===
  buildWallSegs('x', bd / 2, bw, true, wallDarkMat);
  buildWallSegs('x', bd / 2, bw, false, wallMat);

  // === EAST/WEST WALLS ===
  for (const sx of [-1, 1]) {
    buildWallSegs('y', sx * bw / 2, bd, true, wallDarkMat);
    buildWallSegs('y', sx * bw / 2, bd, false, wallMat);
  }

  // Mid-band trim + second band for tall buildings
  const midBand = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.08, bd + 0.08, 0.08), accentMat);
  midBand.position.set(0, 0, 0.1 + halfH);
  bldg.add(midBand);
  if (bh > 4) {
    const midBand2 = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.08, bd + 0.08, 0.06), accentMat);
    midBand2.position.set(0, 0, 0.1 + wallH * 0.33);
    bldg.add(midBand2);
    const midBand3 = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.08, bd + 0.08, 0.06), accentMat);
    midBand3.position.set(0, 0, 0.1 + wallH * 0.66);
    bldg.add(midBand3);
  }

  // Top cornice
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.16, bd + 0.16, 0.1), accentMat);
  cornice.position.set(0, 0, 0.1 + wallH - 0.05);
  bldg.add(cornice);

  // === WINDOW HELPER — adds windows to any wall face ===
  const winRows = bh >= 5.5 ? 4 : bh >= 4.5 ? 3 : bh >= 3 ? 2 : 1;
  function addWallWindows(
    faceX: number, faceY: number, axis: 'x' | 'y', faceSign: number,
    wallLen: number, faceMat: THREE.Material,
    gapCenter?: number, gapHalfSize?: number,
  ) {
    const count = Math.max(3, Math.floor(wallLen / 0.8));
    const spacing = wallLen / count;
    for (let row = 0; row < winRows; row++) {
      const rowZ = 0.1 + wallH * ((row + 0.5) / winRows);
      for (let i = 0; i < count; i++) {
        const pos = -wallLen / 2 + spacing * (i + 0.5);
        if (gapCenter !== undefined && gapHalfSize !== undefined) {
          if (Math.abs(pos - gapCenter) < gapHalfSize + 0.25) continue;
        }
        const ww = 0.3 + Math.random() * 0.25;
        const wh = 0.4 + Math.random() * 0.3;
        const state = Math.random();
        const fx = axis === 'x' ? pos : faceX;
        const fy = axis === 'y' ? pos : faceY;
        const off = faceSign * 0.11;
        const fd = 0.06;
        const fo = off - 0.03;

        const isY = axis === 'y';
        const bx = (w: number, d: number, h: number) => isY ? new THREE.BoxGeometry(d, w, h) : new THREE.BoxGeometry(w, d, h);

        if (state < 0.20) {
          // Boarded — glass + frame + cracks + planks on top
          const plankOff = faceSign * 0.06;
          // 1. Glass pane
          const glass = new THREE.Mesh(bx(ww, 0.04, wh), darkMat);
          if (axis === 'x') glass.position.set(fx, fy + off, rowZ);
          else glass.position.set(fx + off, fy, rowZ);
          bldg.add(glass);
          // 2. Frame
          for (const [lw, lz] of [[ww + 0.1, wh / 2], [ww + 0.1, -wh / 2]] as const) {
            const f = new THREE.Mesh(bx(lw, fd, fd), trimMat);
            if (axis === 'x') f.position.set(fx, fy + fo, rowZ + lz);
            else f.position.set(fx + fo, fy, rowZ + lz);
            bldg.add(f);
          }
          for (const [lh, lz] of [[wh + 0.1, -ww / 2], [wh + 0.1, ww / 2]] as const) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(fd, fd, lh), trimMat);
            if (axis === 'x') f.position.set(fx + lz, fy + fo, rowZ);
            else f.position.set(fx + fo, fy + lz, rowZ);
            bldg.add(f);
          }
          // 3. Cracks in glass
          const numCracks = 1 + (Math.random() > 0.6 ? 1 : 0);
          for (let ci = 0; ci < numCracks; ci++) {
            const crackLen = Math.min(ww, wh) * (0.4 + Math.random() * 0.4);
            const crack = new THREE.Mesh(bx(crackLen, 0.05, 0.015), crackMat);
            const crackAngle = Math.PI / 4 + (Math.random() - 0.5) * 0.6;
            if (axis === 'x') {
              crack.position.set(fx + (Math.random() - 0.5) * ww * 0.3, fy + off + 0.01, rowZ + (Math.random() - 0.5) * wh * 0.3);
              crack.rotation.z = crackAngle;
            } else {
              crack.position.set(fx + off + 0.01, fy + (Math.random() - 0.5) * ww * 0.3, rowZ + (Math.random() - 0.5) * wh * 0.3);
              crack.rotation.x = crackAngle;
            }
            bldg.add(crack);
          }
          // 4. Planks on top — 4 styles
          const style = Math.floor(Math.random() * 4);
          const pd = 0.06;
          if (style === 0) {
            // X boarding: two diagonal planks crossing
            const diag = Math.sqrt(ww * ww + wh * wh) + 0.1;
            const angle = Math.atan2(wh, ww);
            const p1 = new THREE.Mesh(bx(diag, pd, pd), boardMat);
            const p2 = new THREE.Mesh(bx(diag, pd, pd), boardMat);
            if (axis === 'x') {
              p1.position.set(fx, fy + plankOff, rowZ); p1.rotation.z = angle;
              p2.position.set(fx, fy + plankOff, rowZ); p2.rotation.z = -angle;
            } else {
              p1.position.set(fx + plankOff, fy, rowZ); p1.rotation.x = angle;
              p2.position.set(fx + plankOff, fy, rowZ); p2.rotation.x = -angle;
            }
            bldg.add(p1); bldg.add(p2);
          } else if (style === 1) {
            // Single diagonal plank
            const d = new THREE.Mesh(bx(ww + 0.14, pd, 0.05), boardMat);
            if (axis === 'x') { d.position.set(fx, fy + plankOff, rowZ); d.rotation.z = 0.7; }
            else { d.position.set(fx + plankOff, fy, rowZ); d.rotation.x = 0.7; }
            bldg.add(d);
          } else if (style === 2) {
            // Horizontal slats (2–3)
            const n = 2 + (Math.random() > 0.5 ? 1 : 0);
            for (let s = 0; s < n; s++) {
              const slat = new THREE.Mesh(bx(ww + 0.06, pd, 0.05), boardMat);
              const zOff = (s - (n - 1) / 2) * (wh / n);
              if (axis === 'x') slat.position.set(fx, fy + plankOff, rowZ + zOff);
              else slat.position.set(fx + plankOff, fy, rowZ + zOff);
              bldg.add(slat);
            }
          } else {
            // Vertical slats (2–3)
            const n = 2 + (Math.random() > 0.5 ? 1 : 0);
            for (let s = 0; s < n; s++) {
              const slat = new THREE.Mesh(new THREE.BoxGeometry(pd, pd, wh + 0.06), boardMat);
              const xOff = (s - (n - 1) / 2) * (ww / n);
              if (axis === 'x') slat.position.set(fx + xOff, fy + plankOff, rowZ);
              else slat.position.set(fx + plankOff, fy + xOff, rowZ);
              bldg.add(slat);
            }
          }
        } else if (state < 0.40) {
          // Intact glass with frame
          const glass = new THREE.Mesh(bx(ww, 0.04, wh), darkMat);
          if (axis === 'x') glass.position.set(fx, fy + off, rowZ);
          else glass.position.set(fx + off, fy, rowZ);
          bldg.add(glass);
          for (const [lw, lz] of [[ww + 0.1, wh / 2], [ww + 0.1, -wh / 2]] as const) {
            const f = new THREE.Mesh(bx(lw, fd, fd), trimMat);
            if (axis === 'x') f.position.set(fx, fy + fo, rowZ + lz);
            else f.position.set(fx + fo, fy, rowZ + lz);
            bldg.add(f);
          }
          for (const [lh, lz] of [[wh + 0.1, -ww / 2], [wh + 0.1, ww / 2]] as const) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(fd, fd, lh), trimMat);
            if (axis === 'x') f.position.set(fx + lz, fy + fo, rowZ);
            else f.position.set(fx + fo, fy + lz, rowZ);
            bldg.add(f);
          }
        } else if (state < 0.55) {
          // Cracked glass — intact frame with diagonal crack line
          const glass = new THREE.Mesh(bx(ww, 0.04, wh), darkMat);
          if (axis === 'x') glass.position.set(fx, fy + off, rowZ);
          else glass.position.set(fx + off, fy, rowZ);
          bldg.add(glass);
          // Frame
          for (const [lw, lz] of [[ww + 0.1, wh / 2], [ww + 0.1, -wh / 2]] as const) {
            const f = new THREE.Mesh(bx(lw, fd, fd), trimMat);
            if (axis === 'x') f.position.set(fx, fy + fo, rowZ + lz);
            else f.position.set(fx + fo, fy, rowZ + lz);
            bldg.add(f);
          }
          for (const [lh, lz] of [[wh + 0.1, -ww / 2], [wh + 0.1, ww / 2]] as const) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(fd, fd, lh), trimMat);
            if (axis === 'x') f.position.set(fx + lz, fy + fo, rowZ);
            else f.position.set(fx + fo, fy + lz, rowZ);
            bldg.add(f);
          }
          // Diagonal crack
          const crackLen = Math.min(ww, wh) * 0.8;
          const crack = new THREE.Mesh(bx(crackLen, 0.05, 0.02), crackMat);
          const crackAngle = Math.PI / 4 + (Math.random() - 0.5) * 0.3;
          if (axis === 'x') {
            crack.position.set(fx, fy + off + 0.01, rowZ);
            crack.rotation.z = crackAngle;
          } else {
            crack.position.set(fx + off + 0.01, fy, rowZ);
            crack.rotation.x = crackAngle;
          }
          bldg.add(crack);
        } else if (state < 0.70) {
          // Glass with single diagonal board — board over intact glass
          const glass = new THREE.Mesh(bx(ww, 0.04, wh), darkMat);
          if (axis === 'x') glass.position.set(fx, fy + off, rowZ);
          else glass.position.set(fx + off, fy, rowZ);
          bldg.add(glass);
          // Frame
          for (const [lw, lz] of [[ww + 0.1, wh / 2], [ww + 0.1, -wh / 2]] as const) {
            const f = new THREE.Mesh(bx(lw, fd, fd), trimMat);
            if (axis === 'x') f.position.set(fx, fy + fo, rowZ + lz);
            else f.position.set(fx + fo, fy, rowZ + lz);
            bldg.add(f);
          }
          for (const [lh, lz] of [[wh + 0.1, -ww / 2], [wh + 0.1, ww / 2]] as const) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(fd, fd, lh), trimMat);
            if (axis === 'x') f.position.set(fx + lz, fy + fo, rowZ);
            else f.position.set(fx + fo, fy + lz, rowZ);
            bldg.add(f);
          }
          // Single diagonal plank nailed over
          const pdCrack = 0.04;
          const plank = new THREE.Mesh(bx(ww * 0.9, pdCrack, 0.05), trimMat);
          if (axis === 'x') {
            plank.position.set(fx, fy + off + 0.02, rowZ);
            plank.rotation.z = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.3);
          } else {
            plank.position.set(fx + off + 0.02, fy, rowZ);
            plank.rotation.x = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.3);
          }
          bldg.add(plank);
        } else if (state < 0.85) {
          // Broken shard — glass remnant with frame piece
          const shard = new THREE.Mesh(bx(ww * 0.5, 0.04, wh * 0.6), glassMat);
          if (axis === 'x') {
            shard.position.set(fx, fy + off + 0.01, rowZ - 0.06);
            shard.rotation.z = 0.3 * (Math.random() > 0.5 ? 1 : -1);
          } else {
            shard.position.set(fx + off + 0.01, fy, rowZ - 0.06);
            shard.rotation.x = 0.3 * (Math.random() > 0.5 ? 1 : -1);
          }
          bldg.add(shard);
          // Small frame remnant on one side
          const rem = new THREE.Mesh(new THREE.BoxGeometry(fd, fd, wh * 0.4), trimMat);
          const side = Math.random() > 0.5 ? 1 : -1;
          if (axis === 'x') rem.position.set(fx + side * ww * 0.3, fy + fo, rowZ);
          else rem.position.set(fx + fo, fy + side * ww * 0.3, rowZ);
          bldg.add(rem);
        } else if (state < 0.93) {
          // Empty dark hole
          const hole = new THREE.Mesh(bx(ww, 0.12, wh), darkMat);
          if (axis === 'x') hole.position.set(fx, fy + off, rowZ);
          else hole.position.set(fx + off, fy, rowZ);
          bldg.add(hole);
        } else {
          // Just frame (no glass, no board)
          for (const [lw, lz] of [[ww + 0.1, wh / 2], [ww + 0.1, -wh / 2]] as const) {
            const f = new THREE.Mesh(bx(lw, fd, fd), trimMat);
            if (axis === 'x') f.position.set(fx, fy + fo, rowZ + lz);
            else f.position.set(fx + fo, fy, rowZ + lz);
            bldg.add(f);
          }
          for (const [lh, lz] of [[wh + 0.1, -ww / 2], [wh + 0.1, ww / 2]] as const) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(fd, fd, lh), trimMat);
            if (axis === 'x') f.position.set(fx + lz, fy + fo, rowZ);
            else f.position.set(fx + fo, fy + lz, rowZ);
            bldg.add(f);
          }
        }
      }
    }
  }

  // === SOUTH WALL WINDOWS ===
  addWallWindows(0, southY, 'x', -1, bw, wallMat, doCollapse && csy === -1 ? collapseX : undefined, doCollapse && csy === -1 ? gapW / 2 : undefined);

  // === NORTH WALL WINDOWS ===
  addWallWindows(0, bd / 2, 'x', 1, bw, wallMat, doCollapse && csy === 1 ? collapseX : undefined, doCollapse && csy === 1 ? gapW / 2 : undefined);

  // === EAST/WEST WALL WINDOWS ===
  addWallWindows(bw / 2, 0, 'y', 1, bd, wallMat, doCollapse && csx === 1 ? collapseY : undefined, doCollapse && csx === 1 ? gapD / 2 : undefined);
  addWallWindows(-bw / 2, 0, 'y', -1, bd, wallMat, doCollapse && csx === -1 ? collapseY : undefined, doCollapse && csx === -1 ? gapD / 2 : undefined);

  // === DOOR on south wall ===
  const doorW = 0.6, doorH = 1.0;
  const doorX = bw * 0.2 * (Math.random() > 0.5 ? 1 : -1);
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.14, doorH), darkMat);
  door.position.set(doorX, southY - 0.11, 0.1 + doorH / 2);
  bldg.add(door);
  for (const [fw, fh, fp] of [
    [doorW + 0.14, 0.08, [0, doorH / 2]],
    [doorW + 0.14, 0.08, [0, -doorH / 2]],
    [0.08, doorH + 0.14, [-doorW / 2 - 0.04, 0]],
    [0.08, doorH + 0.14, [doorW / 2 + 0.04, 0]],
  ] as const) {
    const df = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.09, fh), trimMat);
    df.position.set(doorX + fp[0], southY - 0.14, 0.1 + doorH / 2 + fp[1]);
    bldg.add(df);
  }
  const step = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.5, 0.18, 0.1), trimMat);
  step.position.set(doorX, southY - 0.14, 0.05);
  bldg.add(step);

  // === ENTRANCE CANOPY (50%) or simple awning ===
  if (Math.random() > 0.5) {
    // Large canopy with support columns
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.06), boardMat);
    canopy.position.set(doorX, southY - 0.3, 0.1 + doorH + 0.12);
    bldg.add(canopy);
    for (const cx of [-0.55, 0.55]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, doorH + 0.1, 4), steelMat);
      col.position.set(doorX + cx, southY - 0.55, 0.1 + (doorH + 0.1) / 2);
      bldg.add(col);
    }
  } else {
    const awning = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.4, 0.35, 0.05), boardMat);
    awning.position.set(doorX, southY - 0.18, 0.1 + doorH + 0.08);
    bldg.add(awning);
  }

  // === SECOND DOOR on east or west wall (40%) ===
  if (Math.random() > 0.6) {
    const sdSide = Math.random() > 0.5 ? 1 : -1;
    const sdY = (Math.random() - 0.5) * bd * 0.4;
    const sdX = sdSide * bw / 2;
    const sd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.85), darkMat);
    sd.position.set(sdX + sdSide * 0.02, sdY, 0.1 + 0.425);
    bldg.add(sd);
    // Metal frame
    for (const [fw, fd, fp] of [
      [0.06, 0.5, [0, 0.425]],
      [0.06, 0.5, [0, -0.425]],
    ] as const) {
      const sf = new THREE.Mesh(new THREE.BoxGeometry(0.05, fw, fd), steelMat);
      sf.position.set(sdX + sdSide * 0.04, sdY + fp[0], 0.1 + fp[1]);
      bldg.add(sf);
    }
  }

  // === TOWER/STAIRWELL SECTION ===
  const towerW = bw * 0.3;
  const towerD = bd * 0.35;
  const towerH = 1.2 + Math.random() * 0.6;
  const towerSide = Math.random() > 0.5 ? -1 : 1;
  const towerX = towerSide * (bw / 2 - towerW / 2);
  const towerY = (Math.random() > 0.5 ? -1 : 1) * (bd / 2 - towerD / 2);
  const towerGroup = new THREE.Group();
  for (const [tx, ty, tw, td] of [
    [0, -towerD / 2, towerW, 0.14],
    [0, towerD / 2, towerW, 0.14],
    [-towerW / 2, 0, 0.14, towerD],
    [towerW / 2, 0, 0.14, towerD],
  ] as const) {
    const twall = new THREE.Mesh(new THREE.BoxGeometry(tw, ty === 0 ? td : 0.14, towerH), wallDarkMat);
    twall.position.set(tx, ty, 0.1 + wallH + towerH / 2);
    towerGroup.add(twall);
  }
  const towerCap = new THREE.Mesh(new THREE.BoxGeometry(towerW + 0.1, towerD + 0.1, 0.08), roofMat);
  towerCap.position.set(0, 0, 0.1 + wallH + towerH + 0.04);
  towerGroup.add(towerCap);
  const towerDoor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.5), darkMat);
  towerDoor.position.set(0, -towerD / 2 - 0.02, 0.1 + wallH + 0.3);
  towerGroup.add(towerDoor);
  towerGroup.position.set(towerX, towerY, 0);
  bldg.add(towerGroup);

  // === FLAT ROOF ===
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.14, bd + 0.14, 0.14), roofMat);
  roofSlab.position.set(0, 0, 0.1 + bh - 0.07);
  bldg.add(roofSlab);

  // Parapet walls
  for (const [side, sy] of [['south', -bd / 2], ['north', bd / 2]] as const) {
    const para = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.14, 0.1, 0.24), accentMat);
    para.position.set(0, sy, 0.1 + bh + 0.12);
    bldg.add(para);
  }
  for (const sx of [-1, 1]) {
    const para = new THREE.Mesh(new THREE.BoxGeometry(0.1, bd + 0.14, 0.24), accentMat);
    para.position.set(sx * bw / 2, 0, 0.1 + bh + 0.12);
    bldg.add(para);
  }

  // === ROOF RAILING (40%) ===
  if (Math.random() > 0.6) {
    const railSide = Math.random() > 0.5 ? -1 : 1;
    const railLen = bw * 0.6;
    const railX = (Math.random() - 0.5) * bw * 0.2;
    for (let ri = 0; ri < 4; ri++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), steelMat);
      post.position.set(railX - railLen / 2 + ri * railLen / 3, railSide * (bd / 2 - 0.1), 0.1 + bh + 0.12 + 0.15);
      bldg.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.02, 0.02), steelMat);
    rail.position.set(railX, railSide * (bd / 2 - 0.1), 0.1 + bh + 0.12 + 0.3);
    bldg.add(rail);
  }

  // === COLLAPSED CORNER (debris on ground near corner) ===
  if (doCollapse) {
    for (let ri = 0; ri < 5; ri++) {
      const rr = new THREE.Mesh(
        new THREE.BoxGeometry(0.12 + Math.random() * 0.25, 0.1 + Math.random() * 0.2, 0.06 + Math.random() * 0.1),
        trimMat
      );
      rr.rotation.z = Math.random() * 0.5;
      rr.position.set(
        collapseX + (Math.random() - 0.5) * gapW * 1.5,
        collapseY + (Math.random() - 0.5) * gapD * 1.5,
        0.04
      );
      bldg.add(rr);
    }
    for (let ri = 0; ri < 2; ri++) {
      const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2 + Math.random() * 0.3, 4), rustMat);
      rb.position.set(
        collapseX + (Math.random() - 0.5) * gapW * 0.8,
        collapseY + csy * gapD * 0.55,
        0.1 + bh + 0.05 + Math.random() * 0.1
      );
      rb.rotation.x = (Math.random() - 0.5) * 0.4;
      rb.rotation.z = (Math.random() - 0.5) * 0.4;
      bldg.add(rb);
    }
  }

  // === WATER TANK ===
  if (Math.random() > 0.15) {
    const tx = bw * 0.25 * (Math.random() > 0.5 ? 1 : -1);
    const ty = bd * 0.2 * (Math.random() > 0.5 ? 1 : -1);
    const tankH = 0.5 + Math.random() * 0.3;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, tankH, 6), steelMat);
    tank.position.set(tx, ty, 0.1 + bh + 0.14 + tankH / 2 + 0.15);
    bldg.add(tank);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 6), accentMat);
    band.position.set(tx, ty, 0.1 + bh + 0.14 + tankH * 0.4 + 0.15);
    bldg.add(band);
    for (const [lx, ly] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 4), steelMat);
      leg.position.set(tx + lx, ty + ly, 0.1 + bh + 0.14 + 0.1);
      bldg.add(leg);
    }
  }

  // === SATELLITE DISH (30%) ===
  if (Math.random() > 0.7) {
    const dx = bw * 0.3 * (Math.random() > 0.5 ? 1 : -1);
    const dy = bd * 0.25 * (Math.random() > 0.5 ? 1 : -1);
    const dishArm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 4), steelMat);
    dishArm.position.set(dx, dy, 0.1 + bh + 0.14 + 0.25);
    bldg.add(dishArm);
    const dish = new THREE.Mesh(new THREE.CircleGeometry(0.15, 8), steelMat);
    dish.position.set(dx, dy, 0.1 + bh + 0.14 + 0.36);
    dish.rotation.x = -0.4;
    dish.rotation.z = Math.random() * Math.PI * 2;
    bldg.add(dish);
  }

  // === ROOF ACCESS SHED ===
  const shedW = 0.5 + Math.random() * 0.3;
  const shedD = shedW * 0.7;
  const shedH = 0.3;
  const shedX = (Math.random() - 0.5) * bw * 0.3;
  const shedY = (Math.random() - 0.5) * bd * 0.3;
  const shed = new THREE.Mesh(new THREE.BoxGeometry(shedW, shedD, shedH), wallMat);
  shed.position.set(shedX, shedY, 0.1 + bh + 0.07 + shedH / 2);
  bldg.add(shed);
  const shedDoor = new THREE.Mesh(new THREE.BoxGeometry(shedW * 0.3, 0.04, shedH * 0.7), accentMat);
  shedDoor.position.set(shedX, shedY + shedD / 2 + 0.03, 0.1 + bh + 0.07 + shedH * 0.35);
  bldg.add(shedDoor);

  // === VENTS / AC CONDENSER / SOLAR PANELS (mixed) ===
  for (let vi = 0; vi < 3; vi++) {
    if (Math.random() > 0.5) continue;
    const vx = -bw * 0.3 + vi * bw * 0.3;
    const vy = -bd * 0.3;
    const roll = Math.random();
    if (roll < 0.4) {
      // Standard vent
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.14), steelMat);
      vent.position.set(vx, vy, 0.1 + bh + 0.07 + 0.07);
      bldg.add(vent);
    } else if (roll < 0.65) {
      // AC condenser — larger box with fan grille
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.25), steelMat);
      ac.position.set(vx, vy, 0.1 + bh + 0.07 + 0.125);
      bldg.add(ac);
      const grille = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 6), darkMat);
      grille.position.set(vx, vy, 0.1 + bh + 0.07 + 0.26);
      bldg.add(grille);
    } else {
      // Solar panel frame — tilted panels
      for (let pi = 0; pi < 2; pi++) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.22), darkMat);
        panel.position.set(vx + pi * 0.4 - 0.2, vy, 0.1 + bh + 0.07 + 0.12);
        panel.rotation.x = -0.4;
        bldg.add(panel);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.03, 0.01), steelMat);
        frame.position.set(vx + pi * 0.4 - 0.2, vy - 0.1, 0.1 + bh + 0.07 + 0.22);
        bldg.add(frame);
      }
    }
  }

  // === SKYLIGHT (30%) ===
  if (Math.random() > 0.7) {
    const skylight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.04), glassMat);
    skylight.position.set((Math.random() - 0.5) * bw * 0.3, (Math.random() - 0.5) * bd * 0.3, 0.1 + bh + 0.01);
    bldg.add(skylight);
    const skylightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.03), trimMat);
    skylightFrame.position.set(skylight.position.x, skylight.position.y, 0.1 + bh + 0.025);
    bldg.add(skylightFrame);
  }

  // === TALL ANTENNA ===
  if (Math.random() > 0.3) {
    const ax = bw * 0.35 * (Math.random() > 0.5 ? 1 : -1);
    const ay = bd * 0.3 * (Math.random() > 0.5 ? 1 : -1);
    const antH = 0.8 + Math.random() * 0.5;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, antH, 4), steelMat);
    ant.position.set(ax, ay, 0.1 + bh + 0.07 + antH / 2 + 0.15);
    bldg.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), redMat);
    tip.position.set(ax, ay, 0.1 + bh + 0.07 + antH + 0.18);
    bldg.add(tip);
    for (let ci = 0; ci < 2; ci++) {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.02), steelMat);
      cross.position.set(ax, ay, 0.1 + bh + 0.07 + antH * (0.3 + ci * 0.35) + 0.15);
      bldg.add(cross);
    }
  }

  // === DRAINAGE PIPES — vertical downspouts ===
  for (let di = 0; di < 2; di++) {
    if (Math.random() > 0.6) continue;
    const ds = Math.random() > 0.5 ? 1 : -1;
    const dx = ds * (bw / 2 - 0.05);
    const dy = (Math.random() - 0.5) * bd * 0.6;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, wallH, 4), steelMat);
    pipe.position.set(dx, dy, 0.1 + wallH / 2);
    bldg.add(pipe);
    // Bracket at mid-height
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), steelMat);
    bracket.position.set(dx - ds * 0.02, dy, 0.1 + wallH * 0.5);
    bldg.add(bracket);
  }

  // === AC UNITS on walls ===
  for (let ai = 0; ai < 3; ai++) {
    if (Math.random() > 0.5) continue;
    const as = Math.random() > 0.5 ? 1 : -1;
    const ax = as * bw / 2;
    const ay = (Math.random() - 0.5) * bd * 0.5;
    const az = 0.1 + wallH * (0.25 + Math.random() * 0.3);
    const acUnit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.2), steelMat);
    acUnit.position.set(ax + as * 0.06, ay, az);
    bldg.add(acUnit);
    // Fan grille on face
      const grille = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 6), darkMat);
    grille.position.set(ax + as * 0.11, ay, az);
    grille.rotation.z = Math.PI / 2;
    bldg.add(grille);
  }

  // === VINES hanging over edge ===
  for (let vi = 0; vi < 3; vi++) {
    if (Math.random() > 0.5) continue;
    const vs = Math.random() > 0.5 ? 1 : -1;
    const vx = (Math.random() - 0.5) * bw * 0.6;
    const vineLen = 0.3 + Math.random() * 0.5;
    const vine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, vineLen), vegMat);
    vine.position.set(vx, vs * (bd / 2 + 0.01), 0.1 + wallH - vineLen / 2);
    bldg.add(vine);
  }

  // === FIRE ESCAPE ===
  if (Math.random() > 0.25) {
    const feX = bw * 0.3 * (Math.random() > 0.5 ? 1 : -1);
    for (let fi = 0; fi < 3; fi++) {
      const fz = 0.1 + wallH * (0.25 + fi * 0.3);
      const plat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), steelMat);
      plat.position.set(feX, southY - 0.25, fz);
      bldg.add(plat);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), steelMat);
      bracket.position.set(feX, southY - 0.14, fz - 0.08);
      bldg.add(bracket);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.22), steelMat);
      rail.position.set(feX, southY - 0.45, fz + 0.11);
      bldg.add(rail);
      for (const rx of [-0.3, 0, 0.3]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), steelMat);
        post.position.set(feX + rx, southY - 0.45, fz + 0.11);
        bldg.add(post);
      }
    }
    const ladderH = wallH * 0.55;
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, ladderH), steelMat);
    ladder.position.set(feX + 0.3, southY - 0.4, 0.1 + wallH * 0.25 + ladderH / 2);
    bldg.add(ladder);
  }

  // === GRAFFITI ===
  const graffitiColors = [0xdd3333, 0x3366dd, 0x33aa55, 0xddaa33, 0xff66aa];
  for (let gi = 0; gi < 3; gi++) {
    if (Math.random() > 0.5) continue;
    const gw = 0.4 + Math.random() * 0.7;
    const gh = 0.3 + Math.random() * 0.5;
    const gs = Math.random() > 0.5 ? 1 : -1;
    const gx = (Math.random() - 0.5) * bw * 0.5;
    const gy = gs * (bd / 2 + 0.02);
    const gz = 0.3 + Math.random() * (wallH * 0.5);
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(gw, 0.015, gh),
      graffitiMats[gi % graffitiMats.length]
    );
    tag.position.set(gx, gy, gz);
    bldg.add(tag);
  }

  // === CRACK LINES (replaces water stains) ===
  for (let ci = 0; ci < 3; ci++) {
    if (Math.random() > 0.5) continue;
    const ch = 0.3 + Math.random() * 0.6;
    const cx = (Math.random() - 0.5) * bw * 0.5;
    const cs = Math.random() > 0.5 ? 1 : -1;
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.015, ch),
      crackMat
    );
    crack.position.set(cx, cs * (bd / 2 + 0.015), 0.3 + Math.random() * (wallH * 0.5));
    crack.rotation.z = (Math.random() - 0.5) * 0.3;
    bldg.add(crack);
  }

  // === EXPOSED BRICK PATCHES ===
  for (let bi = 0; bi < 3; bi++) {
    if (Math.random() > 0.5) continue;
    const bw2 = 0.3 + Math.random() * 0.4;
    const bh2 = 0.2 + Math.random() * 0.3;
    const bs = Math.random() > 0.5 ? 1 : -1;
    const bx = (Math.random() - 0.5) * bw * 0.4;
    const bz = 0.3 + Math.random() * (wallH * 0.4);
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(bw2, 0.02, bh2),
      brickMat
    );
    patch.position.set(bx, bs * (bd / 2 + 0.01), bz);
    bldg.add(patch);
  }

  // === BOLLARDS near door ===
  for (let bi = 0; bi < 3; bi++) {
    if (Math.random() > 0.6) continue;
    const bx = doorX + (bi - 1) * 0.35;
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.15, 4), steelMat);
    bollard.position.set(bx, southY - 0.25, 0.075);
    bldg.add(bollard);
  }

  // === DUMPSTER (30%) ===
  if (Math.random() > 0.7) {
    const dumpSide = Math.random() > 0.5 ? 1 : -1;
    const dumpX = dumpSide * (bw / 2 + 0.4);
    const dumpY = (Math.random() - 0.5) * bd * 0.4;
    const dumpster = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.25), dumpsterBodyMat);
    dumpster.position.set(dumpX, dumpY, 0.125);
    bldg.add(dumpster);
    // Lid slightly open
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3), dumpsterLidMat);
    lid.position.set(dumpX, dumpY - 0.08, 0.27);
    lid.rotation.x = 0.3;
    bldg.add(lid);
    // Trash spilling out
    for (let ti = 0; ti < 3; ti++) {
      const trash = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 + Math.random() * 0.06, 0.04, 0.03),
        Math.random() > 0.5 ? boardMat : trimMat
      );
      trash.position.set(dumpX + (Math.random() - 0.5) * 0.3, dumpY + 0.2 + Math.random() * 0.1, 0.02);
      trash.rotation.z = Math.random() * Math.PI;
      bldg.add(trash);
    }
  }

  // === BUSHES at base ===
  for (let bi = 0; bi < 3; bi++) {
    if (Math.random() > 0.5) continue;
    const bs = Math.random() > 0.5 ? 1 : -1;
    const bx = (Math.random() - 0.5) * bw * 0.5;
    for (let si = 0; si < 2; si++) {
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 6, 6),
        vegMat
      );
      bush.position.set(
        bx + (Math.random() - 0.5) * 0.2,
        bs * (bd / 2 + 0.1 + Math.random() * 0.15),
        0.08
      );
      bldg.add(bush);
    }
  }

  // === RUBBLE at base ===
  for (let ri = 0; ri < 8; ri++) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const rx = (Math.random() - 0.5) * bw * 0.5;
    const ry = side * (bd / 2 + 0.08 + Math.random() * 0.35);
    const rt = Math.random();
    let rubble: THREE.Mesh;
    if (rt < 0.4) {
      rubble = new THREE.Mesh(
        new THREE.BoxGeometry(0.12 + Math.random() * 0.2, 0.08 + Math.random() * 0.12, 0.04 + Math.random() * 0.06),
        trimMat
      );
      rubble.rotation.z = Math.random() * 0.6;
    } else if (rt < 0.65) {
      rubble = new THREE.Mesh(new THREE.BoxGeometry(0.2 + Math.random() * 0.3, 0.03, 0.025), boardMat);
      rubble.rotation.z = Math.random() * Math.PI;
    } else if (rt < 0.85) {
      rubble = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1 + Math.random() * 0.15, 4), rustMat);
      rubble.rotation.x = (Math.random() - 0.5) * 0.5;
      rubble.rotation.z = (Math.random() - 0.5) * 0.5;
    } else {
      rubble = new THREE.Mesh(new THREE.BoxGeometry(0.08 + Math.random() * 0.1, 0.06, 0.02), vegMat);
    }
    rubble.position.set(rx, ry, 0.025);
    bldg.add(rubble);
  }

  // === MERGE ALL GEOMETRIES BY MATERIAL (reduces draw calls from ~150 to ~15) ===
  // Only structural materials cast shadows; detail materials don't
  const shadowMats = new Set([wallMat.uuid, wallDarkMat.uuid, roofMat.uuid, accentMat.uuid, trimMat.uuid]);
  bldg.updateMatrixWorld(true);
  const geoBins = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const toRemove: THREE.Object3D[] = [];
  bldg.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geo = child.geometry.clone();
      child.updateWorldMatrix(true, false);
      geo.applyMatrix4(child.matrixWorld);
      const key = child.material.uuid;
      if (!geoBins.has(key)) geoBins.set(key, { mat: child.material, geos: [] });
      geoBins.get(key)!.geos.push(geo);
      toRemove.push(child);
    }
  });
  for (const obj of toRemove) obj.parent?.remove(obj);
  for (const { mat, geos } of geoBins.values()) {
    if (geos.length === 0) continue;
    const merged = mergeGeometries(geos, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = shadowMats.has(mat.uuid);
      mesh.receiveShadow = true;
      bldg.add(mesh);
    }
  }

  bldg.position.set(x, y, 0);
  return bldg;
}
