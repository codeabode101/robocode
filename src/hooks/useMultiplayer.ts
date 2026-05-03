"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Player {
  id: string;
  x: number;
  y: number;
  name?: string;
}

export function useMultiplayer() {
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerId, setPlayerId] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
        window.location.host
      }/api/multiplayer`
    );

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "init") {
          setPlayerId(data.playerId);
          ws.send(
            JSON.stringify({
              type: "join",
              playerId: data.playerId,
            })
          );
        } else if (data.type === "state") {
          setPlayers(data.players);
        } else if (data.type === "leave") {
          setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
        }
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const movePlayer = useCallback((x: number, y: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "move", x, y }));
    }
  }, []);

  return { connected, players, movePlayer, playerId };
}
