import { Hono } from "hono";
import { LocationDraftSchema } from "@sisarpras/domain";
import { createLocation, listLocations } from "@/repositories/locations";
import { currentUser, requireAuth, requireRole } from "@/middleware/auth";

export const locationsRoute = new Hono();

locationsRoute.get("/", requireAuth, async (c) => c.json({ data: await listLocations() }));

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
