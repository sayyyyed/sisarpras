import { useEffect, useMemo, useState } from "react";
import { RiAddLine, RiDownload2Line, RiEditLine, RiPriceTag3Line, RiSubtractLine } from "@remixicon/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Pagination } from "@/components/base/pagination/pagination";
import { SearchField } from "@/components/base/search-field/search-field";
import { Select, SelectItem } from "@/components/base/select/select";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { toast } from "@/components/base/toast/toast";
import { PageHeading, Panel } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { useApp } from "@/lib/store";
import { apiRequest } from "@/lib/api";
import type { AssetLoan } from "@sisarpras/domain";

const PAGE_SIZE = 8;

function usageColor(used: number, stock: number): ChipColor {
  if (stock <= 0 || used >= stock) return "rose";
  if ((stock - used) / stock <= 0.2) return "yellow";
  return "lime";
}

export default function AssetsPage() {
  const { assets, categories, locations, adjustAssetStock } = useApp();
  const [loans, setLoans] = useState<AssetLoan[]>([]);
  useEffect(() => { void apiRequest<{ data: AssetLoan[] }>("/v1/loans").then(({ data }) => setLoans(data)).catch(() => {}); }, []);
  const borrowed = (id: string) => loans.filter((loan) => loan.assetId === id && !loan.returnedAt).reduce((sum, loan) => sum + loan.quantity, 0);
  const navigate = useNavigate();
  const categoryName = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const locationName = useMemo(() => new Map(locations.map((item) => [item.id, item.name])), [locations]);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState(searchParams.get("locationId") ?? "all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (asset.deletedAt) return false;
      if (category !== "all" && asset.categoryId !== category) return false;
      if (location !== "all" && !asset.roomStocks.some((item) => item.locationId === location)) return false;
      return !needle || asset.name.toLowerCase().includes(needle) || asset.assetCode.toLowerCase().includes(needle) || (asset.serialNumber ?? "").toLowerCase().includes(needle) || (asset.description ?? "").toLowerCase().includes(needle);
    });
  }, [assets, query, category, location]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalStock = assets.filter((item) => !item.deletedAt).reduce((sum, item) => sum + item.stockQuantity, 0);

  async function changeStock(assetId: string, delta: number, used: number, stock: number) {
    if (delta < 0 && stock + delta < used) {
      toast.error("Stok tidak dapat dikurangi", { description: `${formatNumber(used)} unit sedang digunakan.` });
      return;
    }
    const result = await adjustAssetStock(assetId, { delta });
    if (!result.ok) toast.error("Stok gagal diperbarui", { description: result.error });
  }

  return (
    <>
      <PageHeading
        title="Aset"
        subtitle={`${formatNumber(assets.length)} jenis barang · ${formatNumber(totalStock)} unit stok`}
        actions={
          <>
            <Button variant="secondary" leadingIcon={RiDownload2Line}>Ekspor CSV</Button>
            <Button variant="secondary" leadingIcon={RiPriceTag3Line} onClick={() => navigate("/categories")}>Kategori</Button>
            <Button leadingIcon={RiAddLine} onClick={() => navigate("/assets/new")}>Tambah Barang</Button>
          </>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <SearchField aria-label="Cari barang" placeholder="Cari nama, kode, atau nomor seri…" value={query} onChange={(value) => { setQuery(value); setPage(1); }} className="min-w-[260px] flex-1" />
          <Select aria-label="Filter kategori" className="w-[180px]" selectedKey={category} onSelectionChange={(key) => { setCategory(String(key)); setPage(1); }}>
            <SelectItem id="all">Semua kategori</SelectItem>
            {categories.map((item) => <SelectItem key={item.id} id={item.id}>{item.name}</SelectItem>)}
          </Select>
          <Select aria-label="Filter ruangan" className="w-[200px]" selectedKey={location} onSelectionChange={(key) => { setLocation(String(key)); setPage(1); }}>
            <SelectItem id="all">Semua ruangan</SelectItem>
            {locations.filter((item) => item.kind === "room" || item.kind === "storage").map((item) => <SelectItem key={item.id} id={item.id}>{item.name}</SelectItem>)}
          </Select>
        </div>

        <Table aria-label="Daftar barang aset" size="md">
          <TableHeader>
            <TableColumn isRowHeader>Nama Barang</TableColumn>
            <TableColumn>Kategori</TableColumn>
            <TableColumn>Ruangan</TableColumn>
            <TableColumn>Dipakai / Stok</TableColumn>
            <TableColumn>Stok & Aksi</TableColumn>
          </TableHeader>
          <TableBody>
            {rows.map((asset) => {
              const inRooms = asset.roomStocks.reduce((sum, item) => sum + item.quantity, 0);
              const onLoan = borrowed(asset.id);
              const used = inRooms + onLoan;
              return (
                <TableRow key={asset.id} id={asset.id} onAction={() => navigate(`/assets/${asset.id}`)} className="cursor-pointer">
                  <TableCell><span className="text-body-medium text-text-primary">{asset.name}</span></TableCell>
                  <TableCell>{categoryName.get(asset.categoryId) ?? "—"}</TableCell>
                  <TableCell>
                    <TooltipTrigger>
                      <Button size="small" variant="ghost" aria-label={`${formatNumber(asset.roomStocks.length)} ruangan untuk ${asset.name}`} onClick={(event) => event.stopPropagation()}>
                        {formatNumber(asset.roomStocks.length)}
                      </Button>
                      <Tooltip>
                        <div className="flex flex-col gap-1">
                          {asset.roomStocks.length === 0 ? <span>Belum ditempatkan</span> : asset.roomStocks.map((item) => (
                            <span key={item.locationId}>{locationName.get(item.locationId) ?? "Ruangan"} · {formatNumber(item.quantity)} unit</span>
                          ))}
                        </div>
                      </Tooltip>
                    </TooltipTrigger>
                  </TableCell>
                  <TableCell><Chip variant="bold" color={usageColor(used, asset.stockQuantity)}>{formatNumber(Math.max(0, asset.stockQuantity - used))} tersedia · {formatNumber(inRooms)} di ruangan · {formatNumber(onLoan)} dipinjam</Chip></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-xl border border-border-button-default p-1">
                        <Button size="small" variant="secondary" iconOnly leadingIcon={RiSubtractLine} aria-label={`Kurangi stok ${asset.name}`} onClick={(event) => { event.stopPropagation(); void changeStock(asset.id, -1, used, asset.stockQuantity); }} />
                        <span className="min-w-10 text-center text-body-medium text-text-primary" aria-label={`${formatNumber(asset.stockQuantity)} unit stok`}>{formatNumber(asset.stockQuantity)}</span>
                        <Button size="small" variant="secondary" iconOnly leadingIcon={RiAddLine} aria-label={`Tambah stok ${asset.name}`} onClick={(event) => { event.stopPropagation(); void changeStock(asset.id, 1, used, asset.stockQuantity); }} />
                      </div>
                      <Button size="small" variant="ghost" iconOnly leadingIcon={RiEditLine} aria-label={`Edit ${asset.name}`} onClick={(event) => { event.stopPropagation(); navigate(`/assets/${asset.id}/edit`); }} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator-border p-4">
          <span className="text-caption-1-regular text-text-tertiary">Menampilkan {rows.length} dari {filtered.length} barang</span>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} aria-label="Navigasi halaman aset" />
        </div>
      </Panel>
    </>
  );
}
