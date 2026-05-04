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
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'robocode-live' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'player-move') {
          const playerData: PlayerPosition = data.data;
          setPlayers(prev => ({
            ...prev,
            [playerData.userId]: playerData,
          }));
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          // Only reconnect if this is still the current WebSocket
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, []);

  const sendMove = async (x: number, y: number) => {
    try {
      const res = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      });
      if (!res.ok) {
        console.error('Failed to send move:', await res.text());
      }
    } catch (error) {
      console.error('Error sending move:', error);
    }
  };

  return { players, isConnected, sendMove };
}
