import type { Hitbox } from './types';

export function buildObstacles(): Hitbox[] {
  return [
    // Apartment building walls (door gap on south side at x≈[-10,-9.2])
    { shape: 'box', center: { x: -6, y: -2.1 }, halfWidth: 4.04, halfHeight: 0.08 },
    { shape: 'box', center: { x: -2, y: -3.5 }, halfWidth: 0.08, halfHeight: 1.34 },
    { shape: 'box', center: { x: -10, y: -3.5 }, halfWidth: 0.08, halfHeight: 1.44 },
    { shape: 'box', center: { x: -5.58, y: -4.9 }, halfWidth: 3.62, halfHeight: 0.08 },

    // 2 Bazaar stalls + repair shop (covers counter area)
    { shape: 'circle', center: { x: -7.5, y: -5.3 }, radius: 0.4 },
    { shape: 'circle', center: { x: -4.87, y: -5.3 }, radius: 0.4 },
    { shape: 'circle', center: { x: -2.87, y: -5.3 }, radius: 0.4 },

    // Rafiq's Robots (pet workshop) — cover wall outer edges (bw=7.4, bd=2.4, walls 0.08 thick)
    { shape: 'box', center: { x: -6, y: -11.8 }, halfWidth: 3.70, halfHeight: 1.20 },

    // Fountain in lake
    { shape: 'circle', center: { x: 6, y: -4 }, radius: 0.6 },

    // Parts shop building
    { shape: 'box', center: { x: 6.0, y: -12.0 }, halfWidth: 4.0, halfHeight: 2.0 },

    // Tree/ruin barrier east of Parts Shop (blocks passage eastward)
    { shape: 'box', center: { x: 10.5, y: -8.5 }, halfWidth: 0.1, halfHeight: 2.5 },
    { shape: 'box', center: { x: 11.5, y: -9.5 }, halfWidth: 1.5, halfHeight: 0.1 },
    { shape: 'box', center: { x: 12.5, y: -8.0 }, halfWidth: 0.1, halfHeight: 2.0 },
    { shape: 'box', center: { x: 13.0, y: -10.0 }, halfWidth: 0.8, halfHeight: 0.1 },
  ];
}
