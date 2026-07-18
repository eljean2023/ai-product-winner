// Single source of truth for "is SerpAPI configured". Every SerpAPI-backed
// provider must call `isSerpApiConfigured()` / `getSerpApiKey()` instead of
// re-reading process.env itself — mirrors mercadoLibreConfig.ts.
export function getSerpApiKey(): string | null {
  return process.env.SERPAPI_API_KEY || null;
}

export function isSerpApiConfigured(): boolean {
  return getSerpApiKey() !== null;
}
