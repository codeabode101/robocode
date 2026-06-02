'use client';

import { useSyncExternalStore, useCallback } from 'react';
import type { ScrapPartId } from '@/components/game/types';

type GameState = {
  money: number;
  backpack: ScrapPartId[];
  robotName: string;
  calibrationYear: number;
  calibrationMonth: number;
  calibrationDay: number;
};

type Listener = () => void;

let store: GameState = { money: 0, backpack: [], robotName: '', calibrationYear: 0, calibrationMonth: 0, calibrationDay: 0 };
const listeners = new Set<Listener>();

function getSnapshot(): GameState {
  return store;
}

function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emitChange() {
  for (const cb of listeners) cb();
}

export const gameStore = {
  get<K extends keyof GameState>(key: K): GameState[K] {
    return store[key];
  },
  set<K extends keyof GameState>(key: K, value: GameState[K]) {
    store = { ...store, [key]: value };
    emitChange();
  },
};

export function useGameStoreKey<K extends keyof GameState>(key: K): GameState[K] {
  const subscribeFn = useCallback((cb: Listener) => subscribe(cb), []);
  const getSnapshotFn = useCallback(() => store[key], [key]);
  return useSyncExternalStore(subscribeFn, getSnapshotFn);
}
