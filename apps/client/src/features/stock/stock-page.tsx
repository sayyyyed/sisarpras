import { useState } from "react";
import { RiAddLine, RiDownload2Line, RiStackLine } from "@remixicon/react";
import { StockMovementDraftSchema, type StockMovementDraft } from "@sisarpras/domain";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Meter, type MeterTone } from "@/components/base/meter/meter";
import {
  Modal,
  ModalBody,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalTrigger,
  useModalClose,
} from "@/components/base/modal/modal";
import { NumberField } from "@/components/base/number-field/number-field";
import { Select, SelectItem } from "@/components/base/select/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import { PageHeading, Panel } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { useApp } from "@/lib/store";

function stockState(quantity: number, reorderLevel: number): { color: ChipColor; label: string; tone: MeterTone } {
  if (quantity < reorderLevel) return { color: "rose", label: "Di bawah minimum", tone: "error" };
  if (quantity < reorderLevel * 1.5) return { color: "yellow", label: "Menipis", tone: "warning" };
  return { color: "lime", label: "Cukup", tone: "success" };
}

function newTransactionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function StockPage() {
  const { stockItems, loading } = useApp();

  const totalUnits = stockItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowCount = stockItems.filter((item) => item.quantity < item.reorderLevel).length;

  return (
    <>
      <PageHeading
        title="Stok Habis Pakai"
        subtitle={`${formatNumber(totalUnits)} unit tersedia · ${lowCount} jenis di bawah batas minimum`}
        actions={
          <>
            <Button variant="secondary" leadingIcon={RiDownload2Line}>
              Ekspor CSV
            </Button>
            <ModalTrigger>
              <Button leadingIcon={RiAddLine}>Catat Mutasi</Button>
              <Modal size="md" aria-label="Catat mutasi stok">
                <ModalDialog aria-label="Catat mutasi stok">
                  <ModalHeader
                    title="Catat Mutasi Stok"
                    description="Mutasi dicatat sebagai transaksi; jumlah stok ikut menyesuaikan."
                  />
                  <NewMovementForm />
                </ModalDialog>
              </Modal>
            </ModalTrigger>
          </>
        }
      />

      <Panel padded>
        <div className="flex flex-wrap items-center gap-3">
          <Chip variant="caption" color={lowCount > 0 ? "yellow" : "lime"}>
            {lowCount > 0 ? `${lowCount} perlu pengadaan ulang` : "stok aman"}
          </Chip>
          <div className="flex-1" />
          {loading && <span className="text-caption-1-regular text-text-tertiary">Memuat dari server…</span>}
        </div>
      </Panel>

      <Panel>
        {stockItems.length === 0 ? (
          <div className="px-5 py-10 text-center text-body-regular text-text-tertiary">
            Belum ada jenis stok habis pakai.
          </div>
        ) : (
          <Table aria-label="Daftar stok" size="md">
            <TableHeader>
              <TableColumn isRowHeader>Nama Barang</TableColumn>
              <TableColumn>Satuan</TableColumn>
              <TableColumn>Tersedia</TableColumn>
              <TableColumn>Batas Minimum</TableColumn>
              <TableColumn>Level Stok</TableColumn>
              <TableColumn>Status</TableColumn>
            </TableHeader>
            <TableBody>
              {stockItems.map((item) => {
                const state = stockState(item.quantity, item.reorderLevel);
                const level = Math.min(100, Math.round((item.quantity / Math.max(1, item.reorderLevel * 3)) * 100));
                return (
                  <TableRow key={item.id} id={item.id}>
                    <TableCell>
                      <span className="text-body-medium text-text-primary">{item.name}</span>
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{formatNumber(item.quantity)}</TableCell>
                    <TableCell>{formatNumber(item.reorderLevel)}</TableCell>
                    <TableCell>
                      <div className="w-[180px]">
                        <Meter aria-label={`Level stok ${item.name}`} value={level} tone={state.tone} size="sm" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip variant="bold" color={state.color}>
                        {state.label}
                      </Chip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel padded>
        <div className="flex items-center gap-2 text-body-medium text-text-secondary">
          <RiStackLine className="size-4" />
          Mutasi stok dicatat append-only (stok masuk / stok keluar) dengan ID transaksi unik, jadi mutasi ganda tidak
          akan dihitung dua kali.
        </div>
      </Panel>
    </>
  );
}

function NewMovementForm() {
  const close = useModalClose();
  const { stockItems, addStockMovement, showToast } = useApp();

  const [itemId, setItemId] = useState<string | null>(null);
  const [direction, setDirection] = useState<string | null>("in");
  const [quantity, setQuantity] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = stockItems.find((item) => item.id === itemId);

  async function save() {
    const qty = quantity ?? 0;
    const draft: StockMovementDraft = {
      stockItemId: itemId ?? "",
      delta: direction === "out" ? -qty : qty,
      reason: reason.trim() || null,
      transactionId: newTransactionId(),
    };

    const parsed = StockMovementDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Data belum lengkap");
      return;
    }

    setSaving(true);
    try {
      const outcome = await addStockMovement(parsed.data);
      if (!outcome.ok) {
        setError(outcome.error ?? "Gagal menyimpan mutasi");
        return;
      }
      showToast(
        outcome.queued ? "Tersimpan di perangkat" : "Mutasi stok tercatat",
        outcome.queued
          ? "Server belum terjangkau — akan disinkronkan nanti"
          : `${selected?.name ?? "Stok"} ${draft.delta > 0 ? "+" : ""}${draft.delta}`,
      );
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-5">
          <Select
            label="Jenis stok *"
            placeholder="Pilih barang..."
            selectedKey={itemId}
            onSelectionChange={(key) => setItemId(key === null ? null : String(key))}
          >
            {stockItems.map((item) => (
              <SelectItem key={item.id} id={item.id}>
                {item.name} ({item.quantity} {item.unit})
              </SelectItem>
            ))}
          </Select>

          <Select
            label="Arah"
            selectedKey={direction}
            onSelectionChange={(key) => setDirection(key === null ? null : String(key))}
          >
            <SelectItem id="in">Stok masuk</SelectItem>
            <SelectItem id="out">Stok keluar</SelectItem>
          </Select>

          <NumberField
            label="Jumlah *"
            minValue={1}
            value={quantity}
            onChange={(value) => setQuantity(Number.isNaN(value) ? undefined : value)}
            hint={selected ? `Tersedia saat ini: ${selected.quantity} ${selected.unit}` : undefined}
          />

          <Input
            label="Alasan"
            placeholder="cth. Pemakaian ruang rapat"
            value={reason}
            onChange={setReason}
          />

          {error && <p className="text-caption-1-regular text-text-error-primary">{error}</p>}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={close} disabled={saving}>
          Batal
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Mutasi"}
        </Button>
      </ModalFooter>
    </>
  );
}
