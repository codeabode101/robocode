'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import CharacterSelect from './CharacterSelect';
import GameErrorBoundary from './GameErrorBoundary';

const GameMap = dynamic(() => import('./GameMap'), { ssr: false });

export default function GameMapLoader(props: {
  userId: string;
  apinatorAppKey: string;
  apinatorCluster: 'us' | 'eu';
}) {
  const [characterId, setCharacterId] = useState<string | null>(null);

  if (!characterId) {
    return <CharacterSelect onConfirm={setCharacterId} />;
  }

  return (
    <GameErrorBoundary>
      <GameMap {...props} characterId={characterId} />
    </GameErrorBoundary>
  );
}
