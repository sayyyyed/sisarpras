import { useMemo } from "react";
import type { Asset } from "@sisarpras/domain";
import {
  RiAddLine,
  RiArchiveLine,
  RiCheckboxCircleLine,
  RiRefreshLine,
  RiToolsLine,
  RiWallet3Line,
} from "@remixicon/react";
import { useNavigate } from "react-router-dom";
import { RevenueChartCard, type RevenuePoint } from "@/components/application/dashboard/revenue-chart-card";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Divider } from "@/components/base/divider/divider";
import { Meter, type MeterTone } from "@/components/base/meter/meter";
import { PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import type { ActivityEntry } from "@/lib/activity";
import { formatNumber, formatRelative } from "@/lib/format";
import { activeAssets, percent, summarizeRooms } from "@/lib/inventory";
import { useApp } from "@/lib/store";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/**
 * Derived from real acquisition dates: this year vs last year, per month.
 * Deliberately no sample numbers — an empty database yields an empty chart.
 */
function buildAcquisitionTrend(assets: Asset[]): RevenuePoint[] {
  const thisYear = new Date().getFullYear();
  const rows: RevenuePoint[] = MONTHS.map((label) => ({ label, current: 0, previous: 0 }));

  for (const asset of assets) {
    if (!asset.acquisitionDate) continue;
    const date = new Date(asset.acquisitionDate);
    if (Number.isNaN(date.getTime())) continue;
    const month = date.getMonth();
    if (date.getFullYear() === thisYear) rows[month].current += asset.stockQuantity;
    else if (date.getFullYear() === thisYear - 1) rows[month].previous += asset.stockQuantity;
  }

  return rows;
}

const HEALTH_TONE: Record<string, MeterTone> = {
  good: "success",
  attention: "warning",
  critical: "error",
  storage: "accent",
};

const ACTIVITY_CHIP: Record<ActivityEntry["kind"], ChipColor> = {
  create: "lime",
  update: "blue",
  delete: "rose",
  move: "blue",
  condition: "yellow",
  procurement: "purple",
  stock: "cyan",
};

const ACTIVITY_LABEL: Record<ActivityEntry["kind"], string> = {
  create: "baru",
  update: "ubah",
  delete: "hapus",
  move: "pindah",
  condition: "kondisi",
  procurement: "pengadaan",
  stock: "stok",
};

export default function DashboardPage() {
  const { assets, activity, locations } = useApp();
  const navigate = useNavigate();

  const active = activeAssets(assets);
  const trend = useMemo(() => buildAcquisitionTrend(assets), [assets]);
  const trendTotal = trend.reduce((sum, row) => sum + row.current + row.previous, 0);
  const rooms = summarizeRooms(locations, assets).filter((room) => room.location.kind === "room");
  const total = active.reduce((sum, asset) => sum + asset.stockQuantity, 0);
  const available = active.reduce((sum, asset) => sum + Math.max(0, asset.stockQuantity - asset.roomStocks.reduce((used, room) => used + room.quantity, 0)), 0);
  const maintenance = active.filter((asset) => asset.status === "maintenance").reduce((sum, asset) => sum + asset.stockQuantity, 0);
  const disposed = assets.filter((asset) => asset.status === "disposed").length;
  const bookValue = active.reduce((sum, asset) => sum + (asset.acquisitionCostIdr ?? 0) * asset.stockQuantity, 0);
  const attention = rooms.filter((room) => room.health !== "good").length;

  const stats: Stat[] = [
    {
      icon: RiArchiveLine,
      label: "Total Aset",
      value: formatNumber(total),
      delta: `${formatNumber(trendTotal)} bertanggal perolehan`,
      deltaColor: "lime",
      tone: "blue",
      caption: "Unit barang di inventaris",
    },
    {
      icon: RiCheckboxCircleLine,
      label: "Tersedia",
      value: formatNumber(available),
      delta: `${percent(available, total)}% dari total`,
      deltaColor: "lime",
      tone: "emerald",
      caption: "Unit yang belum digunakan",
    },
    {
      icon: RiToolsLine,
      label: "Perlu Perbaikan",
      value: formatNumber(maintenance),
      delta: `${percent(maintenance, total)}% dari aset aktif`,
      deltaColor: "rose",
      tone: "orange",
      caption: "Status perbaikan berjalan",
    },
    {
      icon: RiWallet3Line,
      label: "Nilai Perolehan",
      value: `Rp ${formatNumber(Math.round(bookValue / 1_000_000))} jt`,
      delta: "tidak disusutkan",
      deltaColor: "neutral",
      tone: "purple",
      caption: "Akumulasi harga perolehan aset aktif",
    },
  ];

  return (
    <>
      <PageHeading
        title="Dashboard Inventaris"
        subtitle="Ringkasan kondisi aset dan ruangan dari basis data lokal perangkat ini"
        actions={
          <>
            <Button variant="secondary" leadingIcon={RiRefreshLine} onClick={() => navigate("/sync")}>
              Sinkronkan
            </Button>
            <Button leadingIcon={RiAddLine} onClick={() => navigate("/assets/new")}>
              Tambah Barang
            </Button>
          </>
        }
      />

      <StatCards stats={stats} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {trendTotal > 0 ? (
          <RevenueChartCard data={trend} title="Aset Ditambahkan per Bulan" />
        ) : (
          <Panel padded className="flex items-center justify-center">
            <div className="py-10 text-center">
              <div className="text-body-medium text-text-primary">Belum ada data perolehan</div>
              <div className="mt-1 text-caption-1-regular text-text-tertiary">
                Grafik ini dihitung dari tanggal perolehan aset yang kamu input.
              </div>
            </div>
          </Panel>
        )}

        <Panel padded>
          <SectionHeading
            title="Kondisi Aset per Ruangan"
            subtitle={`${attention} ruangan perlu perhatian`}
            actions={
              <Button size="small" variant="ghost" onClick={() => navigate("/rooms")}>
                Lihat semua
              </Button>
            }
          />
          <div className="mt-5 flex flex-col gap-5">
            {rooms.slice(0, 4).map((room) => {
              const goodPercent = percent(room.byCondition.good, room.totalAssets);
              return (
                <div key={room.location.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-body-medium text-text-primary">{room.location.name}</span>
                    <Chip
                      variant="caption"
                      color={room.health === "good" ? "lime" : room.health === "critical" ? "rose" : "yellow"}
                    >
                      {room.healthLabel}
                    </Chip>
                  </div>
                  <Meter
                    label={`${room.totalAssets} aset · ${goodPercent}% kondisi baik`}
                    showValueLabel
                    tone={HEALTH_TONE[room.health] ?? "accent"}
                    value={goodPercent}
                  />
                  <span className="text-caption-1-regular text-text-tertiary">
                    Baik {room.byCondition.good} · Cukup {room.byCondition.fair} · Rusak {room.byCondition.damaged}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel padded>
        <SectionHeading title="Aktivitas Terbaru" subtitle="Setiap perubahan dicatat untuk keperluan audit" />
        <div className="mt-4 flex flex-col">
          {activity.slice(0, 5).map((entry, index) => (
            <div key={entry.id}>
              {index > 0 && <Divider />}
              <div className="flex items-center gap-3 py-3">
                <Avatar size="sm" initials={entry.title.slice(0, 1).toUpperCase()} color="neutral" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body-medium text-text-primary">{entry.title}</div>
                  <div className="truncate text-caption-1-regular text-text-tertiary">{entry.detail}</div>
                </div>
                <Chip variant="caption" color={ACTIVITY_CHIP[entry.kind]}>
                  {ACTIVITY_LABEL[entry.kind]}
                </Chip>
                <span className="whitespace-nowrap text-caption-1-regular text-text-tertiary">
                  {formatRelative(entry.at)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <Divider />
        <div className="pt-3 text-caption-1-regular text-text-tertiary">
          {formatNumber(disposed)} aset sudah diarsipkan (disposal) — riwayatnya tetap tersimpan.
        </div>
      </Panel>
    </>
  );
}
