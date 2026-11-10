import { DashboardSidebar } from "@/components/application/dashboard/dashboard-sidebar";
import { APP_NAV_ITEMS, navKeyForPath } from "@/components/layout/nav";
import { usePath } from "@/lib/use-path";
import { useAuth } from "@/lib/auth";
import { DEFAULT_ROLE_MENU_KEYS } from "@sisarpras/domain";

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
      items={APP_NAV_ITEMS.filter((item) => (user?.menuKeys ?? DEFAULT_ROLE_MENU_KEYS[user?.role ?? "viewer"]).includes(item.key))}
      mobile={mobile}
      onClose={onClose}
    />
  );
}
