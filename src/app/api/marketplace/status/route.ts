import { getConnectionStatus } from "@/lib/marketplace/providers/mercadoLibreOAuth";
import { getAllProviderStatuses } from "@/lib/marketplace/registry";

export async function GET() {
  const status = await getConnectionStatus();
  console.log(`[ML] /api/marketplace/status: connected=${status.connected}`);
  const providers = await getAllProviderStatuses();
  return Response.json({
    mercadolibre: status.connected ? { connected: true, account: status.account } : { connected: false },
    // Connection status for every registered provider (the direct Amazon
    // PA-API, eBay Browse API, Mercado Libre, Walmart Affiliate API, and
    // the SerpAPI Amazon/eBay fallbacks), keyed by provider id. Additive —
    // the `mercadolibre` key above is unchanged for existing consumers.
    providers,
  });
}
