import type {
  Asset,
  AssetDraft,
  Category,
  Location,
  LocationDraft,
  StockItem,
  StockMovementDraft,
} from "@sisarpras/domain";
import { apiRequest, ApiError } from "@/lib/api";

/**
 * The contract the UI depends on. The desktop build will swap in a SQLite
 * implementation; the browser build uses the HTTP one. Neither the pages nor
 * the forms know which database is behind it.
 */
export interface InventoryRepository {
  listAssets(): Promise<Asset[]>;
  createAsset(draft: AssetDraft): Promise<Asset>;
  listCategories(): Promise<Category[]>;
  listLocations(): Promise<Location[]>;
  createLocation(draft: LocationDraft): Promise<Location>;
  listStockItems(): Promise<StockItem[]>;
  /** Records an append-only movement and returns the item with its new quantity. */
  createStockMovement(draft: StockMovementDraft): Promise<StockItem>;
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
    const { data } = await apiRequest<Envelope<Asset>>("/v1/assets", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    return data;
  }

  async listCategories(): Promise<Category[]> {
    const { data } = await apiRequest<Envelope<Category[]>>("/v1/assets/categories");
    return data;
  }

  async listLocations(): Promise<Location[]> {
    const { data } = await apiRequest<Envelope<Location[]>>("/v1/locations");
    return data;
  }

  async createLocation(draft: LocationDraft): Promise<Location> {
    const { data } = await apiRequest<Envelope<Location>>("/v1/locations", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    return data;
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
}

export const inventoryRepository: InventoryRepository = new ApiInventoryRepository();

export { ApiError };
