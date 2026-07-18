import { disconnectMercadoLibre } from "@/lib/marketplace/providers/mercadoLibreOAuth";

// Clears the stored Mercado Libre tokens so the account shows as "Not
// Connected" again. Does not call any Mercado Libre revocation endpoint —
// it just forgets the local token; the user can also revoke access from
// their Mercado Libre account settings.
export async function POST() {
  disconnectMercadoLibre();
  return Response.json({ ok: true });
}
