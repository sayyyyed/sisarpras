import { useEffect, useState } from "react";
import { RiCloudOffLine, RiRefreshLine, RiWifiLine } from "@remixicon/react";
import { Outlet, useNavigate } from "react-router-dom";
import { Chip } from "@/components/base/badges/chip";
import { StatusDot } from "@/components/base/badges/status-dot";
import { Button } from "@/components/base/buttons/button";
import { Toaster } from "@/components/base/toast/toast";
import { AppSidebar } from "@/components/layout/sidebar";
import { SearchPalette } from "@/components/layout/search-palette";
import { CompanyModal, OPEN_COMPANY_EVENT } from "@/components/layout/company-modal";
import { Topbar } from "@/components/layout/topbar";
import { API_BASE } from "@/lib/api";
import { useApp } from "@/lib/store";

function SyncBar() {
  const { outbox, online, source, loading, reload, showToast } = useApp();
  const navigate = useNavigate();
  const pending = outbox.filter((item) => item.status === "pending" || item.status === "conflict").length;
  const connected = source === "api" && online;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-separator-border bg-background-primary-default px-4 py-2.5 sm:gap-3 sm:px-6">
      <StatusDot color={connected ? "green" : "yellow"} />
      <span className="text-body-medium text-text-primary">{connected ? "Terhubung" : "Mode lokal"}</span>
      <Chip variant="caption" color={pending > 0 ? "yellow" : "lime"}>
        {pending > 0 ? `${pending} menunggu sinkronisasi` : "semua tersinkron"}
      </Chip>

      <div className="hidden flex-1 sm:block" />
      <span className="hidden font-mono text-caption-1-regular text-text-tertiary md:inline">
        {connected ? API_BASE.replace(/^https?:\/\//, "") : "data lokal (fallback)"}
      </span>

      <Button
        size="small"
        variant="secondary"
        leadingIcon={connected ? RiCloudOffLine : RiWifiLine}
        disabled={loading}
        onClick={async () => {
          if (connected) {
            showToast("Koneksi ke server tetap aktif", API_BASE);
            return;
          }
          await reload();
          showToast("Percobaan menyambung selesai");
        }}
      >
        {connected ? "Terhubung" : "Coba Hubungkan"}
      </Button>
      <Button size="small" variant="ghost" leadingIcon={RiRefreshLine} onClick={() => navigate("/sync")}>
        Detail
      </Button>
    </div>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);

  // The sidebar's "Cari cepat" button and ⌘K / Ctrl+K both open the palette.
  useEffect(() => {
    const open = () => setSearchOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("sisarpras:open-search", open);
    const openCompany = () => setCompanyOpen(true);
    window.addEventListener(OPEN_COMPANY_EVENT, openCompany);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("sisarpras:open-search", open);
      window.removeEventListener(OPEN_COMPANY_EVENT, openCompany);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="fixed inset-0 flex overflow-clip bg-background-full">
      {/*
        The rail is pinned: the shell is a fixed-height flex row and only <main>
        scrolls. The rail itself scrolls internally if the nav outgrows the
        viewport, so it never moves with the page.
      */}
      <aside
        data-sidebar-rail
        className="hidden h-full w-[280px] shrink-0 overflow-y-auto border-r border-separator-border lg:block"
      >
        <AppSidebar />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto bg-background-primary-default shadow-xl">
            <AppSidebar mobile onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main data-app-main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
            <Outlet />
          </div>
        </main>
        <SyncBar />
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CompanyModal open={companyOpen} onClose={() => setCompanyOpen(false)} />
      <Toaster />
    </div>
  );
}
