/** IndexedDB is the offline cache/outbox; uploaded files live in private Supabase Storage. */
import { apiRequest } from "@/lib/api";
import { invoke, isTauri } from "@tauri-apps/api/core";

const DB_NAME = "sisarpras-files";
const DB_VERSION = 1;
const STORE = "attachments";

export type AttachmentOwner = "asset" | "procurement" | "location";

export interface LocalAttachment {
  id: string;
  ownerType: AttachmentOwner;
  ownerId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  objectKey?: string;
  localOnly?: boolean;
}

interface StoredAttachment extends LocalAttachment {
  blob: Blob;
}

interface CompressedImage {
  bytes: number[];
  mimeType: string;
  width: number;
  height: number;
}

async function prepareImage(file: File): Promise<File> {
  if (!isTauri() || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  const result = await invoke<CompressedImage>("compress_image", { bytes });
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([new Uint8Array(result.bytes)], `${baseName}.jpg`, {
    type: result.mimeType,
    lastModified: file.lastModified,
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("owner", ["ownerType", "ownerId"]);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persist(record: StoredAttachment): Promise<void> {
  const db = await openDb();
  try { await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).put(record)); }
  finally { db.close(); }
}

async function uploadRecord(record: StoredAttachment): Promise<StoredAttachment> {
  const result = await apiRequest<{ data: { signedUrl: string; objectKey: string } }>("/v1/attachments/upload-url", {
    method: "POST",
    body: JSON.stringify({ ownerType: record.ownerType, ownerId: record.ownerId, fileName: record.fileName, mimeType: record.mimeType, sizeBytes: record.sizeBytes }),
  });
  const response = await fetch(result.data.signedUrl, { method: "PUT", headers: { "content-type": record.mimeType, "x-upsert": "false" }, body: record.blob });
  if (!response.ok) throw new Error("Supabase Storage menolak unggahan.");
  return { ...record, objectKey: result.data.objectKey, localOnly: false };
}

export async function retryPendingAttachments(ownerType: AttachmentOwner, ownerId: string): Promise<void> {
  const db = await openDb();
  let rows: StoredAttachment[];
  try { rows = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).index("owner").getAll([ownerType, ownerId]) as IDBRequest<StoredAttachment[]>); }
  finally { db.close(); }
  for (const row of rows.filter((item) => item.localOnly)) {
    try { await persist(await uploadRecord(row)); } catch { return; }
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Stores the file bytes locally and returns their metadata. */
export async function saveAttachment(
  ownerType: AttachmentOwner,
  ownerId: string,
  file: File,
): Promise<LocalAttachment> {
  const preparedFile = await prepareImage(file);
  const record: StoredAttachment = {
    id: newId(),
    ownerType,
    ownerId,
    fileName: preparedFile.name,
    mimeType: preparedFile.type || "application/octet-stream",
    sizeBytes: preparedFile.size,
    createdAt: new Date().toISOString(),
    blob: preparedFile,
  };

  await persist({ ...record, localOnly: true });
  try { await persist(await uploadRecord(record)); } catch { /* Keep the local copy queued for retry. */ }
  const db = await openDb();
  const saved = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).get(record.id) as IDBRequest<StoredAttachment>);
  db.close();
  const { blob: _blob, ...meta } = saved;
  return meta;
}

export async function listAttachments(ownerType: AttachmentOwner, ownerId: string): Promise<LocalAttachment[]> {
  await retryPendingAttachments(ownerType, ownerId);
  const db = await openDb();
  let local: LocalAttachment[];
  try {
    const index = db.transaction(STORE, "readonly").objectStore(STORE).index("owner");
    const rows = await requestToPromise(index.getAll([ownerType, ownerId]) as IDBRequest<StoredAttachment[]>);
    local = rows.map(({ blob: _blob, ...meta }) => meta);
  } finally {
    db.close();
  }
  let remote: LocalAttachment[] = [];
  try { remote = (await apiRequest<{ data: LocalAttachment[] }>(`/v1/attachments?ownerType=${encodeURIComponent(ownerType)}&ownerId=${encodeURIComponent(ownerId)}`)).data; } catch { /* Offline: show local cache/outbox. */ }
  const merged = [...remote];
  for (const item of local) if (item.localOnly || !item.objectKey) merged.push(item);
  return merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listAllAttachments(): Promise<LocalAttachment[]> {
  const db = await openDb();
  try {
    const rows = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll() as IDBRequest<StoredAttachment[]>);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ blob: _blob, ...meta }) => meta);
  } finally {
    db.close();
  }
}

/** Object URL for previewing a locally stored file. Revoke it when done. */
export async function attachmentUrl(id: string): Promise<string | null> {
  const db = await openDb();
  try {
    const row = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).get(id) as IDBRequest<StoredAttachment | undefined>);
    if (row?.blob) return URL.createObjectURL(row.blob);
  } finally {
    db.close();
  }
  try {
    const { url } = await apiRequest<{ url: string }>("/v1/attachments/download-url", { method: "POST", body: JSON.stringify({ objectKey: id }) });
    // Use the signed URL directly in <img src>. Fetching it here requires
    // Supabase CORS permission, while a normal image navigation does not.
    return url || null;
  } catch { return null; }
}

export async function deleteAttachment(id: string, objectKey?: string): Promise<void> {
  if (objectKey) await apiRequest("/v1/attachments", { method: "DELETE", body: JSON.stringify({ objectKey }) });
  else if (id.includes("/")) await apiRequest("/v1/attachments", { method: "DELETE", body: JSON.stringify({ objectKey: id }) });
  const db = await openDb();
  try {
    await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}

/** How many files an entity owns — used for the "berkas" column. */
export async function countAttachments(ownerId: string): Promise<number> {
  const db = await openDb();
  try {
    const rows = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll() as IDBRequest<StoredAttachment[]>);
    return rows.filter((row) => row.ownerId === ownerId).length;
  } finally {
    db.close();
  }
}
