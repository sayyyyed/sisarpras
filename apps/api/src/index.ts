import { Hono } from "hono";
import { cors } from "hono/cors";
import { pingDatabase } from "@/db/client";
import { assetsRoute } from "@/routes/assets";
import { locationsRoute } from "@/routes/locations";
import { procurementRoute } from "@/routes/procurement";
import { stockRoute } from "@/routes/stock";
import { loansRoute } from "@/routes/loans";
import { syncRoute } from "@/routes/sync";
import { authRoute } from "@/routes/auth";
import { attachmentsRoute } from "@/routes/attachments";
import { accessRoute } from "@/routes/access";

const app = new Hono();

app.use("*", cors());

/**
 * Liveness + readiness in one: a 503 with the driver's message is far more
 * useful than a 200 that hides a dead database.
 */
app.get("/health", async (c) => {
  const database = await pingDatabase();
  return c.json(
    {
      status: database.ok ? "ok" : "degraded",
      service: "sisarpras-api",
      version: "0.1.0",
      database,
    },
    database.ok ? 200 : 503,
  );
});

app.route("/v1/assets", assetsRoute);
app.route("/v1/locations", locationsRoute);
app.route("/v1/stock", stockRoute);
app.route("/v1/loans", loansRoute);
app.route("/v1/procurement", procurementRoute);
app.route("/v1/auth", authRoute);
app.route("/v1/sync", syncRoute);
app.route("/v1/attachments", attachmentsRoute);
app.route("/v1/access", accessRoute);

export default app;

// Cloudflare Workers named entry point. Keep the Node adapter in dev.ts for local use.
export const fetch = app.fetch;
