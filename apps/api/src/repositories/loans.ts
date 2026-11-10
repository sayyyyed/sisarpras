import { and, desc, eq, isNull } from "drizzle-orm";
import type { AssetLoanDraft } from "@sisarpras/domain";
import { db } from "@/db/client";
import { assetLoans, assetRoomStocks, assets } from "@/db/schema";

export class LoanError extends Error {
  constructor(message: string, readonly status: 404 | 409 | 422) { super(message); }
}

export async function listLoans() {
  return db.select().from(assetLoans).orderBy(desc(assetLoans.createdAt));
}

export async function createLoan(draft: AssetLoanDraft, actorId: string) {
  return db.transaction(async (tx) => {
    const [asset] = await tx.select().from(assets).where(eq(assets.id, draft.assetId)).for("update").limit(1);
    if (!asset || asset.deletedAt) throw new LoanError("Aset tidak ditemukan", 404);
    const rooms = await tx.select({ quantity: assetRoomStocks.quantity }).from(assetRoomStocks).where(eq(assetRoomStocks.assetId, asset.id));
    const loans = await tx.select({ quantity: assetLoans.quantity }).from(assetLoans).where(and(eq(assetLoans.assetId, asset.id), isNull(assetLoans.returnedAt)));
    const available = asset.stockQuantity - rooms.reduce((sum, row) => sum + row.quantity, 0) - loans.reduce((sum, row) => sum + row.quantity, 0);
    if (draft.quantity > available) throw new LoanError(`Stok tersedia hanya ${Math.max(0, available)} unit`, 409);
    const [created] = await tx.insert(assetLoans).values({ ...draft, createdBy: actorId }).returning();
    return created;
  });
}

export async function returnLoan(id: string) {
  return db.transaction(async (tx) => {
    const [loan] = await tx.select().from(assetLoans).where(eq(assetLoans.id, id)).limit(1);
    if (!loan) throw new LoanError("Peminjaman tidak ditemukan", 404);
    await tx.select({ id: assets.id }).from(assets).where(eq(assets.id, loan.assetId)).for("update");
    const [updated] = await tx.update(assetLoans).set({ returnedAt: new Date() }).where(and(eq(assetLoans.id, id), isNull(assetLoans.returnedAt))).returning();
    if (!updated) throw new LoanError("Peminjaman sudah dikembalikan", 409);
    return updated;
  });
}
