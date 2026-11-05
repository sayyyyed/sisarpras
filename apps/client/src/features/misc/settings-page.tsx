import { RiDatabase2Line, RiShieldUserLine } from "@remixicon/react";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Divider } from "@/components/base/divider/divider";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { Switch } from "@/components/base/switch/switch";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
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

const ROLES: { name: string; scope: string; color: ChipColor }[] = [
  { name: "Admin", scope: "Semua modul, kelola pengguna dan pengaturan", color: "purple" },
  { name: "Operator", scope: "Tambah/ubah aset, ruangan, dan pengadaan", color: "blue" },
  { name: "Viewer", scope: "Hanya lihat dan ekspor laporan", color: "neutral" },
];

export default function SettingsPage() {
  const { showToast } = useApp();

  return (
    <>
      <PageHeading title="Pengaturan" subtitle="Kategori, ruangan, pengguna, dan preferensi aplikasi" />

      <Tabs defaultSelectedKey="umum">
        <TabList aria-label="Bagian pengaturan">
          <Tab id="umum">Umum</Tab>
          <Tab id="akses" icon={RiShieldUserLine}>
            Akses
          </Tab>
          <Tab id="data" icon={RiDatabase2Line}>
            Data
          </Tab>
        </TabList>

        <TabPanel id="umum" className="pt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel padded>
              <SectionHeading title="Instansi" subtitle="Muncul pada label dan laporan" />
              <div className="mt-4 flex flex-col gap-5">
                <Input label="Nama instansi" defaultValue="Dinas Sarana & Prasarana" />
                <Input label="Prefix kode aset" defaultValue="AST-2026-" hint="Contoh kode: AST-2026-0001" />
                <Select label="Zona waktu" defaultSelectedKey="wib">
                  <SelectItem id="wib">WIB (UTC+7)</SelectItem>
                  <SelectItem id="wita">WITA (UTC+8)</SelectItem>
                  <SelectItem id="wit">WIT (UTC+9)</SelectItem>
                </Select>
              </div>
            </Panel>

            <Panel padded>
              <SectionHeading title="Tampilan &amp; Notifikasi" subtitle="Preferensi perangkat ini" />
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-body-medium text-text-primary">Tema</div>
                    <div className="text-caption-1-regular text-text-tertiary">
                      Mengikuti token BoardUI — mode gelap tanpa override warna
                    </div>
                  </div>
                  <ThemeToggle appearance="segmented" size="small" />
                </div>
                <Divider />
                <Switch defaultSelected>Peringatan aset rusak</Switch>
                <Switch defaultSelected>Pengingat stok menipis</Switch>
                <Switch>Ringkasan harian melalui surel</Switch>
                <Divider />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-body-medium text-text-primary">Ukuran teks lebih besar</div>
                    <div className="text-caption-1-regular text-text-tertiary">
                      Membantu keterbacaan pengguna 40–60 tahun
                    </div>
                  </div>
                  <Switch />
                </div>
              </div>
            </Panel>
          </div>
        </TabPanel>

        <TabPanel id="akses" className="pt-6">
          <Panel>
            <div className="p-5">
              <SectionHeading
                title="Peran Akses"
                subtitle="Setiap permintaan API dan mutasi sinkronisasi diotorisasi di server"
                actions={
                  <Button size="small" onClick={() => showToast("Undangan terkirim", "Pengguna baru akan menerima surel")}>
                    Undang Pengguna
                  </Button>
                }
              />
            </div>
            <Table aria-label="Daftar peran" size="md">
              <TableHeader>
                <TableColumn isRowHeader>Peran</TableColumn>
                <TableColumn>Ruang lingkup</TableColumn>
                <TableColumn>Akses web luar kantor</TableColumn>
              </TableHeader>
              <TableBody>
                {ROLES.map((role) => (
                  <TableRow key={role.name} id={role.name}>
                    <TableCell>
                      <Chip variant="bold" color={role.color}>
                        {role.name}
                      </Chip>
                    </TableCell>
                    <TableCell>{role.scope}</TableCell>
                    <TableCell>
                      {role.name === "Viewer" ? (
                        <Chip variant="caption" color="lime">
                          baca-saja
                        </Chip>
                      ) : (
                        <span className="text-caption-1-regular text-text-tertiary">
                          menyusul setelah sinkronisasi stabil
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </TabPanel>

        <TabPanel id="data" className="pt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel padded>
              <SectionHeading title="Basis Data Lokal" />
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-caption-1-regular text-text-tertiary">Berkas</span>
                  <span className="font-mono text-body-medium text-text-primary">sqlite:inventory.db</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-caption-1-regular text-text-tertiary">Mode operasi</span>
                  <Chip variant="caption" color="yellow">
                    offline-first
                  </Chip>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-caption-1-regular text-text-tertiary">Versi aplikasi</span>
                  <span className="font-mono text-body-medium text-text-primary">0.1.0</span>
                </div>
              </div>
              <Divider className="my-4" />
              <div className="flex flex-wrap gap-2">
                <Button size="small" variant="secondary" onClick={() => showToast("Cadangan lokal dibuat")}>
                  Cadangkan Sekarang
                </Button>
                <Button size="small" variant="ghost" onClick={() => showToast("Verifikasi basis data selesai", "Tidak ada kerusakan terdeteksi")}>
                  Verifikasi Basis Data
                </Button>
              </div>
            </Panel>

            <Panel padded>
              <SectionHeading title="Keamanan" subtitle="Sebelum dipakai staf sungguhan" />
              <div className="mt-4 flex flex-col gap-3 text-body-regular text-text-secondary">
                <p>Kredensial disimpan di penyimpanan aman sistem operasi, bukan di SQLite biasa.</p>
                <p>Server tidak pernah mempercayai id pengguna, timestamp, atau versi yang dikirim perangkat.</p>
                <p>Penghapusan aset selalu soft delete agar riwayat audit tetap utuh.</p>
              </div>
            </Panel>
          </div>
        </TabPanel>
      </Tabs>
    </>
  );
}
