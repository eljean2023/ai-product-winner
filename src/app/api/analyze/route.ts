import { analyzeProduct } from "@/lib/engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const country = searchParams.get("country") ?? undefined;

  if (!query) {
    return Response.json({ error: "Missing required query parameter 'q'." }, { status: 400 });
  }

  const result = await analyzeProduct(query, { country });
  return Response.json(result);
}
