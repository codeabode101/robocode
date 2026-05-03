import { workos, WORKOS_CLIENT_ID } from "@/lib/workos";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "robocode-secret-key-change-in-production";

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

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.firstName + " " + user.lastName,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.redirect(new URL("/", url.origin));
    response.cookies.set("session", token, {
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
