import { useState } from "react";
import { RiDownload2Line, RiFileList3Line, RiLineChartLine, RiStockLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Select, SelectItem } from "@/components/base/select/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import { PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import { useApp } from "@/lib/store";

const REPORTS = [
  {
    id: "assets",
    name: "Daftar Aset per Ruangan",
    description: "Kode, nama, kategori, lokasi, kondisi, status, dan nilai perolehan",
    icon: RiFileList3Line,
    formats: ["CSV", "Excel", "PDF"],
  },
  {
    id: "condition",
    name: "Rekap Kondisi Aset",
    description: "Jumlah aset baik / cukup / rusak per gedung dan lantai",
    icon: RiLineChartLine,
    formats: ["CSV", "PDF"],
  },
  {
    id: "stock",
    name: "Mutasi Stok Habis Pakai",
    description: "Riwayat stok masuk dan keluar beserta penanggung jawab",
    icon: RiStockLine,
    formats: ["CSV", "Excel"],
  },
  {
    id: "procurement",
    name: "Riwayat Pengadaan",
    description: "Pengajuan, harga usulan, nilai disetujui, dan kelengkapan kuitansi",
    icon: RiFileList3Line,
    formats: ["Excel", "PDF"],
  },
];

export default function ReportsPage() {
  const { showToast } = useApp();
  const [period, setPeriod] = useState<string | null>("q");

  return (
    <>
      <PageHeading
        title="Laporan"
        subtitle="Ekspor daftar aset, mutasi stok, dan riwayat pengadaan"
        actions={
          <Button variant="secondary" leadingIcon={RiDownload2Line}>
            Unduh Semua
          </Button>
        }
      />

      <Panel padded>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Periode"
            className="w-[220px]"
            selectedKey={period}
            onSelectionChange={(key) => setPeriod(key === null ? null : String(key))}
          >
            <SelectItem id="month">Bulan ini</SelectItem>
            <SelectItem id="q">Kuartal ini</SelectItem>
            <SelectItem id="year">Tahun 2026</SelectItem>
            <SelectItem id="all">Seluruh periode</SelectItem>
          </Select>
          <div className="flex-1" />
          <Chip variant="caption" color="blue">
            mode lokal · data belum tersinkron ikut terhitung
          </Chip>
        </div>
      </Panel>

      <Panel>
        <div className="p-5">
          <SectionHeading title="Jenis Laporan" subtitle="Pilih format lalu unduh" />
        </div>
        <Table aria-label="Daftar laporan" size="md">
          <TableHeader>
            <TableColumn isRowHeader>Laporan</TableColumn>
            <TableColumn>Keterangan</TableColumn>
            <TableColumn>Format</TableColumn>
            <TableColumn> </TableColumn>
          </TableHeader>
          <TableBody>
            {REPORTS.map((report) => (
              <TableRow key={report.id} id={report.id}>
                <TableCell>
                  <span className="flex items-center gap-2 text-body-medium text-text-primary">
                    <report.icon className="size-4 text-foreground-icon-secondary" />
                    {report.name}
                  </span>
                </TableCell>
                <TableCell>{report.description}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1.5">
                    {report.formats.map((format) => (
                      <Chip key={format} variant="caption" color="soft">
                        {format}
                      </Chip>
                    ))}
                  </span>
                </TableCell>
                <TableCell>
                  <Button size="small" variant="secondary" onClick={() => showToast("Laporan disiapkan", report.name)}>
                    Unduh
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}
