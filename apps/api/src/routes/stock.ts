import { Hono } from "hono";
import { StockMovementDraftSchema } from "@sisarpras/domain";
import { requireAuth, requireRole } from "@/middleware/auth";
import { createStockMovement, listStockItems, listStockMovements, StockError } from "@/repositories/stock";

export const stockRoute = new Hono();

stockRoute.get("/", requireAuth, async (c) => c.json({ data: await listStockItems() }));

stockRoute.get("/:id/movements", requireAuth, async (c) => c.json({ data: await listStockMovements(c.req.param("id")) }));

stockRoute.post("/movements", requireAuth, requireRole("admin", "operator"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = StockMovementDraftSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  }

  try {
    return c.json({ data: await createStockMovement(parsed.data) }, 201);
  } catch (error) {
    if (error instanceof StockError) {
      return c.json({ error: error.message }, error.status);
    }
    // Drizzle wraps driver errors, so read the Postgres SQLSTATE instead of
    // matching the message text. 23505 = unique_violation, i.e. this
    // transaction_id was already applied.
    const code =
      (error as { code?: string }).code ??
      (error as { cause?: { code?: string } }).cause?.code;
    const message = error instanceof Error ? error.message : String(error);
    const duplicate = code === "23505" || /unique|duplicate/i.test(message);
    return c.json(
      { error: duplicate ? "duplicate_transaction" : "write_failed", detail: message },
      duplicate ? 409 : 422,
    );
  }
});
