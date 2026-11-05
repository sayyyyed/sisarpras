import { useMemo, useState } from "react";
import { RiAddLine, RiDownload2Line } from "@remixicon/react";
import { useNavigate } from "react-router-dom";
import {
  CONDITION_LABEL,
  STATUS_LABEL,
  type AssetCondition,
  type AssetStatus,
} from "@sisarpras/domain";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Pagination } from "@/components/base/pagination/pagination";
import { SearchField } from "@/components/base/search-field/search-field";
import { Select, SelectItem } from "@/components/base/select/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import { MonoCode, PageHeading, Panel } from "@/components/ui/primitives";
import { attachments } from "@/data/mock";
import { formatDate, formatIdr } from "@/lib/format";
import { activeAssets } from "@/lib/inventory";
import { useApp } from "@/lib/store";

const FILE_COUNT = attachments.reduce<Record<string, number>>((acc, file) => {
  acc[file.entityId] = (acc[file.entityId] ?? 0) + 1;
  return acc;
}, {});

const CONDITION_CHIP: Record<AssetCondition, ChipColor> = { good: "lime", fair: "yellow", damaged: "rose" };
const STATUS_CHIP: Record<AssetStatus, ChipColor> = {
  available: "blue",
  assigned: "purple",
  maintenance: "orange",
  disposed: "neutral",
};

const PAGE_SIZE = 8;

export default function AssetsPage() {
  const { assets, categories, locations } = useApp();
  const navigate = useNavigate();
  const categoryName = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const locationName = useMemo(() => new Map(locations.map((item) => [item.id, item.name])), [locations]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [condition, setCondition] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (category !== "all" && asset.categoryId !== category) return false;
      if (location !== "all" && asset.locationId !== location) return false;
      if (condition !== "all" && asset.condition !== condition) return false;
      if (status !== "all" && asset.status !== status) return false;
      if (!needle) return true;
      return (
        asset.name.toLowerCase().includes(needle) ||
        asset.assetCode.toLowerCase().includes(needle) ||
        (asset.serialNumber ?? "").toLowerCase().includes(needle)
      );
    });
  }, [assets, query, category, location, condition, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeCount = activeAssets(assets).length;

  return (
    <>
      <PageHeading
        title="Aset"
        subtitle={`${activeCount} aset aktif · ${assets.length - activeCount} arsip`}
        actions={
          <>
            <Button variant="secondary" leadingIcon={RiDownload2Line}>
              Ekspor CSV
            </Button>
            <Button leadingIcon={RiAddLine} onClick={() => navigate("/assets/new")}>
              Tambah Aset
            </Button>
          </>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <SearchField
            aria-label="Cari aset"
            placeholder="Cari nama, kode, atau nomor seri…"
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            className="min-w-[260px] flex-1"
          />
          <Select
            aria-label="Filter kategori"
            className="w-[180px]"
            selectedKey={category}
            onSelectionChange={(key) => {
              setCategory(String(key));
              setPage(1);
            }}
          >
            <SelectItem id="all">Semua kategori</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item.id} id={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Filter ruangan"
            className="w-[200px]"
            selectedKey={location}
            onSelectionChange={(key) => {
              setLocation(String(key));
              setPage(1);
            }}
          >
            <SelectItem id="all">Semua ruangan</SelectItem>
            {locations
              .filter((item) => item.kind === "room" || item.kind === "storage")
              .map((item) => (
                <SelectItem key={item.id} id={item.id}>
                  {item.name}
                </SelectItem>
              ))}
          </Select>
          <Select
            aria-label="Filter kondisi"
            className="w-[160px]"
            selectedKey={condition}
            onSelectionChange={(key) => {
              setCondition(String(key));
              setPage(1);
            }}
          >
            <SelectItem id="all">Semua kondisi</SelectItem>
            {(Object.keys(CONDITION_LABEL) as AssetCondition[]).map((key) => (
              <SelectItem key={key} id={key}>
                {CONDITION_LABEL[key]}
              </SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Filter status"
            className="w-[160px]"
            selectedKey={status}
            onSelectionChange={(key) => {
              setStatus(String(key));
              setPage(1);
            }}
          >
            <SelectItem id="all">Semua status</SelectItem>
            {(Object.keys(STATUS_LABEL) as AssetStatus[]).map((key) => (
              <SelectItem key={key} id={key}>
                {STATUS_LABEL[key]}
              </SelectItem>
            ))}
          </Select>
        </div>

        <Table aria-label="Daftar aset" size="md">
          <TableHeader>
            <TableColumn isRowHeader>Kode</TableColumn>
            <TableColumn>Nama Aset</TableColumn>
            <TableColumn>Kategori</TableColumn>
            <TableColumn>Ruangan</TableColumn>
            <TableColumn>Harga Perolehan</TableColumn>
            <TableColumn>Perolehan</TableColumn>
            <TableColumn>Kondisi</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Berkas</TableColumn>
          </TableHeader>
          <TableBody>
            {rows.map((asset) => (
              <TableRow key={asset.id} id={asset.id}>
                <TableCell>
                  <MonoCode>{asset.assetCode}</MonoCode>
                </TableCell>
                <TableCell>
                  <span className="text-body-medium text-text-primary">{asset.name}</span>
                </TableCell>
                <TableCell>{categoryName.get(asset.categoryId) ?? "—"}</TableCell>
                <TableCell>{locationName.get(asset.locationId) ?? "—"}</TableCell>
                <TableCell>{formatIdr(asset.acquisitionCostIdr)}</TableCell>
                <TableCell>{formatDate(asset.acquisitionDate)}</TableCell>
                <TableCell>
                  <Chip variant="bold" color={CONDITION_CHIP[asset.condition]}>
                    {CONDITION_LABEL[asset.condition]}
                  </Chip>
                </TableCell>
                <TableCell>
                  <Chip variant="bold" color={STATUS_CHIP[asset.status]}>
                    {STATUS_LABEL[asset.status]}
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="text-caption-1-regular text-text-tertiary">
                    {FILE_COUNT[asset.id] ? `${FILE_COUNT[asset.id]} berkas` : "—"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator-border p-4">
          <span className="text-caption-1-regular text-text-tertiary">
            Menampilkan {rows.length} dari {filtered.length} aset
          </span>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} aria-label="Navigasi halaman aset" />
        </div>
      </Panel>
    </>
  );
}
