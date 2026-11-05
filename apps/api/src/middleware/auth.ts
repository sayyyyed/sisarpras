import type { Context, MiddlewareHandler } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { readToken, type SessionUser } from "@/lib/tokens";

export type AuthEnv = { Variables: { user: SessionUser } };

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const value = c.req.header("authorization");
  const token = value?.match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = token ? readToken(token) : null;
  if (!claims) return c.json({ error: "unauthorized" }, 401);
  const [record] = await db.select({ id: users.id, name: users.name, role: users.role }).from(users)
    .where(and(eq(users.id, claims.id), eq(users.isActive, true))).limit(1);
  if (!record) return c.json({ error: "unauthorized" }, 401);
  const user = record;
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
