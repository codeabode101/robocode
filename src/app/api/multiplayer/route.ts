import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Use WebSocket to connect",
    wsUrl: `${process.env.WORKOS_REDIRECT_URI?.replace("https://", "wss://")}/api/multiplayer`,
  });
}
