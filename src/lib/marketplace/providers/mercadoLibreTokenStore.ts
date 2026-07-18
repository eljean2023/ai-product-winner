import fs from "node:fs";
import path from "node:path";

// Persists the Mercado Libre OAuth tokens to disk so a connected account
// survives dev-server restarts (an in-memory cache does not). This is a
// single-tenant app with no database and no user/session system, so there
// is exactly one stored record: the one Mercado Libre account this
// deployment is connected as.
//
// The file lives outside `src/` and is gitignored (see `.data/` in
// .gitignore) — never commit it, it contains a live refresh token.

export interface MercadoLibreTokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  userId: number;
  nickname: string;
  siteId?: string;
  obtainedAt: number; // epoch ms
}

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(STORE_DIR, "mercadolibre-token.json");

export function readTokenRecord(): MercadoLibreTokenRecord | null {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw) as MercadoLibreTokenRecord;
  } catch {
    return null;
  }
}

export function writeTokenRecord(record: MercadoLibreTokenRecord): void {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(record, null, 2), { mode: 0o600 });
}

export function clearTokenRecord(): void {
  try {
    fs.unlinkSync(STORE_PATH);
  } catch {
    // Already gone — nothing to clear.
  }
}
