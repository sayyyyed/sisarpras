import { asc, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { AssetDraftSchema, LocationDraftSchema } from "@sisarpras/domain";
import { db } from "@/db/client";
import { assets, devices, locations, processedMutations, syncChanges } from "@/db/schema";
import { currentSyncCursor } from "@/repositories/assets";
import { currentUser, requireAuth, requireRole } from "@/middleware/auth";

export const syncRoute = new Hono();
const pushSchema = z.object({
  deviceId: z.string().uuid(),
  deviceName: z.string().trim().min(1).max(255).default("Desktop"),
  platform: z.string().trim().min(1).max(50).default("windows"),
  mutations: z.array(z.object({
    mutationId: z.string().min(1).max(100),
    entityType: z.string().min(1).max(50),
    entityId: z.string().uuid(),
    operation: z.enum(["create", "update", "delete"]),
    baseVersion: z.number().int().positive().nullable(),
    payload: z.unknown().optional(),
  })).max(200),
});

/** GET /v1/sync/status — cheap diagnostics for the desktop footer. */
syncRoute.get("/status", async (c) => c.json({ cursor: await currentSyncCursor(), pushEnabled: true, pullEnabled: true }));

syncRoute.post("/push", requireAuth, requireRole("admin", "operator"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "validation_failed", issues: parsed.error.issues }, 400);
  const actor = currentUser(c);
  const { deviceId, deviceName, platform, mutations } = parsed.data;
  await db.insert(devices).values({ id: deviceId, name: deviceName, platform, lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: devices.id, set: { name: deviceName, platform, lastSeenAt: new Date() } });

  const results = [];
  for (const mutation of mutations) {
    const [previous] = await db.select().from(processedMutations).where(eq(processedMutations.mutationId, mutation.mutationId)).limit(1);
    if (previous) {
      results.push({ mutationId: mutation.mutationId, ...(previous.result as Record<string, unknown>), duplicate: true });
      continue;
    }
    if (mutation.entityType !== "asset" && mutation.entityType !== "location") {
      results.push({ mutationId: mutation.mutationId, status: "failed", error: "unsupported_entity" });
      continue;
    }

    let result: Record<string, unknown>;
    try {
      result = await db.transaction(async (tx) => {
      if (mutation.entityType === "asset") {
        const [current] = await tx.select().from(assets).where(eq(assets.id, mutation.entityId)).for("update").limit(1);
        if (mutation.operation === "create") {
          if (current) return { status: "conflict", version: current.version, error: "entity_exists" };
          const draft = AssetDraftSchema.safeParse(mutation.payload);
          if (!draft.success) return { status: "failed", error: "invalid_payload" };
          const now = new Date();
          const [created] = await tx.insert(assets).values({ ...draft.data, id: mutation.entityId, version: 1, createdBy: actor.id, createdAt: now, updatedAt: now })
            .returning();
          await tx.insert(syncChanges).values({ entityType: "asset", entityId: created.id, operation: "create", version: created.version, payload: created, deviceId, actorId: actor.id });
          await tx.insert(processedMutations).values({ mutationId: mutation.mutationId, deviceId, entityType: "asset", entityId: mutation.entityId, result: { status: "acked", version: created.version } });
          return { status: "acked", version: created.version };
        }
        if (!current) return { status: "conflict", error: "entity_not_found" };
        if (mutation.baseVersion !== current.version) return { status: "conflict", version: current.version, server: current };
        if (mutation.operation === "delete") {
          const [updated] = await tx.update(assets).set({ version: current.version + 1, updatedAt: new Date(), deletedAt: new Date() }).where(eq(assets.id, current.id)).returning();
          await tx.insert(syncChanges).values({ entityType: "asset", entityId: current.id, operation: "delete", version: updated.version, payload: updated, deviceId, actorId: actor.id });
          await tx.insert(processedMutations).values({ mutationId: mutation.mutationId, deviceId, entityType: "asset", entityId: current.id, result: { status: "acked", version: updated.version } });
          return { status: "acked", version: updated.version };
        }
        const draft = AssetDraftSchema.safeParse(mutation.payload);
        if (!draft.success) return { status: "failed", error: "invalid_payload" };
        const [updated] = await tx.update(assets).set({ ...draft.data, version: current.version + 1, updatedAt: new Date() }).where(eq(assets.id, current.id)).returning();
        await tx.insert(syncChanges).values({ entityType: "asset", entityId: current.id, operation: "update", version: updated.version, payload: updated, deviceId, actorId: actor.id });
        await tx.insert(processedMutations).values({ mutationId: mutation.mutationId, deviceId, entityType: "asset", entityId: current.id, result: { status: "acked", version: updated.version } });
        return { status: "acked", version: updated.version };
      }

      const [current] = await tx.select().from(locations).where(eq(locations.id, mutation.entityId)).for("update").limit(1);
      if (mutation.operation === "create") {
        if (current) return { status: "conflict", version: current.version, error: "entity_exists" };
        const draft = LocationDraftSchema.safeParse(mutation.payload);
        if (!draft.success) return { status: "failed", error: "invalid_payload" };
        const now = new Date();
        const [created] = await tx.insert(locations).values({ ...draft.data, id: mutation.entityId, version: 1, createdAt: now, updatedAt: now })
          .returning();
        await tx.insert(syncChanges).values({ entityType: "location", entityId: created.id, operation: "create", version: created.version, payload: created, deviceId, actorId: actor.id });
        await tx.insert(processedMutations).values({ mutationId: mutation.mutationId, deviceId, entityType: "location", entityId: mutation.entityId, result: { status: "acked", version: created.version } });
        return { status: "acked", version: created.version };
      }
      if (!current) return { status: "conflict", error: "entity_not_found" };
      if (mutation.baseVersion !== current.version) return { status: "conflict", version: current.version, server: current };
      if (mutation.operation === "delete") {
        const [updated] = await tx.update(locations).set({ version: current.version + 1, updatedAt: new Date(), deletedAt: new Date() }).where(eq(locations.id, current.id)).returning();
        await tx.insert(syncChanges).values({ entityType: "location", entityId: current.id, operation: "delete", version: updated.version, payload: updated, deviceId, actorId: actor.id });
        await tx.insert(processedMutations).values({ mutationId: mutation.mutationId, deviceId, entityType: "location", entityId: current.id, result: { status: "acked", version: updated.version } });
        return { status: "acked", version: updated.version };
      }
      const draft = LocationDraftSchema.safeParse(mutation.payload);
      if (!draft.success) return { status: "failed", error: "invalid_payload" };
      const [updated] = await tx.update(locations).set({ ...draft.data, version: current.version + 1, updatedAt: new Date() }).where(eq(locations.id, current.id)).returning();
      await tx.insert(syncChanges).values({ entityType: "location", entityId: current.id, operation: "update", version: updated.version, payload: updated, deviceId, actorId: actor.id });
      await tx.insert(processedMutations).values({ mutationId: mutation.mutationId, deviceId, entityType: "location", entityId: current.id, result: { status: "acked", version: updated.version } });
      return { status: "acked", version: updated.version };
      });
    } catch {
      result = { status: "failed", error: "write_failed" };
    }
    results.push({ mutationId: mutation.mutationId, ...result });
  }
  return c.json({ results, cursor: await currentSyncCursor() });
});

syncRoute.get("/pull", requireAuth, async (c) => {
  const since = Number(c.req.query("since") ?? 0);
  const requestedLimit = Number(c.req.query("limit") ?? 200);
  if (!Number.isSafeInteger(since) || since < 0 || !Number.isSafeInteger(requestedLimit)) return c.json({ error: "invalid_cursor" }, 400);
  const limit = Math.min(Math.max(requestedLimit, 1), 500);
  const rows = await db.select().from(syncChanges).where(gt(syncChanges.seq, since)).orderBy(asc(syncChanges.seq)).limit(limit + 1);
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const cursor = data.length ? data[data.length - 1]!.seq : since;
  return c.json({ data, cursor, hasMore });
});
