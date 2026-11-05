import { RiArrowDownSLine, RiLogoutBoxRLine, RiMenuLine, RiSettings3Line, RiUserLine } from "@remixicon/react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/base/avatar/avatar";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { IconButton } from "@/components/base/buttons/icon-button";
import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownPopover,
} from "@/components/base/dropdown/dropdown";
import { DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { SearchField } from "@/components/base/search-field/search-field";
import { trailForPath } from "@/components/layout/nav";
import { usePath } from "@/lib/use-path";
import { useAuth } from "@/lib/auth";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePath();
  const navigate = useNavigate();
  const trail = trailForPath(pathname);
  const { user, logout } = useAuth();
  const initials = user?.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() ?? "U";

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-separator-border bg-background-primary-default px-4 py-3 sm:gap-4 sm:px-6">
      <IconButton icon={RiMenuLine} aria-label="Buka menu" className="lg:hidden" onClick={onMenu} />

      <Breadcrumb aria-label="Breadcrumb" className="hidden min-w-0 sm:flex">
        {trail.map((item) => (
          <BreadcrumbItem key={item.label} href={item.href} current={!item.href}>
            {item.label}
          </BreadcrumbItem>
        ))}
      </Breadcrumb>

      <div className="min-w-0 flex-1">
        <span className="truncate text-title-3-semibold text-text-primary sm:hidden">
          {trail[trail.length - 1]?.label ?? ""}
        </span>
      </div>

      <SearchField
        aria-label="Cari aset"
        placeholder="Cari aset…"
        shape="pill"
        className="hidden w-[220px] md:block xl:w-[320px]"
        onSubmit={() => navigate("/assets")}
      />

      <Dropdown>
        <DropdownTrigger className="flex items-center gap-2 rounded-full border border-border-button-default bg-background-primary-default py-1 pl-1 pr-2.5 transition-colors hover:bg-background-secondary-default">
          <Avatar size="sm" initials={initials} color="blue" />
          <span className="hidden text-body-medium text-text-primary sm:inline">{user?.name}</span>
          <RiArrowDownSLine className="size-4 text-text-tertiary" />
        </DropdownTrigger>
        <DropdownPopover aria-label="Menu pengguna">
          {user?.role === "admin" && <DropdownItem onSelect={() => navigate("/users")}><span className="flex items-center gap-2"><RiUserLine className="size-4" /> Manajemen User</span></DropdownItem>}
          <DropdownItem onSelect={() => navigate("/settings")}>
            <span className="flex items-center gap-2">
              <RiUserLine className="size-4" /> Profil
            </span>
          </DropdownItem>
          <DropdownItem onSelect={logout}>
            <span className="flex items-center gap-2">
              <RiSettings3Line className="size-4" /> Pengaturan
            </span>
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem onSelect={() => navigate("/settings")}>
            <span className="flex items-center gap-2 text-text-error-primary">
              <RiLogoutBoxRLine className="size-4" /> Keluar
            </span>
          </DropdownItem>
        </DropdownPopover>
      </Dropdown>
    </header>
  );
}
