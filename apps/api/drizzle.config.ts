import { defineConfig } from "drizzle-kit";

/** Local dev uses .env; CI/production passes DATABASE_URL in the environment. */
try {
  process.loadEnvFile();
} catch {
  // .env is optional — an exported DATABASE_URL is enough.
}

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL belum diset. Salin apps/api/.env.example menjadi apps/api/.env lalu isi nilainya.",
  );
}

/** Supabase (and any hosted Postgres) requires TLS; localhost does not. */
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: isLocal ? false : "require",
  },
  verbose: true,
  strict: true,
});
