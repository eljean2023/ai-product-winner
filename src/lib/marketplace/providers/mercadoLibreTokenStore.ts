import { getPrisma } from "@/lib/prisma";

// Persists the Mercado Libre OAuth tokens to Postgres (via Prisma) so a
// connected account survives serverless redeploys and cold starts. A prior
// version of this store wrote to a local .data/ JSON file — that worked in
// long-running dev servers but silently never persisted on Vercel, whose
// serverless functions run against a read-only filesystem outside /tmp. See
// the MarketplaceOAuthToken model in prisma/schema.prisma.
//
// This is a single-tenant app with no user/session system, so there is
// exactly one stored record per `provider`: the one Mercado Libre account
// this deployment is connected as.

export interface MercadoLibreTokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  userId: number;
  nickname: string;
  siteId?: string;
  obtainedAt: number; // epoch ms
}

const PROVIDER = "mercadolibre";

export async function readTokenRecord(): Promise<MercadoLibreTokenRecord | null> {
  try {
    const row = await getPrisma().marketplaceOAuthToken.findUnique({ where: { provider: PROVIDER } });
    if (!row) return null;
    return {
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      expiresAt: row.expiresAt.getTime(),
      userId: row.userId ?? 0,
      nickname: row.nickname ?? "",
      siteId: row.siteId ?? undefined,
      obtainedAt: row.obtainedAt.getTime(),
    };
  } catch (err) {
    console.error("[ML token store] read failed", err);
    return null;
  }
}

export async function writeTokenRecord(record: MercadoLibreTokenRecord): Promise<void> {
  const data = {
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    expiresAt: new Date(record.expiresAt),
    userId: record.userId,
    nickname: record.nickname,
    siteId: record.siteId,
    obtainedAt: new Date(record.obtainedAt),
  };
  await getPrisma().marketplaceOAuthToken.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, ...data },
    update: data,
  });
}

export async function clearTokenRecord(): Promise<void> {
  await getPrisma().marketplaceOAuthToken.deleteMany({ where: { provider: PROVIDER } });
}
