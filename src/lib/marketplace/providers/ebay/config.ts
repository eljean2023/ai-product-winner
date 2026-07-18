// Single source of truth for "is the direct eBay integration configured".
// Every part of this provider must call `getEbayConfig()` instead of
// re-reading process.env itself — mirrors mercadoLibreConfig.ts.
export interface EbayConfig {
  clientId: string;
  clientSecret: string;
  marketplaceId: string;
}

export function getEbayConfig(): EbayConfig | null {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_US",
  };
}

export function isEbayConfigured(): boolean {
  return getEbayConfig() !== null;
}
