import { keepaProvider } from "@/lib/marketplace/providers/keepa";
import { getConnectionStatus } from "@/lib/marketplace/providers/mercadoLibreOAuth";
import { getAllProviderStatuses } from "@/lib/marketplace/registry";

export async function GET() {
  const status = await getConnectionStatus();
  console.log(`[ML] /api/marketplace/status: connected=${status.connected}`);
  const providers = await getAllProviderStatuses();
  const keepaStatus = await keepaProvider.getProviderStatus();
  return Response.json({
    mercadolibre: status.connected ? { connected: true, account: status.account } : { connected: false },
    // Real connection status for every provider actually in the active
    // search flow (direct Amazon PA-API, eBay Browse API, Mercado Libre,
    // Walmart Affiliate API), keyed by provider id, plus Keepa (historical
    // enrichment only, not a search provider — see providers/keepa.ts).
    // SerpAPI is deliberately absent: it is disabled and not part of the
    // active registry (see lib/marketplace/registry.ts). Additive — the
    // `mercadolibre` key above is unchanged for existing consumers.
    providers: { ...providers, keepa: keepaStatus },
  });
}
