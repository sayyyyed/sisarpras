import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import AssetsPage from "@/features/assets/assets-page";
import AssetFormPage from "@/features/assets/asset-form-page";
import DashboardPage from "@/features/dashboard/dashboard-page";
import LabelsPage from "@/features/labels/labels-page";
import ReportsPage from "@/features/misc/reports-page";
import SettingsPage from "@/features/misc/settings-page";
import ProcurementPage from "@/features/procurement/procurement-page";
import RoomsPage from "@/features/rooms/rooms-page";
import StockPage from "@/features/stock/stock-page";
import SyncPage from "@/features/sync/sync-page";
import { AppProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LoginPage } from "@/features/auth/login-page";
import UsersPage from "@/features/users/users-page";

function AuthenticatedApp() {
  const { ready, user } = useAuth();
  if (!ready) return <div className="flex min-h-dvh items-center justify-center bg-background-full text-body-regular text-text-secondary">Memuat akun…</div>;
  if (!user) return <LoginPage />;
  return <>
    <SpaLinkInterceptor />
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/assets/new" element={<AssetFormPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/procurement" element={<ProcurementPage />} />
        <Route path="/labels" element={<LabelsPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users" element={user.role === "admin" ? <UsersPage /> : <Navigate to="/dashboard" replace />} />
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
