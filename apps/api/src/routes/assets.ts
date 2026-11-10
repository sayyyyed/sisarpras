import { Hono } from "hono";
import { z } from "zod";
import { AssetDraftSchema, AssetPatchSchema, AssetRoomStockSchema, AssetStockAdjustmentSchema, CategoryPatchSchema, CONDITION_LABEL, STATUS_LABEL } from "@sisarpras/domain";
import { adjustAssetStock, AssetStockError, createAsset, createCategory, isAssetCodeTaken, listAssets, listCategories, setAssetRoomStock, softDeleteAsset, updateAsset, updateCategory } from "@/repositories/assets";
import { listLocations } from "@/repositories/locations";
import { requireAuth, requireMenuAccess, requireRole, currentUser } from "@/middleware/auth";

export const assetsRoute = new Hono();
assetsRoute.use("*", requireAuth, requireMenuAccess("assets"));

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

const categorySchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(255),
});

/** POST /v1/assets/categories — so an asset can be added without procurement. */
assetsRoute.post("/categories", requireAuth, requireRole("admin", "operator"), async (c) => {
  const parsed = categorySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);

  try {
    const created = await createCategory(parsed.data.code, parsed.data.name);
    return c.json({ data: created }, 201);
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") return c.json({ error: "category_code_taken" }, 409);
    return c.json(
      { error: "write_failed", detail: error instanceof Error ? error.message : String(error) },
      422,
    );
  }
});

assetsRoute.patch("/categories/:id", requireAuth, requireRole("admin", "operator"), async (c) => {
  const parsed = CategoryPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  try {
    const updated = await updateCategory(c.req.param("id"), parsed.data);
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json({ data: updated });
  } catch (error) {
    return c.json({ error: "write_failed", detail: error instanceof Error ? error.message : String(error) }, 422);
  }
});
assetsRoute.get("/locations", requireAuth, async (c) => c.json({ data: await listLocations() }));
assetsRoute.get("/meta", requireAuth, (c) => c.json({ conditions: CONDITION_LABEL, statuses: STATUS_LABEL }));

/** POST /v1/assets/:id/stock-adjustments { delta }; reductions cannot pass units in use. */
assetsRoute.post("/:id/stock-adjustments", requireAuth, requireRole("admin", "operator"), async (c) => {
  const parsed = AssetStockAdjustmentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  try {
    const updated = await adjustAssetStock(c.req.param("id"), parsed.data, { actorId: currentUser(c).id });
    return c.json({ data: updated });
  } catch (error) {
    if (error instanceof AssetStockError) return c.json({ error: error.message }, error.status);
    return c.json({ error: "write_failed", detail: error instanceof Error ? error.message : String(error) }, 422);
  }
});

/** PUT /v1/assets/:id/rooms/:locationId { quantity } */
assetsRoute.put("/:id/rooms/:locationId", requireAuth, requireRole("admin", "operator"), async (c) => {
  const parsed = AssetRoomStockSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  try {
    const updated = await setAssetRoomStock(c.req.param("id"), c.req.param("locationId"), parsed.data, { actorId: currentUser(c).id });
    return c.json({ data: updated });
  } catch (error) {
    if (error instanceof AssetStockError) return c.json({ error: error.message }, error.status);
    return c.json({ error: "write_failed", detail: error instanceof Error ? error.message : String(error) }, 422);
  }
});

/** POST /v1/assets — validates with the shared zod schema, then writes one transaction. */
assetsRoute.post("/", requireAuth, requireRole("admin", "operator"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AssetDraftSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
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

/** PATCH /v1/assets/:id — partial update; bumps the version used for conflict checks. */
assetsRoute.patch("/:id", requireAuth, requireRole("admin", "operator"), async (c) => {
  const parsed = AssetPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  if (Object.keys(parsed.data).length === 0) return c.json({ error: "empty_patch" }, 400);

  if (parsed.data.assetCode && (await isAssetCodeTaken(parsed.data.assetCode, c.req.param("id")))) {
    return c.json({ error: "asset_code_taken", assetCode: parsed.data.assetCode }, 409);
  }

  try {
    const updated = await updateAsset(c.req.param("id"), parsed.data, { actorId: currentUser(c).id });
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json({ data: updated });
  } catch (error) {
    return c.json(
      { error: "write_failed", detail: error instanceof Error ? error.message : String(error) },
      422,
    );
  }
});

/** DELETE /v1/assets/:id — soft delete; the row and its history stay. */
assetsRoute.delete("/:id", requireAuth, requireRole("admin"), async (c) => {
  const deleted = await softDeleteAsset(c.req.param("id"), { actorId: currentUser(c).id });
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ data: { id: deleted.id } });
});
