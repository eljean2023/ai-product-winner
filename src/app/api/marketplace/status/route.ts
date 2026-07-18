import { keepaProvider } from "@/lib/marketplace/providers/keepa";
import { getConnectionStatus } from "@/lib/marketplace/providers/mercadoLibreOAuth";
import { getAllProviderStatuses } from "@/lib/marketplace/registry";

// Each status check below is independent — one throwing (e.g. a corrupt
// token file, a provider bug) must never blank out every other provider's
// real status, so each is settled on its own instead of one shared await
// chain that a single rejection could take down.
async function safeConnectionStatus(): ReturnType<typeof getConnectionStatus> {
  try {
    return await getConnectionStatus();
  } catch {
    return { connected: false };
  }
}

async function safeKeepaStatus() {
  try {
    return await keepaProvider.getProviderStatus();
  } catch (err) {
    return { connected: false, reason: err instanceof Error ? err.message : "Status check failed." };
  }
}

export async function GET() {
  const [status, providers, keepaStatus] = await Promise.all([
    safeConnectionStatus(),
    getAllProviderStatuses(),
    safeKeepaStatus(),
  ]);
  console.log(`[ML] /api/marketplace/status: connected=${status.connected}`);
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
