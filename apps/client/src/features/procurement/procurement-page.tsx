import { RiAddLine, RiFileTextLine, RiMoneyDollarCircleLine, RiShoppingCartLine } from "@remixicon/react";
import { PROCUREMENT_STATUS_LABEL, type ProcurementStatus } from "@sisarpras/domain";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Modal, ModalBody, ModalDialog, ModalFooter, ModalHeader, ModalTrigger, useModalClose } from "@/components/base/modal/modal";
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
import { Textarea } from "@/components/base/textarea/textarea";
import { MonoCode, PageHeading, Panel } from "@/components/ui/primitives";
import { formatDate, formatIdr } from "@/lib/format";
import { useApp } from "@/lib/store";

const STATUS_CHIP: Record<ProcurementStatus, ChipColor> = {
  draft: "neutral",
  submitted: "yellow",
  approved: "lime",
  rejected: "rose",
  received: "cyan",
};

function NewRequestForm() {
  const close = useModalClose();
  const { showToast } = useApp();

  return (
    <>
      <ModalBody>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Nama barang *" placeholder="cth. Kursi kerja mesh" />
          <NumberField label="Jumlah *" defaultValue={1} minValue={1} />
          <Input label="Vendor" placeholder="cth. CV Multi Furni" />
          <NumberField label="Harga pengajuan (Rp) *" minValue={0} hint="Bilangan bulat rupiah" />
          <Select label="Kategori" defaultSelectedKey="elektronik">
            <SelectItem id="elektronik">Elektronik</SelectItem>
            <SelectItem id="furnitur">Furnitur</SelectItem>
            <SelectItem id="kendaraan">Kendaraan</SelectItem>
          </Select>
          <Input label="Diajukan oleh" defaultValue="Admin Sarpras" isReadOnly />
        </div>
        <div className="mt-5">
          <Textarea label="Justifikasi" rows={3} placeholder="Alasan kebutuhan, kondisi aset yang diganti…" />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={close}>
          Batal
        </Button>
        <Button
          onClick={() => {
            showToast("Pengajuan dibuat", "Menunggu persetujuan atasan");
            close();
          }}
        >
          Kirim Pengajuan
        </Button>
      </ModalFooter>
    </>
  );
}

export default function ProcurementPage() {
  const { procurements: rawProcurements } = useApp();
  // The server does not store receipt bytes yet, so normalise the shape here.
  const procurements = rawProcurements.map((item) => ({ ...item, receiptFiles: item.receiptFiles ?? [] }));
  const awaiting = procurements.filter((item) => item.status === "submitted");
  const approved = procurements.filter((item) => item.status === "approved" || item.status === "received");
  const awaitingValue = awaiting.reduce((sum, item) => sum + item.proposedPriceIdr, 0);
  const approvedValue = approved.reduce((sum, item) => sum + (item.approvedPriceIdr ?? item.proposedPriceIdr), 0);
  const withReceipt = approved.filter((item) => item.receiptFiles.length > 0).length;

  const stats: Stat[] = [
    {
      icon: RiShoppingCartLine,
      label: "Menunggu Persetujuan",
      value: `${awaiting.length}`,
      delta: formatIdr(awaitingValue),
      deltaColor: "neutral",
      tone: "orange",
      caption: "Perlu keputusan atasan",
    },
    {
      icon: RiMoneyDollarCircleLine,
      label: "Disetujui",
      value: `${approved.length}`,
      delta: formatIdr(approvedValue),
      deltaColor: "lime",
      tone: "emerald",
      caption: "Nilai pengadaan berjalan",
    },
    {
      icon: RiFileTextLine,
      label: "Kuitansi Diterima",
      value: `${withReceipt}/${approved.length}`,
      delta: `${approved.length - withReceipt} berkas kurang`,
      deltaColor: approved.length - withReceipt > 0 ? "rose" : "lime",
      tone: "blue",
      caption: "Kelengkapan berkas pengadaan",
    },
  ];

  return (
    <>
      <PageHeading
        title="Pengadaan"
        subtitle="Pengajuan, harga usulan, persetujuan, dan kuitansi"
        actions={
          <ModalTrigger>
            <Button leadingIcon={RiAddLine}>Buat Pengajuan</Button>
            <Modal size="lg" aria-label="Buat pengajuan pengadaan">
              <ModalDialog aria-label="Buat pengajuan pengadaan">
                <ModalHeader
                  title="Buat Pengajuan Pengadaan"
                  description="Harga pengajuan dicatat sebagai usulan, bukan nilai final."
                />
                <NewRequestForm />
              </ModalDialog>
            </Modal>
          </ModalTrigger>
        }
      />

      <StatCards stats={stats} />

      <Panel>
        <Table aria-label="Daftar pengadaan" size="md">
          <TableHeader>
            <TableColumn isRowHeader>No. Pengajuan</TableColumn>
            <TableColumn>Item</TableColumn>
            <TableColumn>Vendor</TableColumn>
            <TableColumn>Harga Pengajuan</TableColumn>
            <TableColumn>Disetujui</TableColumn>
            <TableColumn>Tanggal</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Kuitansi</TableColumn>
          </TableHeader>
          <TableBody>
            {procurements.map((item) => (
              <TableRow key={item.id} id={item.id}>
                <TableCell>
                  <MonoCode>{item.reference}</MonoCode>
                </TableCell>
                <TableCell>
                  <span className="text-body-medium text-text-primary">
                    {item.itemName} × {item.quantity}
                  </span>
                </TableCell>
                <TableCell>{item.vendor}</TableCell>
                <TableCell>{formatIdr(item.proposedPriceIdr)}</TableCell>
                <TableCell>{formatIdr(item.approvedPriceIdr)}</TableCell>
                <TableCell>{formatDate(item.requestedAt)}</TableCell>
                <TableCell>
                  <Chip variant="bold" color={STATUS_CHIP[item.status]}>
                    {PROCUREMENT_STATUS_LABEL[item.status]}
                  </Chip>
                </TableCell>
                <TableCell>
                  {item.receiptFiles.length > 0 ? (
                    <Chip variant="subtle" color="blue">
                      {item.receiptFiles.length > 1 ? `${item.receiptFiles.length} berkas` : item.receiptFiles[0]}
                    </Chip>
                  ) : (
                    <span className="text-caption-1-regular text-text-tertiary">Belum ada</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}
