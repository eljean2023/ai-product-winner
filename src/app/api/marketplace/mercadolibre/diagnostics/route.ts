import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getMercadoLibreOAuthConfig, isMercadoLibreConfigured } from "@/lib/marketplace/providers/mercadoLibreConfig";

// TEMPORARY diagnostic route — audit only, safe to hit in production.
// Never returns secret values, only booleans/lengths. Remove once the
// Mercado Libre "not configured" investigation is closed.
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

  let tokenStoreWritable = false;
  let tokenStoreError: string | null = null;
  try {
    const dir = path.join(process.cwd(), ".data");
    fs.mkdirSync(dir, { recursive: true });
    const testPath = path.join(dir, "diagnostic-write-test.tmp");
    fs.writeFileSync(testPath, "ok");
    fs.unlinkSync(testPath);
    tokenStoreWritable = true;
  } catch (err) {
    tokenStoreError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  return NextResponse.json({
    env,
    isMercadoLibreConfigured: isMercadoLibreConfigured(),
    oauthConfigResolved: getMercadoLibreOAuthConfig() !== null,
    tokenStoreWritable,
    tokenStoreError,
    cwd: process.cwd(),
    vercel: {
      isVercel: Boolean(process.env.VERCEL),
      region: process.env.VERCEL_REGION ?? null,
    },
  });
}
