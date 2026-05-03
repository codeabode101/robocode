import { workos, WORKOS_CLIENT_ID } from "@/lib/workos";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    const { user } = await workos.userManagement.authenticateWithCode({
      clientId: WORKOS_CLIENT_ID,
      code,
    });

    const sessionData = JSON.stringify({
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
    });

    const response = NextResponse.redirect(new URL("/", url.origin));
    response.cookies.set("session", Buffer.from(sessionData).toString("base64"), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
