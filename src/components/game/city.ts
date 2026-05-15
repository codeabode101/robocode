import type { Hitbox, Vec2 } from './types';

export function buildObstacles(): Hitbox[] {
  const hits: Hitbox[] = [
    { shape: 'circle', center: { x: 3.98, y: -2.02 }, radius: 0.42 },
    { shape: 'circle', center: { x: 3.6, y: 1.8 }, radius: 0.95 },
    { shape: 'circle', center: { x: -3.85, y: -1.8 }, radius: 1.08 },
    { shape: 'circle', center: { x: 0.9, y: -1.8 }, radius: 1.08 },
    { shape: 'circle', center: { x: 5.65, y: -1.8 }, radius: 1.08 },
    { shape: 'box', center: { x: -14, y: -10 }, halfWidth: 3.8, halfHeight: 2.2 },
    { shape: 'box', center: { x: 20, y: -14 }, halfWidth: 4.2, halfHeight: 3.2 },
  ];
  const buildings = [
    { x: -8, y: 4, hw: 2.5, hh: 1.75 },
    { x: -2, y: 4, hw: 2, hh: 1.75 },
    { x: 5, y: 4, hw: 2.5, hh: 1.75 },
    { x: -8, y: -4, hw: 2.5, hh: 1.75 },
    { x: -2, y: -4, hw: 2, hh: 1.75 },
    { x: 5, y: -4, hw: 2.5, hh: 1.75 },
    { x: -8, y: -11.5, hw: 2.5, hh: 1.75 },
    { x: -2, y: -11.5, hw: 2, hh: 1.75 },
    { x: 5, y: -11.5, hw: 2.5, hh: 1.75 },
    { x: -8, y: -19, hw: 2.5, hh: 1.75 },
    { x: -2, y: -19, hw: 2, hh: 1.75 },
    { x: 5, y: -19, hw: 2.5, hh: 1.75 },
  ];
  buildings.forEach(b => hits.push({ shape: 'box', center: { x: b.x, y: b.y }, halfWidth: b.hw, halfHeight: b.hh }));
  return hits;
}
