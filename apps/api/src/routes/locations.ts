import { Hono } from "hono";
import { z } from "zod";
import { LocationDraftSchema, LocationPatchSchema } from "@sisarpras/domain";
import { createBuilding, createLocation, listLocations, softDeleteLocation, updateBuilding, updateLocation } from "@/repositories/locations";
import { currentUser, requireAuth, requireMenuAccess, requireRole } from "@/middleware/auth";

export const locationsRoute = new Hono();
locationsRoute.use("*", requireAuth, requireMenuAccess("rooms"));

locationsRoute.get("/", requireAuth, async (c) => c.json({ data: await listLocations() }));

locationsRoute.post("/building", requireAuth, requireRole("admin", "operator"), async (c) => {
  const schema = z.object({ name: z.string().trim().min(1).max(255), floorCount: z.number().int().min(1).max(50) });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  try {
    const created = await createBuilding(parsed.data.name, parsed.data.floorCount, { actorId: currentUser(c).id });
    return c.json({ data: created }, 201);
  } catch (error) {
    return c.json({ error: "write_failed", detail: error instanceof Error ? error.message : String(error) }, 422);
  }
});

locationsRoute.patch("/building/:id", requireAuth, requireRole("admin", "operator"), async (c) => {
  const schema = z.object({ name: z.string().trim().min(1).max(255), floorCount: z.number().int().min(1).max(50) });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  try {
    const updated = await updateBuilding(c.req.param("id"), parsed.data.name, parsed.data.floorCount, { actorId: currentUser(c).id });
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "floor_has_rooms") {
      return c.json({ error: "floor_has_rooms", detail: "Pindahkan ruangan dari lantai yang akan dihapus terlebih dahulu." }, 409);
    }
    return c.json({ error: "write_failed", detail: error instanceof Error ? error.message : String(error) }, 422);
  }
});

locationsRoute.post("/", requireAuth, requireRole("admin", "operator"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = LocationDraftSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  }

  try {
    const created = await createLocation(parsed.data, { actorId: currentUser(c).id });
    return c.json({ data: created }, 201);
  } catch (error) {
    // A bad parentId trips the foreign key.
    return c.json(
      { error: "write_failed", detail: error instanceof Error ? error.message : String(error) },
      422,
    );
  }
});

locationsRoute.patch("/:id", requireAuth, requireRole("admin", "operator"), async (c) => {
  const parsed = LocationPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  if (Object.keys(parsed.data).length === 0) return c.json({ error: "empty_patch" }, 400);

  try {
    const updated = await updateLocation(c.req.param("id"), parsed.data, { actorId: currentUser(c).id });
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json({ data: updated });
  } catch (error) {
    return c.json(
      { error: "write_failed", detail: error instanceof Error ? error.message : String(error) },
      422,
    );
  }
});

/** Soft delete: children keep pointing at the row so history stays valid. */
locationsRoute.delete("/:id", requireAuth, requireRole("admin"), async (c) => {
  const deleted = await softDeleteLocation(c.req.param("id"), { actorId: currentUser(c).id });
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ data: { id: deleted.id } });
});
