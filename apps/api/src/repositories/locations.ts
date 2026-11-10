import { asc, eq, isNull } from "drizzle-orm";
import type { LocationDraft, LocationPatch } from "@sisarpras/domain";
import { db } from "@/db/client";
import { locations, syncChanges } from "@/db/schema";

export async function listLocations() {
  return db.select().from(locations).where(isNull(locations.deletedAt)).orderBy(asc(locations.name));
}

/**
 * A new room joins the server database and the change feed in one transaction,
 * same shape as the asset write so pull-based sync picks it up later.
 */
export async function createLocation(draft: LocationDraft, context: { actorId?: string; deviceId?: string } = {}) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(locations)
      .values({
        name: draft.name,
        kind: draft.kind,
        // A building is a root node; everything else may hang off a parent.
        parentId: draft.kind === "building" ? null : draft.parentId,
        building: draft.building,
        floor: draft.floor,
        capacity: draft.capacity,
      })
      .returning();

    await tx.insert(syncChanges).values({
      entityType: "location",
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

export async function createBuilding(name: string, floorCount: number, context: { actorId?: string } = {}) {
  return db.transaction(async (tx) => {
    const [building] = await tx.insert(locations).values({ name, kind: "building", parentId: null, building: name, floor: null }).returning();
    await tx.insert(syncChanges).values({ entityType: "location", entityId: building.id, operation: "create", version: building.version, payload: building, actorId: context.actorId ?? null });
    const floors = [];
    for (let index = 1; index <= floorCount; index += 1) {
      const floorName = `Lantai ${index}`;
      const [floor] = await tx.insert(locations).values({ name: floorName, kind: "floor", parentId: building.id, building: name, floor: floorName }).returning();
      floors.push(floor);
      await tx.insert(syncChanges).values({ entityType: "location", entityId: floor.id, operation: "create", version: floor.version, payload: floor, actorId: context.actorId ?? null });
    }
    return { building, floors };
  });
}

export async function updateBuilding(id: string, name: string, floorCount: number, context: { actorId?: string } = {}) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(locations).where(eq(locations.id, id)).limit(1);
    if (!current || current.kind !== "building") return null;

    const [building] = await tx.update(locations).set({ name, building: name, updatedAt: new Date() }).where(eq(locations.id, id)).returning();
    await tx.insert(syncChanges).values({ entityType: "location", entityId: id, operation: "update", version: building.version, payload: building, actorId: context.actorId ?? null });

    const active = await tx.select().from(locations).where(isNull(locations.deletedAt));
    const floors = active.filter((row) => row.kind === "floor" && row.parentId === id)
      .sort((a, b) => Number((a.name.match(/\d+/)?.[0] ?? 0)) - Number((b.name.match(/\d+/)?.[0] ?? 0)));

    if (floors.length > floorCount) {
      const removed = floors.slice(floorCount);
      const removedIds = new Set(removed.map((floor) => floor.id));
      if (active.some((row) => row.parentId && removedIds.has(row.parentId))) {
        throw new Error("floor_has_rooms");
      }
      for (const floor of removed) {
        const [deleted] = await tx.update(locations).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(locations.id, floor.id)).returning();
        await tx.insert(syncChanges).values({ entityType: "location", entityId: floor.id, operation: "delete", version: deleted.version, payload: deleted, actorId: context.actorId ?? null });
      }
    }

    const keptCount = Math.min(floors.length, floorCount);
    for (let index = 0; index < keptCount; index += 1) {
      const floor = floors[index];
      const floorName = `Lantai ${index + 1}`;
      if (floor.name !== floorName || floor.building !== name || floor.floor !== floorName) {
        const [updated] = await tx.update(locations).set({ name: floorName, building: name, floor: floorName, updatedAt: new Date() }).where(eq(locations.id, floor.id)).returning();
        await tx.insert(syncChanges).values({ entityType: "location", entityId: floor.id, operation: "update", version: updated.version, payload: updated, actorId: context.actorId ?? null });
        for (const child of active.filter((row) => row.parentId === floor.id)) {
          const [updatedChild] = await tx.update(locations).set({ floor: floorName, building: name, updatedAt: new Date() }).where(eq(locations.id, child.id)).returning();
          await tx.insert(syncChanges).values({ entityType: "location", entityId: child.id, operation: "update", version: updatedChild.version, payload: updatedChild, actorId: context.actorId ?? null });
        }
      }
    }
    for (let index = keptCount; index < floorCount; index += 1) {
      const floorName = `Lantai ${index + 1}`;
      const [created] = await tx.insert(locations).values({ name: floorName, kind: "floor", parentId: id, building: name, floor: floorName }).returning();
      await tx.insert(syncChanges).values({ entityType: "location", entityId: created.id, operation: "create", version: created.version, payload: created, actorId: context.actorId ?? null });
    }

    const descendants = active.filter((row) => row.building === current.name && row.id !== id);
    for (const row of descendants) {
      if (row.kind === "floor" && floors.some((floor) => floor.id === row.id)) continue;
      if (row.parentId && floors.some((floor) => floor.id === row.parentId)) continue;
      if (row.building === name) continue;
      const [updated] = await tx.update(locations).set({ building: name, updatedAt: new Date() }).where(eq(locations.id, row.id)).returning();
      await tx.insert(syncChanges).values({ entityType: "location", entityId: row.id, operation: "update", version: updated.version, payload: updated, actorId: context.actorId ?? null });
    }

    const updatedFloors = await tx.select().from(locations).where(isNull(locations.deletedAt));
    return { building, floors: updatedFloors.filter((row) => row.kind === "floor" && row.parentId === id) };
  });
}

export async function updateLocation(id: string, patch: LocationPatch, context: { actorId?: string } = {}) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(locations).where(eq(locations.id, id)).limit(1);
    if (!current) return null;
    const [updated] = await tx
      .update(locations)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();

    await tx.insert(syncChanges).values({
      entityType: "location",
      entityId: id,
      operation: "update",
      version: 1,
      payload: updated,
      actorId: context.actorId ?? null,
    });

    if (current.kind === "building" && patch.name && patch.name !== current.name) {
      const descendants = await tx.select().from(locations).where(isNull(locations.deletedAt));
      const children = descendants.filter((row) => row.parentId === id || (row.building === current.name && row.id !== id));
      for (const child of children) {
        const [renamed] = await tx.update(locations).set({ building: patch.name, updatedAt: new Date() }).where(eq(locations.id, child.id)).returning();
        await tx.insert(syncChanges).values({ entityType: "location", entityId: child.id, operation: "update", version: renamed.version, payload: renamed, actorId: context.actorId ?? null });
      }
    }

    return updated;
  });
}

export async function softDeleteLocation(id: string, context: { actorId?: string } = {}) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(locations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();

    if (!updated) return null;

    await tx.insert(syncChanges).values({
      entityType: "location",
      entityId: id,
      operation: "delete",
      version: 1,
      payload: updated,
      actorId: context.actorId ?? null,
    });

    return updated;
  });
}
