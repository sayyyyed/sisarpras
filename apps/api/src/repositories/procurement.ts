import { desc, eq, isNull, sql } from "drizzle-orm";
import type { ProcurementDraft, ProcurementPatch } from "@sisarpras/domain";
import { db } from "@/db/client";
import { procurementRequests, syncChanges } from "@/db/schema";

export async function listProcurements() {
  return db
    .select()
    .from(procurementRequests)
    .where(isNull(procurementRequests.deletedAt))
    .orderBy(desc(procurementRequests.createdAt));
}

/** "PR-2026-003" — derived from the highest reference of the current year. */
function buildReference(year: number, highest: string | null): string {
  const prefix = `PR-${year}-`;
  const last = highest && highest.startsWith(prefix) ? Number.parseInt(highest.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(last) ? last + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export async function createProcurement(draft: ProcurementDraft, actorId?: string) {
  return db.transaction(async (tx) => {
    const year = new Date().getFullYear();
    const [row] = await tx
      .select({ highest: sql<string | null>`max(${procurementRequests.reference})` })
      .from(procurementRequests)
      .where(sql`${procurementRequests.reference} like ${`PR-${year}-%`}`);

    const [created] = await tx
      .insert(procurementRequests)
      .values({
        reference: buildReference(year, row?.highest ?? null),
        itemName: draft.itemName,
        quantity: draft.quantity,
        vendor: draft.vendor,
        proposedPriceIdr: draft.proposedPriceIdr,
        requestedAt: draft.requestedAt,
        notes: draft.notes,
        status: "submitted",
        requestedBy: actorId ?? null,
      })
      .returning();

    await tx.insert(syncChanges).values({
      entityType: "procurement",
      entityId: created.id,
      operation: "create",
      version: 1,
      payload: created,
      actorId: actorId ?? null,
    });

    return created;
  });
}

export async function updateProcurement(id: string, patch: ProcurementPatch, actorId?: string) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(procurementRequests)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(procurementRequests.id, id))
      .returning();

    if (!updated) return null;

    await tx.insert(syncChanges).values({
      entityType: "procurement",
      entityId: id,
      operation: "update",
      version: 1,
      payload: updated,
      actorId: actorId ?? null,
    });

    return updated;
  });
}

/** Soft delete: history stays, the row leaves the list. */
export async function deleteProcurement(id: string, actorId?: string) {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(procurementRequests)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(procurementRequests.id, id))
      .returning();

    if (!deleted) return null;

    await tx.insert(syncChanges).values({
      entityType: "procurement",
      entityId: id,
      operation: "delete",
      version: 1,
      payload: { id },
      actorId: actorId ?? null,
    });

    return deleted;
  });
}
