import { mercadoLibreProvider } from "@/lib/marketplace/providers/mercadoLibre";

export async function GET() {
  return Response.json({ mercadolibre: mercadoLibreProvider.isConfigured() });
}
