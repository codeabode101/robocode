'use client';

import dynamic from 'next/dynamic';
import GameErrorBoundary from './GameErrorBoundary';

const GameMap = dynamic(() => import('./GameMap'), { ssr: false });

export default function GameMapLoader(props: {
  userId: string;
  apinatorAppKey: string;
  apinatorCluster: 'us' | 'eu';
}) {
  return (
    <GameErrorBoundary>
      <GameMap {...props} />
    </GameErrorBoundary>
  );
}
