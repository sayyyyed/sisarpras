import { useEffect, useMemo, useState } from "react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { RiAddLine } from "@remixicon/react";
import type { AssetLoan } from "@sisarpras/domain";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Input } from "@/components/base/input/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { NumberField } from "@/components/base/number-field/number-field";
import { SearchField } from "@/components/base/search-field/search-field";
import { Select, SelectItem } from "@/components/base/select/select";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { PageHeading, Panel } from "@/components/ui/primitives";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/store";

export default function LoansPage() {
  const { assets, reload } = useApp();
  const { user } = useAuth();
  const [loans, setLoans] = useState<AssetLoan[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [quantity, setQuantity] = useState<number | undefined>(1);
  const [startDate, setStartDate] = useState<CalendarDate | null>(parseDate(new Date().toLocaleDateString("en-CA")));
  const [dueDate, setDueDate] = useState<CalendarDate | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const writable = user?.role === "admin" || user?.role === "operator";
  const load = async () => {
    try { const result = await apiRequest<{ data: AssetLoan[] }>("/v1/loans"); setLoans(result.data); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat peminjaman"); }
  };
  useEffect(() => { void load(); }, []);
  const activeByAsset = useMemo(() => {
    const values = new Map<string, number>();
    for (const loan of loans) if (!loan.returnedAt) values.set(loan.assetId, (values.get(loan.assetId) ?? 0) + loan.quantity);
    return values;
  }, [loans]);
  const available = (id: string) => {
    const asset = assets.find((row) => row.id === id);
    return asset ? Math.max(0, asset.stockQuantity - asset.roomStocks.reduce((sum, row) => sum + row.quantity, 0) - (activeByAsset.get(id) ?? 0)) : 0;
  };
  const assetName = (id: string) => assets.find((row) => row.id === id)?.name ?? "Aset tidak tersedia";
  const today = new Date().toLocaleDateString("en-CA");
  const shown = loans.filter((loan) => {
    const status = loan.returnedAt ? "returned" : loan.dueDate < today ? "late" : "active";
    return (filter === "all" || filter === status || (filter === "active" && status === "late")) && `${assetName(loan.assetId)} ${loan.borrowerName}`.toLowerCase().includes(query.toLowerCase());
  });
  async function save() {
    if (!assetId || !borrowerName.trim() || !quantity || !startDate || !dueDate) { setError("Lengkapi semua kolom."); return; }
    if (dueDate.compare(startDate) < 0) { setError("Tanggal jatuh tempo harus setelah tanggal mulai."); return; }
    setBusy(true);
    try {
      await apiRequest("/v1/loans", { method: "POST", body: JSON.stringify({ assetId, borrowerName: borrowerName.trim(), quantity, startDate: startDate.toString(), dueDate: dueDate.toString() }) });
      setOpen(false); setAssetId(""); setBorrowerName(""); setQuantity(1); setDueDate(null);
      await Promise.all([load(), reload()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menyimpan peminjaman"); }
    finally { setBusy(false); }
  }
  async function finish(id: string) {
    setBusy(true);
    try { await apiRequest(`/v1/loans/${id}/return`, { method: "POST" }); await Promise.all([load(), reload()]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal mencatat pengembalian"); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading title="Peminjaman" subtitle={`${loans.filter((loan) => !loan.returnedAt).length} peminjaman aktif · ${loans.filter((loan) => !loan.returnedAt && loan.dueDate < today).length} lewat jatuh tempo`} actions={writable ? <Button leadingIcon={RiAddLine} onClick={() => { setError(""); setOpen(true); }}>Tambah Peminjaman</Button> : undefined} />
    {error && <p className="text-body-regular text-text-error-primary" role="alert">{error}</p>}
    <Panel>
      <div className="flex flex-wrap gap-3 p-4"><SearchField aria-label="Cari peminjaman" placeholder="Cari aset atau peminjam…" value={query} onChange={setQuery} className="min-w-64 flex-1" /><Select aria-label="Filter status" selectedKey={filter} onSelectionChange={(key) => setFilter(String(key))} className="w-48"><SelectItem id="active">Sedang dipinjam</SelectItem><SelectItem id="late">Terlambat</SelectItem><SelectItem id="returned">Sudah kembali</SelectItem><SelectItem id="all">Semua</SelectItem></Select></div>
      <Table aria-label="Daftar peminjaman"><TableHeader><TableColumn isRowHeader>Aset</TableColumn><TableColumn>Peminjam</TableColumn><TableColumn>Jumlah</TableColumn><TableColumn>Mulai</TableColumn><TableColumn>Jatuh tempo</TableColumn><TableColumn>Status</TableColumn><TableColumn>Aksi</TableColumn></TableHeader><TableBody>{shown.map((loan) => <TableRow id={loan.id} key={loan.id}><TableCell>{assetName(loan.assetId)}</TableCell><TableCell>{loan.borrowerName}</TableCell><TableCell>{loan.quantity}</TableCell><TableCell>{loan.startDate}</TableCell><TableCell>{loan.dueDate}</TableCell><TableCell><Chip color={loan.returnedAt ? "lime" : loan.dueDate < today ? "rose" : "yellow"}>{loan.returnedAt ? "Kembali" : loan.dueDate < today ? "Terlambat" : "Dipinjam"}</Chip></TableCell><TableCell>{writable && !loan.returnedAt ? <Button size="small" variant="secondary" disabled={busy} onClick={() => void finish(loan.id)}>Catat kembali</Button> : "—"}</TableCell></TableRow>)}</TableBody></Table>
      {shown.length === 0 && <p className="p-5 text-body-regular text-text-secondary">Belum ada peminjaman pada filter ini.</p>}
    </Panel>
    <Modal isOpen={open} onOpenChange={setOpen}><ModalHeader title="Tambah Peminjaman" description="Hanya stok yang belum digunakan di ruangan dapat dipinjam." /><ModalBody><div className="flex flex-col gap-4"><Select label="Aset" selectedKey={assetId || null} onSelectionChange={(key) => setAssetId(String(key))}>{assets.filter((asset) => !asset.deletedAt && available(asset.id) > 0).map((asset) => <SelectItem key={asset.id} id={asset.id}>{asset.name} · {available(asset.id)} tersedia</SelectItem>)}</Select><Input label="Nama peminjam" value={borrowerName} onChange={setBorrowerName} /><NumberField label="Jumlah" value={quantity} onChange={setQuantity} minValue={1} maxValue={assetId ? available(assetId) : undefined} /><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-caption-1-semibold text-text-secondary">Tanggal mulai</p><DatePicker value={startDate} onChange={setStartDate} aria-label="Tanggal mulai" /></div><div><p className="text-caption-1-semibold text-text-secondary">Jatuh tempo</p><DatePicker value={dueDate} onChange={setDueDate} aria-label="Jatuh tempo" /></div></div></div></ModalBody><ModalFooter><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button disabled={busy} onClick={() => void save()}>Simpan</Button></ModalFooter></Modal>
  </>;
}
