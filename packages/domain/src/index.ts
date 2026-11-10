import { z } from "zod";

export const APP_MENU_DEFINITIONS = [
  { key: "dashboard", label: "Dashboard", required: true },
  { key: "assets", label: "Aset", required: false },
  { key: "rooms", label: "Ruangan", required: false },
  { key: "procurement", label: "Pengadaan", required: false },
  { key: "labels", label: "Label & Barcode", required: false },
  { key: "stock", label: "Stok", required: false },
  { key: "loans", label: "Peminjaman", required: false },
  { key: "sync", label: "Sinkronisasi", required: false },
  { key: "reports", label: "Laporan", required: false },
  { key: "settings", label: "Pengaturan", required: false },
  { key: "users", label: "Manajemen User", required: true },
] as const;
export type AppMenuKey = (typeof APP_MENU_DEFINITIONS)[number]["key"];
export const DEFAULT_ROLE_MENU_KEYS: Record<"admin" | "operator" | "viewer", AppMenuKey[]> = {
  admin: APP_MENU_DEFINITIONS.map((menu) => menu.key),
  operator: APP_MENU_DEFINITIONS.filter((menu) => menu.key !== "users").map((menu) => menu.key),
  viewer: APP_MENU_DEFINITIONS.filter((menu) => menu.key !== "users").map((menu) => menu.key),
};

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
  locationId: z.string().min(1).nullable().default(null),
  stockQuantity: z.number().int().nonnegative().default(0),
  roomStocks: z.array(z.object({ locationId: z.string().min(1), quantity: z.number().int().positive() })).default([]),
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

/** Partial update for PATCH /v1/assets/:id. */
export const AssetPatchSchema = AssetDraftSchema.omit({ stockQuantity: true, roomStocks: true }).partial();
export type AssetPatch = z.infer<typeof AssetPatchSchema>;

export const AssetStockAdjustmentSchema = z.object({ delta: z.number().int().refine((value) => value !== 0) });
export type AssetStockAdjustment = z.infer<typeof AssetStockAdjustmentSchema>;

export const AssetRoomStockSchema = z.object({ quantity: z.number().int().nonnegative() });
export type AssetRoomStock = z.infer<typeof AssetRoomStockSchema>;

export const AssetLoanSchema = z.object({
  id: z.string().min(1), assetId: z.string().min(1), borrowerName: z.string().trim().min(1).max(255),
  quantity: z.number().int().positive(), startDate: z.string().date(), dueDate: z.string().date(),
  returnedAt: z.string().nullable(), createdAt: z.string(),
});
export type AssetLoan = z.infer<typeof AssetLoanSchema>;
export const AssetLoanDraftSchema = AssetLoanSchema.omit({ id: true, returnedAt: true, createdAt: true }).refine((v) => v.dueDate >= v.startDate, { message: "Tanggal jatuh tempo harus setelah tanggal pinjam", path: ["dueDate"] });
export type AssetLoanDraft = z.infer<typeof AssetLoanDraftSchema>;

/* ---------------------------------------------------------------------------
   Categories & locations
   --------------------------------------------------------------------------- */

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  code: z.string().min(1),
  active: z.boolean().default(true),
});
export type Category = z.infer<typeof CategorySchema>;

export const CategoryPatchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "empty_patch" });
export type CategoryPatch = z.infer<typeof CategoryPatchSchema>;

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
  active: z.boolean().default(true),
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
  active: z.boolean().optional(),
});
export type LocationDraft = z.infer<typeof LocationDraftSchema>;

/** Partial update for PATCH /v1/locations/:id. */
export const LocationPatchSchema = LocationDraftSchema.partial();
export type LocationPatch = z.infer<typeof LocationPatchSchema>;

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

/** Payload for "Buat Pengajuan". Server assigns id, reference, status, timestamps. */
export const ProcurementDraftSchema = z.object({
  itemName: z.string().trim().min(1, "Nama barang wajib diisi").max(255),
  quantity: z.number().int().positive(),
  vendor: z.string().trim().max(255).nullable(),
  proposedPriceIdr: z.number().int().nonnegative(),
  requestedAt: z.string().min(1),
  notes: z.string().max(1000).nullable(),
});
export type ProcurementDraft = z.infer<typeof ProcurementDraftSchema>;

export const ProcurementPatchSchema = z.object({
  itemName: z.string().trim().min(1).max(255).optional(),
  quantity: z.number().int().positive().optional(),
  vendor: z.string().trim().max(255).nullable().optional(),
  proposedPriceIdr: z.number().int().nonnegative().optional(),
  approvedPriceIdr: z.number().int().nonnegative().nullable().optional(),
  status: ProcurementStatus.optional(),
  notes: z.string().max(1000).nullable().optional(),
});
export type ProcurementPatch = z.infer<typeof ProcurementPatchSchema>;

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
