import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { APP_MENU_DEFINITIONS } from "@sisarpras/domain";
import { db } from "@/db/client";
import { appMenus, roles, users } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

export const accessRoute = new Hono();
const roleInput = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(255).optional().nullable(),
  accessLevel: z.enum(["operator", "viewer"]),
  menuKeys: z.array(z.string()).max(APP_MENU_DEFINITIONS.length),
});

function allowedRoleMenus(keys: string[]) {
  return [...new Set(["dashboard", ...keys])].filter((key) => key !== "users" && APP_MENU_DEFINITIONS.some((menu) => menu.key === key));
}

accessRoute.use("*", requireAuth, requireRole("admin"));

accessRoute.get("/config", async (c) => {
  const [menuRows, roleRows, userCounts] = await Promise.all([
    db.select().from(appMenus).orderBy(appMenus.key),
    db.select().from(roles).orderBy(roles.name),
    db.select({ roleId: users.roleId, count: sql<number>`count(*)::int` }).from(users).groupBy(users.roleId),
  ]);
  const counts = new Map(userCounts.map((row) => [row.roleId, row.count]));
  return c.json({ data: { menus: menuRows, roles: roleRows.map((role) => ({ ...role, userCount: counts.get(role.id) ?? 0 })) } });
});

accessRoute.post("/roles", async (c) => {
  const parsed = roleInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  const menuKeys = allowedRoleMenus(parsed.data.menuKeys);
  const keyBase = parsed.data.name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "role";
  const [existing] = await db.select({ value: sql<number>`count(*)::int` }).from(roles).where(sql`${roles.key} like ${`${keyBase}%`}`);
  const key = existing?.value ? `${keyBase}-${existing.value + 1}` : keyBase;
  const [created] = await db.insert(roles).values({ key, name: parsed.data.name, description: parsed.data.description ?? null, accessLevel: parsed.data.accessLevel, menuKeys }).returning();
  return c.json({ data: { ...created, userCount: 0 } }, 201);
});

accessRoute.patch("/roles/:id", async (c) => {
  const parsed = roleInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  const [current] = await db.select().from(roles).where(eq(roles.id, c.req.param("id"))).limit(1);
  if (!current) return c.json({ error: "role_not_found" }, 404);
  if (current.isSystem && current.accessLevel === "admin") return c.json({ error: "admin_role_locked" }, 409);
  const menuKeys = allowedRoleMenus(parsed.data.menuKeys);
  const [updated] = await db.update(roles).set({ name: parsed.data.name, description: parsed.data.description ?? null, accessLevel: current.isSystem ? current.accessLevel : parsed.data.accessLevel, menuKeys: current.isSystem && current.accessLevel === "admin" ? current.menuKeys : menuKeys, updatedAt: new Date() }).where(eq(roles.id, current.id)).returning();
  await db.update(users).set({ role: updated.accessLevel, updatedAt: new Date() }).where(eq(users.roleId, current.id));
  const [count] = await db.select({ value: sql<number>`count(*)::int` }).from(users).where(eq(users.roleId, current.id));
  return c.json({ data: { ...updated, userCount: count?.value ?? 0 } });
});

accessRoute.delete("/roles/:id", async (c) => {
  const [role] = await db.select().from(roles).where(eq(roles.id, c.req.param("id"))).limit(1);
  if (!role) return c.json({ error: "role_not_found" }, 404);
  if (role.isSystem) return c.json({ error: "system_role_locked" }, 409);
  const [count] = await db.select({ value: sql<number>`count(*)::int` }).from(users).where(eq(users.roleId, role.id));
  if ((count?.value ?? 0) > 0) return c.json({ error: "role_in_use", userCount: count?.value }, 409);
  await db.delete(roles).where(eq(roles.id, role.id));
  return c.json({ ok: true });
});

accessRoute.patch("/menus/:key", async (c) => {
  const [definition] = APP_MENU_DEFINITIONS.filter((menu) => menu.key === c.req.param("key"));
  if (!definition) return c.json({ error: "menu_not_found" }, 404);
  const parsed = z.object({ enabled: z.boolean() }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed" }, 400);
  if (definition.required && !parsed.data.enabled) return c.json({ error: "required_menu" }, 409);
  const [updated] = await db.update(appMenus).set({ enabled: parsed.data.enabled, updatedAt: new Date() }).where(eq(appMenus.key, definition.key)).returning();
  return c.json({ data: updated });
});
