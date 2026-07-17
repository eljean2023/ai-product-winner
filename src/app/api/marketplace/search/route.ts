import { searchAllMarketplaces } from "@/lib/marketplace/registry";

// Not cached by default in this Next.js version (no `cacheComponents`), which
// is what we want here: every request should reflect live marketplace data.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const country = searchParams.get("country") ?? undefined;

  if (!query) {
    return Response.json({ error: "Missing required query parameter 'q'." }, { status: 400 });
  }

  const summaries = await searchAllMarketplaces(query, { country });
  return Response.json({ summaries });
}
