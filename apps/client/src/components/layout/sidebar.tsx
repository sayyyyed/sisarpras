import { DashboardSidebar } from "@/components/application/dashboard/dashboard-sidebar";
import { APP_NAV_ITEMS, navKeyForPath } from "@/components/layout/nav";
import { usePath } from "@/lib/use-path";
import { useAuth } from "@/lib/auth";

/**
 * The sidebar rail. `mobile` renders BoardUI's drawer flavour (always expanded,
 * close button instead of the collapse toggle).
 */
export function AppSidebar({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const pathname = usePath();
  const { user } = useAuth();
  return (
    <DashboardSidebar
      selected={navKeyForPath(pathname)}
      items={user?.role === "admin" ? APP_NAV_ITEMS : APP_NAV_ITEMS.filter((item) => item.key !== "users")}
      mobile={mobile}
      onClose={onClose}
    />
  );
}
