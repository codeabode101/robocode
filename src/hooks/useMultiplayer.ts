'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Apinator } from '@apinator/client';

interface PlayerPosition {
  user_id: string;
  x: number;
  y: number;
}

export function useMultiplayer(userId: string) {
  const [players, setPlayers] = useState<Map<string, PlayerPosition>>(new Map());
  const [connected, setConnected] = useState(false);
  const apinatorRef = useRef<Apinator | null>(null);

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_APINATOR_APP_KEY;
    if (!appKey) {
      console.error('NEXT_PUBLIC_APINATOR_APP_KEY not set');
      return;
    }

    const apinator = new Apinator({
      cluster: 'us',   // or 'eu' if that matches your Apinator app
      appKey,
    });
    apinatorRef.current = apinator;

    // Monitor connection state
    apinator.bind('state_change', (state: any) => {
      const current = typeof state === 'string' ? state : state?.current;
      console.log('Apinator state:', current);
      setConnected(current === 'connected');
    });

    // Subscribe to the shared game channel
    const channel = apinator.subscribe('robocode-game');

    // Listen for other players' moves
    channel.bind('player-move', (data: any) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (!parsed || typeof parsed.user_id !== 'string') return;
        if (parsed.user_id === userId) return; // ignore self

        setPlayers(prev => {
          const next = new Map(prev);
          next.set(parsed.user_id, {
            user_id: parsed.user_id,
            x: parsed.x ?? 0,
            y: parsed.y ?? 0,
          });
          return next;
        });
      } catch (e) {
        console.error('Error parsing move:', e);
      }
    });

    // Listen for other players joining
    channel.bind('player-join', (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.user_id && parsed.user_id !== userId) {
        setPlayers(prev => {
          const next = new Map(prev);
          if (!next.has(parsed.user_id)) {
            next.set(parsed.user_id, {
              user_id: parsed.user_id,
              x: parsed.x ?? 0,
              y: parsed.y ?? 0,
            });
          }
          return next;
        });
      }
    });

    // Connect to Apinator
    apinator.connect();

    return () => {
      apinator.unsubscribe('robocode-game');
      apinator.disconnect();
    };
  }, [userId]);

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
