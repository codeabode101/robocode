import type { Hitbox } from './types';

export interface ObstacleParams {
  arenaCenterX: number;
  arenaCenterY: number;
  arenaHalfW: number;
  arenaHalfD: number;
}

export function buildObstacles(params: ObstacleParams): Hitbox[] {
  const { arenaCenterX, arenaCenterY, arenaHalfW, arenaHalfD } = params;
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

    // Arena footprint
    { shape: 'box', center: { x: arenaCenterX, y: arenaCenterY }, halfWidth: arenaHalfW, halfHeight: arenaHalfD },

    // Fountain in lake
    { shape: 'circle', center: { x: 6, y: -4 }, radius: 0.6 },

    // Dock edge obstacles (prevent falling off N/S/W sides)
    { shape: 'box', center: { x: -14.4, y: -9.6 }, halfWidth: 4.0, halfHeight: 0.1 },
    { shape: 'box', center: { x: -14.4, y: -6.4 }, halfWidth: 4.0, halfHeight: 0.1 },
    { shape: 'box', center: { x: -18.4, y: -8 }, halfWidth: 0.1, halfHeight: 1.6 },

    // Parts shop building
    { shape: 'box', center: { x: 6.0, y: -12.0 }, halfWidth: 4.0, halfHeight: 2.0 },

    // Abandoned buildings — one per grass block, filling the plot
    // Top-left
    { shape: 'box', center: { x: -5.7, y: 4 }, halfWidth: 4.4, halfHeight: 2.7 },
    // Top-center
    { shape: 'box', center: { x: 6, y: 4 }, halfWidth: 4.7, halfHeight: 2.7 },
    // Top-right
    { shape: 'box', center: { x: 18.5, y: 4 }, halfWidth: 5.2, halfHeight: 2.7 },
    // Mid-right
    { shape: 'box', center: { x: 18.5, y: -4 }, halfWidth: 5.2, halfHeight: 2.7 },
    // Bottom-right (expanded)
    { shape: 'box', center: { x: 18.5, y: -11 }, halfWidth: 5.2, halfHeight: 3.0 },
  ];
}
