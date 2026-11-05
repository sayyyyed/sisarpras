import type {
  Asset,
  Attachment,
  Category,
  Location,
  Procurement,
  StockItem,
  SyncMutation,
} from "@sisarpras/domain";

export interface ActivityEntry {
  id: string;
  kind: "create" | "move" | "condition" | "procurement";
  title: string;
  detail: string;
  at: string;
}

export const categories: Category[] = [
  { id: "cat-elk", code: "ELK", name: "Elektronik" },
  { id: "cat-frn", code: "FRN", name: "Furnitur" },
  { id: "cat-knd", code: "KND", name: "Kendaraan" },
  { id: "cat-prl", code: "PRL", name: "Peralatan" },
  { id: "cat-atk", code: "ATK", name: "Alat Tulis & Stok" },
];

export const locations: Location[] = [
  { id: "loc-ga", name: "Gedung A", kind: "building", parentId: null, building: "Gedung A", floor: null, capacity: null },
  { id: "loc-gb", name: "Gedung B", kind: "building", parentId: null, building: "Gedung B", floor: null, capacity: null },
  { id: "loc-ga-201", name: "Ruang 201 — Rapat", kind: "room", parentId: "loc-ga", building: "Gedung A", floor: "Lantai 2", capacity: 24 },
  { id: "loc-gb-305", name: "Ruang 305 — Laboratorium", kind: "room", parentId: "loc-gb", building: "Gedung B", floor: "Lantai 3", capacity: 30 },
  { id: "loc-ga-104", name: "Ruang 104 — Arsip", kind: "room", parentId: "loc-ga", building: "Gedung A", floor: "Lantai 1", capacity: 6 },
  { id: "loc-gb-store", name: "Gudang Inventaris", kind: "storage", parentId: "loc-gb", building: "Gedung B", floor: "Lantai 1", capacity: null },
];

type AssetSeed = Omit<Asset, "version" | "createdAt" | "updatedAt" | "deletedAt"> & {
  deletedAt?: string | null;
};

function asset(seed: AssetSeed, version = 1): Asset {
  return {
    ...seed,
    version,
    createdAt: "2026-01-05T08:00:00.000Z",
    updatedAt: "2026-10-28T09:30:00.000Z",
    deletedAt: seed.deletedAt ?? null,
  };
}

export const assets: Asset[] = [
  asset({
    id: "ast-0127", assetCode: "AST-2026-0127", name: "Laptop Dell Latitude 5440", categoryId: "cat-elk",
    locationId: "loc-ga-201", serialNumber: "SN-88213004", description: "Unit baru, kelengkapan lengkap.",
    condition: "good", status: "available", acquisitionDate: "2026-02-12", acquisitionCostIdr: 12500000,
  }),
  asset({
    id: "ast-0098", assetCode: "AST-2026-0098", name: "Proyektor Epson EB-X06", categoryId: "cat-elk",
    locationId: "loc-gb-305", serialNumber: "SN-EPS-77120", description: null,
    condition: "good", status: "assigned", acquisitionDate: "2025-11-03", acquisitionCostIdr: 6850000,
  }, 3),
  asset({
    id: "ast-0042", assetCode: "AST-2026-0042", name: "AC Split Daikin 1.5PK", categoryId: "cat-elk",
    locationId: "loc-ga-104", serialNumber: "SN-DKN-40921", description: "Freon perlu dicek ulang.",
    condition: "damaged", status: "maintenance", acquisitionDate: "2024-07-19", acquisitionCostIdr: 4700000,
  }, 5),
  asset({
    id: "ast-0210", assetCode: "AST-2026-0210", name: "Meja Rapat Kayu Jati", categoryId: "cat-frn",
    locationId: "loc-ga-201", serialNumber: null, description: null,
    condition: "fair", status: "available", acquisitionDate: "2023-03-08", acquisitionCostIdr: 8900000,
  }),
  asset({
    id: "ast-0188", assetCode: "AST-2025-0188", name: "Kursi Kerja Mesh (10 unit)", categoryId: "cat-frn",
    locationId: "loc-ga-201", serialNumber: null, description: "Batch pengadaan PR-2026-021.",
    condition: "good", status: "available", acquisitionDate: "2026-01-20", acquisitionCostIdr: 4500000,
  }),
  asset({
    id: "ast-0771", assetCode: "AST-2025-0771", name: "Toyota Hilux — B 1234 XYZ", categoryId: "cat-knd",
    locationId: "loc-gb-store", serialNumber: "MH-8821009", description: "Kendaraan operasional.",
    condition: "good", status: "disposed", acquisitionDate: "2021-05-11", acquisitionCostIdr: 385000000,
    deletedAt: "2026-09-30T07:00:00.000Z",
  }),
  asset({
    id: "ast-0301", assetCode: "AST-2026-0301", name: "Printer HP LaserJet Pro", categoryId: "cat-elk",
    locationId: "loc-ga-104", serialNumber: "SN-HP-55123", description: null,
    condition: "fair", status: "available", acquisitionDate: "2024-09-02", acquisitionCostIdr: 3200000,
  }),
  asset({
    id: "ast-0322", assetCode: "AST-2026-0322", name: "Mikroskop Binokuler", categoryId: "cat-prl",
    locationId: "loc-gb-305", serialNumber: "SN-MIK-1187", description: null,
    condition: "good", status: "available", acquisitionDate: "2025-08-14", acquisitionCostIdr: 15750000,
  }),
  asset({
    id: "ast-0333", assetCode: "AST-2026-0333", name: "Lemari Arsip Besi 4 Pintu", categoryId: "cat-frn",
    locationId: "loc-ga-104", serialNumber: null, description: null,
    condition: "good", status: "available", acquisitionDate: "2022-11-25", acquisitionCostIdr: 2750000,
  }),
  asset({
    id: "ast-0344", assetCode: "AST-2026-0344", name: "Genset 5000 Watt", categoryId: "cat-prl",
    locationId: "loc-gb-store", serialNumber: "SN-GEN-9912", description: "Cadangan listrik gedung B.",
    condition: "damaged", status: "maintenance", acquisitionDate: "2020-04-16", acquisitionCostIdr: 21500000,
  }, 4),
  asset({
    id: "ast-0355", assetCode: "AST-2026-0355", name: "Papan Tulis Whiteboard 120cm", categoryId: "cat-frn",
    locationId: "loc-gb-305", serialNumber: null, description: null,
    condition: "fair", status: "available", acquisitionDate: "2023-06-30", acquisitionCostIdr: 950000,
  }),
  asset({
    id: "ast-0366", assetCode: "AST-2026-0366", name: "Kamera Canon EOS 250D", categoryId: "cat-elk",
    locationId: "loc-ga-201", serialNumber: "SN-CAN-2201", description: null,
    condition: "good", status: "assigned", acquisitionDate: "2025-01-09", acquisitionCostIdr: 9800000,
  }, 2),
];

export const procurements: Procurement[] = [
  {
    id: "pr-021", reference: "PR-2026-021", itemName: "Kursi kerja mesh", quantity: 10, vendor: "CV Multi Furni",
    proposedPriceIdr: 4500000, approvedPriceIdr: 4400000, requestedAt: "2026-11-01",
    status: "approved", receiptFiles: ["kuitansi-pr-021.pdf"],
  },
  {
    id: "pr-022", reference: "PR-2026-022", itemName: "Laptop i5 16GB", quantity: 3, vendor: "Toko Komputindo",
    proposedPriceIdr: 27900000, approvedPriceIdr: null, requestedAt: "2026-11-01",
    status: "submitted", receiptFiles: [],
  },
  {
    id: "pr-019", reference: "PR-2026-019", itemName: "AC Split 1.5PK", quantity: 2, vendor: "Sejuk Abadi",
    proposedPriceIdr: 9400000, approvedPriceIdr: 9400000, requestedAt: "2026-10-28",
    status: "received", receiptFiles: ["kuitansi-pr-019.pdf", "bast-pr-019.pdf"],
  },
  {
    id: "pr-018", reference: "PR-2026-018", itemName: "Proyektor Epson EB-X06", quantity: 1, vendor: "Toko Komputindo",
    proposedPriceIdr: 6850000, approvedPriceIdr: null, requestedAt: "2026-10-26",
    status: "rejected", receiptFiles: [],
  },
  {
    id: "pr-023", reference: "PR-2026-023", itemName: "Genset 5000 Watt", quantity: 1, vendor: "Sumber Teknik",
    proposedPriceIdr: 21500000, approvedPriceIdr: null, requestedAt: "2026-11-02",
    status: "submitted", receiptFiles: [],
  },
];

export const stockItems: StockItem[] = [
  { id: "stk-kertas", name: "Kertas HVS A4 70gsm", unit: "rim", quantity: 42, reorderLevel: 20 },
  { id: "stk-tinta", name: "Tinta Printer HP 680", unit: "botol", quantity: 7, reorderLevel: 12 },
  { id: "stk-pulpen", name: "Pulpen Gel Hitam", unit: "box", quantity: 18, reorderLevel: 10 },
  { id: "stk-map", name: "Map Ordner", unit: "pcs", quantity: 9, reorderLevel: 15 },
];

export const attachments: Attachment[] = [
  { id: "att-1", entityType: "asset", entityId: "ast-0127", fileName: "foto-laptop-5440.jpg", mimeType: "image/jpeg", sizeBytes: 1843200, uploadedAt: "2026-02-12T08:10:00.000Z" },
  { id: "att-2", entityType: "asset", entityId: "ast-0127", fileName: "nota-pembelian.pdf", mimeType: "application/pdf", sizeBytes: 421888, uploadedAt: "2026-02-12T08:12:00.000Z" },
  { id: "att-3", entityType: "asset", entityId: "ast-0098", fileName: "bast-proyektor.pdf", mimeType: "application/pdf", sizeBytes: 310272, uploadedAt: "2025-11-03T09:00:00.000Z" },
  { id: "att-4", entityType: "asset", entityId: "ast-0042", fileName: "foto-kondisi-ac.jpg", mimeType: "image/jpeg", sizeBytes: 2211840, uploadedAt: "2026-10-30T04:20:00.000Z" },
  { id: "att-5", entityType: "asset", entityId: "ast-0042", fileName: "berita-acara-servis.pdf", mimeType: "application/pdf", sizeBytes: 268800, uploadedAt: "2026-10-30T04:22:00.000Z" },
  { id: "att-6", entityType: "asset", entityId: "ast-0042", fileName: "kwitansi-teknisi.jpg", mimeType: "image/jpeg", sizeBytes: 983040, uploadedAt: "2026-10-30T04:25:00.000Z" },
  { id: "att-7", entityType: "asset", entityId: "ast-0771", fileName: "stnk-hilux.pdf", mimeType: "application/pdf", sizeBytes: 512000, uploadedAt: "2021-05-11T03:00:00.000Z" },
];

export const outbox: SyncMutation[] = [
  {
    id: "ob-1", mutationId: "mut-f81c0e21", entityType: "asset", entityId: "ast-0399",
    entityLabel: "Laptop Dell Latitude 5440 (baru)", operation: "create", baseVersion: null,
    status: "pending", attempts: 0, lastError: null, createdAt: "2026-11-02T01:12:00.000Z",
  },
  {
    id: "ob-2", mutationId: "mut-4b7d9a02", entityType: "asset", entityId: "ast-0098",
    entityLabel: "Proyektor Epson — pindah ruangan", operation: "update", baseVersion: 3,
    status: "pending", attempts: 1, lastError: null, createdAt: "2026-11-02T01:31:00.000Z",
  },
  {
    id: "ob-3", mutationId: "mut-9c2ae410", entityType: "asset", entityId: "ast-0042",
    entityLabel: "AC Split — kondisi Baik → Rusak", operation: "update", baseVersion: 5,
    status: "conflict", attempts: 2, lastError: "Versi server lebih baru (6) — perlu ditinjau",
    createdAt: "2026-11-02T02:05:00.000Z",
  },
];

export const activity: ActivityEntry[] = [
  { id: "act-1", kind: "create", title: "Laptop Dell Latitude ditambahkan", detail: "AST-2026-0127 · Ruang 201 · Admin Sarpras", at: "2026-11-02T03:58:00.000Z" },
  { id: "act-2", kind: "move", title: "Proyektor Epson dipindah ke Ruang 305", detail: "AST-2026-0098 · dari Ruang 201 · Operator", at: "2026-11-02T03:42:00.000Z" },
  { id: "act-3", kind: "condition", title: "AC Split diubah: Baik → Rusak", detail: "AST-2026-0042 · Ruang 104 · Teknisi", at: "2026-11-02T03:00:00.000Z" },
  { id: "act-4", kind: "procurement", title: "Pengadaan PR-2026-021 disetujui", detail: "10 unit kursi · Rp 4.400.000 · Kuitansi terunggah", at: "2026-11-02T01:00:00.000Z" },
];
