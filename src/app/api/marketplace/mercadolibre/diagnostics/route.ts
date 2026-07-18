import { NextResponse } from "next/server";
import { getMercadoLibreOAuthConfig, isMercadoLibreConfigured } from "@/lib/marketplace/providers/mercadoLibreConfig";
import { getConnectionStatus } from "@/lib/marketplace/providers/mercadoLibreOAuth";
import { getPrisma } from "@/lib/prisma";

// TEMPORARY diagnostic route — audit only, safe to hit in production.
// Never returns secret values, only booleans/lengths. Remove once the
// Mercado Libre persistence fix (filesystem -> Postgres via Prisma) is
// confirmed working end-to-end in production.
const EXPECTED_REDIRECT_URI = "https://ai-product-winner.vercel.app/api/marketplace/mercadolibre/callback";

export async function GET() {
  const env = {
    ML_CLIENT_ID: { exists: Boolean(process.env.ML_CLIENT_ID), length: process.env.ML_CLIENT_ID?.length ?? 0 },
    ML_CLIENT_SECRET: { exists: Boolean(process.env.ML_CLIENT_SECRET), length: process.env.ML_CLIENT_SECRET?.length ?? 0 },
    ML_REDIRECT_URI: {
      exists: Boolean(process.env.ML_REDIRECT_URI),
      value: process.env.ML_REDIRECT_URI ?? null,
      matchesExpected: process.env.ML_REDIRECT_URI === EXPECTED_REDIRECT_URI,
    },
    ML_AUTH_DOMAIN: { exists: Boolean(process.env.ML_AUTH_DOMAIN), value: process.env.ML_AUTH_DOMAIN ?? null },
  };

  let dbReachable = false;
  let dbError: string | null = null;
  let tokenRowExists = false;
  try {
    const prisma = getPrisma();
    const row = await prisma.marketplaceOAuthToken.findUnique({ where: { provider: "mercadolibre" } });
    dbReachable = true;
    tokenRowExists = row !== null;
  } catch (err) {
    dbError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  const connectionStatus = await getConnectionStatus().catch((err) => ({
    connected: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  return NextResponse.json({
    env,
    isMercadoLibreConfigured: isMercadoLibreConfigured(),
    oauthConfigResolved: getMercadoLibreOAuthConfig() !== null,
    database: { reachable: dbReachable, error: dbError, tokenRowExists },
    connectionStatus,
    vercel: {
      isVercel: Boolean(process.env.VERCEL),
      region: process.env.VERCEL_REGION ?? null,
    },
  });
}
