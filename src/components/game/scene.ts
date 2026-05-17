import * as THREE from 'three';

export const LABEL_BUILD_TAG = 'label-build-20260510-0342';

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

  applyShadows(group, true, true);
  group.scale.set(2.35, 2.35, 2.35);
  return { root: group, nameSprite, body: dummyBody as unknown as THREE.Mesh, shadow: new THREE.Object3D() as unknown as THREE.Mesh, leftPupil, rightPupil, antennaTip: antennaTip as unknown as THREE.Mesh };
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

export function createRobotVisual(color: THREE.Color, name: string) {
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
  leftArm.position.set(-0.37, 0.26, 0.5);
  leftArm.rotation.z = 0.3;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), armMat);
  rightArm.position.set(0.37, 0.26, 0.5);
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
  group.scale.set(2.35, 2.35, 2.35);
  return { root: group, nameSprite, body, shadow: new THREE.Object3D() as unknown as THREE.Mesh, leftPupil, rightPupil, antennaTip };
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
      const lit = Math.random() < 0.65;
      const opacity = lit ? 0.35 + Math.random() * 0.5 : 0.08 + Math.random() * 0.1;
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

  const sign = createLabelSprite('PET WORKSHOP', '#f8fafc', 'rgba(15,23,42,0.92)', '#fde68a', 360, 90);
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
}

export function addExclamationMarker(parent: THREE.Group) {
  const marker = createExclamationMarker();
  marker.renderOrder = 61;
  const s = parent.scale.x;
  const worldSize = 0.22;
  marker.scale.set(worldSize / s, worldSize / s, 1);
  if (parent.rotation.x >= 1) {
    marker.position.set(0, 1.0, 0.46);
  } else {
    marker.position.set(0, 0, 0.5);
  }
  parent.add(marker);
  return marker;
}
