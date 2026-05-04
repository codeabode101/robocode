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
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/multiplayer`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const playerData = JSON.parse(event.data);
        if (
          playerData &&
          typeof playerData.userId === 'string' &&
          typeof playerData.x === 'number' &&
          typeof playerData.y === 'number'
        ) {
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
      setTimeout(() => {
        if (wsRef.current === ws) {
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
