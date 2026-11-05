import { asc, isNull } from "drizzle-orm";
import type { LocationDraft } from "@sisarpras/domain";
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
