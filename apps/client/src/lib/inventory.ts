import type { Asset, AssetCondition, Location, RoomHealth, RoomSummary } from "@sisarpras/domain";
import { ROOM_HEALTH_LABEL } from "@sisarpras/domain";

export const EMPTY_CONDITION_COUNT: Record<AssetCondition, number> = { good: 0, fair: 0, damaged: 0 };

export function countByCondition(list: Asset[]): Record<AssetCondition, number> {
  const counts = { ...EMPTY_CONDITION_COUNT };
  for (const asset of list) {
    if (asset.deletedAt) continue;
    counts[asset.condition] += 1;
  }
  return counts;
}

/**
 * Room health is derived, never stored: a room is only as healthy as the assets
 * inside it. Storage locations are reported separately.
 */
export function classifyRoom(location: Location, counts: Record<AssetCondition, number>, total: number): RoomHealth {
  if (location.kind === "storage") return "storage";
  if (total === 0) return "good";
  const brokenRatio = counts.damaged / total;
  const fairRatio = counts.fair / total;
  if (brokenRatio >= 0.15) return "critical";
  if (brokenRatio > 0 || fairRatio >= 0.25) return "attention";
  return "good";
}

export function summarizeRooms(locations: Location[], assets: Asset[]): RoomSummary[] {
  return locations
    .filter((location) => location.kind === "room" || location.kind === "storage")
    .map((location) => {
      const inside = assets.filter((asset) => asset.locationId === location.id && !asset.deletedAt);
      const byCondition = countByCondition(inside);
      const health = classifyRoom(location, byCondition, inside.length);
      return {
        location,
        totalAssets: inside.length,
        byCondition,
        health,
        healthLabel: ROOM_HEALTH_LABEL[health],
      };
    });
}

export function activeAssets(assets: Asset[]): Asset[] {
  return assets.filter((asset) => !asset.deletedAt);
}

export function nextAssetCode(assets: Asset[], year = new Date().getFullYear()): string {
  const prefix = `AST-${year}-`;
  const highest = assets
    .filter((asset) => asset.assetCode.startsWith(prefix))
    .reduce((max, asset) => {
      const parsed = Number.parseInt(asset.assetCode.slice(prefix.length), 10);
      return Number.isNaN(parsed) ? max : Math.max(max, parsed);
    }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
