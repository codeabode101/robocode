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
    // Apartment building walls (door gap on south side at x≈[-10,-8.8])
    { shape: 'box', center: { x: -6, y: -2.1 }, halfWidth: 4.0, halfHeight: 0.08 },
    { shape: 'box', center: { x: -2, y: -3.5 }, halfWidth: 0.08, halfHeight: 1.3 },
    { shape: 'box', center: { x: -10, y: -3.5 }, halfWidth: 0.08, halfHeight: 1.4 },
    { shape: 'box', center: { x: -5.4, y: -4.9 }, halfWidth: 3.4, halfHeight: 0.08 },

    // 2 Bazaar stalls + repair shop
    { shape: 'circle', center: { x: -7.5, y: -5.3 }, radius: 0.5 },
    { shape: 'circle', center: { x: -4.87, y: -5.3 }, radius: 0.5 },
    { shape: 'box', center: { x: -2.87, y: -5.3 }, halfWidth: 1.1, halfHeight: 0.45 },

    // Rafiq's Robots (pet workshop) footprint
    { shape: 'box', center: { x: -6, y: -11.8 }, halfWidth: 4.1, halfHeight: 1.6 },

    // Arena footprint
    { shape: 'box', center: { x: arenaCenterX, y: arenaCenterY }, halfWidth: arenaHalfW, halfHeight: arenaHalfD },

    // Fountain in lake
    { shape: 'circle', center: { x: 6, y: -4 }, radius: 0.6 },

    // Transport store walls (open east side)
    { shape: 'box', center: { x: -18.75, y: -14.2 }, halfWidth: 5, halfHeight: 0.1 },
    { shape: 'box', center: { x: -18.75, y: -9.8 }, halfWidth: 5, halfHeight: 0.1 },
    { shape: 'box', center: { x: -23.8, y: -12 }, halfWidth: 0.1, halfHeight: 2.2 },

    // Parts shop building
    { shape: 'box', center: { x: 6.0, y: -12.0 }, halfWidth: 4.0, halfHeight: 2.0 },
  ];
}
