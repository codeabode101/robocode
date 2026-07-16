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
    { shape: 'box', center: { x: -6, y: -11.8 }, halfWidth: 3.70, halfHeight: 2.20 },

    // Fountain in lake
    { shape: 'circle', center: { x: 6, y: -4 }, radius: 0.6 },

    // Dock edge obstacles (prevent falling off N/S/W sides)
    { shape: 'box', center: { x: -14.4, y: -9.6 }, halfWidth: 4.0, halfHeight: 0.1 },
    { shape: 'box', center: { x: -14.4, y: -6.4 }, halfWidth: 4.0, halfHeight: 0.1 },
    { shape: 'box', center: { x: -18.4, y: -8 }, halfWidth: 0.1, halfHeight: 1.6 },

    // Parts shop building
    { shape: 'box', center: { x: 6.0, y: -12.0 }, halfWidth: 4.0, halfHeight: 2.0 },

    // Abandoned buildings — one per grass block
    // Top-left
    { shape: 'box', center: { x: -5.7, y: 4 }, halfWidth: 4.2, halfHeight: 2.5 },
    // Top-center
    { shape: 'box', center: { x: 6, y: 4 }, halfWidth: 4.5, halfHeight: 2.5 },
    // Top-right
    { shape: 'box', center: { x: 18.5, y: 4 }, halfWidth: 4.8, halfHeight: 2.5 },
    // Mid-right
    { shape: 'box', center: { x: 18.5, y: -4 }, halfWidth: 4.8, halfHeight: 2.5 },
    // Bottom-right
    { shape: 'box', center: { x: 18.5, y: -11.75 }, halfWidth: 4.8, halfHeight: 2.0 },
    // East side — wall buildings blocking road sight line
    { shape: 'box', center: { x: 28, y: 4 }, halfWidth: 2.2, halfHeight: 2.5 },
    { shape: 'box', center: { x: 28, y: -4 }, halfWidth: 2.2, halfHeight: 2.5 },
    { shape: 'box', center: { x: 28, y: -11.75 }, halfWidth: 2.2, halfHeight: 2.0 },
  ];
}
