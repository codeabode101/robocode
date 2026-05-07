import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import GameMap from '@/components/GameMap';

export default async function GamePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  let userId = '';
  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.WORKOS_API_KEY!)
      );
      userId = payload.sub as string;
    } catch {
      // Invalid token – the middleware will redirect, but fallback to empty string
    }
  }

  const apinatorAppKey = process.env.NEXT_PUBLIC_APINATOR_APP_KEY || '';
  const apinatorCluster = (process.env.NEXT_PUBLIC_APINATOR_CLUSTER as 'us' | 'eu') || 'us';

  return (
    <GameMap
      userId={userId}
      apinatorAppKey={apinatorAppKey}
      apinatorCluster={apinatorCluster}
    />
  );
}
