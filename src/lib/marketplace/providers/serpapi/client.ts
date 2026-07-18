import { getSerpApiKey } from "./config";

// Shared HTTP client for every SerpAPI-backed marketplace provider. SerpAPI
// is one vendor fronting several search engines (amazon, ebay, walmart,
// google_shopping, ...) via a single REST endpoint distinguished by the
// `engine` param — this is the one place that knows how to call it, so
// auth/timeout/error handling isn't duplicated per marketplace.
const BASE_URL = "https://serpapi.com/search.json";
const FETCH_TIMEOUT_MS = 8000;

export type SerpApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function fetchSerpApi<T>(
  engine: string,
  params: Record<string, string>
): Promise<SerpApiResult<T>> {
  const apiKey = getSerpApiKey();
  if (!apiKey) return { ok: false, error: "not-configured" };

  const url = new URL(BASE_URL);
  url.searchParams.set("engine", engine);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok || data.error) {
      return { ok: false, error: data.error ?? `SerpAPI returned HTTP ${res.status}.` };
    }
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `SerpAPI request failed: ${err.message}` : "SerpAPI request failed.",
    };
  }
}
