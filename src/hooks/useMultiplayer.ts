'use client';

import { useEffect, useRef, useState } from 'react';

interface PlayerPosition {
  userId: string;
  x: number;
  y: number;
}

export function useMultiplayer() {
  const [players, setPlayers] = useState<Record<string, PlayerPosition>>({});
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`wss://ws.apinator.io?token=${process.env.NEXT_PUBLIC_APINATOR_APP_KEY}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Subscribe to channel
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'robocode-live',
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'player-move') {
        const playerData: PlayerPosition = data.data;
        setPlayers(prev => ({
          ...prev,
          [playerData.userId]: playerData,
        }));
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  const sendMove = async (x: number, y: number) => {
    await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    });
  };

  return { players, isConnected, sendMove };
}
