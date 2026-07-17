import { isMercadoLibreConfigured } from "@/lib/marketplace/providers/mercadoLibreConfig";

export async function GET() {
  const configured = isMercadoLibreConfigured();
  console.log(`[ML] /api/marketplace/status: credentials detected=${configured}`);
  return Response.json({ mercadolibre: configured });
}
