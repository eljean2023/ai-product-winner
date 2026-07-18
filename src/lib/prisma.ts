import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Lazy singleton — constructed on first actual DB call, not at module import
// time. This matters because API route modules get imported during
// `next build`'s route collection even when DATABASE_URL isn't set yet (e.g.
// in an environment that hasn't provisioned the database), and eagerly
// constructing PrismaClient at import time would break that build. Also
// follows Prisma's standard Next.js pattern of reusing one client across hot
// reloads in dev instead of exhausting connections.
//
// Prisma 7's default "client" query engine has no built-in connection
// manager — it requires an explicit driver adapter (unlike Prisma 5/6, which
// read `datasource.url` and connected on their own). @prisma/adapter-pg uses
// `pg`'s connection pooling directly, which works over Neon's pooled
// connection string (the `-pooler` host) exactly like any other Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — Mercado Libre token storage requires a Postgres connection.");
    }
    const adapter = new PrismaPg(connectionString);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
