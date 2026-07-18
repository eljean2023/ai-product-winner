import { getConnectionStatus } from "@/lib/marketplace/providers/mercadoLibreOAuth";

export async function GET() {
  const status = await getConnectionStatus();
  console.log(`[ML] /api/marketplace/status: connected=${status.connected}`);
  return Response.json({
    mercadolibre: status.connected ? { connected: true, account: status.account } : { connected: false },
  });
}
