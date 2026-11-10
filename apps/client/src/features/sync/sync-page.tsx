import { RiAlertLine, RiCloudOffLine, RiRefreshLine, RiWifiLine } from "@remixicon/react";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import { MonoCode, PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import type { MutationStatus } from "@sisarpras/domain";
import { formatRelative } from "@/lib/format";
import { useApp } from "@/lib/store";

const STATUS_CHIP: Record<MutationStatus, ChipColor> = {
  pending: "yellow",
  sending: "blue",
  acked: "lime",
  conflict: "rose",
  failed: "rose",
};

export default function SyncPage() {
  const { outbox, online, syncNow, showToast } = useApp();
  const pending = outbox.filter((item) => item.status === "pending");
  const conflicts = outbox.filter((item) => item.status === "conflict");

  const stats: Stat[] = [
    {
      icon: online ? RiWifiLine : RiCloudOffLine,
      label: "Koneksi",
      value: online ? "Terhubung" : "Terputus",
      delta: online ? "siap mengirim" : "tidak ada koneksi",
      deltaColor: online ? "lime" : "neutral",
      tone: online ? "emerald" : "orange",
      caption: "Status sambungan ke server pusat",
    },
    {
      icon: RiRefreshLine,
      label: "Menunggu Dikirim",
      value: `${pending.length}`,
      delta: "aman di perangkat",
      deltaColor: "neutral",
      tone: "blue",
      caption: "Perubahan tersimpan di outbox lokal",
    },
    {
      icon: RiAlertLine,
      label: "Konflik",
      value: `${conflicts.length}`,
      delta: conflicts.length ? "perlu ditinjau" : "tidak ada",
      deltaColor: conflicts.length ? "rose" : "lime",
      tone: conflicts.length ? "pink" : "sky",
      caption: "Tidak diselesaikan otomatis (bukan last-write-wins)",
    },
  ];

  return (
    <>
      <PageHeading
        title="Sinkronisasi"
        subtitle="Antrean perubahan lokal dan status koneksi ke server pusat"
        actions={
          <Button
            variant={online ? "secondary" : "primary"}
            leadingIcon={online ? RiCloudOffLine : RiWifiLine}
          onClick={async () => {
            const result = await syncNow();
            showToast(result.ok ? "Sinkronisasi selesai" : "Sinkronisasi gagal", result.message);
          }}
          >
          {online ? "Sinkronkan sekarang" : "Coba sambungkan"}
          </Button>
        }
      />

      <StatCards stats={stats} />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel>
          <div className="flex items-start justify-between gap-4 p-5">
            <SectionHeading
              title="Antrean Perubahan (Outbox)"
              subtitle="Setiap mutasi punya mutation_id unik agar tidak dobel"
            />
            <Button
              size="small"
              leadingIcon={RiRefreshLine}
              onClick={async () => {
                const result = await syncNow();
                showToast(result.ok ? "Sinkronisasi selesai" : "Sinkronisasi gagal", result.message);
              }}
            >
              Sinkronkan
            </Button>
          </div>
          {outbox.length === 0 ? (
            <div className="px-5 py-10 text-center text-body-regular text-text-tertiary">
              Antrean kosong — semua perubahan sudah tersinkron ke server.
            </div>
          ) : (
            <Table aria-label="Antrean sinkronisasi" size="sm">
              <TableHeader>
                <TableColumn isRowHeader>Entitas</TableColumn>
                <TableColumn>Operasi</TableColumn>
                <TableColumn>Base Version</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Dibuat</TableColumn>
              </TableHeader>
              <TableBody>
                {outbox.map((item) => (
                  <TableRow key={item.id} id={item.id}>
                    <TableCell>
                      <span className="text-body-2-medium text-text-primary">{item.entityLabel}</span>
                      <div className="mt-0.5">
                        <MonoCode>{item.mutationId.slice(0, 12)}</MonoCode>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip variant="caption" color={item.operation === "create" ? "blue" : "purple"}>
                        {item.operation}
                      </Chip>
                    </TableCell>
                    <TableCell>{item.baseVersion ?? "—"}</TableCell>
                    <TableCell>
                      <Chip variant="bold" color={STATUS_CHIP[item.status]}>
                        {item.status}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-caption-1-regular text-text-tertiary">
                        {formatRelative(item.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel padded>
          <SectionHeading title="Konflik Terdeteksi" subtitle={`${conflicts.length} perubahan perlu ditinjau`} />
          {conflicts.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border-button-default p-5 text-center text-body-regular text-text-tertiary">
              Tidak ada konflik sinkronisasi.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {conflicts.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-button-default p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body-medium text-text-primary">{item.entityLabel}</div>
                    <div className="text-caption-1-regular text-text-tertiary">{item.lastError ?? "Perlu ditinjau sebelum dikirim ulang."}</div>
                  </div>
                  <Chip variant="bold" color={STATUS_CHIP[item.status]}>{item.status}</Chip>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
