import { NextRequest, NextResponse } from "next/server";
import { Apinator } from "@apinator/server";
import { jwtVerify } from "jose";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

const apinator = new Apinator({
  appId: process.env.APINATOR_APP_ID!,
  key: process.env.NEXT_PUBLIC_APINATOR_KEY!,
  secret: process.env.APINATOR_SECRET!,
  cluster: (process.env.NEXT_PUBLIC_APINATOR_CLUSTER as "us" | "eu") || "us",
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let workosId: string;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.WORKOS_API_KEY!)
    );
    workosId = payload.sub as string;
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Get user's name from DB
  const [user] = await db.select().from(users).where(eq(users.workos_id, workosId));
  const userName = user?.name || "Unknown";

  const { x, y } = await request.json();

  await apinator.trigger({
    name: "player-join",
    channel: "game-world",
    data: JSON.stringify({
      user_id: workosId,
      x: x || 0,
      y: y || 0,
      name: userName,
    }),
  });

  return NextResponse.json({ ok: true });
}
