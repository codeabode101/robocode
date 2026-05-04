'use client';

import { useEffect, useRef, useState } from 'react';

interface PlayerPosition {
  userId: string;
  x: number;
  y: number;
}

export function useMultiplayer() {
  const [players, setPlayers] = useState<Record<string, PlayerPosition>>({});
  const [isConnected, setIsConnected] = useState(true); // Polling is always "connected"
  const localPlayerRef = useRef({ x: 0, y: 0 });

  // Poll for other players' positions
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/players');
        if (res.ok) {
          const data = await res.json();
          const playersMap: Record<string, PlayerPosition> = {};
          data.players?.forEach((p: any) => {
            playersMap[p.user_id] = { userId: p.user_id, x: parseFloat(p.x), y: parseFloat(p.y) };
          });
          setPlayers(playersMap);
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    };

    poll(); // Initial poll
    const interval = setInterval(poll, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
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
