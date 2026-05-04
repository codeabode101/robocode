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

  // If no userId after all, the middleware should have redirected already.
  // Passing an empty string as fallback, but the map will show "Connecting..." 
  // and the move endpoint will reject unauthorized requests.
  return <GameMap userId={userId} />;
}
