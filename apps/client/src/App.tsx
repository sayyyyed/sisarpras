import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import AssetsPage from "@/features/assets/assets-page";
import AssetFormPage from "@/features/assets/asset-form-page";
import AssetDetailPage from "@/features/assets/asset-detail-page";
import CategoriesPage from "@/features/assets/categories-page";
import DashboardPage from "@/features/dashboard/dashboard-page";
import LabelsPage from "@/features/labels/labels-page";
import ReportsPage from "@/features/misc/reports-page";
import SettingsPage from "@/features/misc/settings-page";
import ProcurementPage from "@/features/procurement/procurement-page";
import RoomsPage from "@/features/rooms/rooms-page";
import RoomDetailPage from "@/features/rooms/room-detail-page";
import StockPage from "@/features/stock/stock-page";
import LoansPage from "@/features/loans/loans-page";
import SyncPage from "@/features/sync/sync-page";
import { AppProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useApp } from "@/lib/store";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { DEFAULT_ROLE_MENU_KEYS } from "@sisarpras/domain";
import { LoginPage } from "@/features/auth/login-page";
import UsersPage from "@/features/users/users-page";

function AuthenticatedApp() {
  const { ready, user } = useAuth();
  const { loading } = useApp();
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      setLoadedUserId(null);
      return;
    }
    if (!loading) setLoadedUserId(user.id);
  }, [user?.id, loading]);

  if (!ready) return <AppLoadingScreen label="Memeriksa akun…" />;
  if (!user) return <LoginPage />;
  if (loadedUserId !== user.id) return <AppLoadingScreen />;
  const canOpen = (menu: string) => (user.menuKeys ?? DEFAULT_ROLE_MENU_KEYS[user.role]).includes(menu);
  return <>
    <SpaLinkInterceptor />
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={canOpen("dashboard") ? <DashboardPage /> : <Navigate to="/" replace />} />
        <Route path="/assets" element={canOpen("assets") ? <AssetsPage /> : <Navigate to="/" replace />} />
        <Route path="/assets/new" element={canOpen("assets") ? <AssetFormPage /> : <Navigate to="/" replace />} />
        <Route path="/assets/:assetId/edit" element={canOpen("assets") ? <AssetFormPage /> : <Navigate to="/" replace />} />
        <Route path="/assets/:assetId" element={canOpen("assets") ? <AssetDetailPage /> : <Navigate to="/" replace />} />
        <Route path="/categories" element={canOpen("assets") ? <CategoriesPage /> : <Navigate to="/" replace />} />
        <Route path="/rooms" element={canOpen("rooms") ? <RoomsPage /> : <Navigate to="/" replace />} />
        <Route path="/rooms/:roomId" element={canOpen("rooms") ? <RoomDetailPage /> : <Navigate to="/" replace />} />
        <Route path="/procurement" element={canOpen("procurement") ? <ProcurementPage /> : <Navigate to="/" replace />} />
        <Route path="/labels" element={canOpen("labels") ? <LabelsPage /> : <Navigate to="/" replace />} />
        <Route path="/stock" element={canOpen("stock") ? <StockPage /> : <Navigate to="/" replace />} />
        <Route path="/loans" element={canOpen("loans") ? <LoansPage /> : <Navigate to="/" replace />} />
        <Route path="/sync" element={canOpen("sync") ? <SyncPage /> : <Navigate to="/" replace />} />
        <Route path="/reports" element={canOpen("reports") ? <ReportsPage /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={canOpen("settings") ? <SettingsPage /> : <Navigate to="/" replace />} />
        <Route path="/users" element={user.role === "admin" && canOpen("users") ? <UsersPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  </>;
}

/**
 * BoardUI's sidebar and breadcrumb render plain anchors (they assume Next.js
 * routing). We keep their markup and turn same-origin anchor clicks into
 * client-side navigations so the shell stays a single-page app.
 */
function SpaLinkInterceptor() {
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;

      event.preventDefault();
      navigate(href);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <AuthProvider><AppProvider><AuthenticatedApp /></AppProvider></AuthProvider>
  );
}
