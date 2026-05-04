'use client';

import { useEffect, useRef, useState } from 'react';
import { Apinator } from '@apinator/client';

interface PlayerPosition {
  userId: string;
  x: number;
  y: number;
}

export function useMultiplayer() {
  const [players, setPlayers] = useState<Record<string, PlayerPosition>>({});
  const [isConnected, setIsConnected] = useState(false);
  const localUserIdRef = useRef<string>('');
  const apinatorRef = useRef<Apinator | null>(null);

  useEffect(() => {
    // Generate a random user ID for the local player if not already set
    if (!localUserIdRef.current) {
      localUserIdRef.current = Math.random().toString(36).substring(2, 15);
    }

    // Get Apinator token from environment variable
    const apinatorToken = process.env.NEXT_PUBLIC_APINATOR_TOKEN;
    if (!apinatorToken) {
      console.warn('Apinator token not found in environment variables');
      return;
    }

    // Initialize Apinator client
    const apinator = new Apinator({
      token: apinatorToken,
      // Optional: configure reconnection attempts, etc.
      reconnectAttempts: 10,
      reconnectDelay: 1000,
    });
    apinatorRef.current = apinator;

    // Subscribe to the game channel
    const channel = apinator.channel('robocode-game');

    // Handle incoming messages
    channel.subscribe((message: any) => {
      try {
        // Ignore messages from ourselves
        if (message.userId === localUserIdRef.current) return;

        // Validate message structure
        if (
          message &&
          typeof message.userId === 'string' &&
          typeof message.x === 'number' &&
          typeof message.y === 'number'
        ) {
          setPlayers(prev => ({
            ...prev,
            [message.userId]: message,
          }));
        }
      } catch (e) {
        console.error('Error processing Apinator message:', e);
      }
    });

    // Handle connection events
    apinator.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to Apinator');
    });

    apinator.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from Apinator');
    });

    apinator.on('error', (error: Error) => {
      console.error('Apinator error:', error);
      setIsConnected(false);
    });

    // Connect to Apinator
    apinator.connect();

    // Cleanup on unmount
    return () => {
      if (apinatorRef.current) {
        apinatorRef.current.disconnect();
        apinatorRef.current = null;
      }
    };
  }, []);

  const sendMove = async (x: number, y: number) => {
    try {
      // Publish move to Apinator channel
      const channel = apinatorRef.current?.channel('robocode-game');
      if (!channel) {
        console.warn('Apinator channel not available');
        return;
      }

      channel.publish({
        userId: localUserIdRef.current,
        x,
        y,
      });

      // Also update local player position immediately for responsiveness
      setPlayers(prev => ({
        ...prev,
        [localUserIdRef.current]: { userId: localUserIdRef.current, x, y },
      }));
    } catch (error) {
      console.error('Error sending move via Apinator:', error);
    }
  };

  return { players, isConnected, sendMove };
}
