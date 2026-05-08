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

  useEffect(() => {
    if (!apinatorAppKey) {
      console.error('NEXT_PUBLIC_APINATOR_APP_KEY not set');
      return;
    }

    const apinator = new Apinator({
      cluster: apinatorCluster,
      appKey: apinatorAppKey,
    });
    apinatorRef.current = apinator;

    const upsertRemotePlayer = (payload: unknown) => {
      const parsed =
        typeof payload === 'string' ? (JSON.parse(payload) as Record<string, unknown>) : (payload as Record<string, unknown> | null);
      const remoteUserId = parsed?.userId ?? parsed?.user_id;
      if (typeof remoteUserId !== 'string' || remoteUserId === userId) return;

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
      try {
        apinator.connect();
      } catch (error) {
        console.error('Reconnect attempt failed:', error);
      }
    };

    // Monitor connection state
    apinator.bind('state_change', (state: unknown) => {
      const statePayload = state as { current?: string } | string | null;
      const current = typeof statePayload === 'string' ? statePayload : statePayload?.current;
      console.log('Apinator state:', current);
      const isConnected = current === 'connected';
      connectedRef.current = isConnected;
      setConnected(isConnected);
    });

    // Subscribe to the shared game channel
    const channel = apinator.subscribe('robocode-live');

    // Listen for other players' moves
    channel.bind('player-move', (data: unknown) => {
      try {
        upsertRemotePlayer(data);
      } catch (error) {
        console.error('Error parsing move:', error);
      }
    });

    channel.bind('player-join', (data: unknown) => {
      try {
        upsertRemotePlayer(data);
      } catch (error) {
        console.error('Error parsing join:', error);
      }
    });

    channel.bind('player-leave', (data: unknown) => {
      try {
        const parsed =
          typeof data === 'string' ? (JSON.parse(data) as Record<string, unknown>) : (data as Record<string, unknown> | null);
        const remoteUserId = parsed?.userId ?? parsed?.user_id;
        if (typeof remoteUserId === 'string') {
          setPlayers((prev) => ({
            ...Object.fromEntries(Object.entries(prev).filter(([id]) => id !== remoteUserId)),
          }));
        }
      } catch (error) {
        console.error('Error parsing leave:', error);
      }
    });

    // Connect to Apinator
    apinator.connect();

    const reconnectInterval = window.setInterval(() => {
      tryReconnect();
    }, 4000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        tryReconnect();
      }
    };
    const handleWindowFocus = () => {
      tryReconnect();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      setConnected(false);
      connectedRef.current = false;
      window.clearInterval(reconnectInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleWindowFocus);
      apinator.unsubscribe('robocode-live');
      apinator.disconnect();
    };
  }, [apinatorAppKey, apinatorCluster, userId]);

  useEffect(() => {
    if (!connected) return;

    const loadPlayers = async () => {
      try {
        const res = await fetch('/api/players');
        if (!res.ok) return;
        const payload = await res.json();
        const incoming: Array<{
          user_id?: string;
          userId?: string;
          x?: number;
          y?: number;
          name?: string;
        }> = payload?.players || [];

        setPlayers((prev) => {
          const next = { ...prev };
          for (const player of incoming) {
            const remoteUserId = player.userId ?? player.user_id;
            if (!remoteUserId || remoteUserId === userId) continue;
            next[remoteUserId] = {
              userId: remoteUserId,
              x: Number(player.x) || 0,
              y: Number(player.y) || 0,
              name: player.name || next[remoteUserId]?.name,
              lastSeenAt: Date.now(),
            };
          }
          return next;
        });
      } catch (error) {
        console.error('Failed to load current players:', error);
      }
    };

    loadPlayers();
  }, [connected, userId]);

  useEffect(() => {
    const prune = window.setInterval(() => {
      const now = Date.now();
      setPlayers((prev) => {
        const next: Record<string, PlayerPosition> = {};
        for (const [remoteUserId, player] of Object.entries(prev)) {
          if (now - player.lastSeenAt < 30000) {
            next[remoteUserId] = player;
          }
        }
        return next;
      });
    }, 5000);
    return () => window.clearInterval(prune);
  }, []);

  const sendPosition = useCallback(async (x: number, y: number) => {
    // Send move to server route for publication
    try {
      await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      });
    } catch (e) {
      console.error('Failed to send move:', e);
    }
  }, []);

  return { players, connected, sendPosition };
}
