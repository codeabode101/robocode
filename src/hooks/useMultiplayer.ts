'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Apinator } from '@apinator/client';

interface PlayerPosition {
  userId: string;
  x: number;
  y: number;
  name?: string;
  lastSeenAt: number;
}

export type ArenaEvent = {
  type: 'arena-challenge' | 'arena-accept' | 'arena-decline' | 'arena-join' | 'arena-leave';
  fromId: string;
  fromName: string;
  challengeId?: string;
};

export function useMultiplayer(
  userId: string,
  apinatorAppKey: string,
  apinatorCluster: 'us' | 'eu'
) {
  const [players, setPlayers] = useState<Record<string, PlayerPosition>>({});
  const [connected, setConnected] = useState(false);
  const [arenaPlayers, setArenaPlayers] = useState<{ id: string; name: string | null }[]>([]);
  const [arenaChallenge, setArenaChallenge] = useState<{ fromId: string; fromName: string } | null>(null);
  const apinatorRef = useRef<Apinator | null>(null);
  const connectedRef = useRef(false);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const playerNameRef = useRef('');
  const arenaPlayersRef = useRef<{ id: string; name: string }[]>([]);
  const onArenaEventRef = useRef<((event: ArenaEvent) => void) | null>(null);

  useEffect(() => {
    if (!apinatorAppKey) {
      console.error('NEXT_PUBLIC_APINATOR_APP_KEY not set');
      return;
    }

    const apinator = new Apinator({
      cluster: apinatorCluster,
      appKey: apinatorAppKey,
      authEndpoint: '/api/apinator-auth',
    });
    apinatorRef.current = apinator;

    const upsertRemotePlayer = (payload: unknown) => {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : (payload as Record<string, unknown> | null);
      const remoteUserId = parsed?.userId ?? parsed?.user_id;
      if (typeof remoteUserId !== 'string' || remoteUserId === userIdRef.current) return;
      setPlayers((prev) => ({
        ...prev,
        [remoteUserId]: {
          userId: remoteUserId,
          x: Number(parsed?.x) || 0,
          y: Number(parsed?.y) || 0,
          name: typeof parsed?.name === 'string' ? parsed.name : prev[remoteUserId]?.name,
          lastSeenAt: Date.now(),
        },
      }));
    };

    const handleArenaEvent = (eventName: string, data: unknown) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown> | null);
      const fromId = parsed?.userId as string;
      if (!fromId || fromId === userIdRef.current) return;
      const fromName = (parsed?.name as string) || 'Unknown';
      const challengeId = parsed?.challengeId as string;
      const event: ArenaEvent = {
        type: eventName.replace('client-', '') as ArenaEvent['type'],
        fromId,
        fromName,
        challengeId,
      };
      onArenaEventRef.current?.(event);
    };

    const tryReconnect = () => {
      if (connectedRef.current) return;
      try { apinator.connect(); } catch { /* ignore */ }
    };

    let reconnectTimeout: number | null = null;
    let reconnectDelayMs = 1200;
    const clearReconnectTimeout = () => {
      if (reconnectTimeout !== null) { window.clearTimeout(reconnectTimeout); reconnectTimeout = null; }
    };
    const scheduleReconnect = () => {
      if (connectedRef.current || reconnectTimeout !== null) return;
      reconnectTimeout = window.setTimeout(() => {
        reconnectTimeout = null;
        tryReconnect();
        reconnectDelayMs = Math.min(10000, Math.floor(reconnectDelayMs * 1.5));
        scheduleReconnect();
      }, reconnectDelayMs);
    };

    apinator.bind('state_change', (state: unknown) => {
      const s = (state as { current?: string } | string | null);
      const current = typeof s === 'string' ? s : s?.current;
      const isConnected = current === 'connected';
      connectedRef.current = isConnected;
      setConnected(isConnected);
      if (isConnected) { reconnectDelayMs = 1200; clearReconnectTimeout(); }
      else { scheduleReconnect(); }
    });

    const channel = apinator.subscribe('private-robocode-live');

    channel.bind('client-player-move', upsertRemotePlayer);
    channel.bind('client-player-join', upsertRemotePlayer);
    channel.bind('client-player-leave', (data: unknown) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown> | null);
      const uid = parsed?.userId ?? parsed?.user_id;
      if (typeof uid === 'string') setPlayers((prev) => { const n = { ...prev }; delete n[uid]; return n; });
    });

    channel.bind('client-arena-join', (data: unknown) => handleArenaEvent('client-arena-join', data));
    channel.bind('client-arena-leave', (data: unknown) => handleArenaEvent('client-arena-leave', data));
    channel.bind('client-arena-challenge', (data: unknown) => handleArenaEvent('client-arena-challenge', data));
    channel.bind('client-arena-accept', (data: unknown) => handleArenaEvent('client-arena-accept', data));
    channel.bind('client-arena-decline', (data: unknown) => handleArenaEvent('client-arena-decline', data));

    apinator.connect();

    const reconnectInterval = window.setInterval(tryReconnect, 4000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') tryReconnect(); };
    window.addEventListener('focus', tryReconnect);
    window.addEventListener('online', tryReconnect);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      setConnected(false);
      connectedRef.current = false;
      clearReconnectTimeout();
      window.clearInterval(reconnectInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', tryReconnect);
      window.removeEventListener('online', tryReconnect);
      apinator.unsubscribe('private-robocode-live');
      apinator.disconnect();
    };
  }, [apinatorAppKey, apinatorCluster]);

  useEffect(() => {
    if (!userId) return;
    fetch('/api/profile').then(r => r.json()).then(d => { if (d.name) playerNameRef.current = d.name; }).catch(() => {});
  }, [userId]);

  function triggerEvent(event: string, data: Record<string, unknown>) {
    const apinator = apinatorRef.current;
    if (!apinator || !connectedRef.current) return;
    const channel = apinator.channel('private-robocode-live');
    if (channel && (channel as any).subscribed) {
      try { apinator.trigger('private-robocode-live', event, { ...data, userId: userIdRef.current, name: playerNameRef.current }); } catch { /* ignore */ }
    }
  }

  const sendPosition = useCallback((x: number, y: number) => {
    triggerEvent('client-player-move', { x, y });
    fetch('/api/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y }) }).catch(() => {});
  }, []);

  return {
    players,
    connected,
    sendPosition,
    triggerEvent,
    arenaPlayers,
    setArenaPlayers,
    arenaChallenge,
    setArenaChallenge,
    onArenaEventRef,
    arenaPlayersRef,
  };
}
