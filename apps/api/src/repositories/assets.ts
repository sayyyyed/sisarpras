import { and, desc, eq, ilike, inArray, isNull, like, or, sql } from "drizzle-orm";
import type { AssetDraft, AssetPatch, AssetStockAdjustment, AssetRoomStock, CategoryPatch } from "@sisarpras/domain";
import { db } from "@/db/client";
import { assetEvents, assetLoans, assetRoomStocks, assets, assetCategories, locations, syncChanges } from "@/db/schema";

export class AssetStockError extends Error {
  constructor(message: string, readonly status: 404 | 409 | 422) { super(message); }
}

async function roomStocksFor(assetId: string) {
  const rows = await db.select().from(assetRoomStocks).where(eq(assetRoomStocks.assetId, assetId));
  return rows.map(({ locationId, quantity }) => ({ locationId, quantity }));
}

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
  if (filters.locationId) {
    conditions.push(inArray(assets.id, db.select({ assetId: assetRoomStocks.assetId }).from(assetRoomStocks).where(eq(assetRoomStocks.locationId, filters.locationId))));
  }
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
      stockQuantity: assets.stockQuantity,
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

  if (rows.length === 0) return rows;
  const allocations = await db.select().from(assetRoomStocks).where(inArray(assetRoomStocks.assetId, rows.map((row) => row.id)));
  const roomStocks = new Map<string, { locationId: string; quantity: number }[]>();
  for (const allocation of allocations) {
    const items = roomStocks.get(allocation.assetId) ?? [];
    items.push({ locationId: allocation.locationId, quantity: allocation.quantity });
    roomStocks.set(allocation.assetId, items);
  }
  return rows.map((row) => ({ ...row, roomStocks: roomStocks.get(row.id) ?? [] }));
}

export async function getAssetById(id: string) {
  const [row] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return row ? { ...row, roomStocks: await roomStocksFor(id) } : null;
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
    if (draft.roomStocks.reduce((total, item) => total + item.quantity, 0) > draft.stockQuantity) {
      throw new AssetStockError("Jumlah yang dipakai melebihi stok", 422);
    }
    const year = new Date().getFullYear();
    const prefix = `AST-${year}-`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`sisarpras.asset-code:${year}`}))`);
    const existingCodes = await tx.select({ assetCode: assets.assetCode }).from(assets).where(like(assets.assetCode, `${prefix}%`));
    const highest = existingCodes.reduce((max, row) => {
      const value = Number.parseInt(row.assetCode.slice(prefix.length), 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);
    const assetCode = `${prefix}${String(highest + 1).padStart(4, "0")}`;
    const [created] = await tx
      .insert(assets)
      .values({
        assetCode,
        name: draft.name,
        categoryId: draft.categoryId,
        locationId: draft.locationId,
        stockQuantity: draft.stockQuantity,
        serialNumber: draft.serialNumber,
        description: draft.description,
        condition: draft.condition,
        status: draft.status,
        acquisitionDate: draft.acquisitionDate,
        acquisitionCostIdr: draft.acquisitionCostIdr,
        createdBy: context.actorId ?? null,
      })
      .returning();

    if (draft.roomStocks.length) {
      await tx.insert(assetRoomStocks).values(draft.roomStocks.map((item) => ({ assetId: created.id, ...item })));
    }

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
      payload: { ...created, roomStocks: draft.roomStocks },
      deviceId: context.deviceId ?? null,
      actorId: context.actorId ?? null,
    });

    return { ...created, roomStocks: draft.roomStocks };
  });
}

/** Atomically adjust stock and reject any reduction below units currently used. */
export async function adjustAssetStock(id: string, adjustment: AssetStockAdjustment, context: { actorId?: string } = {}) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(assets).where(eq(assets.id, id)).for("update").limit(1);
    if (!current || current.deletedAt) throw new AssetStockError("Aset tidak ditemukan", 404);
    const allocations = await tx.select().from(assetRoomStocks).where(eq(assetRoomStocks.assetId, id));
    const activeLoans = await tx.select({ quantity: assetLoans.quantity }).from(assetLoans).where(and(eq(assetLoans.assetId, id), isNull(assetLoans.returnedAt)));
    const used = allocations.reduce((total, item) => total + item.quantity, 0) + activeLoans.reduce((total, item) => total + item.quantity, 0);
    const stockQuantity = current.stockQuantity + adjustment.delta;
    if (stockQuantity < 0) throw new AssetStockError("Stok tidak boleh kurang dari nol", 422);
    if (stockQuantity < used) throw new AssetStockError(`Stok tidak dapat dikurangi. ${used} unit sedang digunakan.`, 409);

    const [updated] = await tx.update(assets).set({ stockQuantity, version: current.version + 1, updatedAt: new Date() }).where(eq(assets.id, id)).returning();
    const roomStocks = allocations.map(({ locationId, quantity }) => ({ locationId, quantity }));
    await tx.insert(assetEvents).values({ assetId: id, actorId: context.actorId ?? null, operation: "update", before: current, after: { ...updated, roomStocks } });
    await tx.insert(syncChanges).values({ entityType: "asset", entityId: id, operation: "update", version: updated.version, payload: { ...updated, roomStocks }, actorId: context.actorId ?? null });
    return { ...updated, roomStocks };
  });
}

/** Set the number of this asset assigned to one room, enforcing total stock. */
export async function setAssetRoomStock(id: string, locationId: string, input: AssetRoomStock, context: { actorId?: string } = {}) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(assets).where(eq(assets.id, id)).for("update").limit(1);
    if (!current || current.deletedAt) throw new AssetStockError("Aset tidak ditemukan", 404);
    const [room] = await tx.select().from(locations).where(eq(locations.id, locationId)).limit(1);
    if (!room || (room.kind !== "room" && room.kind !== "storage")) throw new AssetStockError("Ruangan tidak ditemukan", 404);
    const allocations = await tx.select().from(assetRoomStocks).where(eq(assetRoomStocks.assetId, id));
    const activeLoans = await tx.select({ quantity: assetLoans.quantity }).from(assetLoans).where(and(eq(assetLoans.assetId, id), isNull(assetLoans.returnedAt)));
    const usedElsewhere = allocations.filter((item) => item.locationId !== locationId).reduce((total, item) => total + item.quantity, 0) + activeLoans.reduce((total, item) => total + item.quantity, 0);
    if (usedElsewhere + input.quantity > current.stockQuantity) {
      throw new AssetStockError(`Stok tersedia hanya ${Math.max(0, current.stockQuantity - usedElsewhere)} unit`, 409);
    }
    if (input.quantity === 0) await tx.delete(assetRoomStocks).where(and(eq(assetRoomStocks.assetId, id), eq(assetRoomStocks.locationId, locationId)));
    else await tx.insert(assetRoomStocks).values({ assetId: id, locationId, quantity: input.quantity, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [assetRoomStocks.assetId, assetRoomStocks.locationId], set: { quantity: input.quantity, updatedAt: new Date() } });
    const [updated] = await tx.update(assets).set({ version: current.version + 1, updatedAt: new Date() }).where(eq(assets.id, id)).returning();
    const roomStocks = allocations.filter((item) => item.locationId !== locationId).map(({ locationId: roomId, quantity }) => ({ locationId: roomId, quantity }));
    if (input.quantity > 0) roomStocks.push({ locationId, quantity: input.quantity });
    await tx.insert(assetEvents).values({ assetId: id, actorId: context.actorId ?? null, operation: "update", before: { ...current, roomStocks: allocations }, after: { ...updated, roomStocks } });
    await tx.insert(syncChanges).values({ entityType: "asset", entityId: id, operation: "update", version: updated.version, payload: { ...updated, roomStocks }, actorId: context.actorId ?? null });
    return { ...updated, roomStocks };
  });
}

export async function updateAsset(id: string, patch: AssetPatch, context: { actorId?: string } = {}) {
  const updated = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(assets).where(eq(assets.id, id)).limit(1);
    if (!current) return null;

    const [updated] = await tx
      .update(assets)
      .set({ ...patch, version: current.version + 1, updatedAt: new Date() })
      .where(eq(assets.id, id))
      .returning();

    const allocationRows = await tx.select().from(assetRoomStocks).where(eq(assetRoomStocks.assetId, id));
    const roomStocks = allocationRows.map(({ locationId, quantity }) => ({ locationId, quantity }));

    await tx.insert(assetEvents).values({
      assetId: id,
      actorId: context.actorId ?? null,
      operation: "update",
      before: current,
      after: { ...updated, roomStocks },
    });

    await tx.insert(syncChanges).values({
      entityType: "asset",
      entityId: id,
      operation: "update",
      version: updated.version,
      payload: { ...updated, roomStocks },
      actorId: context.actorId ?? null,
    });

    return updated;
  });
  return updated ? { ...updated, roomStocks: await roomStocksFor(id) } : null;
}

/** Soft delete only: disposal keeps the row and its full history. */
export async function softDeleteAsset(id: string, context: { actorId?: string } = {}) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(assets).where(eq(assets.id, id)).limit(1);
    if (!current) return null;

    const [updated] = await tx
      .update(assets)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: current.version + 1 })
      .where(eq(assets.id, id))
      .returning();

    await tx.insert(assetEvents).values({
      assetId: id,
      actorId: context.actorId ?? null,
      operation: "delete",
      before: current,
      after: updated,
    });

    await tx.insert(syncChanges).values({
      entityType: "asset",
      entityId: id,
      operation: "delete",
      version: updated.version,
      payload: updated,
      actorId: context.actorId ?? null,
    });

    return updated;
  });
}

export async function listCategories() {
  return db.select().from(assetCategories).orderBy(assetCategories.name);
}

/** Categories must be creatable without going through procurement. */
export async function createCategory(code: string, name: string) {
  const [created] = await db
    .insert(assetCategories)
    .values({ code: code.trim().toUpperCase(), name: name.trim() })
    .returning();
  return created;
}

export async function updateCategory(id: string, patch: CategoryPatch) {
  const [updated] = await db.update(assetCategories)
    .set(patch)
    .where(eq(assetCategories.id, id))
    .returning();
  return updated ?? null;
}

/** Highest change-feed cursor, for clients to resume pull from. */
export async function currentSyncCursor(): Promise<number> {
  const [row] = await db
    .select({ seq: sql<number>`coalesce(max(${syncChanges.seq}), 0)` })
    .from(syncChanges);
  return Number(row?.seq ?? 0);
}
