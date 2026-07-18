import { NextResponse } from "next/server";
import { buildAuthorizationUrl, generateState } from "@/lib/marketplace/providers/mercadoLibreOAuth";

const STATE_COOKIE = "ml_oauth_state";

// Step 1 of the Authorization Code flow: send the user to Mercado Libre's
// /authorization page. A random `state` is generated and stashed in a
// short-lived httpOnly cookie so the callback can verify the redirect that
// comes back actually belongs to this login attempt (CSRF protection).
export async function GET() {
  const state = generateState();
  const authUrl = buildAuthorizationUrl(state);

  if (!authUrl) {
    return NextResponse.json(
      {
        error:
          "Mercado Libre is not configured. Set ML_CLIENT_ID, ML_CLIENT_SECRET, and ML_REDIRECT_URI.",
      },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
