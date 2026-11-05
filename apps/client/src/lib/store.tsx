import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "@/components/base/toast/toast";
import { AssetSchema, LocationSchema, type Asset, type AssetDraft, type Category, type Location, type LocationDraft, type StockItem, type StockMovementDraft, type SyncMutation } from "@sisarpras/domain";
import {
  activity as seedActivity,
  assets as seedAssets,
  categories as seedCategories,
  locations as seedLocations,
  type ActivityEntry,
} from "@/data/mock";
import { apiRequest } from "@/lib/api";
import { ApiError, inventoryRepository } from "@/lib/repositories/asset-repository";
import { readStoredValue, writeStoredValue } from "@/lib/desktop-storage";
import { useAuth } from "@/lib/auth";

export type DataSource = "api" | "local";

interface CreateResult {
  ok: boolean;
  /** true when the written row is only on this device and awaits sync. */
  queued: boolean;
  error?: string;
}

interface AppState {
  assets: Asset[];
  categories: Category[];
  locations: Location[];
  stockItems: StockItem[];
  outbox: SyncMutation[];
  activity: ActivityEntry[];
  online: boolean;
  loading: boolean;
  source: DataSource;
  error: string | null;
  reload: () => Promise<void>;
  createAsset: (draft: AssetDraft) => Promise<CreateResult>;
  createLocation: (draft: LocationDraft) => Promise<CreateResult>;
  addStockMovement: (draft: StockMovementDraft) => Promise<CreateResult>;
  syncNow: () => Promise<{ ok: boolean; message: string }>;
  setOnline: (online: boolean) => void;
  showToast: (message: string, description?: string) => void;
}

const AppContext = createContext<AppState | null>(null);

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  // Empty until a write happens offline; with the API reachable there is
  // nothing waiting, so the status bar honestly reads "semua tersinkron".
  const [outbox, setOutbox] = useState<SyncMutation[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>(seedActivity);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<DataSource>("local");
  const [error, setError] = useState<string | null>(null);

  const showToast = useCallback((message: string, description?: string) => {
    toast.success(message, { description });
  }, []);

  /** Fall back to the bundled sample data so the app still renders offline. */
  const loadFallback = useCallback((reason: string) => {
    setAssets((current) => {
      const next = current.length ? current : seedAssets;
      void writeStoredValue("sisarpras.assets.v1", next);
      return next;
    });
    setCategories((current) => {
      const next = current.length ? current : seedCategories;
      void writeStoredValue("sisarpras.categories.v1", next);
      return next;
    });
    setLocations((current) => {
      const next = current.length ? current : seedLocations;
      void writeStoredValue("sisarpras.locations.v1", next);
      return next;
    });
    setSource("local");
    setOnline(false);
    setError(reason);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [localAssets, localCategories, localLocations, localStock, localOutbox] = await Promise.all([
        readStoredValue<Asset[]>("sisarpras.assets.v1"),
        readStoredValue<Category[]>("sisarpras.categories.v1"),
        readStoredValue<Location[]>("sisarpras.locations.v1"),
        readStoredValue<StockItem[]>("sisarpras.stock.v1"),
        readStoredValue<SyncMutation[]>("sisarpras.outbox.v1"),
      ]);
      if (localAssets) setAssets(localAssets);
      if (localCategories) setCategories(localCategories);
      if (localLocations) setLocations(localLocations);
      if (localStock) setStockItems(localStock);
      if (localOutbox) setOutbox(localOutbox);
      const [nextAssets, nextCategories, nextLocations, nextStock] = await Promise.all([
        inventoryRepository.listAssets(),
        inventoryRepository.listCategories(),
        inventoryRepository.listLocations(),
        inventoryRepository.listStockItems(),
      ]);
      setAssets(nextAssets);
      setCategories(nextCategories);
      setLocations(nextLocations);
      setStockItems(nextStock);
      void writeStoredValue("sisarpras.assets.v1", nextAssets);
      void writeStoredValue("sisarpras.categories.v1", nextCategories);
      void writeStoredValue("sisarpras.locations.v1", nextLocations);
      void writeStoredValue("sisarpras.stock.v1", nextStock);
      setSource("api");
      setOnline(true);
      setError(null);
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? cause.isOffline
            ? "Server API tidak terjangkau — memakai data lokal"
            : cause.message
          : "Gagal memuat data";
      loadFallback(message);
    } finally {
      setLoading(false);
    }
  }, [loadFallback]);

  useEffect(() => {
    if (user) void reload();
  }, [reload, user?.id]);

  const createAsset = useCallback(
    async (draft: AssetDraft): Promise<CreateResult> => {
      try {
        const created = await inventoryRepository.createAsset(draft);
        setAssets((current) => [created, ...current]);
        setActivity((current) => [
          {
            id: newId(),
            kind: "create",
            title: `${created.name} ditambahkan`,
            detail: `${created.assetCode} · tersimpan di server`,
            at: new Date().toISOString(),
          },
          ...current,
        ]);
        setOnline(true);
        setSource("api");
        setError(null);
        return { ok: true, queued: false };
      } catch (cause) {
        // A rejected payload must never be queued — surface it instead.
        if (cause instanceof ApiError && !cause.isOffline) {
          return { ok: false, queued: false, error: cause.message };
        }

        // Offline: keep the write on this device and queue it, mirroring the
        // desktop's SQLite outbox behaviour.
        const now = new Date().toISOString();
        const local: Asset = {
          ...draft,
          id: newId(),
          version: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        const mutation: SyncMutation = {
          id: newId(),
          mutationId: newId(),
          entityType: "asset",
          entityId: local.id,
          entityLabel: `${draft.name} (baru)`,
          operation: "create",
          baseVersion: null,
          status: "pending",
          attempts: 0,
          lastError: null,
          createdAt: now,
          payload: local,
        };

        setAssets((current) => {
          const next = [local, ...current];
          void writeStoredValue("sisarpras.assets.v1", next);
          return next;
        });
        setOutbox((current) => {
          const next = [mutation, ...current];
          void writeStoredValue("sisarpras.outbox.v1", next);
          return next;
        });
        setActivity((current) => [
          {
            id: newId(),
            kind: "create",
            title: `${draft.name} ditambahkan`,
            detail: `${draft.assetCode} · menunggu sinkronisasi`,
            at: now,
          },
          ...current,
        ]);
        setOnline(false);
        loadFallback("Server API tidak terjangkau — perubahan disimpan lokal");
        return { ok: true, queued: true };
      }
    },
    [loadFallback],
  );

  const createLocation = useCallback(async (draft: LocationDraft): Promise<CreateResult> => {
    try {
      const created = await inventoryRepository.createLocation(draft);
      setLocations((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSource("api");
      setOnline(true);
      setError(null);
      return { ok: true, queued: false };
    } catch (cause) {
      // Server rejected the payload: report it, never fake a success.
      if (cause instanceof ApiError && !cause.isOffline) {
        return { ok: false, queued: false, error: cause.message };
      }
      // Offline: keep it on this device so the room can still be used locally.
      const local: Location = { ...draft, id: newId() };
      setLocations((current) => {
        const next = [...current, local].sort((a, b) => a.name.localeCompare(b.name));
        void writeStoredValue("sisarpras.locations.v1", next);
        return next;
      });
      const now = new Date().toISOString();
      setOutbox((current) => {
        const next = [{
        id: newId(), mutationId: newId(), entityType: "location", entityId: local.id,
        entityLabel: `${local.name} (baru)`, operation: "create", baseVersion: null,
        status: "pending", attempts: 0, lastError: null, createdAt: now, payload: local,
        } as SyncMutation, ...current];
        void writeStoredValue("sisarpras.outbox.v1", next);
        return next;
      });
      setOnline(false);
      return { ok: true, queued: true };
    }
  }, []);

  const addStockMovement = useCallback(async (draft: StockMovementDraft): Promise<CreateResult> => {
    try {
      const updated = await inventoryRepository.createStockMovement(draft);
      setStockItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSource("api");
      setOnline(true);
      setError(null);
      return { ok: true, queued: false };
    } catch (cause) {
      if (cause instanceof ApiError && !cause.isOffline) {
        return { ok: false, queued: false, error: cause.message };
      }
      // Offline: apply the delta locally and queue the mutation. A negative
      // result is still refused — stock can never go below zero.
      const item = stockItems.find((entry) => entry.id === draft.stockItemId);
      if (!item) return { ok: false, queued: false, error: "Jenis stok tidak ditemukan" };
      if (item.quantity + draft.delta < 0) {
        return { ok: false, queued: false, error: `Stok tidak boleh negatif (tersedia ${item.quantity})` };
      }

      const nextItems = stockItems.map((entry) =>
        entry.id === draft.stockItemId ? { ...entry, quantity: entry.quantity + draft.delta } : entry,
      );
      setStockItems(nextItems);
      void writeStoredValue("sisarpras.stock.v1", nextItems);

      const mutation: SyncMutation = {
        id: newId(),
        mutationId: draft.transactionId,
        entityType: "stock_item",
        entityId: draft.stockItemId,
        entityLabel: `${item.name} ${draft.delta > 0 ? "+" : ""}${draft.delta} ${item.unit}`,
        operation: "update",
        baseVersion: null,
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: new Date().toISOString(),
        payload: draft,
      };
      setOutbox((current) => {
        const next = [mutation, ...current];
        void writeStoredValue("sisarpras.outbox.v1", next);
        return next;
      });
      setOnline(false);
      return { ok: true, queued: true };
    }
  }, [stockItems]);

  const syncNow = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    try {
      let deviceId = await readStoredValue<string>("sisarpras.device-id.v1");
      if (!deviceId) {
        deviceId = newId();
        await writeStoredValue("sisarpras.device-id.v1", deviceId);
      }
      const pending = outbox.filter((item) => item.status === "pending" || item.status === "failed");
      let ackedCount = 0;
      if (pending.length) {
        const pushed = await apiRequest<{ results: Array<{ mutationId: string; status: "acked" | "conflict" | "failed"; error?: string }>; cursor: number }>("/v1/sync/push", {
          method: "POST",
          body: JSON.stringify({ deviceId, deviceName: "Sisarpras Desktop", platform: "desktop", mutations: pending }),
        });
        const byId = new Map(pushed.results.map((item) => [item.mutationId, item]));
        const nextOutbox = outbox.map((item) => {
            const result = byId.get(item.mutationId);
            if (!result) return item;
            if (result.status === "acked") ackedCount += 1;
            return { ...item, status: result.status, attempts: item.attempts + 1, lastError: result.error ?? null };
        });
        setOutbox(nextOutbox);
        void writeStoredValue("sisarpras.outbox.v1", nextOutbox);
      }
      let cursor = await readStoredValue<number>("sisarpras.sync-cursor.v1") ?? 0;
      let hasMore = true;
      let nextAssets = assets;
      let nextLocations = locations;
      while (hasMore) {
        const pulled = await apiRequest<{ data: Array<{ seq: number; entityType: string; entityId: string; operation: string; payload: unknown }>; cursor: number; hasMore: boolean }>(`/v1/sync/pull?since=${cursor}&limit=200`);
        for (const change of pulled.data) {
          if (change.entityType === "asset") {
            const parsed = AssetSchema.safeParse(change.payload);
            if (change.operation === "delete" || (parsed.success && parsed.data.deletedAt)) {
              nextAssets = nextAssets.filter((item) => item.id !== change.entityId);
            } else if (parsed.success) {
              nextAssets = [parsed.data, ...nextAssets.filter((item) => item.id !== parsed.data.id)];
            }
          } else if (change.entityType === "location") {
            const parsed = LocationSchema.safeParse(change.payload);
            if (change.operation === "delete") nextLocations = nextLocations.filter((item) => item.id !== change.entityId);
            else if (parsed.success) nextLocations = [...nextLocations.filter((item) => item.id !== parsed.data.id), parsed.data].sort((a, b) => a.name.localeCompare(b.name));
          }
        }
        cursor = pulled.cursor;
        hasMore = pulled.hasMore;
      }
      setAssets(nextAssets);
      setLocations(nextLocations);
      await Promise.all([
        writeStoredValue("sisarpras.sync-cursor.v1", cursor),
        writeStoredValue("sisarpras.assets.v1", nextAssets),
        writeStoredValue("sisarpras.locations.v1", nextLocations),
      ]);
      setOnline(true);
      setSource("api");
      setError(null);
      return { ok: true, message: `${ackedCount} perubahan terkirim; data server diperbarui.` };
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Sinkronisasi gagal.";
      setOnline(false);
      setError(message);
      return { ok: false, message };
    }
  }, [assets, locations, outbox]);

  const value = useMemo<AppState>(
    () => ({
      assets,
      categories,
      locations,
      stockItems,
      outbox,
      activity,
      online,
      loading,
      source,
      error,
      reload,
      createAsset,
      createLocation,
      addStockMovement,
      syncNow,
      setOnline,
      showToast,
    }),
    [
      assets,
      categories,
      locations,
      stockItems,
      outbox,
      activity,
      online,
      loading,
      source,
      error,
      reload,
      createAsset,
      createLocation,
      addStockMovement,
      syncNow,
      showToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp harus dipakai di dalam <AppProvider>");
  return context;
}
