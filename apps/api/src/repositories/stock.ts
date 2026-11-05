import { asc, eq } from "drizzle-orm";
import type { StockMovementDraft } from "@sisarpras/domain";
import { db } from "@/db/client";
import { stockItems, stockMovements, syncChanges } from "@/db/schema";

export class StockError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 422,
  ) {
    super(message);
    this.name = "StockError";
  }
}

export async function listStockItems() {
  return db.select().from(stockItems).orderBy(asc(stockItems.name));
}

/**
 * One transaction: append the movement, move the cached quantity, and record
 * the change feed row. The movement table stays the source of truth; the
 * quantity column is a projection kept in sync.
 */
export async function createStockMovement(draft: StockMovementDraft, actorId?: string) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(stockItems)
      .where(eq(stockItems.id, draft.stockItemId))
      .limit(1);

    if (!item) throw new StockError("Jenis stok tidak ditemukan", 404);

    const nextQuantity = item.quantity + draft.delta;
    if (nextQuantity < 0) {
      throw new StockError(`Stok tidak boleh negatif (tersedia ${item.quantity} ${item.unit})`, 422);
    }

    // A repeated transactionId would violate the unique index — that is the
    // idempotency guard, so let it surface rather than silently doubling stock.
    const [movement] = await tx
      .insert(stockMovements)
      .values({
        stockItemId: draft.stockItemId,
        delta: draft.delta,
        reason: draft.reason,
        transactionId: draft.transactionId,
        actorId: actorId ?? null,
      })
      .returning();

    const [updated] = await tx
      .update(stockItems)
      .set({ quantity: nextQuantity, updatedAt: new Date() })
      .where(eq(stockItems.id, draft.stockItemId))
      .returning();

    await tx.insert(syncChanges).values({
      entityType: "stock_item",
      entityId: item.id,
      operation: "update",
      version: 1,
      payload: updated,
      actorId: actorId ?? null,
    });

    return { movement, item: updated };
  });
}

export async function listStockMovements(stockItemId: string) {
  return db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.stockItemId, stockItemId))
    .orderBy(asc(stockMovements.createdAt));
}
