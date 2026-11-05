import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { AssetDraft } from "@sisarpras/domain";
import { db } from "@/db/client";
import { assetEvents, assets, assetCategories, locations, syncChanges } from "@/db/schema";

export interface AssetFilters {
  q?: string;
  categoryId?: string;
  locationId?: string;
  condition?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Reads go through one shape so the client can swap the local SQLite
 * repository for this API repository without touching the UI.
 */
export async function listAssets(filters: AssetFilters = {}) {
  const conditions = [isNull(assets.deletedAt)];

  if (filters.q) {
    const needle = `%${filters.q}%`;
    const match = or(
      ilike(assets.name, needle),
      ilike(assets.assetCode, needle),
      ilike(assets.serialNumber, needle),
    );
    if (match) conditions.push(match);
  }
  if (filters.categoryId) conditions.push(eq(assets.categoryId, filters.categoryId));
  if (filters.locationId) conditions.push(eq(assets.locationId, filters.locationId));
  if (filters.condition) conditions.push(sql`${assets.condition}::text = ${filters.condition}`);
  if (filters.status) conditions.push(sql`${assets.status}::text = ${filters.status}`);

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const rows = await db
    .select({
      id: assets.id,
      assetCode: assets.assetCode,
      name: assets.name,
      categoryId: assets.categoryId,
      categoryName: assetCategories.name,
      locationId: assets.locationId,
      locationName: locations.name,
      serialNumber: assets.serialNumber,
      description: assets.description,
      condition: assets.condition,
      status: assets.status,
      acquisitionDate: assets.acquisitionDate,
      acquisitionCostIdr: assets.acquisitionCostIdr,
      version: assets.version,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
      deletedAt: assets.deletedAt,
    })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .where(and(...conditions))
    .orderBy(desc(assets.updatedAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function getAssetById(id: string) {
  const [row] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return row ?? null;
}

export async function isAssetCodeTaken(assetCode: string, excludeId?: string) {
  const [row] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.assetCode, assetCode))
    .limit(1);
  if (!row) return false;
  return excludeId ? row.id !== excludeId : true;
}

/**
 * One transaction writes the asset, its audit event, and the server change
 * feed row — the server-side twin of the desktop's SQLite outbox.
 */
export async function createAsset(draft: AssetDraft, context: { actorId?: string; deviceId?: string } = {}) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(assets)
      .values({
        assetCode: draft.assetCode,
        name: draft.name,
        categoryId: draft.categoryId,
        locationId: draft.locationId,
        serialNumber: draft.serialNumber,
        description: draft.description,
        condition: draft.condition,
        status: draft.status,
        acquisitionDate: draft.acquisitionDate,
        acquisitionCostIdr: draft.acquisitionCostIdr,
        createdBy: context.actorId ?? null,
      })
      .returning();

    await tx.insert(assetEvents).values({
      assetId: created.id,
      actorId: context.actorId ?? null,
      operation: "create",
      after: created,
      deviceId: context.deviceId ?? null,
    });

    await tx.insert(syncChanges).values({
      entityType: "asset",
      entityId: created.id,
      operation: "create",
      version: created.version,
      payload: created,
      deviceId: context.deviceId ?? null,
      actorId: context.actorId ?? null,
    });

    return created;
  });
}

export async function listCategories() {
  return db.select().from(assetCategories).orderBy(assetCategories.name);
}

/** Highest change-feed cursor, for clients to resume pull from. */
export async function currentSyncCursor(): Promise<number> {
  const [row] = await db
    .select({ seq: sql<number>`coalesce(max(${syncChanges.seq}), 0)` })
    .from(syncChanges);
  return Number(row?.seq ?? 0);
}
