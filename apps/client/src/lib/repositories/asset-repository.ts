import type {
  Asset,
  AssetDraft,
  AssetPatch,
  AssetStockAdjustment,
  AssetRoomStock,
  Category,
  CategoryPatch,
  Location,
  LocationDraft,
  LocationPatch,
  Procurement,
  ProcurementDraft,
  ProcurementPatch,
  StockItem,
  StockMovementDraft,
} from "@sisarpras/domain";
import { apiRequest, ApiError } from "@/lib/api";

/**
 * The contract the UI depends on. The desktop build can swap in a SQLite
 * implementation; the browser build uses the HTTP one. Neither the pages nor
 * the forms know which database is behind it.
 */
export interface InventoryRepository {
  listAssets(): Promise<Asset[]>;
  createAsset(draft: AssetDraft): Promise<Asset>;
  updateAsset(id: string, patch: AssetPatch): Promise<Asset>;
  adjustAssetStock(id: string, input: AssetStockAdjustment): Promise<Asset>;
  setAssetRoomStock(id: string, locationId: string, input: AssetRoomStock): Promise<Asset>;
  deleteAsset(id: string): Promise<void>;

  listCategories(): Promise<Category[]>;
  createCategory(input: { code: string; name: string }): Promise<Category>;
  updateCategory(id: string, patch: CategoryPatch): Promise<Category>;

  listLocations(): Promise<Location[]>;
  createLocation(draft: LocationDraft): Promise<Location>;
  createBuilding(input: { name: string; floorCount: number }): Promise<{ building: Location; floors: Location[] }>;
  updateBuilding(id: string, input: { name: string; floorCount: number }): Promise<{ building: Location; floors: Location[] }>;
  updateLocation(id: string, patch: LocationPatch): Promise<Location>;
  deleteLocation(id: string): Promise<void>;

  listStockItems(): Promise<StockItem[]>;
  /** Records an append-only movement and returns the item with its new quantity. */
  createStockMovement(draft: StockMovementDraft): Promise<StockItem>;

  listProcurements(): Promise<Procurement[]>;
  createProcurement(draft: ProcurementDraft): Promise<Procurement>;
  updateProcurement(id: string, patch: ProcurementPatch): Promise<Procurement>;
  deleteProcurement(id: string): Promise<void>;
}

interface Envelope<T> {
  data: T;
}

export class ApiInventoryRepository implements InventoryRepository {
  async listAssets(): Promise<Asset[]> {
    const { data } = await apiRequest<Envelope<Asset[]>>("/v1/assets?limit=200");
    return data;
  }

  async createAsset(draft: AssetDraft): Promise<Asset> {
    const { data } = await apiRequest<Envelope<Asset>>("/v1/assets", { method: "POST", body: JSON.stringify(draft) });
    return data;
  }

  async updateAsset(id: string, patch: AssetPatch): Promise<Asset> {
    const { data } = await apiRequest<Envelope<Asset>>(`/v1/assets/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return data;
  }

  async adjustAssetStock(id: string, input: AssetStockAdjustment): Promise<Asset> {
    const { data } = await apiRequest<Envelope<Asset>>(`/v1/assets/${id}/stock-adjustments`, { method: "POST", body: JSON.stringify(input) });
    return data;
  }

  async setAssetRoomStock(id: string, locationId: string, input: AssetRoomStock): Promise<Asset> {
    const { data } = await apiRequest<Envelope<Asset>>(`/v1/assets/${id}/rooms/${locationId}`, { method: "PUT", body: JSON.stringify(input) });
    return data;
  }

  async deleteAsset(id: string): Promise<void> {
    await apiRequest<Envelope<{ id: string }>>(`/v1/assets/${id}`, { method: "DELETE" });
  }

  async listCategories(): Promise<Category[]> {
    const { data } = await apiRequest<Envelope<Category[]>>("/v1/assets/categories");
    return data;
  }

  async createCategory(input: { code: string; name: string }): Promise<Category> {
    const { data } = await apiRequest<Envelope<Category>>("/v1/assets/categories", { method: "POST", body: JSON.stringify(input) });
    return data;
  }

  async updateCategory(id: string, patch: CategoryPatch): Promise<Category> {
    const { data } = await apiRequest<Envelope<Category>>(`/v1/assets/categories/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return data;
  }

  async listLocations(): Promise<Location[]> {
    const { data } = await apiRequest<Envelope<Location[]>>("/v1/locations");
    return data;
  }

  async createLocation(draft: LocationDraft): Promise<Location> {
    const { data } = await apiRequest<Envelope<Location>>("/v1/locations", { method: "POST", body: JSON.stringify(draft) });
    return data;
  }

  async createBuilding(input: { name: string; floorCount: number }): Promise<{ building: Location; floors: Location[] }> {
    const { data } = await apiRequest<Envelope<{ building: Location; floors: Location[] }>>("/v1/locations/building", { method: "POST", body: JSON.stringify(input) });
    return data;
  }

  async updateBuilding(id: string, input: { name: string; floorCount: number }): Promise<{ building: Location; floors: Location[] }> {
    const { data } = await apiRequest<Envelope<{ building: Location; floors: Location[] }>>(`/v1/locations/building/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    return data;
  }

  async updateLocation(id: string, patch: LocationPatch): Promise<Location> {
    const { data } = await apiRequest<Envelope<Location>>(`/v1/locations/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return data;
  }

  async deleteLocation(id: string): Promise<void> {
    await apiRequest<Envelope<{ id: string }>>(`/v1/locations/${id}`, { method: "DELETE" });
  }

  async listStockItems(): Promise<StockItem[]> {
    const { data } = await apiRequest<Envelope<StockItem[]>>("/v1/stock");
    return data;
  }

  async createStockMovement(draft: StockMovementDraft): Promise<StockItem> {
    const { data } = await apiRequest<Envelope<{ item: StockItem }>>("/v1/stock/movements", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    return data.item;
  }

  async listProcurements(): Promise<Procurement[]> {
    const { data } = await apiRequest<Envelope<Procurement[]>>("/v1/procurement");
    return data;
  }

  async createProcurement(draft: ProcurementDraft): Promise<Procurement> {
    const { data } = await apiRequest<Envelope<Procurement>>("/v1/procurement", { method: "POST", body: JSON.stringify(draft) });
    return data;
  }

  async updateProcurement(id: string, patch: ProcurementPatch): Promise<Procurement> {
    const { data } = await apiRequest<Envelope<Procurement>>(`/v1/procurement/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return data;
  }

  async deleteProcurement(id: string): Promise<void> {
    await apiRequest<Envelope<{ id: string }>>(`/v1/procurement/${id}`, { method: "DELETE" });
  }
}

export const inventoryRepository: InventoryRepository = new ApiInventoryRepository();

export { ApiError };
