import type { Context, MiddlewareHandler } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appMenus, roles, users } from "@/db/schema";
import { readToken, type SessionUser } from "@/lib/tokens";

export type AuthEnv = { Variables: { user: SessionUser } };

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  if (c.get("user")) return next();
  const value = c.req.header("authorization");
  const token = value?.match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = token ? readToken(token) : null;
  if (!claims) return c.json({ error: "unauthorized" }, 401);
  const [record] = await db.select({ id: users.id, name: users.name, role: users.role, roleId: roles.id, roleKey: roles.key, roleName: roles.name, menuKeys: roles.menuKeys }).from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.id, claims.id), eq(users.isActive, true))).limit(1);
  if (!record) return c.json({ error: "unauthorized" }, 401);
  if (!record.roleId) return c.json({ error: "role_not_configured" }, 403);
  const activeMenus = await db.select({ key: appMenus.key }).from(appMenus).where(eq(appMenus.enabled, true));
  const activeKeys = new Set(activeMenus.map((menu) => menu.key));
  const user: SessionUser = {
    id: record.id,
    name: record.name,
    role: record.role,
    roleId: record.roleId,
    roleKey: record.roleKey!,
    roleName: record.roleName!,
    menuKeys: (record.role === "admin" ? activeMenus.map((menu) => menu.key) : record.menuKeys ?? []).filter((key) => activeKeys.has(key)),
  };
  c.set("user", user);
  await next();
};

export function currentUser(c: Context): SessionUser {
  return c.get("user" as never) as SessionUser;
}

export function requireRole(...roles: SessionUser["role"][]): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) return c.json({ error: "forbidden" }, 403);
    await next();
  };
}

export function requireMenuAccess(menuKey: string): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    if (!user.menuKeys.includes(menuKey)) return c.json({ error: "menu_access_denied" }, 403);
    await next();
  };
}
