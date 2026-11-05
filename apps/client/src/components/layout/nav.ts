import {
  RiArchiveLine,
  RiBarChart2Line,
  RiDashboardLine,
  RiDoorOpenLine,
  RiQrCodeLine,
  RiRefreshLine,
  RiShoppingCartLine,
  RiStackLine,
  RiTeamLine,
} from "@remixicon/react";
import type { DashboardNavItem } from "@/components/application/dashboard/dashboard-sidebar";

/** Primary navigation, passed straight into BoardUI's DashboardSidebar. */
export const APP_NAV_ITEMS: DashboardNavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: RiDashboardLine, href: "/dashboard" },
  { key: "assets", label: "Aset", icon: RiArchiveLine, href: "/assets" },
  { key: "rooms", label: "Ruangan", icon: RiDoorOpenLine, href: "/rooms" },
  { key: "procurement", label: "Pengadaan", icon: RiShoppingCartLine, href: "/procurement" },
  { key: "labels", label: "Label & Barcode", icon: RiQrCodeLine, href: "/labels" },
  { key: "stock", label: "Stok", icon: RiStackLine, href: "/stock" },
  { key: "sync", label: "Sinkronisasi", icon: RiRefreshLine, href: "/sync" },
  { key: "reports", label: "Laporan", icon: RiBarChart2Line, href: "/reports" },
  { key: "users", label: "Manajemen User", icon: RiTeamLine, href: "/users" },
];

/** Which sidebar row is highlighted for a given route. */
export function navKeyForPath(pathname: string): string {
  if (pathname.startsWith("/assets")) return "assets";
  if (pathname.startsWith("/rooms")) return "rooms";
  if (pathname.startsWith("/procurement")) return "procurement";
  if (pathname.startsWith("/labels")) return "labels";
  if (pathname.startsWith("/stock")) return "stock";
  if (pathname.startsWith("/sync")) return "sync";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/users")) return "users";
  return "dashboard";
}

export interface Trail {
  label: string;
  href?: string;
}

/** Breadcrumb trail for a given route. */
export function trailForPath(pathname: string): Trail[] {
  if (pathname === "/assets/new") {
    return [{ label: "Aset", href: "/assets" }, { label: "Tambah Aset" }];
  }
  const title = PAGE_TITLES[pathname];
  return [{ label: title ?? "Dashboard" }];
}

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/assets": "Aset",
  "/assets/new": "Tambah Aset",
  "/rooms": "Ruangan",
  "/procurement": "Pengadaan",
  "/labels": "Label & Barcode",
  "/stock": "Stok",
  "/sync": "Sinkronisasi",
  "/reports": "Laporan",
  "/settings": "Pengaturan",
  "/users": "Manajemen User",
};
