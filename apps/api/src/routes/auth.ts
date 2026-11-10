import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db/client";
import { appMenus, roles, users } from "@/db/schema";
import { requireAuth, requireRole, currentUser } from "@/middleware/auth";
import { hashPin, verifyPin } from "@/lib/password";
import { createToken } from "@/lib/tokens";

export const authRoute = new Hono();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const pinSchema = z.string().regex(/^\d{6}$/, "PIN harus 6 digit");
const loginSchema = z.object({ pin: pinSchema });
const createUserSchema = z.object({ name: z.string().trim().min(1).max(255), roleId: z.string().uuid(), pin: pinSchema });
const updateUserSchema = z.object({ name: z.string().trim().min(1).max(255).optional(), roleId: z.string().uuid().optional(), pin: pinSchema.optional() }).refine((value) => Object.keys(value).length > 0);

async function publicUser(userId: string) {
  const [record] = await db.select({ id: users.id, name: users.name, role: users.role, roleId: roles.id, roleKey: roles.key, roleName: roles.name, menuKeys: roles.menuKeys, createdAt: users.createdAt, isActive: users.isActive })
    .from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, userId)).limit(1);
  if (!record) return null;
  const enabled = await db.select({ key: appMenus.key }).from(appMenus).where(eq(appMenus.enabled, true));
  const enabledKeys = new Set(enabled.map((item) => item.key));
  return { ...record, menuKeys: (record.role === "admin" ? [...enabledKeys] : record.menuKeys).filter((key) => enabledKeys.has(key)) };
}

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
  const user = await publicUser(matched.id);
  if (!user) return c.json({ error: "role_not_configured" }, 409);
  return c.json({ token: createToken(user), user, expiresIn: 43200 });
});

authRoute.use("/users", requireAuth, requireRole("admin"));
authRoute.use("/users/*", requireAuth, requireRole("admin"));
authRoute.get("/me", requireAuth, async (c) => c.json({ user: currentUser(c) }));

authRoute.get("/users", async (c) => {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.isActive, true)).orderBy(users.createdAt);
  const values = await Promise.all(rows.map((row) => publicUser(row.id)));
  return c.json({ data: values.filter(Boolean) });
});

authRoute.post("/users", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  const [assignedRole] = await db.select().from(roles).where(eq(roles.id, parsed.data.roleId)).limit(1);
  if (!assignedRole) return c.json({ error: "role_not_found" }, 404);
  if (assignedRole.accessLevel === "admin") return c.json({ error: "admin_role_assignment_locked" }, 403);
  if (await pinAlreadyInUse(parsed.data.pin)) return c.json({ error: "pin_already_in_use" }, 409);
  const id = randomUUID();
  const [created] = await db.insert(users).values({
    id,
    email: `${id}@pin.sisarpras.local`,
    name: parsed.data.name,
    role: assignedRole.accessLevel,
    roleId: assignedRole.id,
    passwordHash: "!pin-only",
    pinHash: await hashPin(parsed.data.pin),
  }).returning({ id: users.id, name: users.name, role: users.role, createdAt: users.createdAt, isActive: users.isActive });
  return c.json({ data: await publicUser(created.id) }, 201);
});

authRoute.patch("/users/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  const { id } = c.req.param();
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return c.json({ error: "user_not_found" }, 404);
  const [assignedRole] = parsed.data.roleId ? await db.select().from(roles).where(eq(roles.id, parsed.data.roleId)).limit(1) : [null];
  if (parsed.data.roleId && !assignedRole) return c.json({ error: "role_not_found" }, 404);
  if (assignedRole?.accessLevel === "admin" && target.role !== "admin") return c.json({ error: "admin_role_assignment_locked" }, 403);
  if (parsed.data.pin && await pinAlreadyInUse(parsed.data.pin, id)) return c.json({ error: "pin_already_in_use" }, 409);
  if (target.role === "admin" && assignedRole && assignedRole.accessLevel !== "admin") {
    const [count] = await db.select({ value: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true)));
    if (Number(count?.value ?? 0) <= 1) return c.json({ error: "last_admin_required" }, 409);
  }
  const [updated] = await db.update(users).set({
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(assignedRole ? { role: assignedRole.accessLevel, roleId: assignedRole.id } : {}),
    ...(parsed.data.pin ? { pinHash: await hashPin(parsed.data.pin) } : {}),
    updatedAt: new Date(),
  }).where(eq(users.id, id)).returning({ id: users.id });
  return c.json({ data: await publicUser(updated.id) });
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
