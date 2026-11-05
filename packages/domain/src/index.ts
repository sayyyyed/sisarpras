import { z } from "zod";

/* ---------------------------------------------------------------------------
   Assets
   --------------------------------------------------------------------------- */

export const AssetCondition = z.enum(["good", "fair", "damaged"]);
export type AssetCondition = z.infer<typeof AssetCondition>;

export const AssetStatus = z.enum(["available", "assigned", "maintenance", "disposed"]);
export type AssetStatus = z.infer<typeof AssetStatus>;

export const AssetSchema = z.object({
  id: z.string().min(1),
  assetCode: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  categoryId: z.string().min(1),
  locationId: z.string().min(1),
  serialNumber: z.string().max(150).nullable(),
  description: z.string().nullable(),
  condition: AssetCondition,
  status: AssetStatus,
  acquisitionDate: z.string().nullable(),
  acquisitionCostIdr: z.number().int().nonnegative().nullable(),
  version: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type Asset = z.infer<typeof AssetSchema>;

/** Payload accepted by the "Tambah Aset" form. Server assigns id/version/timestamps. */
export const AssetDraftSchema = AssetSchema.omit({
  id: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
export type AssetDraft = z.infer<typeof AssetDraftSchema>;

/* ---------------------------------------------------------------------------
   Categories & locations
   --------------------------------------------------------------------------- */

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  code: z.string().min(1),
});
export type Category = z.infer<typeof CategorySchema>;

/** Rooms are hierarchical: building > floor > room, linked by parentId. */
export const LocationKind = z.enum(["building", "floor", "room", "storage"]);
export type LocationKind = z.infer<typeof LocationKind>;

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  kind: LocationKind,
  parentId: z.string().nullable(),
  building: z.string().nullable(),
  floor: z.string().nullable(),
  capacity: z.number().int().nonnegative().nullable(),
});
export type Location = z.infer<typeof LocationSchema>;

/** Payload accepted by the "Tambah Ruangan" form. Server assigns id/timestamps. */
export const LocationDraftSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(255),
  kind: LocationKind,
  parentId: z.string().nullable(),
  building: z.string().max(255).nullable(),
  floor: z.string().max(100).nullable(),
  capacity: z.number().int().nonnegative().nullable(),
});
export type LocationDraft = z.infer<typeof LocationDraftSchema>;

export const LOCATION_KIND_LABEL: Record<LocationKind, string> = {
  building: "Gedung",
  floor: "Lantai",
  room: "Ruangan",
  storage: "Gudang",
};

/* ---------------------------------------------------------------------------
   Room classification, derived from the condition of the assets inside it
   --------------------------------------------------------------------------- */

export const RoomHealth = z.enum(["good", "attention", "critical", "storage"]);
export type RoomHealth = z.infer<typeof RoomHealth>;

export interface RoomSummary {
  location: Location;
  totalAssets: number;
  byCondition: Record<AssetCondition, number>;
  health: RoomHealth;
  healthLabel: string;
}

export const ROOM_HEALTH_LABEL: Record<RoomHealth, string> = {
  good: "Baik",
  attention: "Perlu Perhatian",
  critical: "Kritis",
  storage: "Stok",
};

/* ---------------------------------------------------------------------------
   Procurement (pengadaan)
   --------------------------------------------------------------------------- */

export const ProcurementStatus = z.enum(["draft", "submitted", "approved", "rejected", "received"]);
export type ProcurementStatus = z.infer<typeof ProcurementStatus>;

export const ProcurementSchema = z.object({
  id: z.string(),
  reference: z.string(),
  itemName: z.string(),
  quantity: z.number().int().positive(),
  vendor: z.string(),
  proposedPriceIdr: z.number().int().nonnegative(),
  approvedPriceIdr: z.number().int().nonnegative().nullable(),
  requestedAt: z.string(),
  status: ProcurementStatus,
  receiptFiles: z.array(z.string()),
});
export type Procurement = z.infer<typeof ProcurementSchema>;

/* ---------------------------------------------------------------------------
   Attachments & stock
   --------------------------------------------------------------------------- */

export interface Attachment {
  id: string;
  entityType: "asset" | "procurement";
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export const StockItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  quantity: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative(),
});
export type StockItem = z.infer<typeof StockItemSchema>;

/** Stock only ever moves through transactions, never by overwriting a number. */
export const StockMovementDraftSchema = z.object({
  stockItemId: z.string().min(1),
  /** Positive = stock in, negative = stock out. Zero is rejected. */
  delta: z
    .number()
    .int()
    .refine((value) => value !== 0, "Jumlah tidak boleh 0"),
  reason: z.string().max(255).nullable(),
  transactionId: z.string().min(1).max(100),
});
export type StockMovementDraft = z.infer<typeof StockMovementDraftSchema>;

/* ---------------------------------------------------------------------------
   Offline sync (outbox pattern)
   --------------------------------------------------------------------------- */

export const MutationOperation = z.enum(["create", "update", "delete"]);
export type MutationOperation = z.infer<typeof MutationOperation>;

export const MutationStatus = z.enum(["pending", "sending", "acked", "conflict", "failed"]);
export type MutationStatus = z.infer<typeof MutationStatus>;

export interface SyncMutation {
  id: string;
  mutationId: string;
  entityType: "asset" | "location" | "procurement" | "stock_item";
  entityId: string;
  entityLabel: string;
  operation: MutationOperation;
  baseVersion: number | null;
  status: MutationStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  /** Entity snapshot carried to the server when this mutation is pushed. */
  payload?: unknown;
}

/* ---------------------------------------------------------------------------
   Display labels
   --------------------------------------------------------------------------- */

export const CONDITION_LABEL: Record<AssetCondition, string> = {
  good: "Baik",
  fair: "Cukup",
  damaged: "Rusak",
};

export const STATUS_LABEL: Record<AssetStatus, string> = {
  available: "Tersedia",
  assigned: "Ditugaskan",
  maintenance: "Perbaikan",
  disposed: "Dihapus",
};

export const CONDITION_TONE: Record<AssetCondition, "success" | "warn" | "danger"> = {
  good: "success",
  fair: "warn",
  damaged: "danger",
};

export const STATUS_TONE: Record<AssetStatus, "info" | "accent" | "warn" | "muted"> = {
  available: "info",
  assigned: "accent",
  maintenance: "warn",
  disposed: "muted",
};

export const PROCUREMENT_STATUS_LABEL: Record<ProcurementStatus, string> = {
  draft: "Draf",
  submitted: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  received: "Diterima",
};
