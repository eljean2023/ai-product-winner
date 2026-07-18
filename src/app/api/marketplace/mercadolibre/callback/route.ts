import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/marketplace/providers/mercadoLibreOAuth";

const STATE_COOKIE = "ml_oauth_state";

// Step 2 of the Authorization Code flow: Mercado Libre redirects here with
// either `?code=...&state=...` (success) or `?error=...` (user declined).
// The code is a one-time value exchanged server-side for an access_token +
// refresh_token via POST https://api.mercadolibre.com/oauth/token.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const authError = searchParams.get("error");
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  function redirectHome(status: "connected" | "error", message?: string) {
    const url = new URL("/", request.url);
    url.searchParams.set("ml_status", status);
    if (message) url.searchParams.set("ml_message", message);
    const response = NextResponse.redirect(url);
    response.cookies.delete(STATE_COOKIE);
    return response;
  }

  if (authError) {
    return redirectHome("error", `Mercado Libre authorization was denied (${authError}).`);
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectHome("error", "Mercado Libre authorization failed: invalid or expired state.");
  }

  const result = await exchangeCodeForToken(code);
  if (!result.ok) {
    return redirectHome("error", result.error);
  }
  return redirectHome("connected");
}
