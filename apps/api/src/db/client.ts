import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

try {
  process.loadEnvFile();
} catch {
  // .env is optional in production where the platform injects env vars.
}

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL belum diset. Salin apps/api/.env.example menjadi apps/api/.env, atau jalankan .\\scripts\\pg.ps1 start untuk Postgres lokal.",
  );
}

/**
 * Local portable Postgres speaks plain TCP on localhost.
 * Supabase (and every other hosted provider) requires TLS and, when going
 * through pgbouncer in transaction mode, cannot use prepared statements.
 * Detecting from the URL keeps one code path for both.
 */
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url);
const isPooler = url.includes("pooler.supabase.com") || url.includes(":6543");

const client = postgres(url, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
  ssl: isLocal ? false : "require",
  prepare: !isPooler,
});

export const db = drizzle(client, { schema });
export { client as sql, schema };
export type Database = typeof db;

/** Cheap liveness probe used by GET /health. */
export async function pingDatabase(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const rows = await client`select version() as version`;
    return { ok: true, version: rows[0]?.version as string | undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
