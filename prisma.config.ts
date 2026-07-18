import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads DATABASE_URL directly from schema.prisma or
// auto-loads .env — both must be wired up explicitly here for the Prisma
// CLI (migrate/generate/studio). The Next.js app itself doesn't use this
// file; it gets DATABASE_URL from its own env loading (see src/lib/prisma.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
