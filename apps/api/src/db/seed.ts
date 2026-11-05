import { sql } from "drizzle-orm";
import { db, sql as client } from "@/db/client";
import { assetCategories, assets, locations, stockItems } from "@/db/schema";
import { users } from "@/db/schema";
import { hashPin } from "@/lib/password";

/**
 * Idempotent reference data. Re-running is safe: it only seeds when the
 * categories table is still empty, so it never fights real data.
 */
async function seed() {
  const [admin] = await db.select({ id: users.id }).from(users).where(sql`${users.role} = 'admin' and ${users.isActive} = true and ${users.pinHash} is not null`).limit(1);
  if (!admin) {
    const pin = process.env.INITIAL_ADMIN_PIN ?? "898851";
    if (!/^\d{6}$/.test(pin)) throw new Error("INITIAL_ADMIN_PIN harus terdiri dari enam digit.");
    const pinHash = await hashPin(pin);
    await db.insert(users).values({
      email: "admin@pin.sisarpras.local",
      name: "Admin",
      role: "admin",
      passwordHash: "!pin-only",
      pinHash,
    }).onConflictDoUpdate({
      target: users.email,
      set: { name: "Admin", role: "admin", passwordHash: "!pin-only", pinHash, isActive: true, updatedAt: new Date() },
    });
    console.log("Akun admin awal dibuat dengan PIN dari INITIAL_ADMIN_PIN.");
  }
  const [existing] = await db.select({ count: sql<number>`count(*)` }).from(assetCategories);
  if (Number(existing?.count ?? 0) > 0) {
    console.log("Data referensi sudah ada - seed dilewati.");
    return;
  }

  const categories = await db
    .insert(assetCategories)
    .values([
      { code: "ELK", name: "Elektronik" },
      { code: "FRN", name: "Furnitur" },
      { code: "KND", name: "Kendaraan" },
      { code: "PRL", name: "Peralatan" },
      { code: "ATK", name: "Alat Tulis & Stok" },
    ])
    .returning();

  const byCode = new Map(categories.map((row) => [row.code, row.id]));

  const buildings = await db
    .insert(locations)
    .values([
      { name: "Gedung A", kind: "building" },
      { name: "Gedung B", kind: "building" },
    ])
    .returning();

  const buildingId = new Map(buildings.map((row) => [row.name, row.id]));

  const rooms = await db
    .insert(locations)
    .values([
      { name: "Ruang 201 - Rapat", kind: "room", parentId: buildingId.get("Gedung A"), building: "Gedung A", floor: "Lantai 2", capacity: 24 },
      { name: "Ruang 104 - Arsip", kind: "room", parentId: buildingId.get("Gedung A"), building: "Gedung A", floor: "Lantai 1", capacity: 6 },
      { name: "Ruang 305 - Laboratorium", kind: "room", parentId: buildingId.get("Gedung B"), building: "Gedung B", floor: "Lantai 3", capacity: 30 },
      { name: "Gudang Inventaris", kind: "storage", parentId: buildingId.get("Gedung B"), building: "Gedung B", floor: "Lantai 1" },
    ])
    .returning();

  const roomId = new Map(rooms.map((row) => [row.name, row.id]));

  await db.insert(assets).values([
    {
      assetCode: "AST-2026-0127",
      name: "Laptop Dell Latitude 5440",
      categoryId: byCode.get("ELK")!,
      locationId: roomId.get("Ruang 201 - Rapat")!,
      serialNumber: "SN-88213004",
      condition: "good",
      status: "available",
      acquisitionDate: "2026-02-12",
      acquisitionCostIdr: 12500000,
    },
    {
      assetCode: "AST-2026-0098",
      name: "Proyektor Epson EB-X06",
      categoryId: byCode.get("ELK")!,
      locationId: roomId.get("Ruang 305 - Laboratorium")!,
      serialNumber: "SN-EPS-77120",
      condition: "good",
      status: "assigned",
      acquisitionDate: "2025-11-03",
      acquisitionCostIdr: 6850000,
    },
    {
      assetCode: "AST-2026-0042",
      name: "AC Split Daikin 1.5PK",
      categoryId: byCode.get("ELK")!,
      locationId: roomId.get("Ruang 104 - Arsip")!,
      serialNumber: "SN-DKN-40921",
      condition: "damaged",
      status: "maintenance",
      acquisitionDate: "2024-07-19",
      acquisitionCostIdr: 4700000,
    },
    {
      assetCode: "AST-2026-0210",
      name: "Meja Rapat Kayu Jati",
      categoryId: byCode.get("FRN")!,
      locationId: roomId.get("Ruang 201 - Rapat")!,
      condition: "fair",
      status: "available",
      acquisitionDate: "2023-03-08",
      acquisitionCostIdr: 8900000,
    },
    {
      assetCode: "AST-2025-0771",
      name: "Toyota Hilux - B 1234 XYZ",
      categoryId: byCode.get("KND")!,
      locationId: roomId.get("Gudang Inventaris")!,
      serialNumber: "MH-8821009",
      condition: "good",
      status: "disposed",
      acquisitionDate: "2021-05-11",
      acquisitionCostIdr: 385000000,
    },
  ]);

  await db.insert(stockItems).values([
    { name: "Kertas HVS A4 70gsm", unit: "rim", quantity: 42, reorderLevel: 20 },
    { name: "Tinta Printer HP 680", unit: "botol", quantity: 7, reorderLevel: 12 },
    { name: "Pulpen Gel Hitam", unit: "box", quantity: 18, reorderLevel: 10 },
    { name: "Map Ordner", unit: "pcs", quantity: 9, reorderLevel: 15 },
  ]);

  console.log("Seed selesai: 5 kategori, 6 lokasi, 5 aset, 4 jenis stok.");
}

seed()
  .then(async () => {
    await client.end({ timeout: 5 });
  })
  .catch(async (error) => {
    console.error("Seed gagal:", error instanceof Error ? error.message : error);
    await client.end({ timeout: 5 });
    process.exit(1);
  });
