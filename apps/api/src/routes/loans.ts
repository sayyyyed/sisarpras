import { Hono } from "hono";
import { AssetLoanDraftSchema } from "@sisarpras/domain";
import { currentUser, requireAuth, requireMenuAccess, requireRole } from "@/middleware/auth";
import { createLoan, listLoans, LoanError, returnLoan } from "@/repositories/loans";

export const loansRoute = new Hono();
loansRoute.use("*", requireAuth, requireMenuAccess("loans"));
loansRoute.get("/", async (c) => c.json({ data: await listLoans() }));
loansRoute.post("/", requireRole("admin", "operator"), async (c) => {
  const parsed = AssetLoanDraftSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  try { return c.json({ data: await createLoan(parsed.data, currentUser(c).id) }, 201); }
  catch (error) { if (error instanceof LoanError) return c.json({ error: error.message }, error.status); throw error; }
});
loansRoute.post("/:id/return", requireRole("admin", "operator"), async (c) => {
  try { return c.json({ data: await returnLoan(c.req.param("id")) }); }
  catch (error) { if (error instanceof LoanError) return c.json({ error: error.message }, error.status); throw error; }
});
