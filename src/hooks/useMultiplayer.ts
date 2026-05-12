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

export function useMultiplayer(
  userId: string,
  apinatorAppKey: string,
  apinatorCluster: 'us' | 'eu'
) {
  const [players, setPlayers] = useState<Record<string, PlayerPosition>>({});
  const [connected, setConnected] = useState(false);
  const apinatorRef = useRef<Apinator | null>(null);
  const connectedRef = useRef(false);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

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
      const parsed =
        typeof payload === 'string' ? (JSON.parse(payload) as Record<string, unknown>) : (payload as Record<string, unknown> | null);
      const remoteUserId = parsed?.userId ?? parsed?.user_id;
      if (typeof remoteUserId !== 'string' || remoteUserId === userIdRef.current) return;

      const rawX = Number(parsed?.x);
      const rawY = Number(parsed?.y);
      const nextX = Number.isFinite(rawX) ? rawX : 0;
      const nextY = Number.isFinite(rawY) ? rawY : 0;
      const nextName = typeof parsed?.name === 'string' ? parsed.name : undefined;

      setPlayers((prev) => ({
        ...prev,
        [remoteUserId]: {
          ...(prev[remoteUserId] || {}),
          userId: remoteUserId,
          x: nextX,
          y: nextY,
          name: nextName ?? prev[remoteUserId]?.name,
          lastSeenAt: Date.now(),
        },
      }));
    };

    const tryReconnect = () => {
      if (connectedRef.current) return;
      try { apinator.connect(); } catch { /* ignore */ }
    };

    let reconnectTimeout: number | null = null;
    let reconnectDelayMs = 1200;
    const clearReconnectTimeout = () => {
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
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
      const statePayload = state as { current?: string } | string | null;
      const current = typeof statePayload === 'string' ? statePayload : statePayload?.current;
      const isConnected = current === 'connected';
      connectedRef.current = isConnected;
      setConnected(isConnected);
      if (isConnected) {
        reconnectDelayMs = 1200;
        clearReconnectTimeout();
      } else {
        scheduleReconnect();
      }
    });

    const channel = apinator.subscribe('private-robocode-live');

    channel.bind('client-player-move', (data: unknown) => {
      try { upsertRemotePlayer(data); } catch { /* ignore */ }
    });

    channel.bind('client-player-join', (data: unknown) => {
      try { upsertRemotePlayer(data); } catch { /* ignore */ }
    });

    channel.bind('client-player-leave', (data: unknown) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown> | null);
        const remoteUserId = parsed?.userId ?? parsed?.user_id;
        if (typeof remoteUserId === 'string') {
          setPlayers((prev) => {
            const next = { ...prev };
            delete next[remoteUserId];
            return next;
          });
        }
      } catch { /* ignore */ }
    });

    apinator.connect();

    const reconnectInterval = window.setInterval(tryReconnect, 4000);

    const handleVisibility = () => { if (document.visibilityState === 'visible') tryReconnect(); };
    const handleWindowFocus = () => { tryReconnect(); };
    const handleOnline = () => { tryReconnect(); };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      setConnected(false);
      connectedRef.current = false;
      clearReconnectTimeout();
      window.clearInterval(reconnectInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      apinator.unsubscribe('private-robocode-live');
      apinator.disconnect();
    };
  }, [apinatorAppKey, apinatorCluster]);

  const sendPosition = useCallback((x: number, y: number) => {
    const apinator = apinatorRef.current;
    if (apinator && connectedRef.current) {
      const channel = apinator.channel('private-robocode-live');
      if (channel && (channel as any).subscribed) {
        try {
          apinator.trigger('private-robocode-live', 'client-player-move', {
            userId: userIdRef.current,
            x,
            y,
          });
        } catch (e) {
          console.error('Failed to send position:', e);
        }
      }
    }
    fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    }).catch(() => {});
  }, []);

  return { players, connected, sendPosition };
}
