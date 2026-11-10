import { Hono } from "hono";
import { z } from "zod";
import { currentUser, requireAuth, requireRole } from "@/middleware/auth";

export const attachmentsRoute = new Hono();
const ownerSchema = z.object({
  ownerType: z.enum(["asset", "location", "procurement"]),
  ownerId: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9:-]+$/),
});
const uploadSchema = ownerSchema.extend({ fileName: z.string().trim().min(1).max(255), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), sizeBytes: z.number().int().positive().max(5 * 1024 * 1024) });
const objectKeySchema = z.string().min(1).max(400).refine((value) => {
  const parts = value.split("/");
  return parts.length === 3 && ownerSchema.safeParse({ ownerType: parts[0], ownerId: parts[1] }).success && /^[a-zA-Z0-9._-]+$/.test(parts[2]!);
}, "invalid object key");

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "asset-photos";
  if (!url || !key) throw new Error("Supabase Storage belum dikonfigurasi di API.");
  return { url, key, bucket };
}

async function storage(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/storage/v1${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, ...(init.body instanceof Blob ? { "content-type": init.body.type } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(String(body?.message ?? body?.error ?? "Supabase Storage request gagal."));
  return body;
}

attachmentsRoute.use("*", requireAuth, async (c, next) => {
  const queryOwner = c.req.query("ownerType");
  const body = await c.req.raw.clone().json().catch(() => null) as Record<string, unknown> | null;
  const ownerType = queryOwner ?? body?.ownerType ?? (typeof body?.objectKey === "string" ? body.objectKey.split("/")[0] : null);
  const menu = ownerType === "location" ? "rooms" : ownerType === "procurement" ? "procurement" : ownerType === "asset" ? "assets" : null;
  if (!menu || !currentUser(c).menuKeys.includes(menu)) return c.json({ error: "menu_access_denied" }, 403);
  await next();
});
attachmentsRoute.get("/", async (c) => {
  const parsed = ownerSchema.safeParse({ ownerType: c.req.query("ownerType"), ownerId: c.req.query("ownerId") });
  if (!parsed.success) return c.json({ error: "invalid_owner" }, 400);
  const { bucket } = config();
  const rows = await storage(`/object/list/${bucket}`, { method: "POST", body: JSON.stringify({ prefix: `${parsed.data.ownerType}/${parsed.data.ownerId}/`, limit: 100, sortBy: { column: "created_at", order: "asc" } }), headers: { "content-type": "application/json" } });
  const items = Array.isArray(rows) ? rows : [];
  return c.json({ data: items.filter((item) => typeof item.name === "string" && item.name !== ".emptyFolderPlaceholder").map((item) => {
    const id = String(item.name);
    const objectKey = `${parsed.data.ownerType}/${parsed.data.ownerId}/${id}`;
    return { id: objectKey, ownerType: parsed.data.ownerType, ownerId: parsed.data.ownerId, objectKey, fileName: id.split("__").slice(1).join("__"), mimeType: String(item.metadata && typeof item.metadata === "object" ? (item.metadata as Record<string, unknown>).mimetype ?? "image/jpeg" : "image/jpeg"), sizeBytes: Number(item.metadata && typeof item.metadata === "object" ? (item.metadata as Record<string, unknown>).size ?? 0 : 0), createdAt: String(item.created_at ?? new Date().toISOString()) };
  }) });
});

attachmentsRoute.post("/upload-url", requireRole("admin", "operator"), async (c) => {
  const parsed = uploadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "validation_failed" }, 400);
  const { ownerType, ownerId, fileName, mimeType } = parsed.data;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectName = `${crypto.randomUUID()}__${safeName}`;
  const objectKey = `${ownerType}/${ownerId}/${objectName}`;
  const { bucket } = config();
  const signed = await storage(`/object/upload/sign/${bucket}/${objectKey.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", body: JSON.stringify({}) , headers: { "content-type": "application/json", "x-upsert": "false" } });
  return c.json({ data: { objectKey, token: signed?.token, signedUrl: `${config().url}/storage/v1${String(signed?.url ?? "")}`, mimeType } });
});

attachmentsRoute.post("/download-url", async (c) => {
  const parsed = z.object({ objectKey: objectKeySchema }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_object_key" }, 400);
  const { bucket } = config();
  // Supabase signs the decoded object path. Keep colons in owner IDs literal;
  // encoding `::` as `%3A%3A` produces a signed URL that Storage rejects.
  const encodedKey = parsed.data.objectKey.split("/").map((part) => encodeURIComponent(part).replace(/%3A/gi, ":")).join("/");
  const signed = await storage(`/object/sign/${bucket}/${encodedKey}`, { method: "POST", body: JSON.stringify({ expiresIn: 300 }), headers: { "content-type": "application/json" } });
  const path = String(signed?.signedURL ?? signed?.signedUrl ?? "");
  const queryIndex = path.indexOf("?");
  const pathname = queryIndex < 0 ? path : path.slice(0, queryIndex);
  const query = queryIndex < 0 ? "" : path.slice(queryIndex);
  // Storage may percent-encode colons in its response even though the token
  // was signed against the literal object path. Restore them in the URL path.
  const normalizedPath = pathname.replace(/%3A/gi, ":") + query;
  return c.json({ url: normalizedPath.startsWith("http") ? normalizedPath : `${config().url}/storage/v1${normalizedPath}` });
});

attachmentsRoute.delete("/", requireRole("admin", "operator"), async (c) => {
  const parsed = z.object({ objectKey: objectKeySchema }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_object_key" }, 400);
  const { bucket } = config();
  await storage(`/object/${bucket}`, { method: "DELETE", body: JSON.stringify({ prefixes: [parsed.data.objectKey] }), headers: { "content-type": "application/json" } });
  return c.json({ ok: true });
});
