'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Apinator } from '@apinator/client';

interface PlayerPosition {
  userId: string;
  x: number;
  y: number;
  name?: string;
  room?: string;
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
  const [playerCount, setPlayerCount] = useState(1);
  const [arenaPlayers, setArenaPlayers] = useState<{ id: string; name: string | null }[]>([]);
  const [arenaChallenge, setArenaChallenge] = useState<{ fromId: string; fromName: string } | null>(null);
  const apinatorRef = useRef<Apinator | null>(null);
  const connectedRef = useRef(false);
  const subscribedRef = useRef(false);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const playerNameRef = useRef('');
  const arenaPlayersRef = useRef<{ id: string; name: string }[]>([]);
  const onArenaEventRef = useRef<((event: ArenaEvent) => void) | null>(null);
  const eventQueueRef = useRef<Array<{ event: string; data: Record<string, unknown> }>>([]);

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

    const sendQueued = () => {
      const queue = eventQueueRef.current;
      eventQueueRef.current = [];
      for (const q of queue) {
        try {
          apinator.trigger('private-robocode-live', q.event, q.data);
          console.log('📤 Sent event:', q.event, q.data);
        } catch (err) {
          console.warn('⚠️ Failed to send queued event:', q.event, err);
        }
      }
    };

    const upsertRemotePlayer = (payload: unknown) => {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : (payload as Record<string, unknown> | null);
      const remoteUserId = parsed?.userId ?? parsed?.user_id;
      if (typeof remoteUserId !== 'string' || remoteUserId === userIdRef.current) return;
      console.log('📥 Multiplayer event:', { event: 'upsert', remoteUserId, x: parsed?.x, y: parsed?.y, room: parsed?.room });
      setPlayers((prev) => {
        const next = {
          ...prev,
          [remoteUserId]: {
            userId: remoteUserId,
            x: Number(parsed?.x) || 0,
            y: Number(parsed?.y) || 0,
            name: typeof parsed?.name === 'string' ? parsed.name : prev[remoteUserId]?.name,
            room: typeof parsed?.room === 'string' ? parsed.room : prev[remoteUserId]?.room,
            lastSeenAt: Date.now(),
          },
        };
        setPlayerCount(1 + Object.keys(next).length);
        return next;
      });
    };

    const handleArenaEvent = (eventName: string, data: unknown) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown> | null);
      const fromId = parsed?.userId as string;
      if (!fromId || fromId === userIdRef.current) return;
      const fromName = (parsed?.name as string) || 'Unknown';
      const challengeId = parsed?.challengeId as string;
      const event: ArenaEvent = {
        type: eventName as ArenaEvent['type'],
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
    const forceReconnect = () => {
      if (connectedRef.current) return;
      try {
        apinator.disconnect();
        apinator.connect();
      } catch { /* ignore */ }
    };

    let reconnectHandle: number | null = null;
    let forceHandle: number | null = null;
    const stopReconnect = () => {
      if (reconnectHandle !== null) { window.clearTimeout(reconnectHandle); reconnectHandle = null; }
      if (forceHandle !== null) { window.clearTimeout(forceHandle); forceHandle = null; }
    };
    const startReconnect = () => {
      stopReconnect();
      subscribedRef.current = false;
      const loop = () => {
        if (connectedRef.current) return;
        tryReconnect();
        reconnectHandle = window.setTimeout(loop, 300);
      };
      loop();
      forceHandle = window.setTimeout(() => {
        forceHandle = null;
        if (!connectedRef.current) forceReconnect();
      }, 10000);
    };

    apinator.bind('state_change', (state: unknown) => {
      const s = (state as { current?: string } | string | null);
      const current = typeof s === 'string' ? s : s?.current;
      const isConnected = current === 'connected';
      connectedRef.current = isConnected;
      setConnected(isConnected);
      if (isConnected) { stopReconnect(); }
      if (!isConnected) { subscribedRef.current = false; startReconnect(); }
    });

    const channel = apinator.subscribe('private-robocode-live');

    channel.bind('realtime:subscription_succeeded', () => {
      subscribedRef.current = true;
      sendQueued();
    });

    channel.bind('realtime:subscription_error', (err: unknown) => {
      console.warn('⚠️ Channel subscription error:', err);
    });

    channel.bind('client-player-join', upsertRemotePlayer);
    channel.bind('client-player-move', upsertRemotePlayer);
    channel.bind('client-player-leave', (data: unknown) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown> | null);
      const uid = parsed?.userId ?? parsed?.user_id;
      if (typeof uid === 'string' && uid !== userIdRef.current) {
        setPlayers((prev) => {
          const n = { ...prev };
          delete n[uid];
          setPlayerCount(1 + Object.keys(n).length);
          return n;
        });
      }
    });

    channel.bind('client-arena-join', (data: unknown) => handleArenaEvent('arena-join', data));
    channel.bind('client-arena-leave', (data: unknown) => handleArenaEvent('arena-leave', data));
    channel.bind('client-arena-challenge', (data: unknown) => handleArenaEvent('arena-challenge', data));
    channel.bind('client-arena-accept', (data: unknown) => handleArenaEvent('arena-accept', data));
    channel.bind('client-arena-decline', (data: unknown) => handleArenaEvent('arena-decline', data));

    apinator.connect();

    const handleVisibility = () => { if (document.visibilityState === 'visible') tryReconnect(); };
    window.addEventListener('focus', tryReconnect);
    window.addEventListener('online', tryReconnect);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      setConnected(false);
      connectedRef.current = false;
      subscribedRef.current = false;
      eventQueueRef.current = [];
      stopReconnect();
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
    if (!apinator) {
      console.warn('⚠️ Apinator not initialized');
      return;
    }
    const enriched = { ...data, userId: userIdRef.current, name: playerNameRef.current };

    if (!subscribedRef.current) {
      eventQueueRef.current.push({ event, data: enriched });
      return;
    }

    try {
      apinator.trigger('private-robocode-live', event, enriched);
      console.log('📤 Sent event:', event, enriched);
    } catch {
      eventQueueRef.current.push({ event, data: enriched });
    }
  }

  const sendPosition = useCallback((x: number, y: number, room?: string) => {
    triggerEvent('client-player-move', { x, y, room });
    fetch('/api/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y, room }) }).catch(() => {});
  }, []);

  return {
    players,
    connected,
    playerCount,
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
