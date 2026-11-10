import { and, eq, isNotNull } from "drizzle-orm";
import { db, sql as client } from "@/db/client";
import { roles, users } from "@/db/schema";
import { hashPin } from "@/lib/password";

/** Creates only the local bootstrap account. Inventory data is entered by users. */
async function seed() {
  const [admin] = await db.select({ id: users.id }).from(users).where(and(
    eq(users.role, "admin"),
    eq(users.isActive, true),
    isNotNull(users.pinHash),
  )).limit(1);
  if (admin) {
    console.log("Akun admin awal sudah tersedia.");
    return;
  }

  const pin = process.env.INITIAL_ADMIN_PIN ?? "898851";
  if (!/^\d{6}$/.test(pin)) throw new Error("INITIAL_ADMIN_PIN harus terdiri dari enam digit.");
  const pinHash = await hashPin(pin);
  const [adminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "admin")).limit(1);
  if (!adminRole) throw new Error("Jalankan migrasi role terlebih dahulu sebelum membuat admin.");
  await db.insert(users).values({
    email: "admin@pin.sisarpras.local",
    name: "Admin",
    role: "admin",
    roleId: adminRole.id,
    passwordHash: "!pin-only",
    pinHash,
  }).onConflictDoUpdate({
    target: users.email,
    set: { name: "Admin", role: "admin", passwordHash: "!pin-only", pinHash, isActive: true, updatedAt: new Date() },
  });
  console.log("Akun admin awal dibuat dengan PIN dari INITIAL_ADMIN_PIN.");
}

seed()
  .then(async () => { await client.end({ timeout: 5 }); })
  .catch(async (error) => {
    console.error("Seed gagal:", error instanceof Error ? error.message : error);
    await client.end({ timeout: 5 });
    process.exit(1);
  });
