import { isTauri } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

let connection: Promise<Database> | null = null;

export async function desktopDatabase(): Promise<Database | null> {
  if (!isTauri()) return null;
  connection ??= Database.load("sqlite:sisarpras.db");
  return connection;
}

export async function readDesktopValue<T>(key: string): Promise<T | null> {
  const db = await desktopDatabase();
  if (!db) return null;
  const rows = await db.select<Array<{ value: string }>>("SELECT value FROM app_state WHERE key = $1", [key]);
  if (!rows.length) return null;
  try { return JSON.parse(rows[0]!.value) as T; } catch { return null; }
}

export async function writeDesktopValue(key: string, value: unknown): Promise<void> {
  const db = await desktopDatabase();
  if (!db) return;
  await db.execute(
    "INSERT INTO app_state (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, JSON.stringify(value)],
  );
}

export async function readStoredValue<T>(key: string): Promise<T | null> {
  const db = await desktopDatabase();
  if (db && key === "sisarpras.assets.v1") {
    const rows = await db.select<Array<{ payload_json: string }>>("SELECT payload_json FROM assets ORDER BY updated_at DESC");
    return rows.map((row) => JSON.parse(row.payload_json)) as T;
  }
  if (db && key === "sisarpras.categories.v1") {
    return await db.select<T>("SELECT id, name, code FROM categories ORDER BY name");
  }
  if (db && key === "sisarpras.locations.v1") {
    const rows = await db.select<Array<{ payload_json: string }>>("SELECT payload_json FROM locations WHERE deleted_at IS NULL ORDER BY name");
    return rows.map((row) => JSON.parse(row.payload_json)) as T;
  }
  if (db && key === "sisarpras.outbox.v1") {
    const rows = await db.select<Array<{ id: string; mutation_id: string; entity_type: string; entity_id: string; operation: string; base_version: number | null; payload_json: string; status: string; attempts: number; last_error: string | null; created_at: string }>>(
      "SELECT id, mutation_id, entity_type, entity_id, operation, base_version, payload_json, status, attempts, last_error, created_at FROM outbox ORDER BY created_at DESC",
    );
    return rows.map((row) => ({ id: row.id, mutationId: row.mutation_id, entityType: row.entity_type, entityId: row.entity_id, operation: row.operation, baseVersion: row.base_version, payload: JSON.parse(row.payload_json), status: row.status, attempts: row.attempts, lastError: row.last_error, createdAt: row.created_at })) as T;
  }
  const dbValue = await readDesktopValue<T>(key);
  if (dbValue !== null) return dbValue;
  if (isTauri()) return null;
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : null;
  } catch {
    return null;
  }
}

export async function writeStoredValue(key: string, value: unknown): Promise<void> {
  const db = await desktopDatabase();
  if (db) {
    if (key === "sisarpras.assets.v1" && Array.isArray(value)) {
      const rows = value as Array<Record<string, unknown>>;
      for (const row of rows) await db.execute(
        "INSERT INTO assets (id, asset_code, name, category_id, location_id, payload_json, version, created_at, updated_at, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET asset_code=excluded.asset_code,name=excluded.name,category_id=excluded.category_id,location_id=excluded.location_id,payload_json=excluded.payload_json,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at",
        [row.id, row.assetCode, row.name, row.categoryId, row.locationId ?? "", JSON.stringify(row), row.version ?? 1, row.createdAt, row.updatedAt, row.deletedAt ?? null],
      );
      const existing = await db.select<Array<{ id: string }>>("SELECT id FROM assets");
      const keep = new Set(rows.map((row) => String(row.id)));
      for (const row of existing) if (!keep.has(row.id)) await db.execute("DELETE FROM assets WHERE id = $1", [row.id]);
      return;
    }
    if (key === "sisarpras.categories.v1" && Array.isArray(value)) {
      const rows = value as Array<{ id: string; code: string; name: string }>;
      for (const row of rows) await db.execute("INSERT INTO categories (id, code, name) VALUES ($1,$2,$3) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name", [row.id, row.code, row.name]);
      return;
    }
    if (key === "sisarpras.locations.v1" && Array.isArray(value)) {
      const rows = value as Array<Record<string, unknown>>;
      for (const row of rows) await db.execute(
        "INSERT INTO locations (id, name, kind, parent_id, building, floor, capacity, payload_json, version, created_at, updated_at, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,parent_id=excluded.parent_id,building=excluded.building,floor=excluded.floor,capacity=excluded.capacity,payload_json=excluded.payload_json,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at",
        [row.id, row.name, row.kind, row.parentId ?? null, row.building ?? null, row.floor ?? null, row.capacity ?? null, JSON.stringify(row), row.version ?? 1, row.createdAt ?? new Date().toISOString(), row.updatedAt ?? new Date().toISOString(), row.deletedAt ?? null],
      );
      const existing = await db.select<Array<{ id: string }>>("SELECT id FROM locations");
      const keep = new Set(rows.map((row) => String(row.id)));
      for (const row of existing) if (!keep.has(row.id)) await db.execute("DELETE FROM locations WHERE id = $1", [row.id]);
      return;
    }
    if (key === "sisarpras.outbox.v1" && Array.isArray(value)) {
      const rows = value as Array<Record<string, unknown>>;
      for (const row of rows) await db.execute(
        "INSERT INTO outbox (id, mutation_id, entity_type, entity_id, operation, base_version, payload_json, status, attempts, last_error, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(mutation_id) DO UPDATE SET status=excluded.status,attempts=excluded.attempts,last_error=excluded.last_error,payload_json=excluded.payload_json",
        [row.id, row.mutationId, row.entityType, row.entityId, row.operation, row.baseVersion ?? null, JSON.stringify(row.payload ?? null), row.status, row.attempts, row.lastError ?? null, row.createdAt],
      );
      return;
    }
    await writeDesktopValue(key, value);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}
