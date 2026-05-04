import GameMap from '@/components/GameMap';

export default function GamePage() {
  return (
    <div>
      <div className="absolute top-4 left-4 z-10">
        <a href="/tutorial" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white text-sm">
          Start Tutorial
        </a>
      </div>
      <GameMap />
    </div>
  );
}
