import { Hono } from "hono";
import { AssetDraftSchema, CONDITION_LABEL, STATUS_LABEL } from "@sisarpras/domain";
import { createAsset, isAssetCodeTaken, listAssets, listCategories } from "@/repositories/assets";
import { listLocations } from "@/repositories/locations";
import { requireAuth, requireRole, currentUser } from "@/middleware/auth";

export const assetsRoute = new Hono();

/** GET /v1/assets?q=&categoryId=&locationId=&condition=&status=&limit=&offset= */
assetsRoute.get("/", requireAuth, async (c) => {
  const rows = await listAssets({
    q: c.req.query("q"),
    categoryId: c.req.query("categoryId"),
    locationId: c.req.query("locationId"),
    condition: c.req.query("condition"),
    status: c.req.query("status"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    offset: c.req.query("offset") ? Number(c.req.query("offset")) : undefined,
  });
  return c.json({ data: rows });
});

/** Reference data the client needs to render the asset form. */
assetsRoute.get("/categories", requireAuth, async (c) => c.json({ data: await listCategories() }));
assetsRoute.get("/locations", requireAuth, async (c) => c.json({ data: await listLocations() }));
assetsRoute.get("/meta", requireAuth, (c) => c.json({ conditions: CONDITION_LABEL, statuses: STATUS_LABEL }));

/** POST /v1/assets — validates with the shared zod schema, then writes one transaction. */
assetsRoute.post("/", requireAuth, requireRole("admin", "operator"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AssetDraftSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  }

  if (await isAssetCodeTaken(parsed.data.assetCode)) {
    return c.json({ error: "asset_code_taken", assetCode: parsed.data.assetCode }, 409);
  }

  try {
    const actor = currentUser(c);
    const created = await createAsset(parsed.data, { actorId: actor.id });
    return c.json({ data: created }, 201);
  } catch (error) {
    // Foreign-key violations surface when categoryId/locationId are unknown.
    return c.json(
      { error: "write_failed", detail: error instanceof Error ? error.message : String(error) },
      422,
    );
  }
});
