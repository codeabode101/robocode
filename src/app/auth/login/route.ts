import { workos, WORKOS_CLIENT_ID, WORKOS_REDIRECT_URI } from "@/lib/workos";
import { NextResponse } from "next/server";

export async function GET() {
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    clientId: WORKOS_CLIENT_ID,
    redirectUri: WORKOS_REDIRECT_URI,
    provider: "authkit",
  });

  return NextResponse.redirect(authorizationUrl);
}
