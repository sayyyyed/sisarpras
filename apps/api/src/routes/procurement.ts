import { Hono } from "hono";
import { ProcurementDraftSchema, ProcurementPatchSchema } from "@sisarpras/domain";
import { currentUser, requireAuth, requireMenuAccess, requireRole } from "@/middleware/auth";
import {
  createProcurement,
  deleteProcurement,
  listProcurements,
  updateProcurement,
} from "@/repositories/procurement";

export const procurementRoute = new Hono();
procurementRoute.use("*", requireAuth, requireMenuAccess("procurement"));

procurementRoute.get("/", requireAuth, async (c) => c.json({ data: await listProcurements() }));

procurementRoute.post("/", requireAuth, requireRole("admin", "operator"), async (c) => {
  const parsed = ProcurementDraftSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);

  const created = await createProcurement(parsed.data, currentUser(c).id);
  return c.json({ data: created }, 201);
});

procurementRoute.patch("/:id", requireAuth, requireRole("admin", "operator"), async (c) => {
  const parsed = ProcurementPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  if (Object.keys(parsed.data).length === 0) return c.json({ error: "empty_patch" }, 400);

  const updated = await updateProcurement(c.req.param("id"), parsed.data, currentUser(c).id);
  if (!updated) return c.json({ error: "not_found" }, 404);
  return c.json({ data: updated });
});

procurementRoute.delete("/:id", requireAuth, requireRole("admin"), async (c) => {
  const deleted = await deleteProcurement(c.req.param("id"), currentUser(c).id);
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ data: { id: deleted.id } });
});
