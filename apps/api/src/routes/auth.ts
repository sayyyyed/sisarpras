import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireAuth, requireRole, currentUser } from "@/middleware/auth";
import { hashPin, verifyPin } from "@/lib/password";
import { createToken } from "@/lib/tokens";

export const authRoute = new Hono();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const pinSchema = z.string().regex(/^\d{6}$/, "PIN harus 6 digit");
const roleSchema = z.enum(["admin", "operator", "viewer"]);
const loginSchema = z.object({ pin: pinSchema });
const createUserSchema = z.object({ name: z.string().trim().min(1).max(255), role: roleSchema, pin: pinSchema });
const updateUserSchema = z.object({ name: z.string().trim().min(1).max(255).optional(), role: roleSchema.optional(), pin: pinSchema.optional() }).refine((value) => Object.keys(value).length > 0);

async function pinAlreadyInUse(pin: string, exceptId?: string): Promise<boolean> {
  const candidates = await db.select({ id: users.id, pinHash: users.pinHash }).from(users)
    .where(and(eq(users.isActive, true), sql`${users.pinHash} is not null`));
  for (const candidate of candidates) {
    if (candidate.id !== exceptId && candidate.pinHash && await verifyPin(pin, candidate.pinHash)) return true;
  }
  return false;
}

authRoute.post("/login", async (c) => {
  const address = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const attempts = loginAttempts.get(address);
  if (attempts && attempts.resetAt > now && attempts.count >= 10) return c.json({ error: "too_many_attempts" }, 429);
  if (attempts && attempts.resetAt <= now) loginAttempts.delete(address);
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);

  const candidates = await db.select().from(users).where(and(eq(users.isActive, true), sql`${users.pinHash} is not null`));
  let matched: (typeof candidates)[number] | undefined;
  for (const candidate of candidates) {
    if (candidate.pinHash && await verifyPin(parsed.data.pin, candidate.pinHash)) { matched = candidate; break; }
  }
  if (!matched) {
    const current = loginAttempts.get(address);
    loginAttempts.set(address, { count: (current?.count ?? 0) + 1, resetAt: current?.resetAt ?? now + 15 * 60 * 1000 });
    return c.json({ error: "invalid_pin" }, 401);
  }
  loginAttempts.delete(address);
  const user = { id: matched.id, name: matched.name, role: matched.role };
  return c.json({ token: createToken(user), user, expiresIn: 43200 });
});

authRoute.use("/users", requireAuth, requireRole("admin"));
authRoute.use("/users/*", requireAuth, requireRole("admin"));
authRoute.get("/me", requireAuth, async (c) => c.json({ user: currentUser(c) }));

authRoute.get("/users", async (c) => {
  const rows = await db.select({ id: users.id, name: users.name, role: users.role, createdAt: users.createdAt, isActive: users.isActive }).from(users).where(eq(users.isActive, true)).orderBy(users.createdAt);
  return c.json({ data: rows });
});

authRoute.post("/users", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  if (await pinAlreadyInUse(parsed.data.pin)) return c.json({ error: "pin_already_in_use" }, 409);
  const id = randomUUID();
  const [created] = await db.insert(users).values({
    id,
    email: `${id}@pin.sisarpras.local`,
    name: parsed.data.name,
    role: parsed.data.role,
    passwordHash: "!pin-only",
    pinHash: await hashPin(parsed.data.pin),
  }).returning({ id: users.id, name: users.name, role: users.role, createdAt: users.createdAt, isActive: users.isActive });
  return c.json({ data: created }, 201);
});

authRoute.patch("/users/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  const { id } = c.req.param();
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return c.json({ error: "user_not_found" }, 404);
  if (parsed.data.pin && await pinAlreadyInUse(parsed.data.pin, id)) return c.json({ error: "pin_already_in_use" }, 409);
  if (target.role === "admin" && parsed.data.role && parsed.data.role !== "admin") {
    const [count] = await db.select({ value: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true)));
    if (Number(count?.value ?? 0) <= 1) return c.json({ error: "last_admin_required" }, 409);
  }
  const [updated] = await db.update(users).set({
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.role ? { role: parsed.data.role } : {}),
    ...(parsed.data.pin ? { pinHash: await hashPin(parsed.data.pin) } : {}),
    updatedAt: new Date(),
  }).where(eq(users.id, id)).returning({ id: users.id, name: users.name, role: users.role, createdAt: users.createdAt, isActive: users.isActive });
  return c.json({ data: updated });
});

authRoute.delete("/users/:id", async (c) => {
  const { id } = c.req.param();
  const actor = currentUser(c);
  if (actor.id === id) return c.json({ error: "cannot_delete_current_user" }, 409);
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return c.json({ error: "user_not_found" }, 404);
  if (target.role === "admin") {
    const [count] = await db.select({ value: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true)));
    if (Number(count?.value ?? 0) <= 1) return c.json({ error: "last_admin_required" }, 409);
  }
  await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id));
  return c.json({ ok: true });
});
